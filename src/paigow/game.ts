// Pai Gow Poker — game logic: deal, arrange, house way, compare

import type { AppState, PaiGowCard, PaiGowState } from "../types";
import type { PaiGowSortMode } from "../types";
import {
  createPaiGowDeck, drawCards, evaluate5, evaluate2,
  compareHands, isValidArrangement, isJoker, rankValue,
} from "./cards";

// --- State factory ---

export function createPaiGowState(): PaiGowState {
  return {
    phase: 'betting',
    deck: [],
    playerCards: [],
    dealerCards: [],
    lowHand: [],
    cursor: 0,
    dealerHigh: [],
    dealerLow: [],
    betAmount: 25,
    winAmount: 0,
    resultMessage: '',
    foulMessage: '',
    sortMode: 'ascending',
    coloredSuits: true,
    spreadFrame: 0,
  };
}

function sortCards(cards: PaiGowCard[], mode: PaiGowSortMode): void {
  if (mode === 'unsorted') return;
  const dir = mode === 'ascending' ? 1 : -1;
  cards.sort((a, b) => {
    const va = isJoker(a) ? (mode === 'ascending' ? 15 : 15) : rankValue(a.rank);
    const vb = isJoker(b) ? (mode === 'ascending' ? 15 : 15) : rankValue(b.rank);
    return (va - vb) * dir;
  });
}

// --- Deal ---

export function deal(state: AppState): void {
  const pg = state.paigow;
  if (pg.betAmount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  state.balance -= pg.betAmount;
  pg.deck = createPaiGowDeck();
  pg.playerCards = drawCards(pg.deck, 7);
  sortCards(pg.playerCards, pg.sortMode);
  pg.dealerCards = drawCards(pg.deck, 7);
  pg.lowHand = [];
  pg.cursor = 0;
  pg.dealerHigh = [];
  pg.dealerLow = [];
  pg.winAmount = 0;
  pg.resultMessage = '';
  pg.foulMessage = '';
  pg.spreadFrame = 1;
  pg.phase = 'arranging';
  state.message = '';
}

// --- Spread animation ---

const SPREAD_FRAMES = 12;
const SPREAD_DELAY = 45;
let spreadGen = 0;

export function startSpreadAnim(state: AppState, render: () => void): void {
  const gen = ++spreadGen;
  const step = () => {
    const pg = state.paigow;
    if (gen !== spreadGen || pg.spreadFrame <= 0) return;
    pg.spreadFrame++;
    if (pg.spreadFrame > SPREAD_FRAMES) {
      pg.spreadFrame = 0;
      render();
      return;
    }
    render();
    setTimeout(step, SPREAD_DELAY);
  };
  render();
  setTimeout(step, SPREAD_DELAY);
}

export function skipSpreadAnim(state: AppState): void {
  spreadGen++;
  state.paigow.spreadFrame = 0;
}

export function spreadProgress(pg: PaiGowState): number {
  if (pg.spreadFrame <= 0) return 1;
  const t = Math.min(1, pg.spreadFrame / SPREAD_FRAMES);
  return 1 - Math.pow(1 - t, 2); // ease-out
}

// --- Toggle a card into/out of the low hand ---

export function toggleLowHand(state: AppState, index: number): void {
  const pg = state.paigow;
  if (pg.phase !== 'arranging') return;
  if (index < 0 || index >= pg.playerCards.length) return;

  const pos = pg.lowHand.indexOf(index);
  if (pos >= 0) {
    pg.lowHand.splice(pos, 1);
    pg.foulMessage = '';
  } else if (pg.lowHand.length < 2) {
    pg.lowHand.push(index);
    pg.foulMessage = '';
  }
  // If exactly 2 selected, validate
  if (pg.lowHand.length === 2) {
    const { high, low } = getArrangedHands(pg);
    if (!isValidArrangement(high, low)) {
      pg.foulMessage = 'Foul: Low hand must be weaker than high hand';
    } else {
      pg.foulMessage = '';
    }
  }
}

// --- Get arranged hands from current selection ---

export function getArrangedHands(pg: PaiGowState): { high: PaiGowCard[]; low: PaiGowCard[] } {
  const lowSet = new Set(pg.lowHand);
  const low = pg.lowHand.map(i => pg.playerCards[i]!);
  const high = pg.playerCards.filter((_, i) => !lowSet.has(i));
  return { high, low };
}

// --- Confirm arrangement and resolve ---

export function confirmArrangement(state: AppState): void {
  const pg = state.paigow;
  if (pg.phase !== 'arranging') return;
  if (pg.lowHand.length !== 2) return;

  const { high, low } = getArrangedHands(pg);
  if (!isValidArrangement(high, low)) {
    pg.foulMessage = 'Foul: Low hand must be weaker than high hand!';
    return;
  }

  // Dealer arranges by house way
  const { high: dHigh, low: dLow } = houseWay(pg.dealerCards);
  pg.dealerHigh = dHigh;
  pg.dealerLow = dLow;

  // Compare
  const highEvalP = evaluate5(high);
  const highEvalD = evaluate5(dHigh);
  const lowEvalP = evaluate2(low);
  const lowEvalD = evaluate2(dLow);

  const highCmp = compareHands(highEvalP, highEvalD);
  const lowCmp = compareHands(lowEvalP, lowEvalD);

  // Ties go to dealer (banker advantage)
  const playerWinsHigh = highCmp > 0;
  const playerWinsLow = lowCmp > 0;

  if (playerWinsHigh && playerWinsLow) {
    // Player wins — 1:1 minus 5% commission
    const gross = pg.betAmount;
    const commission = Math.max(1, Math.floor(gross * 0.05));
    const net = gross - commission;
    state.balance += pg.betAmount + net;
    pg.winAmount = net;
    pg.resultMessage = `Win! +$${net} (5% commission: $${commission})`;
  } else if (!playerWinsHigh && !playerWinsLow) {
    // Dealer wins both
    pg.winAmount = -pg.betAmount;
    pg.resultMessage = 'Dealer wins both hands';
  } else {
    // Push (split)
    state.balance += pg.betAmount;
    pg.winAmount = 0;
    pg.resultMessage = 'Push — split hands';
  }

  pg.phase = 'result';
  state.message = '';
}

// --- Auto-arrange (house way) for player ---

export function autoArrange(state: AppState): void {
  const pg = state.paigow;
  if (pg.phase !== 'arranging') return;

  const { low: lowCards } = houseWay(pg.playerCards);

  // Find indices of the low hand cards in playerCards
  // We need to match by identity since there could be duplicates
  const used = new Set<number>();
  const lowIndices: number[] = [];
  for (const lc of lowCards) {
    for (let i = 0; i < pg.playerCards.length; i++) {
      if (!used.has(i) && pg.playerCards[i] === lc) {
        lowIndices.push(i);
        used.add(i);
        break;
      }
    }
  }

  pg.lowHand = lowIndices;
  pg.foulMessage = '';
}

// --- New round ---

export function newRound(state: AppState): void {
  const pg = state.paigow;
  pg.phase = 'betting';
  pg.playerCards = [];
  pg.dealerCards = [];
  pg.lowHand = [];
  pg.cursor = 0;
  pg.dealerHigh = [];
  pg.dealerLow = [];
  pg.winAmount = 0;
  pg.resultMessage = '';
  pg.foulMessage = '';
  state.message = '';
}

// --- House Way (simplified) ---
// The house way determines how the dealer (and auto-arrange) splits 7 cards

export function houseWay(cards: PaiGowCard[]): { high: PaiGowCard[]; low: PaiGowCard[] } {
  // Sort cards by rank value descending (joker treated as ace for sorting)
  const sorted = [...cards].sort((a, b) => {
    const va = isJoker(a) ? 14 : rankValue(a.rank);
    const vb = isJoker(b) ? 14 : rankValue(b.rank);
    return vb - va;
  });

  // Analyze the hand
  const hasJoker = sorted.some(isJoker);
  const nonJoker = sorted.filter(c => !isJoker(c));

  // Get rank groups
  const groups = new Map<number, PaiGowCard[]>();
  for (const c of nonJoker) {
    const v = rankValue(c.rank);
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v)!.push(c);
  }

  const pairs: number[] = [];
  const trips: number[] = [];
  const quads: number[] = [];

  for (const [val, cs] of groups) {
    if (cs.length === 4) quads.push(val);
    else if (cs.length === 3) trips.push(val);
    else if (cs.length === 2) pairs.push(val);
  }
  pairs.sort((a, b) => b - a);
  trips.sort((a, b) => b - a);
  quads.sort((a, b) => b - a);

  // Check for flush/straight possibilities in the 7 cards
  const flushSuit = findFlushSuit(sorted);
  const straightCards = findBestStraight(sorted);

  // Five Aces (4 aces + joker): split 3 aces in high, 2 in low
  if (hasJoker && (groups.get(14)?.length ?? 0) === 4) {
    const aces = groups.get(14)!;
    const joker = sorted.find(isJoker)!;
    const others = nonJoker.filter(c => rankValue(c.rank) !== 14);
    others.sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
    const low = [aces[0]!, aces[1]!];
    const high = [aces[2]!, aces[3]!, joker, others[0]!, others[1]!];
    return { high, low };
  }

  // Four of a kind
  if (quads.length > 0) {
    const quadVal = quads[0]!;
    const quadCards = groups.get(quadVal)!;
    const rest = sorted.filter(c => !isJoker(c) && rankValue(c.rank) !== quadVal);
    const joker = hasJoker ? sorted.find(isJoker) : null;
    if (joker) rest.unshift(joker);
    rest.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });

    if (quadVal >= 11) {
      // Split high quads: pair in high, pair in low
      const low = [quadCards[0]!, quadCards[1]!];
      const high = [quadCards[2]!, quadCards[3]!, rest[0]!, rest[1]!, rest[2]!];
      return { high, low };
    } else {
      // Keep low quads together
      const low = [rest[0]!, rest[1]!];
      const high = [...quadCards, rest[2]!];
      return { high, low };
    }
  }

  // Full house: split — trips in high, pair in low
  if (trips.length > 0 && pairs.length > 0) {
    const tripVal = trips[0]!;
    const pairVal = pairs[0]!;
    const tripCards = groups.get(tripVal)!;
    const pairCards = groups.get(pairVal)!;
    const rest = sorted.filter(c =>
      !isJoker(c) && rankValue(c.rank) !== tripVal && rankValue(c.rank) !== pairVal
    );
    const joker = hasJoker ? sorted.find(isJoker) : null;

    const low = [pairCards[0]!, pairCards[1]!];
    const highBase = [...tripCards];
    const filler = joker ? [joker, ...rest] : rest;
    filler.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });
    while (highBase.length < 5 && filler.length > 0) {
      highBase.push(filler.shift()!);
    }
    return { high: highBase, low };
  }

  // Two trips (rare): top trip in high, split second trip — pair in low
  if (trips.length >= 2) {
    const t1 = groups.get(trips[0]!)!;
    const t2 = groups.get(trips[1]!)!;
    const rest = sorted.filter(c =>
      !isJoker(c) && rankValue(c.rank) !== trips[0] && rankValue(c.rank) !== trips[1]
    );
    const joker = hasJoker ? sorted.find(isJoker) : null;
    const low = [t2[0]!, t2[1]!]; // pair from second trip
    const highBase = [...t1, t2[2]!];
    const filler = joker ? [joker, ...rest] : rest;
    filler.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });
    while (highBase.length < 5 && filler.length > 0) {
      highBase.push(filler.shift()!);
    }
    return { high: highBase, low };
  }

  // Three of a kind (no pair alongside)
  if (trips.length === 1) {
    const tripVal = trips[0]!;
    const tripCards = groups.get(tripVal)!;
    const rest = sorted.filter(c => !isJoker(c) && rankValue(c.rank) !== tripVal);
    const joker = hasJoker ? sorted.find(isJoker) : null;
    if (joker) rest.unshift(joker);
    rest.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });

    if (tripVal === 14) {
      // Split aces: pair in high, one ace + best kicker in low
      const low = [tripCards[0]!, rest[0]!];
      const high = [tripCards[1]!, tripCards[2]!, rest[1]!, rest[2]!, rest[3]!];
      return { high, low };
    } else {
      // Keep trips in high
      const low = [rest[0]!, rest[1]!];
      const high = [...tripCards, rest[2]!, rest[3]!];
      return { high, low };
    }
  }

  // Three pairs: highest pair in low
  if (pairs.length === 3) {
    const topPairVal = pairs[0]!;
    const topPairCards = groups.get(topPairVal)!;
    const rest = sorted.filter(c => !isJoker(c) && rankValue(c.rank) !== topPairVal);
    const joker = hasJoker ? sorted.find(isJoker) : null;
    const low = [topPairCards[0]!, topPairCards[1]!];
    const filler = joker ? [joker, ...rest] : rest;
    filler.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });
    return { high: filler.slice(0, 5), low };
  }

  // Two pair
  if (pairs.length === 2) {
    const p1 = pairs[0]!; // higher pair
    const p2 = pairs[1]!; // lower pair
    const p1Cards = groups.get(p1)!;
    const p2Cards = groups.get(p2)!;
    const rest = sorted.filter(c =>
      !isJoker(c) && rankValue(c.rank) !== p1 && rankValue(c.rank) !== p2
    );
    const joker = hasJoker ? sorted.find(isJoker) : null;
    if (joker) rest.unshift(joker);
    rest.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });

    // Split if top pair is aces or both pairs are JJ+
    if (p1 >= 14 || (p1 >= 11 && p2 >= 11)) {
      // Split: higher pair in high, lower pair in low
      // Actually: lower pair goes to low, higher pair stays in high
      const low = [p2Cards[0]!, p2Cards[1]!];
      const high = [...p1Cards, rest[0]!, rest[1]!, rest[2]!];
      return { high, low };
    } else {
      // Keep both pairs in high
      const low = [rest[0]!, rest[1]!];
      const high = [...p1Cards, ...p2Cards, rest[2]!];
      return { high, low };
    }
  }

  // One pair
  if (pairs.length === 1) {
    const pairVal = pairs[0]!;
    const pairCards = groups.get(pairVal)!;
    const rest = sorted.filter(c => !isJoker(c) && rankValue(c.rank) !== pairVal);
    const joker = hasJoker ? sorted.find(isJoker) : null;
    if (joker) rest.unshift(joker);
    rest.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });

    // Pair in high, two highest remaining in low
    const low = [rest[0]!, rest[1]!];
    const high = [...pairCards, rest[2]!, rest[3]!, rest[4]!];
    return { high, low };
  }

  // Straight or flush in 7 cards
  if (straightCards) {
    const straightSet = new Set(straightCards);
    const rest = sorted.filter(c => !straightSet.has(c));
    rest.sort((a, b) => {
      const va = isJoker(a) ? 14 : rankValue(a.rank);
      const vb = isJoker(b) ? 14 : rankValue(b.rank);
      return vb - va;
    });
    if (rest.length >= 2) {
      return { high: straightCards, low: [rest[0]!, rest[1]!] };
    }
  }

  if (flushSuit) {
    const flushCards = sorted.filter(c => c.suit === flushSuit || isJoker(c));
    if (flushCards.length >= 5) {
      const best5 = flushCards.slice(0, 5);
      const rest = sorted.filter(c => !best5.includes(c));
      rest.sort((a, b) => {
        const va = isJoker(a) ? 14 : rankValue(a.rank);
        const vb = isJoker(b) ? 14 : rankValue(b.rank);
        return vb - va;
      });
      if (rest.length >= 2) {
        return { high: best5, low: [rest[0]!, rest[1]!] };
      }
    }
  }

  // No pair: highest card in high, next two highest in low
  const low = [sorted[0]!, sorted[1]!];
  const high = sorted.slice(2, 7);
  // Wait — house way says: highest card in high hand, next two highest in low hand
  // But we need 5 in high and 2 in low. "Highest card in high hand" means
  // the high hand should contain the best card. Put 2nd and 3rd highest in low.
  const lowHW = [sorted[1]!, sorted[2]!];
  const highHW = [sorted[0]!, ...sorted.slice(3, 7)];
  return { high: highHW, low: lowHW };
}

// Find a suit that appears 5+ times (for flush detection)
function findFlushSuit(cards: PaiGowCard[]): string | null {
  const counts = new Map<string, number>();
  const jokerCount = cards.filter(isJoker).length;
  for (const c of cards) {
    if (isJoker(c)) continue;
    counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1);
  }
  for (const [suit, count] of counts) {
    if (count + jokerCount >= 5) return suit;
  }
  return null;
}

// Find best 5-card straight from 7 cards (returns the 5 cards, or null)
function findBestStraight(cards: PaiGowCard[]): PaiGowCard[] | null {
  const hasJoker = cards.some(isJoker);
  const nonJoker = cards.filter(c => !isJoker(c));

  // Try all 5-card combos from 7 to find a straight
  // (We'll pick the highest one)
  const indices = hasJoker
    ? combosFromIndices(nonJoker.length, 4) // 4 from non-joker + joker
    : combosFromIndices(nonJoker.length, 5);

  let bestStraight: PaiGowCard[] | null = null;
  let bestHigh = -1;

  for (const combo of indices) {
    const hand = combo.map(i => nonJoker[i]!);
    if (hasJoker) hand.push(cards.find(isJoker)!);

    const vals = hand.filter(c => !isJoker(c)).map(c => rankValue(c.rank)).sort((a, b) => b - a);

    if (hasJoker) {
      if (canFormStraightWith4(vals)) {
        const high = getHighOf4WithWild(vals);
        if (high > bestHigh) {
          bestHigh = high;
          bestStraight = hand;
        }
      }
    } else {
      if (vals.length === 5 && isConsec(vals)) {
        if (vals[0]! > bestHigh) {
          bestHigh = vals[0]!;
          bestStraight = hand;
        }
      }
      // Check wheel
      if (vals.length === 5 && vals[0] === 14) {
        const low = [5, ...vals.slice(1)].sort((a, b) => b - a);
        if (isConsec(low)) {
          if (5 > bestHigh) {
            bestHigh = 5;
            bestStraight = hand;
          }
        }
      }
    }
  }

  return bestStraight;
}

function isConsec(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1]! - sorted[i]! !== 1) return false;
  }
  return true;
}

function canFormStraightWith4(sorted: number[]): boolean {
  if (sorted.length !== 4) return false;
  const candidates: number[][] = [sorted];
  if (sorted[0] === 14) {
    candidates.push([...sorted.slice(1), 1].sort((a, b) => b - a));
  }
  for (const vals of candidates) {
    const high = vals[0]!;
    const low = vals[vals.length - 1]!;
    if (high - low <= 4 && new Set(vals).size === vals.length) return true;
  }
  return false;
}

function getHighOf4WithWild(sorted: number[]): number {
  const candidates: number[][] = [sorted];
  if (sorted[0] === 14) {
    candidates.push([...sorted.slice(1), 1].sort((a, b) => b - a));
  }
  let best = 0;
  for (const vals of candidates) {
    const high = vals[0]!;
    const low = vals[vals.length - 1]!;
    if (high - low <= 4 && new Set(vals).size === vals.length) {
      best = Math.max(best, low + 4);
    }
  }
  return best;
}

function combosFromIndices(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];
  function gen(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      gen(i + 1);
      combo.pop();
    }
  }
  gen(0);
  return result;
}
