import type { AppState } from "../types";
import type { KeyEvent } from "../keybindings";
import { placeBet, placeOddsBet, removeBet, clearBets, roll, newRound, BET_POSITIONS } from "./game";

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
    case "o":
      placeOddsBet(state);
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

// Grid navigation layout matching the visual table:
//
// BET_POSITIONS indices:
// 0-5:   Place 4, 5, 6, 8, 9, 10 (row 0)
// 6:     Field (row 1, full width)
// 7-8:   Don't Come, Come (row 2)
// 9-13:  Don't Pass, Hard 4, 6, 8, 10 (row 3)
// 14-19: Pass Line, Any 7, Any Craps, Yo, Horn, C&E (row 4)

const GRID: number[][] = [
  [0, 1, 2, 3, 4, 5],          // Place 4, 5, 6, 8, 9, 10
  [6],                           // Field (full width)
  [7, 8],                        // Don't Come, Come
  [9, 10, 11, 12, 13],          // Don't Pass, Hard 4, 6, 8, 10
  [14, 15, 16, 17, 18, 19],     // Pass Line, Any 7, Any Craps, Yo, Horn, C&E
];

interface GridPos { row: number; col: number }

function posToGrid(pos: number): GridPos {
  for (let r = 0; r < GRID.length; r++) {
    const row = GRID[r]!;
    const c = row.indexOf(pos);
    if (c !== -1) return { row: r, col: c };
  }
  return { row: 4, col: 0 }; // Default to Pass Line
}

function gridToPos(grid: GridPos): number {
  const row = GRID[grid.row];
  if (!row) return 14; // Pass Line
  const col = Math.min(grid.col, row.length - 1);
  return row[col] ?? 14;
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
  if (grid.row < GRID.length - 1) {
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
  const row = GRID[grid.row];
  if (row && grid.col < row.length - 1) {
    grid.col++;
    cs.cursorPos = gridToPos(grid);
  }
}
