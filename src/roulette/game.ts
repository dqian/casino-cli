import type { AppState, BetType } from "../types";
import { virtualToGridPos, gridPosToBet, sameBetType, isWinner, payout, WHEEL_ORDER, tablePos } from "./board";
import { playRouletteRound, type RouletteBetWire } from "../auth/client";

export function placeBet(state: AppState): void {
  const rs = state.roulette;
  const amount = rs.betAmount;
  if (amount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  // Table maximum check
  const tableMax = state.options.roulette.tableMax;
  if (tableMax !== null) {
    const currentTotal = rs.bets.reduce((s, b) => s + b.amount, 0);
    if (currentTotal + amount > tableMax) {
      state.message = `Table max $${tableMax.toLocaleString()}!`;
      return;
    }
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

  // Server-authoritative path: authed + play money. Server runs RNG and settlement.
  // Local path: offline / unauthed / non-play modes. Falls back to local RNG.
  // (Real money roulette is currently gated at the menu and at the server, so this
  // branch is play-only today; the same code path will handle real money once enabled.)
  const useServer = state.auth.loggedIn && !!state.auth.token && state.moneyMode === "play";

  if (useServer) {
    spinServerDriven(state, render);
  } else {
    spinLocal(state, render);
  }
}

/** Local spin path — Math.random RNG, local settlement. Used when offline or unauthed. */
function spinLocal(state: AppState, render: () => void): void {
  const target = Math.floor(Math.random() * 37);
  startSpinAnimation(state, render, target);
}

/**
 * Server-driven spin: send the round to the backend, await the outcome,
 * then animate toward the server's winning number. Server is the source of
 * truth for both the result and the post-round balance.
 */
function spinServerDriven(state: AppState, render: () => void): void {
  // Render the spinning state immediately so the user gets feedback while we wait.
  render();

  // Convert local bets ($ as number) to wire format (cents as string).
  // We sanity-check the amounts here — the bets array has gone through
  // placeBet's validation already, but a debug hook or an unrelated bug
  // could have left a NaN / non-finite / zero amount in the state. The
  // server would reject such a payload, but catching it client-side lets
  // us produce a clearer error message and avoid an unnecessary round trip.
  const wireBets: RouletteBetWire[] = [];
  for (const b of state.roulette.bets) {
    if (!Number.isFinite(b.amount) || b.amount <= 0) {
      state.roulette.phase = "betting";
      state.message = "Invalid bet amount";
      render();
      return;
    }
    const cents = Math.round(b.amount * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      state.roulette.phase = "betting";
      state.message = "Invalid bet amount";
      render();
      return;
    }
    wireBets.push({ bet: b.type, amount: String(cents) });
  }

  playRouletteRound(state.auth.token, "play", wireBets).then((res) => {
    if (state.roulette.phase !== "spinning") return; // user navigated away

    if (res.error || res.winningNumber === undefined || res.balanceAfter === undefined) {
      // Refund local stakes (the local debits in placeBet are still in effect)
      const totalStake = state.roulette.bets.reduce((s, b) => s + b.amount, 0);
      state.balance += totalStake;
      state.roulette.bets = [];
      state.roulette.phase = "betting";
      state.message = res.error || "Server error";
      render();
      return;
    }

    // Stash server result; finishSpin() will use these instead of computing locally.
    state.roulette.serverWinnings = Number(BigInt(res.totalPayout || "0")) / 100;
    state.roulette.serverBalanceAfter = Number(BigInt(res.balanceAfter)) / 100;

    startSpinAnimation(state, render, res.winningNumber);
  }).catch(() => {
    if (state.roulette.phase !== "spinning") return;
    const totalStake = state.roulette.bets.reduce((s, b) => s + b.amount, 0);
    state.balance += totalStake;
    state.roulette.bets = [];
    state.roulette.phase = "betting";
    state.message = "Could not reach server";
    render();
  });
}

/** Set up spin animation parameters and kick off the loop. Target is the winning number (0-36). */
function startSpinAnimation(state: AppState, render: () => void, target: number): void {
  state.roulette.spinTarget = target;

  // In server-driven mode we no longer cut the wheel animation short when
  // the ball settles (the ball is the wrong source of truth). Instead the
  // wheel must complete its full easing into spinTarget. The default
  // duration (~10-12s total) would feel glacial, so we use a shorter
  // sweep — but not TOO short: we want the wheel to keep rotating for a
  // beat after the ball lands, matching real roulette where the ball
  // settles into a pocket while the wheel is still turning. Target ~5s
  // vs. the ball's ~3-4s settle time. Local mode keeps the cinematic
  // long spin since the ball-settled early-exit still applies there.
  const serverDriven = state.roulette.serverBalanceAfter !== null;

  const targetIdx = WHEEL_ORDER.indexOf(target);
  const totalFrames = serverDriven
    ? 65 + Math.floor(Math.random() * 20)   // 65-84 frames, ~5s with tuned delay curve
    : 80 + Math.floor(Math.random() * 50);  // 80-129 frames (local, cut short at frame>30)
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

/**
 * Resolve the winning number at ball-settle time.
 *
 * In LOCAL mode (offline / unauthed), ball physics is the source of truth —
 * we roll the RNG and use whichever slot the ball lands on. In SERVER-DRIVEN
 * mode, the server's winning number (stashed into spinTarget at round start)
 * is authoritative and the payout was already computed against it. Using the
 * ball's landing here would desync the displayed winner from the amount
 * actually credited: the user would see e.g. "34" flash up while $180 was
 * really paid out for their bet on 1. Snap the ball to center so the visual
 * matches the server's result.
 */
function resolveBallModeWinner(rs: AppState["roulette"]): number {
  if (rs.serverBalanceAfter !== null) {
    rs.ballCol = 0;
    return rs.spinTarget;
  }
  return ballLandingNumber(rs);
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
  const serverDriven = state.roulette.serverBalanceAfter !== null;

  // Check for skip (Enter during spin sets spinFrame high)
  if (state.roulette.spinFrame > totalFrames) frame = totalFrames + 1;

  // Ball mode, LOCAL RNG only: ball physics is the source of truth, so as
  // soon as it settles we can declare the winner. In server-driven mode we
  // deliberately let the wheel animation run to completion — the ball is
  // being centered by stepBallPhysics and the wheel will ease into
  // spinTarget, so both arrive at the server's number at roughly the same
  // time and the final commit has no visible jump.
  if (!serverDriven && state.roulette.wheelMode === "ball" && !state.roulette.ballBouncing && frame > 30) {
    const winNum = ballLandingNumber(state.roulette);
    state.roulette.spinHighlight = winNum;
    state.roulette.spinHalfStep = false;
    finishSpin(state, render, winNum);
    return;
  }

  if (frame > totalFrames) {
    const finalNum = WHEEL_ORDER[targetIdx] ?? 0;
    state.roulette.spinHighlight = finalNum;
    state.roulette.spinHalfStep = false;

    if (state.roulette.wheelMode === "ball" && state.roulette.ballBouncing) {
      // Wheel done, ball still in motion — wait for it to settle, then
      // determine winner. Polls every 30ms with a hard iteration cap.
      // stepBallPhysics has its own 6-second terminator so this should
      // resolve well under the cap; the cap exists only so an unexpected
      // bug (e.g. physics never ticking) can't hang the UI forever.
      const MAX_POLLS = 200; // 200 * 30ms = 6s
      let polls = 0;
      const waitForBall = () => {
        if (!state.roulette.ballBouncing || polls >= MAX_POLLS) {
          if (state.roulette.ballBouncing) {
            // Physics never settled — force it so resolveBallModeWinner
            // produces a valid result. Server-driven mode will snap to
            // spinTarget; local mode will use wherever the ball is.
            state.roulette.ballBouncing = false;
            state.roulette.ballCol = 0;
            state.roulette.ballRow = 6;
          }
          const winNum = resolveBallModeWinner(state.roulette);
          state.roulette.spinHighlight = winNum;
          finishSpin(state, render, winNum);
          return;
        }
        polls++;
        setTimeout(waitForBall, 30);
      };
      waitForBall();
      return;
    }

    state.roulette.ballRow = 6;
    // Local mode: snap ball to center for the final rest pose. Server mode
    // has already done this in stepBallPhysics' settle branch.
    if (!serverDriven) {
      state.roulette.ballCol = 0;
    }
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

  // Randomized delay: base curve + per-frame jitter.
  // Server-driven mode uses a tighter delay curve so the full ~60-frame
  // animation completes in ~3s, synced with the ball settle. Local mode
  // keeps the longer curve since it's cut short by the ball-settled exit.
  const delayCeiling = serverDriven ? 50 : 130;
  const baseDelay = 20 + Math.floor(delayCeiling * eased);
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

  // Calm factor: 0 at round start, ramps smoothly to 1 at ~5s.
  // Previously this waited 2s before starting to calm at all, which
  // produced a visible kink where the ball went from "fully wild" to
  // "calming" in a single tick. A single continuous ramp from t=0
  // transitions gradually — at t=1s calm=0.2 (still mostly wild),
  // at t=3s calm=0.6 (noticeably settling), at t=5s calm=1 (fully calm).
  const elapsed = tick * 0.02; // 20ms per tick
  const calm = Math.min(1, elapsed / 5);

  // Server-driven rounds need the ball to settle near slot 0 (where we snap
  // to the server's winning number). Apply a gentle centering spring that
  // strengthens as the ball calms, so by settle time ballCol ≈ 0 without a
  // visible teleport. Local RNG rounds leave the physics untouched — the
  // ball's landing IS the result there.
  const serverDriven = rs.serverBalanceAfter !== null;

  // Gravity pulls ball down
  rs.ballVY += GRAVITY;

  // Centering spring (server-driven only). Base pull ramps up with calm.
  if (serverDriven) {
    rs.ballVX -= rs.ballCol * (0.004 + 0.02 * calm);
  }

  // Move
  rs.ballY += rs.ballVY;
  rs.ballCol += rs.ballVX;

  // Bounce off floor — spinning wheel kicks ball back up
  if (rs.ballY >= FLOOR) {
    rs.ballY = FLOOR;
    rs.ballVY = -Math.abs(rs.ballVY) * BOUNCE;
    // Wheel kick: spinning wheel imparts upward energy, fades as wheel slows
    rs.ballVY -= 0.35 * (1 - calm);
    // Random horizontal kick on bounce, fades with calming. In server-driven
    // mode we dampen the kicks more aggressively so the spring can win
    // quickly once the ball is calming.
    const kickScale = serverDriven ? 2.0 * (1 - calm) : 2.0 * (1 - calm * 0.8);
    rs.ballVX += (Math.random() - 0.5) * kickScale;
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

  // Settle: on floor, low energy, past minimum time (~3s).
  // In server-driven mode we also require the ball to already be near
  // center (|ballCol| < 0.8) so the final snap to slot 0 is invisible.
  // If the ball is still drifting, the spring+friction will pull it in
  // and the check will pass on a later tick.
  const energy = Math.abs(rs.ballVY) + Math.abs(rs.ballVX);
  const centeredEnough = !serverDriven || Math.abs(rs.ballCol) < 0.8;
  const normalSettle = energy < 0.15 && rs.ballY >= FLOOR - 0.2 && elapsed > 3 && centeredEnough;
  // Hard deadline: after 6 seconds the ball MUST settle, regardless of
  // physics state. This is a terminator for pathological bounce sequences
  // (e.g. adversarial RNG that keeps the ball at |ballCol|>0.8 forever
  // because wall kicks and spring forces reach an unstable equilibrium).
  // Without this, waitForBall at finishSpin time could poll forever and
  // the user would be stuck on the spinning screen.
  const hardTimeout = elapsed > 6;
  if (normalSettle || hardTimeout) {
    rs.ballY = FLOOR;
    rs.ballVY = 0;
    rs.ballVX = 0;
    rs.ballBouncing = false;
    rs.ballRow = 6;
    if (serverDriven) {
      // Invisible final snap — at most 0.8 columns for normal settle
      // (less than a quarter of a slot width), or unbounded for the
      // hard-timeout path. In the timeout case, snapping to 0 may be
      // visually jumpy, but that's better than a hang. Guarantees
      // ballLandingNumber aligns with the wheel's spinTarget.
      rs.ballCol = 0;
    }
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

/** Determine winning number from where the ball landed on the current wheel display. */
function ballLandingNumber(rs: AppState["roulette"]): number {
  const currentIdx = WHEEL_ORDER.indexOf(rs.spinHighlight);
  // Each wheel slot is 4 chars wide; ballCol is offset from center
  const slotOffset = Math.round(rs.ballCol / 4);
  const clamped = Math.max(-4, Math.min(4, slotOffset));
  const winIdx = (currentIdx + clamped + WHEEL_ORDER.length) % WHEEL_ORDER.length;
  return WHEEL_ORDER[winIdx] ?? 0;
}

function finishSpin(state: AppState, render: () => void, finalNum: number): void {
  // Defense in depth: in server-driven mode, the displayed winner must match
  // the server's winning number (spinTarget) — otherwise the credited payout
  // appears to come from a different number than the one highlighted. All
  // animation paths are supposed to pass the right number already, but belt
  // and suspenders: force it here too. We also clear spinHalfStep so the
  // highlighted slot can't render mid-transition between two numbers.
  if (state.roulette.serverBalanceAfter !== null) {
    finalNum = state.roulette.spinTarget;
    state.roulette.spinHighlight = finalNum;
    state.roulette.spinHalfStep = false;
  }
  state.roulette.result = finalNum;

  let winnings: number;
  if (state.roulette.serverBalanceAfter !== null) {
    // Server-driven path: trust the server's settlement.
    // The local debits from placeBet remain in state.balance, and we replace it
    // wholesale with the server's authoritative post-round balance.
    winnings = state.roulette.serverWinnings ?? 0;
    state.balance = state.roulette.serverBalanceAfter;
    state.roulette.serverWinnings = null;
    state.roulette.serverBalanceAfter = null;
  } else {
    // Local path: compute winnings from local rules and credit the balance.
    winnings = 0;
    for (const bet of state.roulette.bets) {
      if (isWinner(finalNum, bet.type)) {
        winnings += bet.amount * (payout(bet.type) + 1);
      }
    }
    state.balance += winnings;
  }

  state.roulette.winAmount = winnings;
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
  state.roulette.spinTarget = 0;
  state.roulette.spinHighlight = 0;
  state.roulette.spinHalfStep = false;
  state.roulette.winAmount = 0;
  state.roulette.ballRow = 0;
  state.roulette.ballCol = 0;
  state.roulette.ballY = 0;
  state.roulette.ballVY = 0;
  state.roulette.ballVX = 0;
  state.roulette.ballBouncing = false;
  state.roulette.serverWinnings = null;
  state.roulette.serverBalanceAfter = null;
  state.message = "";
}
