import type { AppState, CrapsBet, CrapsBetKind, CrapsState } from "../types";

// Bet positions available for cursor navigation
export const BET_POSITIONS: { kind: CrapsBetKind; label: string }[] = [
  { kind: "pass", label: "Pass Line" },
  { kind: "dontPass", label: "Don't Pass" },
  { kind: "come", label: "Come" },
  { kind: "dontCome", label: "Don't Come" },
  { kind: "field", label: "Field" },
  { kind: "place4", label: "Place 4" },
  { kind: "place5", label: "Place 5" },
  { kind: "place6", label: "Place 6" },
  { kind: "place8", label: "Place 8" },
  { kind: "place9", label: "Place 9" },
  { kind: "place10", label: "Place 10" },
];

// Place bet payouts (to 1)
const PLACE_PAYOUTS: Record<number, [number, number]> = {
  4:  [9, 5],   // 9:5
  5:  [7, 5],   // 7:5
  6:  [7, 6],   // 7:6
  8:  [7, 6],   // 7:6
  9:  [7, 5],   // 7:5
  10: [9, 5],   // 9:5
};

export function placePayoutStr(num: number): string {
  const p = PLACE_PAYOUTS[num];
  if (!p) return "?";
  return `${p[0]}:${p[1]}`;
}

export function isBetAvailable(kind: CrapsBetKind, point: number | null): boolean {
  // Come/Don't Come only available during point phase
  if (kind === "come" || kind === "dontCome") return point !== null;
  // Pass/Don't Pass only during come-out (or always — in craps you can place pass anytime,
  // but traditionally it's a come-out bet. We allow it anytime for simplicity.)
  return true;
}

export function placeBet(state: AppState): void {
  const cs = state.craps;
  const pos = BET_POSITIONS[cs.cursorPos];
  if (!pos) return;

  if (!isBetAvailable(pos.kind, cs.point)) {
    state.message = cs.point === null
      ? "Come/Don't Come only available after point is set"
      : "";
    return;
  }

  const amount = cs.betAmount;
  if (amount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  // For pass/don't pass, only one bet allowed
  if (pos.kind === "pass" || pos.kind === "dontPass") {
    const existing = cs.bets.find(b => b.kind === pos.kind && !b.point);
    if (existing) {
      existing.amount += amount;
    } else {
      cs.bets.push({ kind: pos.kind, amount });
    }
  }
  // For come/don't come, only one active (unpointed) bet at a time
  else if (pos.kind === "come" || pos.kind === "dontCome") {
    const existing = cs.bets.find(b => b.kind === pos.kind && !b.point);
    if (existing) {
      existing.amount += amount;
    } else {
      cs.bets.push({ kind: pos.kind, amount });
    }
  }
  // Field is single-roll, allow stacking
  else if (pos.kind === "field") {
    const existing = cs.bets.find(b => b.kind === "field");
    if (existing) {
      existing.amount += amount;
    } else {
      cs.bets.push({ kind: "field", amount });
    }
  }
  // Place bets stack
  else {
    const existing = cs.bets.find(b => b.kind === pos.kind);
    if (existing) {
      existing.amount += amount;
    } else {
      cs.bets.push({ kind: pos.kind, amount });
    }
  }

  state.balance -= amount;
  state.message = "";
}

export function removeBet(state: AppState): void {
  const cs = state.craps;
  const pos = BET_POSITIONS[cs.cursorPos];
  if (!pos) return;

  const idx = cs.bets.findIndex(b => b.kind === pos.kind && !b.point);
  if (idx === -1) return;

  state.balance += cs.bets[idx]!.amount;
  cs.bets.splice(idx, 1);
  state.message = "";
}

export function clearBets(state: AppState): void {
  const cs = state.craps;
  // Only clear bets that don't have established points (those are locked in)
  const locked: CrapsBet[] = [];
  let refund = 0;
  for (const bet of cs.bets) {
    if (bet.point) {
      locked.push(bet);
    } else {
      refund += bet.amount;
    }
  }
  cs.bets = locked;
  state.balance += refund;
  state.message = refund > 0 ? "Bets cleared" : "No bets to clear";
}

export function totalBets(state: AppState): number {
  return state.craps.bets.reduce((sum, b) => sum + b.amount, 0);
}

export function rollDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

export function roll(state: AppState, render: () => void): void {
  const cs = state.craps;
  if (cs.bets.length === 0) {
    state.message = "Place a bet first!";
    return;
  }

  cs.phase = "rolling";
  cs.skipAnim = false;
  state.message = "";

  const target = rollDice();
  cs.rollTarget = target;

  animateRoll(state, render, 0);
}

const ANIM_FRAMES = 10;
const ANIM_DELAY_BASE = 60;

function animateRoll(state: AppState, render: () => void, frame: number): void {
  const cs = state.craps;

  if (cs.skipAnim || frame >= ANIM_FRAMES) {
    // Show final result
    cs.dice = cs.rollTarget;
    cs.rollFrame = ANIM_FRAMES;
    finishRoll(state);
    render();
    return;
  }

  // Show random dice faces for animation
  cs.dice = rollDice();
  cs.rollFrame = frame;
  render();

  const delay = ANIM_DELAY_BASE + frame * 15;
  setTimeout(() => animateRoll(state, render, frame + 1), delay);
}

function finishRoll(state: AppState): void {
  const cs = state.craps;
  const [d1, d2] = cs.rollTarget;
  const sum = d1 + d2;

  cs.rollHistory.push(sum);
  if (cs.rollHistory.length > 20) cs.rollHistory.shift();

  let totalWin = 0;
  let totalLoss = 0;
  const messages: string[] = [];

  const isComingOut = cs.point === null;

  // --- Resolve FIELD bets (single roll) ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "field") {
      const fieldResult = resolveField(sum, bet.amount);
      if (fieldResult > 0) {
        totalWin += fieldResult + bet.amount; // payout + original bet
        messages.push(`Field wins $${fieldResult}`);
      } else {
        totalLoss += bet.amount;
        messages.push("Field loses");
      }
      // Field bet is always resolved (removed)
      cs.bets.splice(i, 1);
    }
  }

  // --- Resolve PLACE bets ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind.startsWith("place")) {
      const placeNum = parseInt(bet.kind.replace("place", ""), 10);
      if (sum === placeNum) {
        const payout = PLACE_PAYOUTS[placeNum];
        if (payout) {
          const win = Math.floor(bet.amount * payout[0] / payout[1]);
          totalWin += win + bet.amount;
          messages.push(`Place ${placeNum} wins $${win}`);
          cs.bets.splice(i, 1);
        }
      } else if (sum === 7) {
        totalLoss += bet.amount;
        messages.push(`Place ${placeNum} loses`);
        cs.bets.splice(i, 1);
      }
      // Otherwise place bet stays
    }
  }

  // --- Resolve COME bets with points ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "come" && bet.point) {
      if (sum === bet.point) {
        totalWin += bet.amount * 2; // even money
        messages.push(`Come (${bet.point}) wins!`);
        cs.bets.splice(i, 1);
      } else if (sum === 7) {
        totalLoss += bet.amount;
        messages.push(`Come (${bet.point}) loses`);
        cs.bets.splice(i, 1);
      }
    }
  }

  // --- Resolve DON'T COME bets with points ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "dontCome" && bet.point) {
      if (sum === 7) {
        totalWin += bet.amount * 2;
        messages.push(`Don't Come (${bet.point}) wins!`);
        cs.bets.splice(i, 1);
      } else if (sum === bet.point) {
        totalLoss += bet.amount;
        messages.push(`Don't Come (${bet.point}) loses`);
        cs.bets.splice(i, 1);
      }
    }
  }

  // --- Resolve fresh COME bets (no point yet) ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "come" && !bet.point) {
      if (sum === 7 || sum === 11) {
        totalWin += bet.amount * 2;
        messages.push("Come wins!");
        cs.bets.splice(i, 1);
      } else if (sum === 2 || sum === 3 || sum === 12) {
        totalLoss += bet.amount;
        messages.push("Come craps out");
        cs.bets.splice(i, 1);
      } else {
        // Establish come point
        bet.point = sum;
        messages.push(`Come point: ${sum}`);
      }
    }
  }

  // --- Resolve fresh DON'T COME bets ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "dontCome" && !bet.point) {
      if (sum === 2 || sum === 3) {
        totalWin += bet.amount * 2;
        messages.push("Don't Come wins!");
        cs.bets.splice(i, 1);
      } else if (sum === 12) {
        // Push — return bet
        totalWin += bet.amount;
        messages.push("Don't Come pushes (12)");
        cs.bets.splice(i, 1);
      } else if (sum === 7 || sum === 11) {
        totalLoss += bet.amount;
        messages.push("Don't Come loses");
        cs.bets.splice(i, 1);
      } else {
        bet.point = sum;
        messages.push(`Don't Come point: ${sum}`);
      }
    }
  }

  // --- Resolve PASS LINE ---
  if (isComingOut) {
    // Come-out roll
    for (let i = cs.bets.length - 1; i >= 0; i--) {
      const bet = cs.bets[i]!;
      if (bet.kind === "pass") {
        if (sum === 7 || sum === 11) {
          totalWin += bet.amount * 2;
          messages.push("Pass Line wins!");
          cs.bets.splice(i, 1);
        } else if (sum === 2 || sum === 3 || sum === 12) {
          totalLoss += bet.amount;
          messages.push("Pass Line craps out");
          cs.bets.splice(i, 1);
        }
        // Otherwise pass bet stays and point is set below
      }
    }

    // Don't Pass on come-out
    for (let i = cs.bets.length - 1; i >= 0; i--) {
      const bet = cs.bets[i]!;
      if (bet.kind === "dontPass") {
        if (sum === 2 || sum === 3) {
          totalWin += bet.amount * 2;
          messages.push("Don't Pass wins!");
          cs.bets.splice(i, 1);
        } else if (sum === 12) {
          totalWin += bet.amount; // push
          messages.push("Don't Pass pushes (12)");
          cs.bets.splice(i, 1);
        } else if (sum === 7 || sum === 11) {
          totalLoss += bet.amount;
          messages.push("Don't Pass loses");
          cs.bets.splice(i, 1);
        }
        // Otherwise stays
      }
    }

    // Set point if needed
    if (sum !== 7 && sum !== 11 && sum !== 2 && sum !== 3 && sum !== 12) {
      cs.point = sum;
      messages.push(`Point is ${sum}`);
    }
  } else {
    // Point phase
    if (sum === cs.point) {
      // Point hit!
      messages.unshift(`Point ${cs.point} hit!`);

      // Pass line wins
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "pass") {
          totalWin += bet.amount * 2;
          cs.bets.splice(i, 1);
        }
      }
      // Don't pass loses
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "dontPass") {
          totalLoss += bet.amount;
          cs.bets.splice(i, 1);
        }
      }

      cs.point = null; // Reset to come-out
    } else if (sum === 7) {
      // Seven out!
      messages.unshift("Seven out!");

      // Pass line loses
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "pass") {
          totalLoss += bet.amount;
          cs.bets.splice(i, 1);
        }
      }
      // Don't pass wins
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "dontPass") {
          totalWin += bet.amount * 2;
          cs.bets.splice(i, 1);
        }
      }

      cs.point = null; // Reset to come-out
    }
    // Other numbers: pass/don't pass stay, no action
  }

  cs.winAmount = totalWin;
  cs.lossAmount = totalLoss;
  state.balance += totalWin;

  // Build result message
  if (messages.length > 0) {
    cs.message = messages.join(" | ");
  } else {
    cs.message = isComingOut ? `Come-out: ${sum}` : `Rolled ${sum}`;
  }

  cs.phase = "result";
}

function resolveField(sum: number, betAmount: number): number {
  // Field: 2,3,4,9,10,11,12 win. 2 pays 2:1, 12 pays 3:1, rest 1:1
  if (sum === 2) return betAmount * 2;
  if (sum === 12) return betAmount * 3;
  if ([3, 4, 9, 10, 11].includes(sum)) return betAmount;
  return 0; // 5,6,7,8 lose
}

export function newRound(state: AppState): void {
  const cs = state.craps;
  cs.phase = "betting";
  cs.rollFrame = 0;
  cs.winAmount = 0;
  cs.lossAmount = 0;
  cs.message = "";
  state.message = "";
}

export function createCrapsState(): CrapsState {
  return {
    phase: "betting",
    point: null,
    bets: [],
    betAmount: 10,
    cursorPos: 0,
    dice: [1, 1],
    rollHistory: [],
    rollFrame: 0,
    rollTarget: [1, 1],
    winAmount: 0,
    lossAmount: 0,
    message: "",
    skipAnim: false,
  };
}
