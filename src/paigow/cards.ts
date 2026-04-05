// Pai Gow Poker — deck creation, joker handling, poker hand evaluation

import type { PaiGowCard, PokerHandEval, Rank, Suit } from "../types";

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

// Numeric rank value for comparison (ace high = 14)
const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export function rankValue(r: string): number {
  return RANK_VALUE[r] ?? 0;
}

// Create a 53-card deck (52 standard + 1 joker), shuffled
export function createPaiGowDeck(): PaiGowCard[] {
  const cards: PaiGowCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ rank, suit });
    }
  }
  cards.push({ rank: 'Joker', suit: 'wild' });
  shuffle(cards);
  return cards;
}

function shuffle(cards: PaiGowCard[]): void {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
}

export function drawCards(deck: PaiGowCard[], n: number): PaiGowCard[] {
  const drawn: PaiGowCard[] = [];
  for (let i = 0; i < n; i++) {
    drawn.push(deck.pop()!);
  }
  return drawn;
}

export function isJoker(card: PaiGowCard): boolean {
  return card.rank === 'Joker';
}

// --- Poker hand evaluation (5-card) ---

// Check if cards form a flush (all same suit, treating joker as wild)
function isFlush(cards: PaiGowCard[]): boolean {
  const nonJoker = cards.filter(c => !isJoker(c));
  if (nonJoker.length === 0) return true;
  const suit = nonJoker[0]!.suit;
  return nonJoker.every(c => c.suit === suit);
}

// Get sorted rank values, treating joker optimally for straights
function getSortedValues(cards: PaiGowCard[]): number[] {
  return cards
    .filter(c => !isJoker(c))
    .map(c => rankValue(c.rank))
    .sort((a, b) => b - a);
}

// Check if cards form a straight, treating joker as wild
function isStraight(cards: PaiGowCard[]): boolean {
  const hasJoker = cards.some(isJoker);
  const values = getSortedValues(cards);

  if (hasJoker) {
    return canFormStraightWithWild(values);
  }

  // Check standard straight
  if (isConsecutiveDown(values)) return true;
  // Check A-2-3-4-5 (wheel): treat ace as 1
  if (values.length === 5 && values[0] === 14) {
    const withLowAce = [...values.slice(1), 1].sort((a, b) => b - a);
    if (isConsecutiveDown(withLowAce)) return true;
  }
  return false;
}

function isConsecutiveDown(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1]! - sorted[i]! !== 1) return false;
  }
  return true;
}

// Can 4 cards + 1 joker form a straight?
function canFormStraightWithWild(sorted: number[]): boolean {
  // sorted is desc, 4 values (joker removed)
  // Try inserting the joker at the best spot
  // The 4 cards must span at most 4 ranks (joker fills 1 gap)
  if (sorted.length !== 4) return false;

  // Try treating ace as low
  const candidates: number[][] = [sorted];
  if (sorted[0] === 14) {
    candidates.push([...sorted.slice(1), 1].sort((a, b) => b - a));
  }

  for (const vals of candidates) {
    const high = vals[0]!;
    const low = vals[vals.length - 1]!;
    if (high - low <= 4) {
      // Check for duplicates — if any duplicate, joker can't fix it
      const unique = new Set(vals);
      if (unique.size === vals.length) return true;
    }
  }
  return false;
}

// Get the straight's high card (for comparison), assuming isStraight is true
function getStraightHigh(cards: PaiGowCard[]): number {
  const hasJoker = cards.some(isJoker);
  const values = getSortedValues(cards);

  if (!hasJoker) {
    // Check for wheel (A-2-3-4-5)
    if (values.length === 5 && values[0] === 14) {
      const withLowAce = [...values.slice(1), 1].sort((a, b) => b - a);
      if (isConsecutiveDown(withLowAce)) {
        return 5; // wheel, 5-high
      }
    }
    return values[0]!;
  }

  // With joker: find the best high card
  // Try ace-high first
  const candidates: number[][] = [values];
  if (values[0] === 14) {
    candidates.push([...values.slice(1), 1].sort((a, b) => b - a));
  }

  let bestHigh = 0;
  for (const vals of candidates) {
    const high = vals[0]!;
    const low = vals[vals.length - 1]!;
    if (high - low <= 4) {
      const unique = new Set(vals);
      if (unique.size === vals.length) {
        // The joker fills the gap, so the straight goes from low to low+4
        bestHigh = Math.max(bestHigh, low + 4);
      }
    }
  }
  return bestHigh || values[0]! + 1; // joker extends the top
}

// Count rank occurrences (joker treated as ace by default, or optimally)
function getRankCounts(cards: PaiGowCard[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of cards) {
    if (isJoker(c)) continue;
    const v = rankValue(c.rank);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

// Evaluate a 5-card poker hand
export function evaluate5(cards: PaiGowCard[]): PokerHandEval {
  const hasJoker = cards.some(isJoker);
  const counts = getRankCounts(cards);
  const flush = isFlush(cards);
  const straight = isStraight(cards);

  // Count groups
  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // by count desc
    return b[0] - a[0]; // by value desc
  });

  const topCount = groups[0]?.[1] ?? 0;
  const secondCount = groups[1]?.[1] ?? 0;

  // Five Aces: 4 aces + joker
  if (hasJoker && (counts.get(14) ?? 0) === 4) {
    return { rank: 'five-aces', value: 140000000, name: 'Five Aces' };
  }

  // Straight flush / Royal flush
  if (flush && straight) {
    const high = getStraightHigh(cards);
    if (high === 14) {
      return { rank: 'royal-flush', value: 130000000 + high, name: 'Royal Flush' };
    }
    return { rank: 'straight-flush', value: 120000000 + high, name: `Straight Flush (${rankName(high)} high)` };
  }

  // Four of a kind (joker can make 3-of-a-kind into 4)
  if (topCount === 4 || (hasJoker && topCount === 3)) {
    const quadRank = topCount === 4 ? groups[0]![0] : groups[0]![0];
    const kicker = topCount === 4
      ? (groups[1]?.[0] ?? 0)
      : Math.max(...[...counts.entries()].filter(([r]) => r !== quadRank).map(([r]) => r), 0);
    return {
      rank: 'four-of-a-kind',
      value: 110000000 + quadRank * 100 + (hasJoker && topCount === 3 ? getJokerKicker(cards, quadRank) : kicker),
      name: `Four ${pluralRank(quadRank)}`,
    };
  }

  // Full house (joker can make two-pair into full house)
  if ((topCount === 3 && secondCount === 2) ||
      (hasJoker && topCount === 2 && secondCount === 2)) {
    let tripRank: number, pairRank: number;
    if (hasJoker && topCount === 2 && secondCount === 2) {
      // Joker pairs with the higher pair to make trips
      tripRank = groups[0]![0];
      pairRank = groups[1]![0];
    } else {
      tripRank = groups[0]![0];
      pairRank = groups[1]![0];
    }
    return {
      rank: 'full-house',
      value: 100000000 + tripRank * 100 + pairRank,
      name: `Full House (${pluralRank(tripRank)} full of ${pluralRank(pairRank)})`,
    };
  }

  // Flush
  if (flush) {
    const vals = getSortedValues(cards);
    // Joker counts as ace in a flush
    if (hasJoker) vals.unshift(14);
    vals.sort((a, b) => b - a);
    const val = vals.reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
    return { rank: 'flush', value: 90000000 + val, name: `Flush (${rankName(vals[0]!)} high)` };
  }

  // Straight
  if (straight) {
    const high = getStraightHigh(cards);
    return { rank: 'straight', value: 80000000 + high, name: `Straight (${rankName(high)} high)` };
  }

  // Three of a kind (joker makes a pair into trips)
  if (topCount === 3 || (hasJoker && topCount === 2 && secondCount < 2)) {
    const tripRank = groups[0]![0];
    const kickers = [...counts.entries()]
      .filter(([r]) => r !== tripRank)
      .map(([r]) => r)
      .sort((a, b) => b - a);
    const kickVal = kickers.reduce((acc, v, i) => acc + v * Math.pow(15, 1 - i), 0);
    return {
      rank: 'three-of-a-kind',
      value: 70000000 + tripRank * 1000 + kickVal,
      name: `Three ${pluralRank(tripRank)}`,
    };
  }

  // Two pair
  if (topCount === 2 && secondCount === 2) {
    const p1 = groups[0]![0];
    const p2 = groups[1]![0];
    const kicker = groups[2]?.[0] ?? 0;
    return {
      rank: 'two-pair',
      value: 60000000 + Math.max(p1, p2) * 10000 + Math.min(p1, p2) * 100 + kicker,
      name: `Two Pair (${pluralRank(Math.max(p1, p2))} and ${pluralRank(Math.min(p1, p2))})`,
    };
  }

  // One pair (joker makes a pair with highest card)
  if (topCount === 2 || hasJoker) {
    let pairRank: number;
    let kickers: number[];
    if (hasJoker) {
      // Joker pairs with highest card
      const vals = getSortedValues(cards);
      pairRank = vals[0]!;
      kickers = vals.slice(1).sort((a, b) => b - a);
    } else {
      pairRank = groups[0]![0];
      kickers = [...counts.entries()]
        .filter(([r]) => r !== pairRank)
        .map(([r]) => r)
        .sort((a, b) => b - a);
    }
    const kickVal = kickers.reduce((acc, v, i) => acc + v * Math.pow(15, 2 - i), 0);
    return {
      rank: 'one-pair',
      value: 50000000 + pairRank * 10000 + kickVal,
      name: `Pair of ${pluralRank(pairRank)}`,
    };
  }

  // High card
  const vals = getSortedValues(cards);
  if (hasJoker) vals.unshift(14);
  vals.sort((a, b) => b - a);
  const val = vals.reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
  return { rank: 'high-card', value: 40000000 + val, name: `${rankName(vals[0]!)} High` };
}

// Evaluate a 2-card hand
export function evaluate2(cards: PaiGowCard[]): PokerHandEval {
  if (cards.length !== 2) {
    return { rank: 'high-card', value: 0, name: 'Empty' };
  }

  const hasJoker = cards.some(isJoker);
  const nonJoker = cards.filter(c => !isJoker(c));

  if (hasJoker) {
    // Joker is an ace — pair of aces
    if (nonJoker.length === 1 && nonJoker[0]!.rank === 'A') {
      return { rank: 'one-pair', value: 50000000 + 14 * 100, name: 'Pair of Aces' };
    }
    // Joker as ace — ace high
    const otherVal = nonJoker.length > 0 ? rankValue(nonJoker[0]!.rank) : 0;
    return {
      rank: 'high-card',
      value: 40000000 + 14 * 100 + otherVal,
      name: `Ace High`,
    };
  }

  const v1 = rankValue(cards[0]!.rank);
  const v2 = rankValue(cards[1]!.rank);

  if (v1 === v2) {
    return { rank: 'one-pair', value: 50000000 + v1 * 100, name: `Pair of ${pluralRank(v1)}` };
  }

  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  return {
    rank: 'high-card',
    value: 40000000 + high * 100 + low,
    name: `${rankName(high)} High`,
  };
}

// Compare two evaluated hands: >0 means a wins, <0 means b wins, 0 = tie
export function compareHands(a: PokerHandEval, b: PokerHandEval): number {
  return a.value - b.value;
}

// Helper: does the high hand beat or equal the low hand?
export function isValidArrangement(high: PaiGowCard[], low: PaiGowCard[]): boolean {
  const highEval = evaluate5(high);
  const lowEval = evaluate2(low);
  return highEval.value >= lowEval.value;
}

// Utility functions
function getJokerKicker(cards: PaiGowCard[], excludeRank: number): number {
  const vals = cards
    .filter(c => !isJoker(c) && rankValue(c.rank) !== excludeRank)
    .map(c => rankValue(c.rank));
  return Math.max(...vals, 0);
}

function rankName(v: number): string {
  switch (v) {
    case 14: return 'Ace';
    case 13: return 'King';
    case 12: return 'Queen';
    case 11: return 'Jack';
    case 10: return '10';
    default: return `${v}`;
  }
}

function pluralRank(v: number): string {
  switch (v) {
    case 14: return 'Aces';
    case 13: return 'Kings';
    case 12: return 'Queens';
    case 11: return 'Jacks';
    case 10: return 'Tens';
    case 9: return 'Nines';
    case 8: return 'Eights';
    case 7: return 'Sevens';
    case 6: return 'Sixes';
    case 5: return 'Fives';
    case 4: return 'Fours';
    case 3: return 'Threes';
    case 2: return 'Twos';
    default: return `${v}s`;
  }
}

// Display name for a card
export function cardName(card: PaiGowCard): string {
  if (isJoker(card)) return 'Joker';
  return `${card.rank}${card.suit}`;
}
