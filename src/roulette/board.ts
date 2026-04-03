// European roulette board — vertical layout
// 0 at top, numbers flow down in 3 columns
// Row 1: [3, 2, 1], Row 2: [6, 5, 4], ... Row 12: [36, 35, 34]

import type { BetType } from "../types";

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function numberColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// Wheel order (European single-zero)
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// --- Vertical board layout ---

export const NUM_TABLE_ROWS = 12;
export const NUM_TABLE_COLS = 3;

// Virtual grid for the number area:
// Even vr, even vc = number cell
// Odd vr, even vc = horizontal border (split between rows in same col)
// Even vr, odd vc = vertical border (split between cols in same row)
// Odd vr, odd vc = corner (4 numbers)
export const VGRID_ROWS = NUM_TABLE_ROWS * 2 - 1; // 23 (0..22)
export const VGRID_COLS = NUM_TABLE_COLS * 2 - 1;  // 5  (0..4)

// Number at table position. tableRow: 1..12, tableCol: 0..2
// Col 0 (left) = lowest of triple, col 2 (right) = highest
export function numberAt(tableRow: number, tableCol: number): number {
  return (tableRow - 1) * 3 + (tableCol + 1);
}

// Find the table position of a number (1-36)
export function tablePos(num: number): { tableRow: number; tableCol: number } | null {
  if (num < 1 || num > 36) return null;
  const tableRow = Math.ceil(num / 3);
  const tableCol = (num - 1) % 3;  // 0->0, 1->1, 2->2
  return { tableRow, tableCol };
}

// --- Grid position types ---

export type GridPosition =
  | { kind: "cell"; tableRow: number; tableCol: number }
  | { kind: "hborder"; tableRow: number; tableCol: number }   // border below tableRow at tableCol
  | { kind: "vborder"; tableRow: number; tableCol: number }   // border right of tableCol at tableRow
  | { kind: "corner"; tableRow: number; tableCol: number }    // corner below-right of (tableRow, tableCol)
  | { kind: "street"; tableRow: number }                       // left edge at a row
  | { kind: "sixline"; tableRow: number };                     // left edge between rows

// Convert virtual grid coords to grid position
// vc can be -1 or VGRID_COLS for edge positions (street/sixline)
export function virtualToGridPos(vr: number, vc: number): GridPosition {
  // vr=-1: zero-to-row-1 border (splits between 0 and first row numbers)
  if (vr === -1) {
    const tableCol = Math.floor(vc / 2);
    return { kind: "hborder", tableRow: 0, tableCol };
  }

  // vc=-1: left edge (street / sixline)
  if (vc < 0) {
    const evenR = vr % 2 === 0;
    const tableRow = Math.floor(vr / 2) + 1;
    if (evenR) return { kind: "street", tableRow };
    return { kind: "sixline", tableRow };
  }

  const evenR = vr % 2 === 0;
  const evenC = vc % 2 === 0;
  const tableRow = Math.floor(vr / 2) + 1;
  const tableCol = Math.floor(vc / 2);

  if (evenR && evenC) return { kind: "cell", tableRow, tableCol };
  if (!evenR && evenC) return { kind: "hborder", tableRow, tableCol };
  if (evenR && !evenC) return { kind: "vborder", tableRow, tableCol };
  return { kind: "corner", tableRow, tableCol };
}

// Convert grid position to bet type
export function gridPosToBet(pos: GridPosition): BetType {
  switch (pos.kind) {
    case "cell":
      return { kind: "straight", number: numberAt(pos.tableRow, pos.tableCol) };
    case "hborder": {
      // tableRow=0 means zero-to-row-1 border (split with 0)
      const n1 = pos.tableRow === 0 ? 0 : numberAt(pos.tableRow, pos.tableCol);
      const n2 = numberAt(pos.tableRow + 1, pos.tableCol);
      const sorted = [Math.min(n1, n2), Math.max(n1, n2)] as [number, number];
      return { kind: "split", numbers: sorted };
    }
    case "vborder": {
      const n1 = numberAt(pos.tableRow, pos.tableCol);
      const n2 = numberAt(pos.tableRow, pos.tableCol + 1);
      const sorted = [Math.min(n1, n2), Math.max(n1, n2)] as [number, number];
      return { kind: "split", numbers: sorted };
    }
    case "corner": {
      const nums = [
        numberAt(pos.tableRow, pos.tableCol),
        numberAt(pos.tableRow, pos.tableCol + 1),
        numberAt(pos.tableRow + 1, pos.tableCol),
        numberAt(pos.tableRow + 1, pos.tableCol + 1),
      ].sort((a, b) => a - b) as [number, number, number, number];
      return { kind: "corner", numbers: nums };
    }
    case "street":
      return { kind: "street", row: pos.tableRow };
    case "sixline":
      return { kind: "sixline", rows: [pos.tableRow, pos.tableRow + 1] };
  }
}

// --- Bet evaluation ---

export function isWinner(num: number, bet: BetType): boolean {
  switch (bet.kind) {
    case "straight": return num === bet.number;
    case "split": return bet.numbers.includes(num);
    case "street": {
      const nums = [numberAt(bet.row, 0), numberAt(bet.row, 1), numberAt(bet.row, 2)];
      return nums.includes(num);
    }
    case "corner": return bet.numbers.includes(num);
    case "sixline": {
      for (const r of bet.rows) {
        for (let c = 0; c < 3; c++) {
          if (numberAt(r, c) === num) return true;
        }
      }
      return false;
    }
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

export function payout(bet: BetType): number {
  switch (bet.kind) {
    case "straight": return 35;
    case "split": return 17;
    case "street": return 11;
    case "corner": return 8;
    case "sixline": return 5;
    case "dozen": case "column": return 2;
    case "red": case "black": case "odd": case "even": case "low": case "high": return 1;
  }
}

// Compare two bet types for equality (used for stacking bets)
export function sameBetType(a: BetType, b: BetType): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "straight": return a.number === (b as typeof a).number;
    case "split": {
      const bb = b as typeof a;
      return a.numbers[0] === bb.numbers[0] && a.numbers[1] === bb.numbers[1];
    }
    case "street": return a.row === (b as typeof a).row;
    case "sixline": {
      const bb = b as typeof a;
      return a.rows[0] === bb.rows[0] && a.rows[1] === bb.rows[1];
    }
    case "corner": {
      const bb = b as typeof a;
      return a.numbers.every((n, i) => n === bb.numbers[i]);
    }
    case "dozen": return a.which === (b as typeof a).which;
    case "column": return a.which === (b as typeof a).which;
    default: return true; // red, black, odd, even, low, high
  }
}

// Get the label for a bet type (for display)
export function betLabel(bet: BetType): string {
  switch (bet.kind) {
    case "straight": return String(bet.number);
    case "split": return `${bet.numbers[0]}-${bet.numbers[1]}`;
    case "street": return `St ${numberAt(bet.row, 2)}-${numberAt(bet.row, 0)}`;
    case "corner": return `${bet.numbers[0]}-${bet.numbers[3]}`;
    case "sixline": return `Line ${numberAt(bet.rows[0], 2)}-${numberAt(bet.rows[1], 0)}`;
    case "red": return "RED";
    case "black": return "BLK";
    case "odd": return "ODD";
    case "even": return "EVEN";
    case "low": return "1-18";
    case "high": return "19-36";
    case "dozen":
      if (bet.which === 1) return "1st 12";
      if (bet.which === 2) return "2nd 12";
      return "3rd 12";
    case "column": return `Col ${bet.which}`;
  }
}
