// Shared card rendering primitives used by blackjack and pai gow

import * as t from "../theme";
import type { Rank } from "../types";

export const CARD_H = 9;
export const INNER_W = 9;
export const INNER_H = 7;

// Pip positions: { c: column 0-8, r: row 1-5 } within the 5-row pip area
// Columns: left=1, center=4, right=7
export const PIP_LAYOUTS: Record<string, { c: number; r: number }[]> = {
  'A':  [{c:4,r:3}],
  '2':  [{c:4,r:1}, {c:4,r:5}],
  '3':  [{c:4,r:1}, {c:4,r:3}, {c:4,r:5}],
  '4':  [{c:1,r:1}, {c:7,r:1}, {c:1,r:5}, {c:7,r:5}],
  '5':  [{c:1,r:1}, {c:7,r:1}, {c:4,r:3}, {c:1,r:5}, {c:7,r:5}],
  '6':  [{c:1,r:1}, {c:7,r:1}, {c:1,r:3}, {c:7,r:3}, {c:1,r:5}, {c:7,r:5}],
  '7':  [{c:1,r:1}, {c:7,r:1}, {c:1,r:3}, {c:7,r:3}, {c:4,r:2}, {c:1,r:5}, {c:7,r:5}],
  '8':  [{c:1,r:1}, {c:7,r:1}, {c:1,r:3}, {c:7,r:3}, {c:4,r:2}, {c:4,r:4}, {c:1,r:5}, {c:7,r:5}],
  '9':  [{c:1,r:1}, {c:7,r:1}, {c:1,r:2}, {c:7,r:2}, {c:4,r:3}, {c:1,r:4}, {c:7,r:4}, {c:1,r:5}, {c:7,r:5}],
  '10': [{c:1,r:1}, {c:7,r:1}, {c:4,r:2}, {c:1,r:2}, {c:7,r:2}, {c:1,r:4}, {c:7,r:4}, {c:4,r:4}, {c:1,r:5}, {c:7,r:5}],
};

export function renderPipBody(clr: string, suit: string, rank: Rank): string[] {
  const pips = PIP_LAYOUTS[rank] ?? [];
  const pipSet = new Set(pips.map(p => `${p.r},${p.c}`));
  const rows: string[] = [];
  for (let row = 1; row <= 5; row++) {
    let line = "";
    for (let col = 0; col < INNER_W; col++) {
      if (pipSet.has(`${row},${col}`)) {
        line += `${clr}${t.bold}${suit}${t.reset}`;
      } else {
        line += " ";
      }
    }
    rows.push(line);
  }
  return rows;
}

export function renderFaceBody(clr: string, suit: string, rank: string): string[] {
  return [
    `  ${clr}╭───╮${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}${suit}${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}${rank}${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}${suit}${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}╰───╯${t.reset}  `,
  ];
}

// Render a standard card given rank, suit, and color
export function renderStandardCard(rank: Rank, suit: string, clr: string): string[] {
  const topLabel = `${rank}${suit}`;
  const topLine = `${clr}${t.bold}${topLabel}${t.reset}${" ".repeat(INNER_W - topLabel.length)}`;

  const botLabel = `${suit}${rank}`;
  const botLine = `${" ".repeat(INNER_W - botLabel.length)}${clr}${t.bold}${botLabel}${t.reset}`;

  const bodyRows = (rank === 'J' || rank === 'Q' || rank === 'K')
    ? renderFaceBody(clr, suit, rank)
    : renderPipBody(clr, suit, rank);

  const lines: string[] = [];
  lines.push(`${t.gray}┌${"─".repeat(INNER_W)}┐${t.reset}`);
  lines.push(`${t.gray}│${t.reset}${topLine}${t.gray}│${t.reset}`);
  for (const row of bodyRows) lines.push(`${t.gray}│${t.reset}${row}${t.gray}│${t.reset}`);
  lines.push(`${t.gray}│${t.reset}${botLine}${t.gray}│${t.reset}`);
  lines.push(`${t.gray}└${"─".repeat(INNER_W)}┘${t.reset}`);
  return lines;
}

export function renderFaceDown(): string[] {
  const backClr = t.fg256(24);
  const lines: string[] = [];
  lines.push(`${t.gray}┌${"─".repeat(INNER_W)}┐${t.reset}`);
  for (let r = 0; r < INNER_H; r++) {
    let pattern = "";
    for (let c = 0; c < INNER_W; c++) {
      pattern += (r + c) % 2 === 0 ? "░" : "▒";
    }
    lines.push(`${t.gray}│${t.reset}${backClr}${pattern}${t.reset}${t.gray}│${t.reset}`);
  }
  lines.push(`${t.gray}└${"─".repeat(INNER_W)}┘${t.reset}`);
  return lines;
}
