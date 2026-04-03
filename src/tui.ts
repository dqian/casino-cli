import type { AppState, RouletteState } from "./types";
import { parseKey } from "./keybindings";
import { renderScreen, MENU_ITEMS } from "./renderer";
import * as t from "./theme";
import { placeBet, clearBets, spin, newRound, totalBets } from "./roulette/game";
import { BOARD_ROWS, BOARD_COLS } from "./roulette/board";

const CHIP_SIZES = [1, 5, 10, 25, 50, 100, 500];

function createRouletteState(): RouletteState {
  return {
    phase: "betting",
    bets: [],
    betAmount: 10,
    cursorRow: 2,
    cursorCol: 5,
    result: null,
    spinFrame: 0,
    spinTarget: 0,
    spinHighlight: 0,
    winAmount: 0,
    showResultTimer: null,
  };
}

function createState(): AppState {
  return {
    screen: "menu",
    balance: 1000,
    menuCursor: 0,
    message: "",
    messageTimeout: null,
    roulette: createRouletteState(),
  };
}

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
  // Alt screen + hide cursor + disable mouse scroll passthrough
  process.stdout.write(t.altScreenOn + t.hideCursor);

  const render = () => renderScreen(state);
  render();

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

    // Ctrl+C always exits
    if (key.ctrl && key.name === "c") {
      exit();
      return;
    }

    if (state.screen === "menu") {
      handleMenuKey(state, key, exit);
    } else if (state.screen === "roulette") {
      handleRouletteKey(state, key, render);
    }

    render();
  });
}

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
          state.roulette = createRouletteState();
        }
        state.message = "";
      } else {
        state.message = `${item.name} is coming soon!`;
      }
      break;
    }
    case "q":
      exit();
      break;
  }
}

function handleRouletteKey(state: AppState, key: ReturnType<typeof parseKey>, render: () => void): void {
  const rs = state.roulette;

  // During spinning, ignore all input
  if (rs.phase === "spinning") return;

  // Result phase: Enter for new round, Esc to go back
  if (rs.phase === "result") {
    if (key.name === "return") {
      newRound(state);
    } else if (key.name === "escape") {
      state.screen = "menu";
      state.message = "";
    }
    return;
  }

  // Betting phase
  switch (key.name) {
    case "up":
      navigateBoard(rs, -1, 0);
      state.message = "";
      break;
    case "down":
      navigateBoard(rs, 1, 0);
      state.message = "";
      break;
    case "left":
      navigateBoard(rs, 0, -1);
      state.message = "";
      break;
    case "right":
      navigateBoard(rs, 0, 1);
      state.message = "";
      break;
    case " ":
      placeBet(state);
      break;
    case "return":
      spin(state, render);
      break;
    case "c":
      clearBets(state);
      break;
    case "+":
    case "=": {
      const idx = CHIP_SIZES.indexOf(rs.betAmount);
      if (idx >= 0 && idx < CHIP_SIZES.length - 1) {
        rs.betAmount = CHIP_SIZES[idx + 1]!;
      }
      break;
    }
    case "-":
    case "_": {
      const idx = CHIP_SIZES.indexOf(rs.betAmount);
      if (idx > 0) {
        rs.betAmount = CHIP_SIZES[idx - 1]!;
      }
      break;
    }
    case "escape":
      // Return bets to balance before leaving
      const betTotal = totalBets(state);
      if (betTotal > 0) {
        clearBets(state);
      }
      state.screen = "menu";
      state.message = "";
      break;
  }
}

function navigateBoard(rs: RouletteState, dRow: number, dCol: number): void {
  let newRow = rs.cursorRow + dRow;
  let newCol = rs.cursorCol + dCol;

  // Clamp rows
  newRow = Math.max(0, Math.min(BOARD_ROWS - 1, newRow));

  // Handle column clamping based on row
  if (newRow === 0) {
    // Zero row - single cell, col doesn't matter
    newCol = 0;
  } else if (newRow >= 1 && newRow <= 3) {
    // Number grid: 12 columns
    newCol = Math.max(0, Math.min(11, newCol));
  } else if (newRow === 4) {
    // Dozens: 3 groups of 4 cols
    newCol = Math.max(0, Math.min(11, newCol));
  } else if (newRow === 5) {
    // Outside bets: 6 groups of 2 cols
    newCol = Math.max(0, Math.min(11, newCol));
  } else if (newRow === 6) {
    // Column bets: 3 groups of 4 cols
    newCol = Math.max(0, Math.min(11, newCol));
  }

  // When moving from zero row to number grid, map to center
  if (rs.cursorRow === 0 && newRow >= 1) {
    newCol = rs.cursorCol || 0;
    newCol = Math.max(0, Math.min(11, newCol));
  }

  // When moving to zero row
  if (newRow === 0 && rs.cursorRow !== 0) {
    // Keep the col for when we move back
    newCol = rs.cursorCol;
  }

  rs.cursorRow = newRow;
  rs.cursorCol = newCol;
}
