import type { Card } from "../types";
import { handValue, cardValue } from "./deck";

// Basic strategy lookup tables
// Each string is 10 chars: action vs dealer up card 2,3,4,5,6,7,8,9,T,A
// H=Hit, S=Stand, D=Double(or Hit), d=Double(or Stand), P=Split

const HARD: Record<number, string> = {
  4:  'HHHHHHHHHH',
  5:  'HHHHHHHHHH',
  6:  'HHHHHHHHHH',
  7:  'HHHHHHHHHH',
  8:  'HHHHHHHHHH',
  9:  'HDDDDHHHHH',
  10: 'DDDDDDDDHH',
  11: 'DDDDDDDDDD',
  12: 'HHSSSHHHHH',
  13: 'SSSSSHHHHH',
  14: 'SSSSSHHHHH',
  15: 'SSSSSHHHHH',
  16: 'SSSSSHHHHH',
  17: 'SSSSSSSSSS',
  18: 'SSSSSSSSSS',
  19: 'SSSSSSSSSS',
  20: 'SSSSSSSSSS',
  21: 'SSSSSSSSSS',
};

const SOFT: Record<number, string> = {
  13: 'HHHDDHHHHH', // A,2
  14: 'HHHDDHHHHH', // A,3
  15: 'HHDDDHHHHH', // A,4
  16: 'HHDDDHHHHH', // A,5
  17: 'HDDDDHHHHH', // A,6
  18: 'dddddSSHHH', // A,7
  19: 'SSSSSSSSSS', // A,8
  20: 'SSSSSSSSSS', // A,9
};

const PAIR: Record<string, string> = {
  'A':  'PPPPPPPPPP',
  '2':  'PPPPPPHHHH',
  '3':  'PPPPPPHHHH',
  '4':  'HHHPPHHHHH',
  '5':  'DDDDDDDDHH', // never split, play as hard 10
  '6':  'PPPPPHHHHH',
  '7':  'PPPPPPHHHH',
  '8':  'PPPPPPPPPP',
  '9':  'PPPPPSPPSS',
  '10': 'SSSSSSSSSS',
};

function dealerIdx(upCard: Card): number {
  const v = cardValue(upCard);
  if (v === 11) return 9; // Ace
  return v - 2; // 2=0, 3=1, ..., 10=8
}

function actionLabel(code: string, canDouble: boolean): string {
  switch (code) {
    case 'H': return 'Hit';
    case 'S': return 'Stand';
    case 'D': return canDouble ? 'Double' : 'Hit';
    case 'd': return canDouble ? 'Double' : 'Stand';
    case 'P': return 'Split';
    default: return 'Hit';
  }
}

export function getBasicStrategyHint(
  playerCards: Card[],
  dealerUpCard: Card,
  canSplitHand: boolean,
  canDoubleHand: boolean,
): string {
  const idx = dealerIdx(dealerUpCard);
  const { value, soft } = handValue(playerCards);

  // Check pairs first
  if (playerCards.length === 2 && canSplitHand) {
    const r1 = playerCards[0]!.rank;
    const r2 = playerCards[1]!.rank;
    if (r1 === r2) {
      const pairKey = (['10', 'J', 'Q', 'K'].includes(r1)) ? '10' : r1;
      const row = PAIR[pairKey];
      if (row) {
        const code = row[idx]!;
        if (code === 'P') return 'Split';
        // Not splitting — fall through to hard/soft
      }
    }
  }

  // Soft total (has ace counted as 11)
  if (soft && value >= 13 && value <= 20) {
    const row = SOFT[value];
    if (row) return actionLabel(row[idx]!, canDoubleHand);
  }

  // Hard total
  const clamped = Math.max(4, Math.min(21, value));
  const row = HARD[clamped];
  if (row) return actionLabel(row[idx]!, canDoubleHand);

  return 'Stand';
}
