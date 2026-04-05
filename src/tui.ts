import type { AppState, RouletteState, BlackjackState, GameOptions, GameModule } from "./types";
import { parseKey } from "./keybindings";
import { renderScreen, MENU_ITEMS } from "./renderer";
import * as t from "./theme";
import { createShoe } from "./shared/cards";
import { newBjRound } from "./blackjack/game";
import { handleRouletteKey } from "./roulette/handler";
import { handleBlackjackKey } from "./blackjack/handler";
import { renderRouletteScreen, renderHotkeyGrid as renderRouletteHotkeys } from "./roulette/renderer";
import { renderBlackjackScreen, renderBjHotkeyGrid } from "./blackjack/renderer";

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
};

// --- State creation ---

function createDefaultOptions(): GameOptions {
  return {
    roulette: { defaultWheelMode: "ball", tableMax: null },
    blackjack: { numDecks: 2 },
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
  };
}

function randomCutCard(numDecks: number): number {
  const base = numDecks * 5;
  return base + Math.floor(Math.random() * (numDecks * 15 + 1));
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

function createState(): AppState {
  const options = createDefaultOptions();
  return {
    screen: "menu",
    balance: 1000,
    moneyMode: "play",
    menuCursor: 0,
    menuAnimFrame: 0,
    message: "",
    messageTimeout: null,
    roulette: createRouletteState(options),
    blackjack: createBlackjackState(options),
    options,
    optionsCursor: 0,
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

  const render = () => renderScreen(state);
  render();

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

    // Game dispatch via registry
    const game = GAMES[state.screen];
    if (game) {
      game.handleKey(state, key, render);
    } else if (state.screen === "menu") {
      handleMenuKey(state, key, exit);
    } else if (state.screen === "options") {
      handleOptionsKey(state, key);
    }

    render();
  });
}

// --- Menu ---

function handleMenuKey(state: AppState, key: ReturnType<typeof parseKey>, exit: () => void): void {
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
      if (item.screen) {
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
        }
        state.message = "";
      } else {
        state.message = `${item.name} is coming soon!`;
      }
      break;
    }
    case "o":
      state.screen = "options";
      state.optionsCursor = 0;
      state.message = "";
      break;
    case "m":
      if (state.moneyMode === "play") {
        state.moneyMode = "real";
        state.balance = 0;
        state.message = "Switched to Real Money mode";
      } else {
        state.moneyMode = "play";
        state.balance = 1000;
        state.message = "Switched to Play Money mode";
      }
      break;
    case "r":
      if (state.moneyMode === "play") {
        state.balance = 1000;
        state.message = "Balance reset to $1,000";
      }
      break;
    case "d":
      if (state.moneyMode === "real") {
        state.message = "Deposits coming soon!";
      }
      break;
    case "q":
      exit();
      break;
  }
}

// --- Options ---

const WHEEL_MODES = ["ball", "arrow"] as const;
const TABLE_MAX_OPTIONS: (number | null)[] = [null, 100, 500, 1000, 5000, 10000];
const DECK_OPTIONS = [1, 2, 4, 6, 8];

function handleOptionsKey(state: AppState, key: ReturnType<typeof parseKey>): void {
  const opts = state.options;
  const total = 3;

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
