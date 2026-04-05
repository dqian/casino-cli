// Pai Gow Poker — renderer

import type { AppState, PaiGowCard, Rank } from "../types";
import * as t from "../theme";
import { renderHeader, renderHotkeySplit } from "../shared/render";
import type { HotkeyItem } from "../shared/render";
import { evaluate5, evaluate2, isJoker } from "./cards";
import { getArrangedHands } from "./game";

const CARD_H = 9;
const INNER_W = 9;
const INNER_H = 7;

// --- Pip layouts ---
// Rows 1-5 are pip area, columns: left=1, center=4, right=7

const PIP_LAYOUTS: Record<string, { c: number; r: number }[]> = {
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

// --- Card rendering ---

function renderPipBody(clr: string, suit: string, rank: Rank): string[] {
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

function renderFaceBody(clr: string, suit: string, rank: string): string[] {
  return [
    `  ${clr}╭───╮${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}${suit}${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}${rank}${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}${suit}${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}╰───╯${t.reset}  `,
  ];
}

function renderJokerBody(): string[] {
  const clr = t.fg256(213); // magenta/pink
  return [
    `  ${clr}╭───╮${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}★${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}J${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}│${t.reset} ${clr}${t.bold}★${t.reset} ${clr}│${t.reset}  `,
    `  ${clr}╰───╯${t.reset}  `,
  ];
}

function renderCard(card: PaiGowCard): string[] {
  if (isJoker(card)) {
    return renderJokerCard();
  }

  const isRed = card.suit === '♥' || card.suit === '♦';
  const clr = isRed ? t.brightRed : t.brightWhite;
  const s = card.suit as string;
  const r = card.rank as Rank;

  const topLabel = `${r}${s}`;
  const topLine = `${clr}${t.bold}${topLabel}${t.reset}${" ".repeat(INNER_W - topLabel.length)}`;

  const botLabel = `${s}${r}`;
  const botLine = `${" ".repeat(INNER_W - botLabel.length)}${clr}${t.bold}${botLabel}${t.reset}`;

  const bodyRows = (r === 'J' || r === 'Q' || r === 'K')
    ? renderFaceBody(clr, s, r)
    : renderPipBody(clr, s, r);

  const lines: string[] = [];
  lines.push(`${t.gray}┌${"─".repeat(INNER_W)}┐${t.reset}`);
  lines.push(`${t.gray}│${t.reset}${topLine}${t.gray}│${t.reset}`);
  for (const row of bodyRows) lines.push(`${t.gray}│${t.reset}${row}${t.gray}│${t.reset}`);
  lines.push(`${t.gray}│${t.reset}${botLine}${t.gray}│${t.reset}`);
  lines.push(`${t.gray}└${"─".repeat(INNER_W)}┘${t.reset}`);
  return lines;
}

function renderJokerCard(): string[] {
  const clr = t.fg256(213); // magenta/pink
  const topLabel = `★`;
  const topLine = `${clr}${t.bold}${topLabel}${t.reset}${" ".repeat(INNER_W - 1)}`;
  const botLine = `${" ".repeat(INNER_W - 1)}${clr}${t.bold}${topLabel}${t.reset}`;

  const bodyRows = renderJokerBody();

  const lines: string[] = [];
  lines.push(`${t.gray}┌${"─".repeat(INNER_W)}┐${t.reset}`);
  lines.push(`${t.gray}│${t.reset}${topLine}${t.gray}│${t.reset}`);
  for (const row of bodyRows) lines.push(`${t.gray}│${t.reset}${row}${t.gray}│${t.reset}`);
  lines.push(`${t.gray}│${t.reset}${botLine}${t.gray}│${t.reset}`);
  lines.push(`${t.gray}└${"─".repeat(INNER_W)}┘${t.reset}`);
  return lines;
}

function renderFaceDown(): string[] {
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

// Render a highlighted card (selected for low hand) — shift border to yellow
function renderCardHighlighted(card: PaiGowCard): string[] {
  const base = renderCard(card);
  const hClr = t.yellow;
  // Replace gray borders with yellow
  return base.map((line, i) => {
    if (i === 0) return `${hClr}${t.bold}┌${"─".repeat(INNER_W)}┐${t.reset}`;
    if (i === CARD_H - 1) return `${hClr}${t.bold}└${"─".repeat(INNER_W)}┘${t.reset}`;
    // Replace leading and trailing gray│ with yellow│
    let out = line;
    // Replace the first │ border
    out = out.replace(`${t.gray}│${t.reset}`, `${hClr}${t.bold}│${t.reset}`);
    // Replace the last │ border — find the last occurrence
    const lastBorder = `${t.gray}│${t.reset}`;
    const lastIdx = out.lastIndexOf(lastBorder);
    if (lastIdx > 0) {
      out = out.substring(0, lastIdx) + `${hClr}${t.bold}│${t.reset}` + out.substring(lastIdx + lastBorder.length);
    }
    return out;
  });
}

// Render a row of cards with optional highlighting and cursor
function renderCardRow(
  cards: PaiGowCard[],
  options: {
    highlighted?: Set<number>;  // indices to highlight (yellow border)
    cursor?: number;            // cursor position (-1 = no cursor)
    faceDown?: boolean;         // render all face down
    elevated?: Set<number>;     // indices to show elevated (for low hand selection)
  } = {},
): string[] {
  const { highlighted, cursor, faceDown, elevated } = options;
  const cardImages: string[][] = [];

  for (let i = 0; i < cards.length; i++) {
    if (faceDown) {
      cardImages.push(renderFaceDown());
    } else if (highlighted?.has(i)) {
      cardImages.push(renderCardHighlighted(cards[i]!));
    } else {
      cardImages.push(renderCard(cards[i]!));
    }
  }

  // Build output — elevated cards are shifted up 1 line
  const elevatedSet = elevated ?? new Set<number>();
  const totalH = CARD_H + 1; // +1 for possible elevation
  const lines: string[] = [];

  for (let row = 0; row < totalH; row++) {
    let line = "";
    for (let i = 0; i < cards.length; i++) {
      if (i > 0) line += " ";
      const isElevated = elevatedSet.has(i);
      const cardRow = isElevated ? row : row - 1; // elevated cards start 1 row higher

      if (cardRow < 0 || cardRow >= CARD_H) {
        line += " ".repeat(11);
      } else {
        line += cardImages[i]![cardRow]!;
      }
    }
    lines.push(line);
  }

  // Add cursor indicator below cards
  if (cursor !== undefined && cursor >= 0 && cursor < cards.length) {
    let cursorLine = "";
    for (let i = 0; i < cards.length; i++) {
      if (i > 0) cursorLine += " ";
      if (i === cursor) {
        cursorLine += `${t.cyan}${t.bold}     ▲     ${t.reset}`;
      } else {
        cursorLine += " ".repeat(11);
      }
    }
    lines.push(cursorLine);
  }

  return lines;
}

// Render a compact card row (no elevation, for result display)
function renderCompactCardRow(cards: PaiGowCard[], faceDown: boolean = false): string[] {
  const cardImages: string[][] = [];
  for (const card of cards) {
    cardImages.push(faceDown ? renderFaceDown() : renderCard(card));
  }
  const lines: string[] = [];
  for (let row = 0; row < CARD_H; row++) {
    let line = "";
    for (let i = 0; i < cards.length; i++) {
      if (i > 0) line += " ";
      line += cardImages[i]![row]!;
    }
    lines.push(line);
  }
  return lines;
}

// --- Main screen renderer ---

export function renderPaiGowScreen(state: AppState): string[] {
  const { columns: width } = process.stdout;
  const lines: string[] = [];
  const pg = state.paigow;
  const pad = "  ";

  // Header
  lines.push(...renderHeader("PAI GOW POKER", state.balance, width));

  lines.push(`${pad}${t.gray}Bet: ${t.reset}${t.brightWhite}${t.bold}$${pg.betAmount}${t.reset}`);
  lines.push("");

  if (pg.phase === 'betting') {
    renderBettingPhase(lines, state, pad);
  } else if (pg.phase === 'arranging') {
    renderArrangingPhase(lines, state, pad);
  } else if (pg.phase === 'result') {
    renderResultPhase(lines, state, pad, width);
  }

  return lines;
}

function renderBettingPhase(lines: string[], state: AppState, pad: string): void {
  const pg = state.paigow;

  lines.push(`${pad}${t.gray}DEALER${t.reset}`);
  lines.push("");
  const dealerCards = renderCompactCardRow(
    Array(7).fill(null).map(() => ({ rank: 'A' as const, suit: '♠' as const })),
    true,
  );
  for (const line of dealerCards) lines.push(`${pad}${line}`);
  lines.push("");
  lines.push("");

  lines.push(`${pad}${t.gray}YOUR HAND${t.reset}`);
  lines.push("");
  const playerCards = renderCompactCardRow(
    Array(7).fill(null).map(() => ({ rank: 'A' as const, suit: '♠' as const })),
    true,
  );
  for (const line of playerCards) lines.push(`${pad}${line}`);
  lines.push("");

  if (state.message) {
    lines.push(`${pad}${t.yellow}${state.message}${t.reset}`);
  }
}

function renderArrangingPhase(lines: string[], state: AppState, pad: string): void {
  const pg = state.paigow;

  // Dealer — face down
  lines.push(`${pad}${t.gray}DEALER${t.reset}`);
  lines.push("");
  const dealerCards = renderCompactCardRow(pg.dealerCards, true);
  for (const line of dealerCards) lines.push(`${pad}${line}`);
  lines.push("");

  // Player's cards with selection UI
  lines.push(`${pad}${t.brightWhite}${t.bold}YOUR HAND${t.reset}  ${t.gray}Select 2 cards for low hand${t.reset}`);

  const lowSet = new Set(pg.lowHand);
  const playerCardLines = renderCardRow(pg.playerCards, {
    highlighted: lowSet,
    cursor: pg.cursor,
    elevated: lowSet,
  });
  for (const line of playerCardLines) lines.push(`${pad}${line}`);

  // Show current hand groupings
  lines.push("");

  if (pg.lowHand.length === 2) {
    const { high, low } = getArrangedHands(pg);
    const highEval = evaluate5(high);
    const lowEval = evaluate2(low);

    const highCards = high.map(c => cardShortName(c)).join(" ");
    const lowCards = low.map(c => cardShortName(c)).join(" ");

    lines.push(`${pad}${t.cyan}High (5): ${t.reset}${t.brightWhite}${highEval.name}${t.reset}  ${t.gray}${highCards}${t.reset}`);
    lines.push(`${pad}${t.cyan}Low  (2): ${t.reset}${t.brightWhite}${lowEval.name}${t.reset}  ${t.gray}${lowCards}${t.reset}`);

    if (pg.foulMessage) {
      lines.push(`${pad}${t.red}${t.bold}${pg.foulMessage}${t.reset}`);
    } else {
      lines.push(`${pad}${t.green}Valid arrangement${t.reset}`);
    }
  } else {
    const selected = pg.lowHand.length;
    lines.push(`${pad}${t.gray}Selected ${selected}/2 cards for low hand${t.reset}`);
    if (pg.lowHand.length === 1) {
      const lowCards = pg.lowHand.map(i => cardShortName(pg.playerCards[i]!)).join(" ");
      lines.push(`${pad}${t.gray}Low so far: ${lowCards}${t.reset}`);
    }
  }

  if (state.message) {
    lines.push(`${pad}${t.yellow}${state.message}${t.reset}`);
  }
}

function renderResultPhase(lines: string[], state: AppState, pad: string, _width: number): void {
  const pg = state.paigow;

  // Dealer's arranged hands
  lines.push(`${pad}${t.gray}DEALER${t.reset}`);

  // Dealer high hand
  const dHighEval = evaluate5(pg.dealerHigh);
  lines.push(`${pad}${t.gray}High (5): ${t.reset}${t.brightWhite}${dHighEval.name}${t.reset}`);
  const dealerHighCards = renderCompactCardRow(pg.dealerHigh);
  for (const line of dealerHighCards) lines.push(`${pad}${line}`);

  // Dealer low hand
  const dLowEval = evaluate2(pg.dealerLow);
  lines.push(`${pad}${t.gray}Low  (2): ${t.reset}${t.brightWhite}${dLowEval.name}${t.reset}`);
  const dealerLowCards = renderCompactCardRow(pg.dealerLow);
  for (const line of dealerLowCards) lines.push(`${pad}${line}`);
  lines.push("");

  // Player's arranged hands
  const lowSet = new Set(pg.lowHand);
  const { high: pHigh, low: pLow } = getArrangedHands(pg);
  const pHighEval = evaluate5(pHigh);
  const pLowEval = evaluate2(pLow);

  lines.push(`${pad}${t.brightWhite}${t.bold}YOUR HAND${t.reset}`);

  // Player high hand
  const highCmp = pHighEval.value - dHighEval.value;
  const highResult = highCmp > 0 ? `${t.green}${t.bold}WIN${t.reset}` : highCmp < 0 ? `${t.red}LOSE${t.reset}` : `${t.yellow}TIE (dealer)${t.reset}`;
  lines.push(`${pad}${t.gray}High (5): ${t.reset}${t.brightWhite}${pHighEval.name}${t.reset}  ${highResult}`);
  const playerHighCards = renderCompactCardRow(pHigh);
  for (const line of playerHighCards) lines.push(`${pad}${line}`);

  // Player low hand
  const lowCmp = pLowEval.value - dLowEval.value;
  const lowResult = lowCmp > 0 ? `${t.green}${t.bold}WIN${t.reset}` : lowCmp < 0 ? `${t.red}LOSE${t.reset}` : `${t.yellow}TIE (dealer)${t.reset}`;
  lines.push(`${pad}${t.gray}Low  (2): ${t.reset}${t.brightWhite}${pLowEval.name}${t.reset}  ${lowResult}`);
  const playerLowCards = renderCompactCardRow(pLow);
  for (const line of playerLowCards) lines.push(`${pad}${line}`);
  lines.push("");

  // Result
  if (pg.winAmount > 0) {
    lines.push(`${pad}${t.green}${t.bold}+$${pg.winAmount}${t.reset}  ${t.green}${pg.resultMessage}${t.reset}`);
  } else if (pg.winAmount < 0) {
    lines.push(`${pad}${t.red}${t.bold}-$${Math.abs(pg.winAmount)}${t.reset}  ${t.red}${pg.resultMessage}${t.reset}`);
  } else {
    lines.push(`${pad}${t.yellow}$0${t.reset}  ${t.yellow}${pg.resultMessage}${t.reset}`);
  }
}

// Short name for a card (for text display)
function cardShortName(card: PaiGowCard): string {
  if (isJoker(card)) return `${t.fg256(213)}${t.bold}Jkr${t.reset}`;
  const isRed = card.suit === '♥' || card.suit === '♦';
  const clr = isRed ? t.brightRed : t.brightWhite;
  return `${clr}${card.rank}${card.suit}${t.reset}`;
}

// --- Hotkey grid ---

export function renderPaiGowHotkeys(width: number, state: AppState): string[] {
  const pg = state.paigow;
  let left: HotkeyItem[] = [];
  let right: HotkeyItem[] = [];

  switch (pg.phase) {
    case 'betting':
      left = [
        { key: "↑↓", label: "Bet size" },
        { key: "Enter", label: "Deal" },
      ];
      right = [
        { key: "q", label: "Menu" },
      ];
      break;
    case 'arranging':
      left = [
        { key: "←→", label: "Select card" },
        { key: "Space", label: "Toggle low" },
        { key: "a", label: "Auto-arrange" },
        { key: "d", label: "Done" },
      ];
      right = [
        { key: "c", label: "Clear selection" },
        { key: "q", label: "Menu" },
      ];
      break;
    case 'result':
      left = [
        { key: "Enter", label: "New round" },
      ];
      right = [
        { key: "q", label: "Menu" },
      ];
      break;
  }

  return renderHotkeySplit(left, right, width);
}
