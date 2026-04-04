import type { AppState } from "../types";
import type { KeyEvent } from "../keybindings";
import { placeBet, removeBet, clearBets, roll, newRound, BET_POSITIONS } from "./game";

const CHIP_SIZES = [1, 5, 10, 25, 50, 100, 500];

export function handleCrapsKey(state: AppState, key: KeyEvent, render: () => void): void {
  const cs = state.craps;

  // Rolling phase: Enter skips animation
  if (cs.phase === "rolling") {
    if (key.name === "return") {
      cs.skipAnim = true;
    }
    return;
  }

  // Result phase
  if (cs.phase === "result") {
    if (key.name === "return") {
      newRound(state);
    } else if (key.name === "q" || key.name === "escape") {
      state.screen = "menu";
      state.message = "";
    }
    return;
  }

  // Betting phase
  switch (key.name) {
    case "up":
      navigateUp(cs);
      state.message = "";
      break;
    case "down":
      navigateDown(cs);
      state.message = "";
      break;
    case "left":
      navigateLeft(cs);
      state.message = "";
      break;
    case "right":
      navigateRight(cs);
      state.message = "";
      break;
    case " ":
      placeBet(state);
      break;
    case "x":
      removeBet(state);
      break;
    case "return":
      roll(state, render);
      break;
    case "c":
      clearBets(state);
      break;
    case "+":
    case "=": {
      const idx = CHIP_SIZES.indexOf(cs.betAmount);
      if (idx >= 0 && idx < CHIP_SIZES.length - 1) {
        cs.betAmount = CHIP_SIZES[idx + 1]!;
      }
      break;
    }
    case "-":
    case "_": {
      const idx = CHIP_SIZES.indexOf(cs.betAmount);
      if (idx > 0) {
        cs.betAmount = CHIP_SIZES[idx - 1]!;
      }
      break;
    }
    case "q":
    case "escape": {
      // Refund active bets and return to menu
      const total = cs.bets.reduce((s, b) => s + b.amount, 0);
      state.balance += total;
      cs.bets = [];
      state.screen = "menu";
      state.message = "";
      break;
    }
  }
}

// Table layout for grid navigation:
// Row 0: [0] Pass Line, [1] Don't Pass, [4] Field
// Row 1: [2] Come, [3] Don't Come
// Row 2: [5] Place 4, [6] Place 5, [7] Place 6
// Row 3: [8] Place 8, [9] Place 9, [10] Place 10

interface GridPos { row: number; col: number }

const GRID_LAYOUT: number[][] = [
  [0, 1, 4],     // Pass, Don't Pass, Field
  [2, 3],        // Come, Don't Come
  [5, 6, 7],     // Place 4, 5, 6
  [8, 9, 10],    // Place 8, 9, 10
];

function posToGrid(pos: number): GridPos {
  for (let r = 0; r < GRID_LAYOUT.length; r++) {
    const row = GRID_LAYOUT[r]!;
    const c = row.indexOf(pos);
    if (c !== -1) return { row: r, col: c };
  }
  return { row: 0, col: 0 };
}

function gridToPos(grid: GridPos): number {
  const row = GRID_LAYOUT[grid.row];
  if (!row) return 0;
  const col = Math.min(grid.col, row.length - 1);
  return row[col] ?? 0;
}

function navigateUp(cs: AppState["craps"]): void {
  const grid = posToGrid(cs.cursorPos);
  if (grid.row > 0) {
    grid.row--;
    cs.cursorPos = gridToPos(grid);
  }
}

function navigateDown(cs: AppState["craps"]): void {
  const grid = posToGrid(cs.cursorPos);
  if (grid.row < GRID_LAYOUT.length - 1) {
    grid.row++;
    cs.cursorPos = gridToPos(grid);
  }
}

function navigateLeft(cs: AppState["craps"]): void {
  const grid = posToGrid(cs.cursorPos);
  if (grid.col > 0) {
    grid.col--;
    cs.cursorPos = gridToPos(grid);
  }
}

function navigateRight(cs: AppState["craps"]): void {
  const grid = posToGrid(cs.cursorPos);
  const row = GRID_LAYOUT[grid.row];
  if (row && grid.col < row.length - 1) {
    grid.col++;
    cs.cursorPos = gridToPos(grid);
  }
}
