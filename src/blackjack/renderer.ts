import type { AppState, Card, Rank } from "../types";
import * as t from "../theme";
import { handValue, isBlackjack, hiLoValue } from "./deck";
import { canSplit, canDouble } from "./game";
import { getBasicStrategyHint } from "./strategy";

const CARD_H = 9;
const INNER_W = 9;
const INNER_H = 7;

// Pip positions: { c: column 0-8, r: row 1-5 } within the 7-row content area
// Rows 0 and 6 are corners; rows 1-5 are the pip area
// Columns: left=1, center=4, right=7
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

function center(text: string, width: number): string {
  const visLen = t.stripAnsi(text).length;
  const pad = Math.max(0, Math.floor((width - visLen) / 2));
  return " ".repeat(pad) + text;
}

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

function renderCard(card: Card | null): string[] {
  if (!card) return renderFaceDown();

  const isRed = card.suit === '♥' || card.suit === '♦';
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

function renderPlaceholderCard(): string[] {
  const d = t.fg256(236);
  const lines: string[] = [];
  lines.push(`${d} ${"╌".repeat(INNER_W)} ${t.reset}`);
  for (let r = 0; r < INNER_H; r++) {
    lines.push(`${d}╎${" ".repeat(INNER_W)}╎${t.reset}`);
  }
  lines.push(`${d} ${"╌".repeat(INNER_W)} ${t.reset}`);
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

const CARD_ANIM_MAX_OFFSET = 25;
const CARD_ANIM_FRAMES = 8;

function cardAnimOffset(frame: number): number {
  const progress = Math.min(1, frame / CARD_ANIM_FRAMES);
  return Math.floor(CARD_ANIM_MAX_OFFSET * Math.pow(1 - progress, 2));
}

const CARD_SLOT_W = 12; // 11 chars per card + 1 gap

function renderHandCards(
  cards: Card[],
  faceDownIndices: number[] = [],
  placeholderSlots: number = 0,
  lastCardOffset: number = 0,
): string[] {
  const totalSlots = Math.max(cards.length, placeholderSlots);
  if (totalSlots === 0) return [];

  const isAnimating = lastCardOffset > 0 && cards.length > 0;
  const animIdx = isAnimating ? cards.length - 1 : -1;
  const settledCount = isAnimating ? cards.length - 1 : cards.length;

  // Pre-render all card images
  const phCard = renderPlaceholderCard();
  const cardImages: string[][] = [];
  for (let i = 0; i < cards.length; i++) {
    cardImages.push(renderCard(faceDownIndices.includes(i) ? null : cards[i]!));
  }

  const lines: string[] = [];
  for (let row = 0; row < CARD_H; row++) {
    // Build a fixed-width buffer of visual characters + ANSI codes
    // Each slot occupies CARD_SLOT_W visual chars (11 card + 1 gap), last has no gap
    let line = "";

    // Render each slot in order
    for (let s = 0; s < totalSlots; s++) {
      if (s > 0) line += " "; // 1-char gap between slots

      if (s === animIdx) {
        // This is the animating card — skip it here, draw placeholder if applicable
        if (s < placeholderSlots) {
          line += phCard[row];
        } else {
          line += " ".repeat(11); // empty space for this slot
        }
      } else if (s < settledCount) {
        // Settled real card
        line += cardImages[s]![row];
      } else if (s < placeholderSlots) {
        // Placeholder
        line += phCard[row];
      } else {
        line += " ".repeat(11);
      }
    }

    // Now overlay the animating card at its offset position
    if (isAnimating) {
      const animCardRow = cardImages[animIdx]![row]!;
      const animVisW = 11; // card visual width
      const slotStart = animIdx * CARD_SLOT_W;
      const animStart = slotStart + lastCardOffset;

      // Strip ANSI from base line to get visual char positions
      const baseVis = t.stripAnsi(line);
      const baseLen = baseVis.length;

      // Rebuild: [base up to animStart] + [anim card] + [base after anim card]
      let out = "";
      if (animStart <= baseLen) {
        out += sliceAnsi(line, 0, animStart);
      } else {
        out += line + " ".repeat(animStart - baseLen);
      }
      out += animCardRow;
      // Append remainder of base after the anim card ends (if any)
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

// Slice an ANSI-colored string by visual character positions [start, end)
function sliceAnsi(str: string, start: number, end: number): string {
  let result = "";
  let visPos = 0;
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\x1b' && str[i + 1] === '[') {
      const escStart = i;
      i += 2;
      while (i < str.length && str[i] !== 'm') i++;
      i++;
      if (visPos >= start && visPos < end) result += str.slice(escStart, i);
      continue;
    }
    if (visPos >= end) break;
    if (visPos >= start) result += str[i];
    visPos++;
    i++;
  }
  // Ensure we close any open ANSI sequences
  if (result.length > 0) result += t.reset;
  return result;
}

function renderCardCountLine(cards: Card[], faceDownIndices: number[]): string {
  let line = "";
  for (let i = 0; i < cards.length; i++) {
    if (i > 0) line += " ";
    if (faceDownIndices.includes(i)) {
      line += " ".repeat(11);
    } else {
      const val = hiLoValue(cards[i]!);
      const label = val > 0 ? `+${val}` : val === 0 ? "0" : `${val}`;
      const clr = val > 0 ? t.green : val < 0 ? t.red : t.white;
      const visLen = label.length;
      const padL = Math.floor((11 - visLen) / 2);
      const padR = 11 - visLen - padL;
      line += " ".repeat(padL) + `${clr}${label}${t.reset}` + " ".repeat(padR);
    }
  }
  return line;
}

// --- Main screen renderer ---

export function renderBlackjackScreen(state: AppState): string[] {
  const { columns: width } = process.stdout;
  const lines: string[] = [];
  const bj = state.blackjack;

  // Header — matches roulette style
  const balStr = `$${state.balance.toLocaleString()}`;
  const header = `  ${t.bold}${t.yellow}BLACKJACK${t.reset}  ${t.green}${balStr}${t.reset}`;
  lines.push(header);
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);

  // Shoe bar — depleting bar with yellow cut card, stretches full width
  const totalShoe = bj.numDecks * 52;
  const leftLabel = "  Shoe ";
  const rightLabel = ` ${bj.shoe.length}/${totalShoe}  `;
  const barMax = Math.max(10, width - leftLabel.length - rightLabel.length);
  const filled = Math.round((bj.shoe.length / totalShoe) * barMax);
  const cutPos = Math.round((bj.cutCard / totalShoe) * barMax);
  let bar = "";
  for (let i = 0; i < barMax; i++) {
    if (i === cutPos) {
      bar += `${t.yellow}${t.bold}|${t.reset}`;
    } else if (i < filled) {
      bar += `${t.gray}█${t.reset}`;
    } else {
      bar += `${t.fg256(238)}░${t.reset}`;
    }
  }
  lines.push(`${t.gray}${leftLabel}${t.reset}${bar}${t.gray}${rightLabel}${t.reset}`);

  // Count line or empty space between shoe and bet
  if (bj.showCount) {
    const rc = bj.runningCount;
    const rcStr = rc >= 0 ? `+${rc}` : `${rc}`;
    const decksLeft = Math.max(1, bj.shoe.length / 52);
    const tc = rc / decksLeft;
    const tcStr = (tc >= 0 ? "+" : "") + tc.toFixed(1);
    lines.push(`  ${t.gray}Count: ${t.reset}${t.brightWhite}${t.bold}${rcStr}${t.reset}  ${t.gray}True: ${t.reset}${t.brightWhite}${t.bold}${tcStr}${t.reset}`);
  } else {
    lines.push("");
  }
  lines.push(`  ${t.gray}Bet: ${t.reset}${t.brightWhite}${t.bold}$${bj.betAmount}${t.reset}`);

  lines.push("");
  lines.push("");

  // Left-aligned table area with fixed indent
  const pad = "  "; // 2-space left margin
  const hasCards = bj.dealerCards.length > 0 || (bj.playerHands.length > 0 && bj.playerHands[0]!.cards.length > 0);

  renderTable(lines, state, pad, hasCards);

  return lines;
}

// --- Table rendering (normal) ---

function renderTable(lines: string[], state: AppState, pad: string, hasCards: boolean): void {
  const bj = state.blackjack;
  const anim = bj.cardAnim;
  const dealerOffset = anim?.target === 'dealer' ? cardAnimOffset(anim.frame) : 0;
  const playerOffset = anim?.target === 'player' ? cardAnimOffset(anim.frame) : 0;

  // Dealer
  lines.push(`${pad}${t.gray}DEALER${t.reset}`);
  if (hasCards) {
    const showDealer = bj.dealerRevealed;
    let dealerInfo = "";
    if (showDealer) {
      const val = handValue(bj.dealerCards).value;
      const bust = val > 21;
      const valClr = bust ? t.red : t.white;
      dealerInfo = `${t.gray}[${t.reset}${valClr}${t.bold}${val}${t.reset}${t.gray}]${t.reset}`;
      if (bust) dealerInfo += ` ${t.red}BUST${t.reset}`;
    } else if (bj.dealerCards.length > 0) {
      const upCard = bj.dealerCards[0]!;
      const upVal = upCard.rank === 'A' ? 11 : (['K','Q','J'].includes(upCard.rank) ? 10 : parseInt(upCard.rank));
      dealerInfo = `${t.gray}[${t.dim}${upVal}${t.gray}]${t.reset}`;
    }
    lines.push(`${pad}${dealerInfo}`);
  } else {
    lines.push("");
  }

  if (hasCards) {
    const faceDown = bj.dealerRevealed ? [] : [1];
    const dealerSettled = dealerOffset > 0 ? bj.dealerCards.length - 1 : bj.dealerCards.length;
    const dealerPh = dealerSettled < 2 ? 2 : 0;
    const dealerCardLines = renderHandCards(bj.dealerCards, faceDown, dealerPh, dealerOffset);
    for (const line of dealerCardLines) lines.push(`${pad}${line}`);
    if (bj.showCount && bj.dealerCards.length > 0) {
      lines.push(`${pad}${renderCardCountLine(bj.dealerCards, faceDown)}`);
      lines.push("");
    } else {
      lines.push("");
      lines.push("");
    }
  } else {
    const ph = renderPlaceholderHand();
    for (const line of ph) lines.push(`${pad}${line}`);
    lines.push("");
    lines.push("");
  }

  // Player hands
  if (hasCards) {
    for (let h = 0; h < bj.playerHands.length; h++) {
      const hand = bj.playerHands[h]!;
      const isActive = h === bj.activeHand && bj.phase === "playing";
      const multi = bj.playerHands.length > 1;

      let nameLabel = multi
        ? `${isActive ? `${t.yellow}${t.bold}►${t.reset} ` : "  "}${t.gray}HAND ${h + 1}${t.reset}`
        : `${t.gray}YOUR HAND${t.reset}`;
      lines.push(`${pad}${nameLabel}`);

      let infoLine = "";
      if (hand.cards.length > 0) {
        const { value, soft } = handValue(hand.cards);
        const bust = value > 21;
        const bj21 = isBlackjack(hand.cards);
        const valClr = bust ? t.red : bj21 ? t.brightGreen : t.white;
        const softStr = soft && !bust && !bj21 ? "soft " : "";
        infoLine += `${t.gray}[${t.reset}${valClr}${t.bold}${softStr}${value}${t.reset}${t.gray}]${t.reset}`;
      }
      infoLine += `  ${t.dim}$${hand.bet}${t.reset}`;
      if (hand.result && bj.phase === "result") {
        infoLine += "  ";
        switch (hand.result) {
          case "blackjack": infoLine += `${t.brightGreen}${t.bold}BLACKJACK!${t.reset}`; break;
          case "win":       infoLine += `${t.green}${t.bold}WIN${t.reset}`; break;
          case "push":      infoLine += `${t.yellow}PUSH${t.reset}`; break;
          case "lose":      infoLine += `${t.red}LOSE${t.reset}`; break;
          case "bust":      infoLine += `${t.red}BUST${t.reset}`; break;
        }
      }
      // Hint display
      if (bj.showHint && isActive && bj.phase === "playing" && hand.cards.length >= 2 && bj.dealerCards.length > 0) {
        const canSp = canSplit(state);
        const canDb = canDouble(state);
        const hint = getBasicStrategyHint(hand.cards, bj.dealerCards[0]!, canSp, canDb);
        infoLine += `  ${t.cyan}${t.bold}${hint}${t.reset}`;
      }
      lines.push(`${pad}${infoLine}`);
      const handOffset = (isActive || !multi) ? playerOffset : 0;
      const playerSettled = handOffset > 0 ? hand.cards.length - 1 : hand.cards.length;
      const playerPh = playerSettled < 2 ? 2 : 0;
      const cardLines = renderHandCards(hand.cards, [], playerPh, handOffset);
      for (const line of cardLines) lines.push(`${pad}${line}`);
      if (bj.showCount && hand.cards.length > 0) {
        lines.push(`${pad}${renderCardCountLine(hand.cards, [])}`);
      }
      if (h < bj.playerHands.length - 1) lines.push("");
    }
  } else {
    lines.push(`${pad}${t.gray}YOUR HAND${t.reset}`);
    lines.push("");
    const ph = renderPlaceholderHand();
    for (const line of ph) lines.push(`${pad}${line}`);
  }

  if (!(bj.showCount && hasCards)) lines.push("");

  // Status line
  if (bj.phase === "result" && !bj.cardAnim) {
    lines.push("");
    if (bj.winAmount > 0) {
      lines.push(`${pad}${t.green}${t.bold}+$${bj.winAmount}${t.reset}`);
    } else if (bj.winAmount < 0) {
      lines.push(`${pad}${t.red}${t.bold}-$${Math.abs(bj.winAmount)}${t.reset}`);
    } else {
      lines.push(`${pad}${t.yellow}$0${t.reset}`);
    }
  } else if (bj.phase === "insurance") {
    const cost = Math.floor(bj.betAmount / 2);
    let insuranceLine = `${pad}${t.yellow}Insurance? ${t.reset}${t.brightWhite}${t.bold}$${cost}${t.reset}  ${t.gray}(y/n)${t.reset}`;
    if (bj.showHint) {
      insuranceLine += `  ${t.cyan}${t.bold}No${t.reset}`;
    }
    lines.push(insuranceLine);
  } else if (bj.phase === "dealer") {
    lines.push(`${pad}${t.yellow}Dealer draws...${t.reset}`);
  } else if (state.message) {
    lines.push(`${pad}${t.yellow}${state.message}${t.reset}`);
  }
}

// --- Hotkey grid ---

export function renderBjHotkeyGrid(width: number, state: AppState): string[] {
  const bj = state.blackjack;
  type HK = { key: string; label: string };
  let left: HK[] = [];
  let right: HK[] = [];

  switch (bj.phase) {
    case "betting":
      left = [
        { key: "↑↓", label: "Bet size" },
        { key: "Enter", label: "Deal" },
      ];
      right = [
        { key: "h", label: bj.showHint ? "Hide hint" : "Show hint" },
        { key: "c", label: bj.showCount ? "Hide count" : "Show count" },
        { key: "q", label: "Menu" },
      ];
      break;
    case "insurance":
      left = [
        { key: "y", label: "Insurance" },
        { key: "n", label: "No insurance" },
      ];
      right = [{ key: "q", label: "Menu" }];
      break;
    case "playing": {
      left = [
        { key: "Enter", label: "Hit" },
        { key: "s", label: "Stand" },
      ];
      if (canDouble(state)) left.push({ key: "d", label: "Double" });
      if (canSplit(state)) left.push({ key: "p", label: "Split" });
      right = [
        { key: "h", label: bj.showHint ? "Hide hint" : "Show hint" },
        { key: "c", label: bj.showCount ? "Hide count" : "Show count" },
        { key: "q", label: "Menu" },
      ];
      break;
    }
    case "dealer":
      left = [{ key: "Enter", label: "Skip" }];
      right = [{ key: "q", label: "Menu" }];
      break;
    case "result":
      left = [{ key: "Enter", label: "New round" }];
      right = [
        { key: "h", label: bj.showHint ? "Hide hint" : "Show hint" },
        { key: "c", label: bj.showCount ? "Hide count" : "Show count" },
        { key: "q", label: "Menu" },
      ];
      break;
  }

  const all = [...left, ...right];
  if (all.length === 0) return [""];

  function renderCell(h: HK, maxK: number, maxL: number): string {
    return `${t.white}${t.bold}${h.key.padStart(maxK)}${t.reset}  ${t.gray}${h.label.padEnd(maxL)}${t.reset}`;
  }

  // Render left group flush-left, right group flush-right
  const maxRows = Math.max(left.length, right.length);
  const lMaxK = left.length > 0 ? Math.max(...left.map(h => h.key.length)) : 0;
  const lMaxL = left.length > 0 ? Math.max(...left.map(h => h.label.length)) : 0;
  const rMaxK = right.length > 0 ? Math.max(...right.map(h => h.key.length)) : 0;
  const rMaxL = right.length > 0 ? Math.max(...right.map(h => h.label.length)) : 0;
  const rightColW = rMaxK + 2 + rMaxL;
  const margin = 2; // left/right margin

  const gridLines: string[] = [];
  for (let r = 0; r < maxRows; r++) {
    let leftPart = "";
    if (r < left.length) {
      leftPart = renderCell(left[r]!, lMaxK, lMaxL);
    }
    const leftVisLen = t.stripAnsi(leftPart).length;

    let rightPart = "";
    if (r < right.length) {
      rightPart = renderCell(right[r]!, rMaxK, rMaxL);
    }
    const rightVisLen = t.stripAnsi(rightPart).length;

    const gap = Math.max(2, width - margin * 2 - leftVisLen - rightVisLen);
    gridLines.push(" ".repeat(margin) + leftPart + " ".repeat(gap) + rightPart);
  }
  return gridLines;
}
