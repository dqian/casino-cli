import type { Card, Rank, Suit } from "../types";

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function createShoe(numDecks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit });
      }
    }
  }
  shuffle(cards);
  return cards;
}

function shuffle(cards: Card[]): void {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
}

export function drawCard(shoe: Card[]): Card {
  return shoe.pop()!;
}

export function needsShuffle(shoe: Card[]): boolean {
  return shoe.length < 30;
}

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
