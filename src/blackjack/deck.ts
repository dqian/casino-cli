import type { Card } from "../types";

// Re-export shared card operations
export { createShoe, drawCard } from "../shared/cards";

export function cardValue(card: Card): number {
  if (card.rank === 'A') return 11;
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10;
  return parseInt(card.rank);
}

export function handValue(cards: Card[]): { value: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { value: total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).value === 21;
}

export function isBusted(cards: Card[]): boolean {
  return handValue(cards).value > 21;
}

export function hiLoValue(card: Card): number {
  const v = cardValue(card);
  if (v >= 2 && v <= 6) return 1;   // 2-6: +1
  if (v >= 10) return -1;           // 10,J,Q,K,A: -1
  return 0;                         // 7-9: 0
}
