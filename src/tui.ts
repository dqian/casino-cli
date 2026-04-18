import type { AppState, RouletteState, BlackjackState, PaiGowState, CrapsState, BaccaratState, GameOptions, GameModule, AuthState } from "./types";
import { parseKey } from "./keybindings";
import { renderScreen, MENU_ITEMS } from "./renderer";
import * as t from "./theme";
import { createShoe } from "./shared/cards";
import { newBjRound } from "./blackjack/game";
import { newRound as newBaccaratRound } from "./baccarat/game";
import { handleRouletteKey } from "./roulette/handler";
import { handleBlackjackKey } from "./blackjack/handler";
import { handleBaccaratKey } from "./baccarat/handler";
import { renderRouletteScreen, renderHotkeyGrid as renderRouletteHotkeys } from "./roulette/renderer";
import { renderBlackjackScreen, renderBjHotkeyGrid } from "./blackjack/renderer";
import { handlePaiGowKey } from "./paigow/handler";
import { renderPaiGowScreen, renderPaiGowHotkeys } from "./paigow/renderer";
import { createPaiGowState, newRound as newPaiGowRound } from "./paigow/game";
import { handleCrapsKey } from "./craps/handler";
import { renderCrapsScreen, renderCrapsHotkeys } from "./craps/renderer";
import { createCrapsState } from "./craps/game";
import { renderBaccaratScreen, renderBaccaratHotkeys } from "./baccarat/renderer";
import { handleLoginKey, verifySession, syncBalanceToServer, serverResetBalance } from "./auth/handler";
import { loadAuth, clearAuth } from "./auth/store";
import { handleDepositKey, handleWithdrawKey, loadWallet } from "./wallet/handler";

// --- Game registry ---

export const GAMES: Record<string, GameModule> = {
  roulette: {
    handleKey: handleRouletteKey,
    render: renderRouletteScreen,
    renderHotkeys: (w, s) => renderRouletteHotkeys(w, s.roulette.phase),
  },
  blackjack: {
    handleKey: handleBlackjackKey,
    render: renderBlackjackScreen,
    renderHotkeys: renderBjHotkeyGrid,
  },
  paigow: {
    handleKey: handlePaiGowKey,
    render: renderPaiGowScreen,
    renderHotkeys: renderPaiGowHotkeys,
  },
  craps: {
    handleKey: handleCrapsKey,
    render: renderCrapsScreen,
    renderHotkeys: renderCrapsHotkeys,
  },
  baccarat: {
    handleKey: handleBaccaratKey,
    render: renderBaccaratScreen,
    renderHotkeys: renderBaccaratHotkeys,
  },
};

// --- State creation ---

function createDefaultOptions(): GameOptions {
  return {
    roulette: { defaultWheelMode: "ball", tableMax: null },
    blackjack: { numDecks: 2 },
    paigow: { defaultSort: "descending", coloredSuits: true },
    baccarat: { numDecks: 8 },
  };
}

function createRouletteState(options: GameOptions): RouletteState {
  return {
    phase: "betting",
    bets: [],
    betAmount: 10,
    cursorZone: "grid",
    cursorVR: 0,
    cursorVC: 0,
    result: null,
    spinFrame: 0,
    spinTarget: 0,
    spinHighlight: 0,
    spinHalfStep: false,
    winAmount: 0,
    spinHistory: [],
    showResultTimer: null,
    wheelMode: options.roulette.defaultWheelMode,
    ballRow: 0,
    ballCol: 0,
    ballY: 0,
    ballVY: 0,
    ballVX: 0,
    ballBouncing: false,
    serverWinnings: null,
    serverBalanceAfter: null,
  };
}

function randomCutCard(numDecks: number): number {
  const base = numDecks * 5;
  return base + Math.floor(Math.random() * (numDecks * 15 + 1));
}

function createBaccaratState(options: GameOptions): BaccaratState {
  const nd = options.baccarat.numDecks;
  return {
    phase: "betting",
    shoe: createShoe(nd),
    cutCard: randomCutCard(nd),
    numDecks: nd,
    playerCards: [],
    bankerCards: [],
    betAmount: 25,
    betType: "player",
    winAmount: 0,
    resultMessage: "",
    cardAnim: null,
  };
}

function createBlackjackState(options: GameOptions): BlackjackState {
  const nd = options.blackjack.numDecks;
  return {
    phase: "betting",
    shoe: createShoe(nd),
    cutCard: randomCutCard(nd),
    numDecks: nd,
    playerHands: [],
    activeHand: 0,
    dealerCards: [],
    dealerRevealed: false,
    betAmount: 25,
    winAmount: 0,
    cardAnim: null,
    showHint: false,
    showCount: false,
    runningCount: 0,
    insuranceBet: 0,
  };
}

function createAuthState(): AuthState {
  const saved = loadAuth();
  if (saved) {
    return {
      loggedIn: true,
      email: saved.email,
      token: saved.token,
      userId: saved.userId,
      phase: "email-input",
      emailInput: "",
      codeInput: "",
      error: "",
    };
  }
  return {
    loggedIn: false,
    email: "",
    token: "",
    userId: 0,
    phase: "email-input",
    emailInput: "",
    codeInput: "",
    error: "",
  };
}

function createState(): AppState {
  const options = createDefaultOptions();
  const auth = createAuthState();
  return {
    screen: "menu",
    balance: 1000,
    playBalance: 1000,
    // If we have a saved session, mark balance as not-yet-ready — startTui
    // will verify the session in the background and flip this true once the
    // authoritative figure is in hand. Unauthed users have no server balance
    // to wait for, so we flag as ready immediately.
    balanceReady: !auth.loggedIn,
    moneyMode: "play",
    menuCursor: 0,
    menuAnimFrame: 0,
    message: "",
    messageTimeout: null,
    roulette: createRouletteState(options),
    blackjack: createBlackjackState(options),
    paigow: createPaiGowState(options),
    craps: createCrapsState(),
    baccarat: createBaccaratState(options),
    options,
    optionsCursor: 0,
    auth,
    wallet: {
      depositPhase: "loading",
      walletAddress: "",
      usdcBalance: "0",
      copied: false,
      deposits: [],
      depositsLoaded: false,
      withdrawals: [],
      withdrawalsLoaded: false,
      pollTimer: null,
      withdrawPhase: "address-input",
      withdrawAddress: "",
      withdrawAmount: "",
      withdrawCode: "",
      txHash: "",
      error: "",
    },
  };
}

// --- TUI lifecycle ---

function cleanup(): void {
  process.stdout.write(t.mouseOff + t.showCursor + t.reset + t.altScreenOff);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

export function startTui(): void {
  if (!process.stdin.isTTY) {
    console.error("Not a TTY.");
    process.exit(1);
  }

  const state = createState();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");
  process.stdout.write(t.altScreenOn + t.hideCursor);

  // Single render entry point. Also mirrors state.balance into state.playBalance
  // while we're in play mode, so toggling modes later can restore the last-known
  // play balance instead of resetting it. Every balance mutation in the app is
  // followed by a render() call (sync or async), so this hook keeps the cache
  // consistent without touching each call site individually.
  const render = () => {
    if (state.moneyMode === "play") {
      state.playBalance = state.balance;
    }
    renderScreen(state);
  };
  render();

  // If we have a saved session, verify it in the background
  if (state.auth.loggedIn) {
    verifySession(state).then(() => {
      // Preload USDC balance so real money balance is instantly available on mode switch
      import("./auth/client").then(({ getWalletBalance }) => {
        getWalletBalance(state.auth.token).then((res) => {
          if (res.usdc_balance) {
            state.wallet.usdcBalance = res.usdc_balance;
            render();
          }
        }).catch(() => {});
      });
      render();
    });
  }

  // Animate menu (shimmer + cursor)
  let lastRenderedFrame = -1;
  setInterval(() => {
    if (state.screen === "menu") {
      state.menuAnimFrame++;
      const shimmerCycle = 250;
      const shimmerSweep = 10;
      const shimmerFrame = state.menuAnimFrame % shimmerCycle;
      const cursorIdx = Math.floor(state.menuAnimFrame / 6);
      const visualKey = shimmerFrame < shimmerSweep ? state.menuAnimFrame : cursorIdx;
      if (visualKey !== lastRenderedFrame) {
        lastRenderedFrame = visualKey;
        render();
      }
    }
  }, 25);

  process.stdout.on("resize", render);

  const exit = () => {
    cleanup();
    process.exit(0);
  };

  process.on("SIGINT", exit);
  process.on("SIGTERM", exit);

  process.stdin.on("data", (data: string | Buffer) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    const key = parseKey(buf);

    if (key.ctrl && key.name === "c") {
      exit();
      return;
    }

    const prevBalance = state.balance;

    // Game dispatch via registry
    const game = GAMES[state.screen];
    if (game) {
      game.handleKey(state, key, render);
    } else if (state.screen === "menu") {
      handleMenuKey(state, key, exit, render);
    } else if (state.screen === "options") {
      handleOptionsKey(state, key);
    } else if (state.screen === "login") {
      handleLoginKey(state, key, render);
    } else if (state.screen === "deposit") {
      handleDepositKey(state, key, render);
    } else if (state.screen === "withdraw") {
      handleWithdrawKey(state, key, render);
    }

    // Sync balance to server whenever it changes — except for screens where the
    // server is already authoritative (roulette settles on the backend, so any
    // local balance change there is either an optimistic bet placement or a
    // server-applied result we'd just be echoing back).
    if (state.balance !== prevBalance && state.screen !== "roulette") {
      syncBalanceToServer(state);
    }

    render();
  });
}

// --- Menu ---

function handleMenuKey(state: AppState, key: ReturnType<typeof parseKey>, exit: () => void, render: () => void): void {
  switch (key.name) {
    case "up":
      state.menuCursor = Math.max(0, state.menuCursor - 1);
      state.message = "";
      break;
    case "down":
      state.menuCursor = Math.min(MENU_ITEMS.length - 1, state.menuCursor + 1);
      state.message = "";
      break;
    case "return": {
      const item = MENU_ITEMS[state.menuCursor]!;
      if (item.screen && !state.balanceReady) {
        // Refuse to enter a game until we have the authoritative server
        // balance — otherwise the user could place bets against the stale
        // local default ($1000), and when verifySession later resolves
        // it would wholesale overwrite state.balance and silently erase
        // those wagers.
        state.message = "Loading balance…";
        break;
      }
      if (item.screen && state.moneyMode === "real") {
        state.message = "Real money games coming soon!";
      } else if (item.screen) {
        state.screen = item.screen;
        if (item.screen === "roulette") {
          state.roulette = createRouletteState(state.options);
        } else if (item.screen === "blackjack") {
          const optDecks = state.options.blackjack.numDecks;
          if (state.blackjack.numDecks !== optDecks) {
            state.blackjack.shoe = createShoe(optDecks);
            state.blackjack.numDecks = optDecks;
            state.blackjack.cutCard = randomCutCard(optDecks);
            state.blackjack.runningCount = 0;
          }
          newBjRound(state);
        } else if (item.screen === "paigow") {
          state.paigow.sortMode = state.options.paigow.defaultSort;
          state.paigow.coloredSuits = state.options.paigow.coloredSuits;
          newPaiGowRound(state);
        } else if (item.screen === "craps") {
          state.craps = createCrapsState();
        } else if (item.screen === "baccarat") {
          const optDecks = state.options.baccarat.numDecks;
          if (state.baccarat.numDecks !== optDecks) {
            state.baccarat.shoe = createShoe(optDecks);
            state.baccarat.numDecks = optDecks;
            state.baccarat.cutCard = randomCutCard(optDecks);
          }
          newBaccaratRound(state);
        }
        state.message = "";
      } else {
        state.message = `${item.name} is coming soon!`;
      }
      break;
    }
    case "s":
      if (state.auth.loggedIn) {
        clearAuth();
        state.auth.loggedIn = false;
        state.auth.email = "";
        state.auth.token = "";
        state.auth.userId = 0;
        state.balance = 1000;
        state.playBalance = 1000;
        state.message = "Logged out";
      } else {
        state.screen = "login";
        state.auth.phase = "email-input";
        state.auth.emailInput = "";
        state.auth.codeInput = "";
        state.auth.error = "";
        state.message = "";
      }
      break;
    case "o":
      state.screen = "options";
      state.optionsCursor = 0;
      state.message = "";
      break;
    case "m":
      if (!state.balanceReady) {
        // Don't let the user juggle modes while we're still waiting on the
        // server — the stale default would leak into the cache.
        break;
      }
      if (state.moneyMode === "play") {
        // Stash current play balance before we overwrite state.balance with
        // the real-money figure, so the reverse toggle can restore it. The
        // render hook normally keeps playBalance in sync, but we capture
        // explicitly here to be resilient to any in-flight async updates.
        state.playBalance = state.balance;
        state.moneyMode = "real";
        state.balance = Number(BigInt(state.wallet.usdcBalance || "0")) / 1_000_000;
        state.message = "Switched to Real Money mode";
        // Refresh in background
        if (state.auth.loggedIn) {
          import("./auth/client").then(({ getWalletBalance }) => {
            getWalletBalance(state.auth.token).then((res) => {
              if (res.usdc_balance) {
                state.wallet.usdcBalance = res.usdc_balance;
                if (state.moneyMode === "real") {
                  state.balance = Number(BigInt(res.usdc_balance)) / 1_000_000;
                }
                render();
              }
            }).catch(() => {});
          });
        }
      } else {
        state.moneyMode = "play";
        // Restore last-known play balance (cached by the render hook while
        // we were in play mode). Do NOT hardcode to 1000 — that wipes any
        // progress from prior rounds.
        state.balance = state.playBalance;
        state.message = "Switched to Play Money mode";
        // Refresh from server in the background so the cache stays fresh
        // against any changes made elsewhere (e.g. another session).
        //
        // IMPORTANT: between firing the request and its resolution the user
        // can navigate into a game and place bets — if we blindly
        // overwrote state.balance on resolution we'd erase those wagers.
        // Snapshot the local balance at request time and only apply the
        // server's value if the user has stayed on the menu AND the local
        // balance hasn't been mutated by game logic in the meantime.
        if (state.auth.loggedIn) {
          const snapshotBalance = state.balance;
          import("./auth/client").then(({ getMe }) => {
            getMe(state.auth.token).then((res) => {
              if (res.error || typeof res.balance !== "number") return;
              if (state.moneyMode !== "play") return;
              if (state.screen !== "menu") return;
              if (state.balance !== snapshotBalance) return;
              state.balance = res.balance / 100;
              state.playBalance = state.balance;
              render();
            }).catch(() => {});
          });
        }
      }
      break;
    case "r":
      if (state.moneyMode === "play") {
        if (state.auth.loggedIn) {
          serverResetBalance(state, render);
        } else {
          state.balance = 1000;
          state.message = "Balance reset to $1,000";
        }
      }
      break;
    case "d":
      if (state.moneyMode === "real") {
        if (!state.auth.loggedIn) {
          state.message = "Sign in to deposit";
        } else {
          state.screen = "deposit";
          loadWallet(state, render);
        }
      }
      break;
    case "w":
      if (state.moneyMode === "real") {
        if (!state.auth.loggedIn) {
          state.message = "Sign in to withdraw";
        } else {
          state.screen = "withdraw";
          state.wallet.withdrawPhase = "address-input";
          state.wallet.withdrawAddress = "";
          state.wallet.withdrawAmount = "";
          state.wallet.withdrawCode = "";
          state.wallet.txHash = "";
          state.wallet.error = "";
          state.wallet.withdrawalsLoaded = false;
          state.wallet.withdrawals = [];
          // Refresh USDC balance and withdrawal history
          import("./auth/client").then(({ getWalletBalance, getWalletWithdrawals }) => {
            getWalletBalance(state.auth.token).then((res) => {
              if (res.usdc_balance) {
                state.wallet.usdcBalance = res.usdc_balance;
                render();
              }
            }).catch(() => {});

            getWalletWithdrawals(state.auth.token).then((res) => {
              state.wallet.withdrawals = (res.transfers || []).map((t) => ({
                to: t.to,
                amount: t.amount,
                tx_hash: t.tx_hash,
              }));
              state.wallet.withdrawalsLoaded = true;
              render();
            }).catch(() => {
              state.wallet.withdrawalsLoaded = true;
              render();
            });
          });
        }
      }
      break;
    case "q":
      syncBalanceToServer(state);
      exit();
      break;
  }
}

// --- Options ---

const WHEEL_MODES = ["ball", "arrow"] as const;
const TABLE_MAX_OPTIONS: (number | null)[] = [null, 100, 500, 1000, 5000, 10000];
const DECK_OPTIONS = [1, 2, 4, 6, 8];
const BACCARAT_DECK_OPTIONS = [4, 6, 8];

function handleOptionsKey(state: AppState, key: ReturnType<typeof parseKey>): void {
  const opts = state.options;
  const total = 6;

  switch (key.name) {
    case "up":
      state.optionsCursor = Math.max(0, state.optionsCursor - 1);
      break;
    case "down":
      state.optionsCursor = Math.min(total - 1, state.optionsCursor + 1);
      break;
    case "left":
    case "right": {
      const dir = key.name === "right" ? 1 : -1;
      switch (state.optionsCursor) {
        case 0: {
          const idx = WHEEL_MODES.indexOf(opts.roulette.defaultWheelMode);
          const next = (idx + dir + WHEEL_MODES.length) % WHEEL_MODES.length;
          opts.roulette.defaultWheelMode = WHEEL_MODES[next]!;
          break;
        }
        case 1: {
          const idx = TABLE_MAX_OPTIONS.indexOf(opts.roulette.tableMax);
          const next = Math.max(0, Math.min(TABLE_MAX_OPTIONS.length - 1, idx + dir));
          opts.roulette.tableMax = TABLE_MAX_OPTIONS[next]!;
          break;
        }
        case 2: {
          const idx = DECK_OPTIONS.indexOf(opts.blackjack.numDecks);
          const next = Math.max(0, Math.min(DECK_OPTIONS.length - 1, idx + dir));
          opts.blackjack.numDecks = DECK_OPTIONS[next]!;
          break;
        }
        case 3: {
          opts.paigow.defaultSort = opts.paigow.defaultSort === "ascending" ? "descending" : "ascending";
          break;
        }
        case 4: {
          opts.paigow.coloredSuits = !opts.paigow.coloredSuits;
          break;
        }
        case 5: {
          const idx = BACCARAT_DECK_OPTIONS.indexOf(opts.baccarat.numDecks);
          const next = Math.max(0, Math.min(BACCARAT_DECK_OPTIONS.length - 1, idx + dir));
          opts.baccarat.numDecks = BACCARAT_DECK_OPTIONS[next]!;
          break;
        }
      }
      break;
    }
    case "q":
    case "escape":
      state.screen = "menu";
      state.message = "";
      break;
  }
}
