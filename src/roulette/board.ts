// European roulette board layout and data
import type { BetType } from "../types";

// Number colors: 0 = green, red numbers, black numbers
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function numberColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// Board cell types for navigation
export type BoardCell =
  | { kind: "number"; number: number }
  | { kind: "zero" }
  | { kind: "dozen"; which: 1 | 2 | 3 }
  | { kind: "column"; which: 1 | 2 | 3 }
  | { kind: "low" }
  | { kind: "high" }
  | { kind: "even" }
  | { kind: "odd" }
  | { kind: "red" }
  | { kind: "black" };

export const BOARD_ROWS = 7;
export const BOARD_COLS = 12;

// Number at board position (rows 1-3, cols 0-11)
// row 1 = top (3,6,9,...), row 2 = mid (2,5,8,...), row 3 = bottom (1,4,7,...)
export function numberAt(row: number, col: number): number {
  const baseCol = col * 3;
  if (row === 1) return baseCol + 3;
  if (row === 2) return baseCol + 2;
  if (row === 3) return baseCol + 1;
  return -1;
}

export function cellAt(row: number, col: number): BoardCell | null {
  if (row === 0) return { kind: "zero" };
  if (row >= 1 && row <= 3 && col >= 0 && col < 12) {
    return { kind: "number", number: numberAt(row, col) };
  }
  if (row === 4) {
    if (col >= 0 && col < 4) return { kind: "dozen", which: 1 };
    if (col >= 4 && col < 8) return { kind: "dozen", which: 2 };
    if (col >= 8 && col < 12) return { kind: "dozen", which: 3 };
  }
  if (row === 5) {
    if (col >= 0 && col < 2) return { kind: "low" };
    if (col >= 2 && col < 4) return { kind: "even" };
    if (col >= 4 && col < 6) return { kind: "red" };
    if (col >= 6 && col < 8) return { kind: "black" };
    if (col >= 8 && col < 10) return { kind: "odd" };
    if (col >= 10 && col < 12) return { kind: "high" };
  }
  if (row === 6) {
    if (col >= 0 && col < 4) return { kind: "column", which: 1 };
    if (col >= 4 && col < 8) return { kind: "column", which: 2 };
    if (col >= 8 && col < 12) return { kind: "column", which: 3 };
  }
  return null;
}

export function cellLabel(cell: BoardCell): string {
  switch (cell.kind) {
    case "zero": return "0";
    case "number": return String(cell.number);
    case "dozen":
      if (cell.which === 1) return "1st 12";
      if (cell.which === 2) return "2nd 12";
      return "3rd 12";
    case "column": return `Col ${cell.which}`;
    case "low": return "1-18";
    case "high": return "19-36";
    case "even": return "EVEN";
    case "odd": return "ODD";
    case "red": return "RED";
    case "black": return "BLK";
  }
}

// Wheel order (European single-zero)
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Check if a number wins for a given bet type
export function isWinner(num: number, bet: BetType): boolean {
  switch (bet.kind) {
    case "straight": return num === bet.number;
    case "red": return num !== 0 && RED_NUMBERS.has(num);
    case "black": return num !== 0 && !RED_NUMBERS.has(num);
    case "odd": return num !== 0 && num % 2 === 1;
    case "even": return num !== 0 && num % 2 === 0;
    case "low": return num >= 1 && num <= 18;
    case "high": return num >= 19 && num <= 36;
    case "dozen":
      if (bet.which === 1) return num >= 1 && num <= 12;
      if (bet.which === 2) return num >= 13 && num <= 24;
      return num >= 25 && num <= 36;
    case "column":
      if (bet.which === 1) return num !== 0 && num % 3 === 1;
      if (bet.which === 2) return num !== 0 && num % 3 === 2;
      return num !== 0 && num % 3 === 0;
  }
}

// Payout multiplier (not including original bet)
export function payout(bet: BetType): number {
  switch (bet.kind) {
    case "straight": return 35;
    case "red": case "black": case "odd": case "even": case "low": case "high": return 1;
    case "dozen": case "column": return 2;
  }
}

// Check if a board cell matches a bet type
export function sameBet(cell: BoardCell, bet: BetType): boolean {
  if (cell.kind === "number" && bet.kind === "straight") return cell.number === bet.number;
  if (cell.kind === "zero" && bet.kind === "straight") return bet.number === 0;
  if (cell.kind === "dozen" && bet.kind === "dozen") return cell.which === bet.which;
  if (cell.kind === "column" && bet.kind === "column") return cell.which === bet.which;
  if (cell.kind === "red" && bet.kind === "red") return true;
  if (cell.kind === "black" && bet.kind === "black") return true;
  if (cell.kind === "odd" && bet.kind === "odd") return true;
  if (cell.kind === "even" && bet.kind === "even") return true;
  if (cell.kind === "low" && bet.kind === "low") return true;
  if (cell.kind === "high" && bet.kind === "high") return true;
  return false;
}

// Convert board cell to bet type
export function cellToBet(cell: BoardCell): BetType {
  switch (cell.kind) {
    case "zero": return { kind: "straight", number: 0 };
    case "number": return { kind: "straight", number: cell.number };
    case "dozen": return { kind: "dozen", which: cell.which };
    case "column": return { kind: "column", which: cell.which };
    case "low": return { kind: "low" };
    case "high": return { kind: "high" };
    case "even": return { kind: "even" };
    case "odd": return { kind: "odd" };
    case "red": return { kind: "red" };
    case "black": return { kind: "black" };
  }
}
