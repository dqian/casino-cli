import type { AppState, Card } from "../types";
import * as t from "../theme";
import { handValue, isBlackjack, hiLoValue } from "./deck";
import { canSplit, canDouble } from "./game";
import { getBasicStrategyHint } from "./strategy";
import { renderHeader, sliceAnsi, renderHotkeySplit, widthWarning } from "../shared/render";
import type { HotkeyItem } from "../shared/render";
import {
  CARD_H, INNER_W, INNER_H, renderStandardCard, renderFaceDown,
} from "../shared/cardRender";

function renderCard(card: Card | null): string[] {
  if (!card) return renderFaceDown();
  const clr = (card.suit === '♥' || card.suit === '♦') ? t.brightRed : t.brightWhite;
  return renderStandardCard(card.rank, card.suit, clr);
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

  // Header
  lines.push(...renderHeader("BLACKJACK", state.balance, width));

  const warn = widthWarning(width, 60);
  if (warn) lines.push(warn);

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
  let left: HotkeyItem[] = [];
  let right: HotkeyItem[] = [];

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

  return renderHotkeySplit(left, right, width);
}
