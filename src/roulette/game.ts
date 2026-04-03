import type { AppState, BetType } from "../types";
import { virtualToGridPos, gridPosToBet, sameBetType, isWinner, payout, WHEEL_ORDER, tablePos } from "./board";

export function placeBet(state: AppState): void {
  const rs = state.roulette;
  const amount = rs.betAmount;
  if (amount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  const betType = cursorToBet(rs);
  if (!betType) return;

  // Stack onto existing bet of same type
  const existing = rs.bets.find(b => sameBetType(b.type, betType));
  if (existing) {
    existing.amount += amount;
  } else {
    rs.bets.push({ type: betType, amount });
  }

  state.balance -= amount;
  state.message = "";
}

function cursorToBet(rs: { cursorZone: string; cursorVR: number; cursorVC: number }): BetType | null {
  switch (rs.cursorZone) {
    case "zero":
      return { kind: "straight", number: 0 };
    case "grid": {
      const pos = virtualToGridPos(rs.cursorVR, rs.cursorVC);
      return gridPosToBet(pos);
    }
    case "column": {
      const which = (rs.cursorVC + 1) as 1 | 2 | 3;
      return { kind: "column", which };
    }
    case "dozen": {
      const which = (rs.cursorVC + 1) as 1 | 2 | 3;
      return { kind: "dozen", which };
    }
    case "outside": {
      if (rs.cursorVR === 0) {
        const types: BetType[] = [{ kind: "red" }, { kind: "black" }, { kind: "low" }];
        return types[rs.cursorVC] ?? null;
      }
      const types: BetType[] = [{ kind: "even" }, { kind: "odd" }, { kind: "high" }];
      return types[rs.cursorVC] ?? null;
    }
  }
  return null;
}

export function removeBet(state: AppState): void {
  const rs = state.roulette;
  const betType = cursorToBet(rs);
  if (!betType) return;

  const idx = rs.bets.findIndex(b => sameBetType(b.type, betType));
  if (idx === -1) return;

  state.balance += rs.bets[idx]!.amount;
  rs.bets.splice(idx, 1);
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

  const target = Math.floor(Math.random() * 37);
  state.roulette.spinTarget = target;

  const targetIdx = WHEEL_ORDER.indexOf(target);
  const totalFrames = 40 + Math.floor(Math.random() * 25);
  const startIdx = Math.floor(Math.random() * WHEEL_ORDER.length);
  // Randomize the easing power (2.0–4.0) and number of rotations (2–5)
  const easePower = 2.0 + Math.random() * 2.0;
  const rotations = 2 + Math.floor(Math.random() * 4);
  // Random delay jitter factor (0.8–1.2)
  const jitterBase = 0.8 + Math.random() * 0.4;

  animateSpin(state, render, startIdx, targetIdx, 0, totalFrames, easePower, rotations, jitterBase);
}

function animateSpin(
  state: AppState,
  render: () => void,
  startIdx: number,
  targetIdx: number,
  frame: number,
  totalFrames: number,
  easePower: number,
  rotations: number,
  jitterBase: number,
): void {
  // Check for skip (Enter during spin sets spinFrame high)
  if (state.roulette.spinFrame > totalFrames) frame = totalFrames + 1;
  if (frame > totalFrames) {
    const finalNum = WHEEL_ORDER[targetIdx] ?? 0;
    state.roulette.spinHighlight = finalNum;
    state.roulette.result = finalNum;

    let winnings = 0;
    for (const bet of state.roulette.bets) {
      if (isWinner(finalNum, bet.type)) {
        winnings += bet.amount * (payout(bet.type) + 1);
      }
    }

    state.roulette.winAmount = winnings;
    state.balance += winnings;
    state.roulette.spinHistory.push(finalNum);
    if (state.roulette.spinHistory.length > 15) state.roulette.spinHistory.shift();
    state.roulette.phase = "result";
    render();
    return;
  }

  const progress = frame / totalFrames;
  const eased = 1 - Math.pow(1 - progress, easePower);
  const totalTravel = rotations * WHEEL_ORDER.length + ((targetIdx - startIdx + WHEEL_ORDER.length) % WHEEL_ORDER.length);
  const currentTravel = Math.floor(totalTravel * eased);
  const currentIdx = (startIdx + currentTravel) % WHEEL_ORDER.length;

  state.roulette.spinHighlight = WHEEL_ORDER[currentIdx] ?? 0;
  state.roulette.spinFrame = frame;
  render();

  // Randomized delay: base curve + per-frame jitter
  const baseDelay = 20 + Math.floor(130 * eased);
  const jitter = jitterBase + (Math.random() - 0.5) * 0.3;
  const delay = Math.max(15, Math.floor(baseDelay * jitter));
  setTimeout(() => animateSpin(state, render, startIdx, targetIdx, frame + 1, totalFrames, easePower, rotations, jitterBase), delay);
}

export function newRound(state: AppState): void {
  // Move cursor to the last spun number's position
  const lastResult = state.roulette.result;
  if (lastResult !== null && lastResult > 0) {
    const pos = tablePos(lastResult);
    if (pos) {
      state.roulette.cursorZone = "grid";
      state.roulette.cursorVR = (pos.tableRow - 1) * 2;
      state.roulette.cursorVC = pos.tableCol * 2;
    }
  } else if (lastResult === 0) {
    state.roulette.cursorZone = "zero";
    state.roulette.cursorVC = 0;
  }

  state.roulette.bets = [];
  state.roulette.phase = "betting";
  state.roulette.result = null;
  state.roulette.spinFrame = 0;
  state.roulette.winAmount = 0;
  state.message = "";
}
