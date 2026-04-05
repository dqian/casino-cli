// Pai Gow Poker — renderer

import type { AppState, PaiGowCard, Rank } from "../types";
import * as t from "../theme";
import { renderHeader, renderHotkeySplit, widthWarning } from "../shared/render";
import type { HotkeyItem } from "../shared/render";
import { evaluate5, evaluate2, isJoker, rankValue } from "./cards";
import { getArrangedHands, spreadProgress } from "./game";
import { sliceAnsi as sliceAnsiShared } from "../shared/render";

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

// 4-color suit mapping: ♠=white, ♥=red, ♦=blue, ♣=green
function suitColor4(suit: string): string {
  switch (suit) {
    case '♠': return t.fg256(147);  // lavender
    case '♥': return t.brightRed;
    case '♦': return t.fg256(75);   // blue
    case '♣': return t.fg256(78);   // green
    default:  return t.brightWhite;
  }
}

function suitColor2(suit: string): string {
  return (suit === '♥' || suit === '♦') ? t.brightRed : t.brightWhite;
}

// Set by renderPaiGowScreen before card rendering
let getSuitColor: (suit: string) => string = suitColor4;

// Fixed column widths for hand detail display
const LABEL_W = 10; // "High (5): " or "Low  (2): "
const NAME_W = 32;  // hand description padded

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

  const clr = getSuitColor(card.suit as string);
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
  const topLabel = `J★`;
  const topLine = `${clr}${t.bold}${topLabel}${t.reset}${" ".repeat(INNER_W - topLabel.length)}`;
  const botLabel = `★J`;
  const botLine = `${" ".repeat(INNER_W - botLabel.length)}${clr}${t.bold}${botLabel}${t.reset}`;

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

// Render cards spreading from stacked to full spread
function renderSpreadingCards(
  cards: PaiGowCard[], progress: number, faceDown: boolean,
): string[] {
  const SLOT = 12;
  const cardImgs = cards.map(c => faceDown ? renderFaceDown() : renderCard(c));
  const n = cards.length;
  const offsets = cards.map((_, i) => Math.floor(i * SLOT * progress));
  const lines: string[] = [];

  for (let row = 0; row < CARD_H; row++) {
    let line = "";
    let pos = 0;

    for (let i = 0; i < n; i++) {
      const offset = offsets[i]!;
      const nextOffset = i < n - 1 ? offsets[i + 1]! : offset + 11;
      const visW = Math.min(11, Math.max(0, nextOffset - offset));

      if (offset > pos) {
        line += " ".repeat(offset - pos);
        pos = offset;
      }

      if (visW > 0) {
        line += sliceAnsiShared(cardImgs[i]![row]!, 0, visW);
        pos = offset + visW;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Render 7 cards spreading from stacked into the 5+gap+2 split layout
function renderSpreadingSplitHand(
  high: PaiGowCard[], low: PaiGowCard[], progress: number,
): string[] {
  const SLOT = 12;
  const GAP = 5;
  // Final positions: high cards at 0,12,24,36,48; low cards at 64,76
  const highOffsets = high.map((_, i) => i * SLOT);
  const lowStart = 5 * SLOT - 1 + GAP; // 59 + 5 = 64
  const lowOffsets = low.map((_, i) => lowStart + i * SLOT);
  const finalPositions = [...highOffsets, ...lowOffsets];
  const allCards = [...high, ...low];

  const cardImgs = allCards.map(c => renderCard(c));
  const n = allCards.length;

  const offsets = finalPositions.map(fp => Math.floor(fp * progress));
  const lines: string[] = [];

  for (let row = 0; row < CARD_H; row++) {
    let line = "";
    let pos = 0;

    for (let i = 0; i < n; i++) {
      const offset = offsets[i]!;
      const nextOffset = i < n - 1 ? offsets[i + 1]! : offset + 11;
      const visW = Math.min(11, Math.max(0, nextOffset - offset));

      if (offset > pos) {
        line += " ".repeat(offset - pos);
        pos = offset;
      }

      if (visW > 0) {
        line += sliceAnsiShared(cardImgs[i]![row]!, 0, visW);
        pos = offset + visW;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Animate cards sliding from 7-in-a-row positions to the 5+gap+2 split layout
function renderRearrangingCards(
  cards: PaiGowCard[], lowIndices: number[], progress: number,
): string[] {
  const SLOT = 12;
  const GAP = 5;
  const LOW_START = 5 * SLOT - 1 + GAP; // 64

  const lowSet = new Set(lowIndices);

  // Compute final positions
  let highN = 0;
  let lowN = 0;
  const endPos: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    if (lowSet.has(i)) {
      endPos.push(LOW_START + lowN * SLOT);
      lowN++;
    } else {
      endPos.push(highN * SLOT);
      highN++;
    }
  }

  // Interpolate each card from start (i*SLOT) to end
  const items: { cardIdx: number; pos: number }[] = [];
  for (let i = 0; i < cards.length; i++) {
    const start = i * SLOT;
    const end = endPos[i]!;
    items.push({ cardIdx: i, pos: Math.floor(start + (end - start) * progress) });
  }

  // Sort by current position for left-to-right rendering
  items.sort((a, b) => a.pos - b.pos);

  const cardImgs = cards.map(c => renderCard(c));
  const lines: string[] = [];

  for (let row = 0; row < CARD_H; row++) {
    let line = "";
    let pos = 0;

    for (let i = 0; i < items.length; i++) {
      const offset = items[i]!.pos;
      const nextOffset = i < items.length - 1 ? items[i + 1]!.pos : offset + 11;
      const visW = Math.min(11, Math.max(0, nextOffset - offset));

      if (offset > pos) {
        line += " ".repeat(offset - pos);
        pos = offset;
      }

      if (visW > 0) {
        line += sliceAnsiShared(cardImgs[items[i]!.cardIdx]![row]!, 0, visW);
        pos = offset + visW;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Render high (5) and low (2) on one row: high left-aligned, gap, low right
function renderSplitHandRow(high: PaiGowCard[], low: PaiGowCard[], faceDown: boolean = false): string[] {
  const highImgs: string[][] = high.map(c => faceDown ? renderFaceDown() : renderCard(c));
  const lowImgs: string[][] = low.map(c => faceDown ? renderFaceDown() : renderCard(c));
  const gap = "     "; // 5-char gap between high and low
  const lines: string[] = [];
  for (let row = 0; row < CARD_H; row++) {
    let line = "";
    for (let i = 0; i < highImgs.length; i++) {
      if (i > 0) line += " ";
      line += highImgs[i]![row]!;
    }
    line += gap;
    for (let i = 0; i < lowImgs.length; i++) {
      if (i > 0) line += " ";
      line += lowImgs[i]![row]!;
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

  // Set suit color mode
  getSuitColor = pg.coloredSuits ? suitColor4 : suitColor2;

  // Header
  lines.push(...renderHeader("PAI GOW POKER", state.balance, width));

  const warn = widthWarning(width, 90);
  if (warn) lines.push(warn);

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
  lines.push(`${pad}${t.gray}DEALER${t.reset}`);
  lines.push("");
  const dummyCards = Array(7).fill(null).map(() => ({ rank: 'A' as const, suit: '♠' as const }));
  const dealerCards = renderCompactCardRow(dummyCards, true);
  for (const line of dealerCards) lines.push(`${pad}${line}`);
  lines.push("");

  lines.push(`${pad}${t.gray}YOUR HAND${t.reset}`);
  lines.push(""); // elevation placeholder (matches arranging phase row 0)
  const playerCards = renderCompactCardRow(dummyCards, true);
  for (const line of playerCards) lines.push(`${pad}${line}`);
  lines.push(""); // cursor placeholder

  if (state.message) {
    lines.push(`${pad}${t.yellow}${state.message}${t.reset}`);
  }
}

function renderArrangingPhase(lines: string[], state: AppState, pad: string): void {
  const pg = state.paigow;

  const progress = spreadProgress(pg);
  const isAnimating = pg.spreadFrame > 0;

  // Dealer — face down (no animation, always static)
  lines.push(`${pad}${t.gray}DEALER${t.reset}`);
  lines.push("");
  const dealerCards = renderCompactCardRow(pg.dealerCards, true);
  for (const line of dealerCards) lines.push(`${pad}${line}`);
  lines.push("");

  // Player's cards with selection UI
  lines.push(`${pad}${t.brightWhite}${t.bold}YOUR HAND${t.reset}${isAnimating ? "" : `  ${t.gray}Select 2 cards for low hand${t.reset}`}`);
  // renderCardRow adds elevation row at top + cursor row at bottom, matching betting layout

  if (isAnimating) {
    lines.push(""); // elevation placeholder
    const playerCards = renderSpreadingCards(pg.playerCards, progress, false);
    for (const line of playerCards) lines.push(`${pad}${line}`);
    lines.push(""); // cursor placeholder
  } else {
    const lowSet = new Set(pg.lowHand);
    const playerCardLines = renderCardRow(pg.playerCards, {
      highlighted: lowSet,
      cursor: pg.cursor,
      elevated: lowSet,
    });
    for (const line of playerCardLines) lines.push(`${pad}${line}`);
  }

  // Show current hand groupings
  lines.push("");

  if (pg.lowHand.length === 2) {
    const { high, low } = getArrangedHands(pg);
    const highEval = evaluate5(high);
    const lowEval = evaluate2(low);

    const highSorted = sortHandForDisplay(high);
    const lowSorted = sortHandForDisplay(low);
    const highCards = highSorted.map(c => cardShortFixed(c)).join("");
    const lowCards = lowSorted.map(c => cardShortFixed(c)).join("");

    const nameW = Math.max(highEval.name.length, lowEval.name.length) + 2;
    lines.push(`${pad}${t.cyan}${"High (5):".padEnd(LABEL_W)}${t.reset}${t.brightWhite}${highEval.name.padEnd(nameW)}${t.reset}${highCards}`);
    lines.push(`${pad}${t.cyan}${"Low  (2):".padEnd(LABEL_W)}${t.reset}${t.brightWhite}${lowEval.name.padEnd(nameW)}${t.reset}${lowCards}`);

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

  // Card row geometry: 5 cards (59) + 5 gap + 2 cards (23) = 87
  const HIGH_W = 5 * 11 + 4; // 59
  const GAP_W = 5;
  const LOW_W = 2 * 11 + 1;  // 23
  const ROW_W = HIGH_W + GAP_W + LOW_W; // 87

  const hLabel = `${t.cyan}High (5)${t.reset}  `;
  const lLabelSuffix = `  ${t.cyan}Low (2)${t.reset}`;

  function handInfoLine(highName: string, lowName: string): string {
    const highPart = t.stripAnsi(hLabel).length + highName.length;
    const lowPart = lowName.length + t.stripAnsi(lLabelSuffix).length;
    const gap = Math.max(2, ROW_W - highPart - lowPart);
    return `${pad}${hLabel}${t.brightWhite}${highName}${t.reset}${" ".repeat(gap)}${t.brightWhite}${lowName}${t.reset}${lLabelSuffix}`;
  }

  function resultLine(highRes: string, lowRes: string): string {
    const highVisLen = t.stripAnsi(highRes).length;
    const gap = Math.max(2, ROW_W - highVisLen - t.stripAnsi(lowRes).length);
    return `${pad}${highRes}${" ".repeat(gap)}${lowRes}`;
  }

  const isAnimating = pg.spreadFrame > 0;
  const progress = spreadProgress(pg);

  // Dealer
  const dHighEval = evaluate5(pg.dealerHigh);
  const dLowEval = evaluate2(pg.dealerLow);

  lines.push(`${pad}${t.gray}DEALER${t.reset}`);
  if (isAnimating) {
    lines.push(""); // placeholder for info line during animation
    const dealerRow = renderSpreadingSplitHand(pg.dealerHigh, pg.dealerLow, progress);
    for (const line of dealerRow) lines.push(`${pad}${line}`);
  } else {
    lines.push(handInfoLine(dHighEval.name, dLowEval.name));
    const dealerRow = renderSplitHandRow(pg.dealerHigh, pg.dealerLow);
    for (const line of dealerRow) lines.push(`${pad}${line}`);
  }
  lines.push("");

  // Player
  const { high: pHigh, low: pLow } = getArrangedHands(pg);
  const pHighEval = evaluate5(pHigh);
  const pLowEval = evaluate2(pLow);

  const highCmp = pHighEval.value - dHighEval.value;
  const lowCmp = pLowEval.value - dLowEval.value;
  const highResult = highCmp > 0 ? `${t.green}${t.bold}WIN${t.reset}` : highCmp < 0 ? `${t.red}LOSE${t.reset}` : `${t.yellow}TIE${t.reset}`;
  const lowResult = lowCmp > 0 ? `${t.green}${t.bold}WIN${t.reset}` : lowCmp < 0 ? `${t.red}LOSE${t.reset}` : `${t.yellow}TIE${t.reset}`;

  lines.push(`${pad}${t.brightWhite}${t.bold}YOUR HAND${t.reset}`);
  if (isAnimating) {
    lines.push("");
    const playerRow = renderRearrangingCards(pg.playerCards, pg.lowHand, progress);
    for (const line of playerRow) lines.push(`${pad}${line}`);
    lines.push("");
  } else {
    lines.push(handInfoLine(pHighEval.name, pLowEval.name));
    const playerRow = renderSplitHandRow(pHigh, pLow);
    for (const line of playerRow) lines.push(`${pad}${line}`);
    lines.push(resultLine(highResult, lowResult));
  }
  lines.push("");

  // Net result
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
  if (isJoker(card)) return `${t.fg256(213)}${t.bold}J★${t.reset}`;
  const clr = getSuitColor(card.suit as string);
  return `${clr}${card.rank}${card.suit}${t.reset}`;
}

// Fixed-width short name (4 vis chars) for grid alignment
function cardShortFixed(card: PaiGowCard): string {
  if (isJoker(card)) return `${t.fg256(213)}${t.bold}J★${t.reset}  `;
  const clr = getSuitColor(card.suit as string);
  const label = `${card.rank}${card.suit}`;
  return `${clr}${label}${t.reset}${" ".repeat(Math.max(0, 4 - label.length))}`;
}

// Sort cards for display: pairs/groups first, then descending singles
function sortHandForDisplay(cards: PaiGowCard[]): PaiGowCard[] {
  const sorted = [...cards];
  // Count ranks
  const counts = new Map<number, number>();
  for (const c of sorted) {
    if (isJoker(c)) continue;
    const v = rankValue(c.rank);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  sorted.sort((a, b) => {
    const va = isJoker(a) ? 14 : rankValue(a.rank);
    const vb = isJoker(b) ? 14 : rankValue(b.rank);
    const ca = isJoker(a) ? 0 : (counts.get(va) ?? 1);
    const cb = isJoker(b) ? 0 : (counts.get(vb) ?? 1);
    // Groups first (higher count), then by value descending
    if (cb !== ca) return cb - ca;
    return vb - va;
  });
  return sorted;
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
        { key: "s", label: `Sort: ${pg.sortMode === 'ascending' ? 'asc' : 'desc'}` },
        { key: "k", label: pg.coloredSuits ? "4-color suits" : "2-color suits" },
        { key: "q", label: "Menu" },
      ];
      break;
    case 'arranging':
      left = [
        { key: "←→", label: "Select card" },
        { key: "Space", label: "Toggle low" },
        { key: "a", label: "Auto-arrange" },
        { key: "Enter", label: "Done" },
      ];
      right = [
        { key: "c", label: "Clear selection" },
        { key: "s", label: `Sort: ${pg.sortMode === 'ascending' ? 'asc' : 'desc'}` },
        { key: "k", label: pg.coloredSuits ? "4-color suits" : "2-color suits" },
        { key: "q", label: "Menu" },
      ];
      break;
    case 'result':
      left = [
        { key: "Enter", label: "New round" },
      ];
      right = [
        { key: "s", label: `Sort: ${pg.sortMode === 'ascending' ? 'asc' : 'desc'}` },
        { key: "q", label: "Menu" },
      ];
      break;
  }

  return renderHotkeySplit(left, right, width);
}
