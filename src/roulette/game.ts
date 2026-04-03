import type { AppState, BetType } from "../types";
import { cellAt, cellToBet, sameBet, isWinner, payout, WHEEL_ORDER } from "./board";

export function placeBet(state: AppState): void {
  const cell = cellAt(state.roulette.cursorRow, state.roulette.cursorCol);
  if (!cell) return;

  const amount = state.roulette.betAmount;
  if (amount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  const betType = cellToBet(cell) as BetType;

  // Check if same bet already exists, if so add to it
  const existing = state.roulette.bets.find(b => sameBet(cell, b.type));
  if (existing) {
    existing.amount += amount;
  } else {
    state.roulette.bets.push({ type: betType, amount });
  }

  state.balance -= amount;
  state.message = "";
}

export function clearBets(state: AppState): void {
  const total = state.roulette.bets.reduce((sum, b) => sum + b.amount, 0);
  state.balance += total;
  state.roulette.bets = [];
  state.message = "Bets cleared";
}

export function totalBets(state: AppState): number {
  return state.roulette.bets.reduce((sum, b) => sum + b.amount, 0);
}

export function spin(state: AppState, render: () => void): void {
  if (state.roulette.bets.length === 0) {
    state.message = "Place a bet first!";
    return;
  }

  state.roulette.phase = "spinning";
  state.message = "";

  // Pick random result
  const target = Math.floor(Math.random() * 37); // 0-36
  state.roulette.spinTarget = target;

  const targetIdx = WHEEL_ORDER.indexOf(target);
  const totalFrames = 60 + Math.floor(Math.random() * 20);
  const startIdx = Math.floor(Math.random() * WHEEL_ORDER.length);

  animateSpin(state, render, startIdx, targetIdx, 0, totalFrames);
}

function animateSpin(
  state: AppState,
  render: () => void,
  startIdx: number,
  targetIdx: number,
  frame: number,
  totalFrames: number,
): void {
  if (frame > totalFrames) {
    // Final landing
    const finalNum = WHEEL_ORDER[targetIdx] ?? 0;
    state.roulette.spinHighlight = finalNum;
    state.roulette.result = finalNum;

    // Calculate winnings
    let winnings = 0;
    for (const bet of state.roulette.bets) {
      if (isWinner(finalNum, bet.type)) {
        const multiplier = payout(bet.type);
        winnings += bet.amount * (multiplier + 1);
      }
    }

    state.roulette.winAmount = winnings;
    state.balance += winnings;
    state.roulette.phase = "result";
    render();
    return;
  }

  const progress = frame / totalFrames;

  // How many total wheel positions to traverse (3+ full rotations + land on target)
  const totalTravel = 3 * WHEEL_ORDER.length + ((targetIdx - startIdx + WHEEL_ORDER.length) % WHEEL_ORDER.length);
  const currentTravel = Math.floor(totalTravel * easeOutCubic(progress));
  const currentIdx = (startIdx + currentTravel) % WHEEL_ORDER.length;

  state.roulette.spinHighlight = WHEEL_ORDER[currentIdx] ?? 0;
  state.roulette.spinFrame = frame;
  render();

  const delay = getFrameDelay(frame, totalFrames);
  setTimeout(() => animateSpin(state, render, startIdx, targetIdx, frame + 1, totalFrames), delay);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function getFrameDelay(frame: number, total: number): number {
  const progress = frame / total;
  return 30 + Math.floor(170 * easeOutCubic(progress));
}

export function newRound(state: AppState): void {
  state.roulette.bets = [];
  state.roulette.phase = "betting";
  state.roulette.result = null;
  state.roulette.spinFrame = 0;
  state.roulette.winAmount = 0;
  state.message = "";
}
