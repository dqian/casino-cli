import type { AppState, Card, Rank } from "../types";
import * as t from "../theme";
import { baccaratHandValue } from "./game";
import { renderHeader, renderHotkeySplit, sliceAnsi, widthWarning } from "../shared/render";
import type { HotkeyItem } from "../shared/render";

const CARD_H = 9;
const INNER_W = 9;
const INNER_H = 7;

// Pip positions within the 7-row content area (rows 1-5 are pip area)
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
    `  ${clr}\u256D\u2500\u2500\u2500\u256E${t.reset}  `,
    `  ${clr}\u2502${t.reset} ${clr}${t.bold}${suit}${t.reset} ${clr}\u2502${t.reset}  `,
    `  ${clr}\u2502${t.reset} ${clr}${t.bold}${rank}${t.reset} ${clr}\u2502${t.reset}  `,
    `  ${clr}\u2502${t.reset} ${clr}${t.bold}${suit}${t.reset} ${clr}\u2502${t.reset}  `,
    `  ${clr}\u256E\u2500\u2500\u2500\u256F${t.reset}  `,
  ];
}

function renderCard(card: Card): string[] {
  const isRed = card.suit === '\u2665' || card.suit === '\u2666';
  const clr = isRed ? t.brightRed : t.brightWhite;
  const s = card.suit;
  const r = card.rank;

  const topLabel = `${r}${s}`;
  const topLine = `${clr}${t.bold}${topLabel}${t.reset}${" ".repeat(INNER_W - topLabel.length)}`;

  const botLabel = `${s}${r}`;
  const botLine = `${" ".repeat(INNER_W - botLabel.length)}${clr}${t.bold}${botLabel}${t.reset}`;

  const bodyRows = (r === 'J' || r === 'Q' || r === 'K')
    ? renderFaceBody(clr, s, r)
    : renderPipBody(clr, s, r);

  const lines: string[] = [];
  lines.push(`${t.gray}\u250C${"\u2500".repeat(INNER_W)}\u2510${t.reset}`);
  lines.push(`${t.gray}\u2502${t.reset}${topLine}${t.gray}\u2502${t.reset}`);
  for (const row of bodyRows) lines.push(`${t.gray}\u2502${t.reset}${row}${t.gray}\u2502${t.reset}`);
  lines.push(`${t.gray}\u2502${t.reset}${botLine}${t.gray}\u2502${t.reset}`);
  lines.push(`${t.gray}\u2514${"\u2500".repeat(INNER_W)}\u2518${t.reset}`);
  return lines;
}

function renderPlaceholderCard(): string[] {
  const d = t.fg256(236);
  const lines: string[] = [];
  lines.push(`${d} ${"\u254C".repeat(INNER_W)} ${t.reset}`);
  for (let r = 0; r < INNER_H; r++) {
    lines.push(`${d}\u254E${" ".repeat(INNER_W)}\u254E${t.reset}`);
  }
  lines.push(`${d} ${"\u254C".repeat(INNER_W)} ${t.reset}`);
  return lines;
}

const CARD_ANIM_MAX_OFFSET = 25;
const CARD_ANIM_FRAMES = 8;
const CARD_SLOT_W = 12;

function cardAnimOffset(frame: number): number {
  const progress = Math.min(1, frame / CARD_ANIM_FRAMES);
  return Math.floor(CARD_ANIM_MAX_OFFSET * Math.pow(1 - progress, 2));
}

function renderHandCards(
  cards: Card[],
  placeholderSlots: number,
  lastCardOffset: number,
): string[] {
  const totalSlots = Math.max(cards.length, placeholderSlots);
  if (totalSlots === 0) return [];

  const isAnimating = lastCardOffset > 0 && cards.length > 0;
  const animIdx = isAnimating ? cards.length - 1 : -1;
  const settledCount = isAnimating ? cards.length - 1 : cards.length;

  const phCard = renderPlaceholderCard();
  const cardImages: string[][] = [];
  for (let i = 0; i < cards.length; i++) {
    cardImages.push(renderCard(cards[i]!));
  }

  const lines: string[] = [];
  for (let row = 0; row < CARD_H; row++) {
    let line = "";

    for (let s = 0; s < totalSlots; s++) {
      if (s > 0) line += " ";

      if (s === animIdx) {
        if (s < placeholderSlots) {
          line += phCard[row];
        } else {
          line += " ".repeat(11);
        }
      } else if (s < settledCount) {
        line += cardImages[s]![row];
      } else if (s < placeholderSlots) {
        line += phCard[row];
      } else {
        line += " ".repeat(11);
      }
    }

    // Overlay the animating card at its offset position
    if (isAnimating) {
      const animCardRow = cardImages[animIdx]![row]!;
      const slotStart = animIdx * CARD_SLOT_W;
      const animStart = slotStart + lastCardOffset;
      const animVisW = 11;

      const baseVis = t.stripAnsi(line);
      const baseLen = baseVis.length;

      let out = "";
      if (animStart <= baseLen) {
        out += sliceAnsi(line, 0, animStart);
      } else {
        out += line + " ".repeat(animStart - baseLen);
      }
      out += animCardRow;
      const afterPos = animStart + animVisW;
      if (afterPos < baseLen) {
        out += sliceAnsi(line, afterPos, baseLen);
      }
      line = out;
    }

    lines.push(line);
  }
  return lines;
}

// --- Main screen renderer ---

export function renderBaccaratScreen(state: AppState): string[] {
  const { columns: width } = process.stdout;
  const lines: string[] = [];
  const bc = state.baccarat;

  // Header
  lines.push(...renderHeader("BACCARAT", state.balance, width));

  const warn = widthWarning(width, 60);
  if (warn) lines.push(warn);

  // Shoe bar
  const totalShoe = bc.numDecks * 52;
  const leftLabel = "  Shoe ";
  const rightLabel = ` ${bc.shoe.length}/${totalShoe}  `;
  const barMax = Math.max(10, width - leftLabel.length - rightLabel.length);
  const filled = Math.round((bc.shoe.length / totalShoe) * barMax);
  const cutPos = Math.round((bc.cutCard / totalShoe) * barMax);
  let bar = "";
  for (let i = 0; i < barMax; i++) {
    if (i === cutPos) {
      bar += `${t.yellow}${t.bold}|${t.reset}`;
    } else if (i < filled) {
      bar += `${t.gray}\u2588${t.reset}`;
    } else {
      bar += `${t.fg256(238)}\u2591${t.reset}`;
    }
  }
  lines.push(`${t.gray}${leftLabel}${t.reset}${bar}${t.gray}${rightLabel}${t.reset}`);

  lines.push("");

  // Bet info
  const betTypeLabel = bc.betType === 'player' ? 'PLAYER' : bc.betType === 'banker' ? 'BANKER' : 'TIE';
  const betTypeClr = bc.betType === 'player' ? t.cyan : bc.betType === 'banker' ? t.red : t.green;
  lines.push(`  ${t.gray}Bet: ${t.reset}${t.brightWhite}${t.bold}$${bc.betAmount}${t.reset}  ${t.gray}on ${t.reset}${betTypeClr}${t.bold}${betTypeLabel}${t.reset}`);

  lines.push("");
  lines.push("");

  const pad = "  ";
  const anim = bc.cardAnim;
  const playerOffset = anim?.target === 'player' ? cardAnimOffset(anim.frame) : 0;
  const bankerOffset = anim?.target === 'banker' ? cardAnimOffset(anim.frame) : 0;

  const hasCards = bc.playerCards.length > 0 || bc.bankerCards.length > 0;

  // Player hand
  const playerVal = bc.playerCards.length > 0 ? baccaratHandValue(bc.playerCards) : -1;
  let playerLabel = `${t.cyan}${t.bold}PLAYER${t.reset}`;
  if (playerVal >= 0) {
    const valClr = playerVal >= 8 ? t.brightGreen : t.brightWhite;
    playerLabel += `  ${t.gray}[${t.reset}${valClr}${t.bold}${playerVal}${t.reset}${t.gray}]${t.reset}`;
    if (bc.playerCards.length === 2 && playerVal >= 8) {
      playerLabel += `  ${t.brightGreen}${t.bold}Natural${t.reset}`;
    }
  }
  lines.push(`${pad}${playerLabel}`);

  if (hasCards) {
    const playerSettled = playerOffset > 0 ? bc.playerCards.length - 1 : bc.playerCards.length;
    const playerPh = playerSettled < 2 ? 2 : 0;
    const cardLines = renderHandCards(bc.playerCards, playerPh, playerOffset);
    for (const line of cardLines) lines.push(`${pad}${line}`);
  } else {
    // Placeholder cards
    const phLines = renderPlaceholderHand();
    for (const line of phLines) lines.push(`${pad}${line}`);
  }

  lines.push("");
  lines.push("");

  // Banker hand
  const bankerVal = bc.bankerCards.length > 0 ? baccaratHandValue(bc.bankerCards) : -1;
  let bankerLabel = `${t.red}${t.bold}BANKER${t.reset}`;
  if (bankerVal >= 0) {
    const valClr = bankerVal >= 8 ? t.brightGreen : t.brightWhite;
    bankerLabel += `  ${t.gray}[${t.reset}${valClr}${t.bold}${bankerVal}${t.reset}${t.gray}]${t.reset}`;
    if (bc.bankerCards.length === 2 && bankerVal >= 8) {
      bankerLabel += `  ${t.brightGreen}${t.bold}Natural${t.reset}`;
    }
  }
  lines.push(`${pad}${bankerLabel}`);

  if (hasCards) {
    const bankerSettled = bankerOffset > 0 ? bc.bankerCards.length - 1 : bc.bankerCards.length;
    const bankerPh = bankerSettled < 2 ? 2 : 0;
    const cardLines = renderHandCards(bc.bankerCards, bankerPh, bankerOffset);
    for (const line of cardLines) lines.push(`${pad}${line}`);
  } else {
    const phLines = renderPlaceholderHand();
    for (const line of phLines) lines.push(`${pad}${line}`);
  }

  lines.push("");

  // Result / status line
  if (bc.phase === "result" && !bc.cardAnim) {
    lines.push("");
    // Result message
    if (bc.resultMessage) {
      lines.push(`${pad}${t.brightWhite}${t.bold}${bc.resultMessage}${t.reset}`);
    }
    if (bc.winAmount > 0) {
      const commissionNote = bc.betType === 'banker' ? `  ${t.gray}(5% commission)${t.reset}` : "";
      lines.push(`${pad}${t.green}${t.bold}+$${bc.winAmount}${t.reset}${commissionNote}`);
    } else if (bc.winAmount < 0) {
      lines.push(`${pad}${t.red}${t.bold}-$${Math.abs(bc.winAmount)}${t.reset}`);
    } else {
      lines.push(`${pad}${t.yellow}$0 ${t.gray}(push)${t.reset}`);
    }
  } else if (bc.phase === "dealing") {
    lines.push(`${pad}${t.yellow}Dealing...${t.reset}`);
  } else if (state.message) {
    lines.push(`${pad}${t.yellow}${state.message}${t.reset}`);
  }

  return lines;
}

function renderPlaceholderHand(): string[] {
  const c1 = renderPlaceholderCard();
  const c2 = renderPlaceholderCard();
  const lines: string[] = [];
  for (let row = 0; row < CARD_H; row++) {
    lines.push(`${c1[row]} ${c2[row]}`);
  }
  return lines;
}

// --- Hotkey grid ---

export function renderBaccaratHotkeys(width: number, state: AppState): string[] {
  const bc = state.baccarat;
  let left: HotkeyItem[] = [];
  let right: HotkeyItem[] = [];

  switch (bc.phase) {
    case "betting":
      left = [
        { key: "\u2191\u2193", label: "Bet size" },
        { key: "\u25C4\u25BA", label: "Bet type" },
        { key: "Enter", label: "Deal" },
      ];
      right = [
        { key: "q", label: "Menu" },
      ];
      break;
    case "dealing":
      left = [
        { key: "Enter", label: "Skip" },
      ];
      right = [
        { key: "q", label: "Menu" },
      ];
      break;
    case "result":
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
