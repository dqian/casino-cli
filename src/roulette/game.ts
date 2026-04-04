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
  const totalFrames = 80 + Math.floor(Math.random() * 50);
  const startIdx = Math.floor(Math.random() * WHEEL_ORDER.length);
  // Randomize the easing power (2.0–4.0) and number of rotations (2–5)
  const easePower = 2.0 + Math.random() * 2.0;
  const rotations = 2 + Math.floor(Math.random() * 4);
  // Random delay jitter factor (0.8–1.2)
  const jitterBase = 0.8 + Math.random() * 0.4;

  // Ball mode: drop ball into bounding box above wheel
  if (state.roulette.wheelMode === "ball") {
    state.roulette.ballY = 0;
    state.roulette.ballRow = 0;
    state.roulette.ballCol = (Math.random() - 0.5) * 20;
    state.roulette.ballVY = 0.15 + Math.random() * 0.1;
    state.roulette.ballVX = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2);
    state.roulette.ballBouncing = true;
    startBallPhysics(state, render);
  }

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

  // Ball mode: if ball has settled, snap wheel to target immediately
  if (state.roulette.wheelMode === "ball" && !state.roulette.ballBouncing && frame > 30) {
    const finalNum = WHEEL_ORDER[targetIdx] ?? 0;
    state.roulette.spinHighlight = finalNum;
    state.roulette.spinHalfStep = false;
    finishSpin(state, render, finalNum);
    return;
  }

  if (frame > totalFrames) {
    const finalNum = WHEEL_ORDER[targetIdx] ?? 0;
    state.roulette.spinHighlight = finalNum;
    state.roulette.spinHalfStep = false;

    if (state.roulette.wheelMode === "ball" && state.roulette.ballBouncing) {
      // Ball still bouncing — wait for it to settle, then finish
      const waitForBall = () => {
        if (!state.roulette.ballBouncing) {
          finishSpin(state, render, finalNum);
          return;
        }
        setTimeout(waitForBall, 30);
      };
      waitForBall();
      return;
    }

    state.roulette.ballRow = 6;
    state.roulette.ballCol = 0;
    finishSpin(state, render, finalNum);
    return;
  }

  const progress = frame / totalFrames;
  const eased = 1 - Math.pow(1 - progress, easePower);
  const totalTravel = rotations * WHEEL_ORDER.length + ((targetIdx - startIdx + WHEEL_ORDER.length) % WHEEL_ORDER.length);
  const currentHalfTravel = Math.floor(totalTravel * 2 * eased);
  const currentIdx = (startIdx + Math.floor(currentHalfTravel / 2)) % WHEEL_ORDER.length;

  state.roulette.spinHighlight = WHEEL_ORDER[currentIdx] ?? 0;
  state.roulette.spinHalfStep = currentHalfTravel % 2 === 1;
  state.roulette.spinFrame = frame;

  render();

  // Randomized delay: base curve + per-frame jitter
  const baseDelay = 20 + Math.floor(130 * eased);
  const jitter = jitterBase + (Math.random() - 0.5) * 0.3;
  const delay = Math.max(15, Math.floor(baseDelay * jitter));
  setTimeout(() => animateSpin(state, render, startIdx, targetIdx, frame + 1, totalFrames, easePower, rotations, jitterBase), delay);
}

function stepBallPhysics(rs: AppState["roulette"], tick: number): void {
  // Bounding box: y 0 (top) to FLOOR (bottom), x -HALF_W to +HALF_W
  const FLOOR = 5;
  const HALF_W = 17;
  const GRAVITY = 0.04;
  const BOUNCE = 0.5;
  const WALL_BOUNCE = 0.6;
  const FRICTION = 0.97;

  // Calm factor: 0 for first 2s, ramps to 1 over next 3s
  const elapsed = tick * 0.02; // 20ms per tick
  const calm = elapsed > 2 ? Math.min(1, (elapsed - 2) / 3) : 0;

  // Gravity pulls ball down
  rs.ballVY += GRAVITY;

  // Move
  rs.ballY += rs.ballVY;
  rs.ballCol += rs.ballVX;

  // Bounce off floor — spinning wheel kicks ball back up
  if (rs.ballY >= FLOOR) {
    rs.ballY = FLOOR;
    rs.ballVY = -Math.abs(rs.ballVY) * BOUNCE;
    // Wheel kick: spinning wheel imparts upward energy, fades as wheel slows
    rs.ballVY -= 0.35 * (1 - calm);
    // Random horizontal kick on bounce, fades with calming
    rs.ballVX += (Math.random() - 0.5) * (2.0 * (1 - calm * 0.8));
  }

  // Bounce off ceiling
  if (rs.ballY < 0) {
    rs.ballY = 0;
    rs.ballVY = Math.abs(rs.ballVY) * 0.5;
  }

  // Bounce off side walls
  if (rs.ballCol > HALF_W) { rs.ballCol = HALF_W; rs.ballVX = -Math.abs(rs.ballVX) * WALL_BOUNCE; }
  if (rs.ballCol < -HALF_W) { rs.ballCol = -HALF_W; rs.ballVX = Math.abs(rs.ballVX) * WALL_BOUNCE; }

  // Horizontal friction (increases as ball calms)
  rs.ballVX *= FRICTION - calm * 0.06;

  // Non-linear row mapping: ball moves fastest near floor, so allocate
  // more y-range to bottom rows for visually even dwell time per row.
  const norm = Math.min(1, Math.max(0, rs.ballY / FLOOR));
  rs.ballRow = Math.min(5, Math.max(0, Math.floor(6 * Math.pow(norm, 0.7))));

  // Settle: on floor, low energy, past minimum time (~3s)
  const energy = Math.abs(rs.ballVY) + Math.abs(rs.ballVX);
  if (energy < 0.15 && rs.ballY >= FLOOR - 0.2 && elapsed > 3) {
    rs.ballY = FLOOR;
    rs.ballVY = 0;
    rs.ballVX = 0;
    rs.ballBouncing = false;
    rs.ballRow = 6;
  }
}

function startBallPhysics(state: AppState, render: () => void): void {
  let tickCount = 0;
  const step = () => {
    const rs = state.roulette;
    if (!rs.ballBouncing) return;
    // Skip check (user pressed Enter)
    if (rs.spinFrame > 9000) {
      rs.ballRow = 6;
      rs.ballCol = 0;
      rs.ballBouncing = false;
      render();
      return;
    }
    tickCount++;
    stepBallPhysics(rs, tickCount);
    render();
    setTimeout(step, 20);
  };
  setTimeout(step, 20);
}

function finishSpin(state: AppState, render: () => void, finalNum: number): void {
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
  state.roulette.ballRow = 0;
  state.roulette.ballCol = 0;
  state.roulette.ballY = 0;
  state.roulette.ballVY = 0;
  state.roulette.ballVX = 0;
  state.roulette.ballBouncing = false;
  state.message = "";
}
