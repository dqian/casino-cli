import type { AppState, CrapsBet, CrapsBetKind, CrapsState } from "../types";

// All navigable bet positions on the table, in cursor order
export const BET_POSITIONS: { kind: CrapsBetKind; label: string }[] = [
  // Row 0: Place bets
  { kind: "place4", label: "Place 4" },
  { kind: "place5", label: "Place 5" },
  { kind: "place6", label: "Place 6" },
  { kind: "place8", label: "Place 8" },
  { kind: "place9", label: "Place 9" },
  { kind: "place10", label: "Place 10" },
  // Row 1: Don't Come + Come
  { kind: "dontCome", label: "Don't Come" },
  { kind: "come", label: "Come" },
  // Row 2: Field
  { kind: "field", label: "Field" },
  // Row 3: Don't Pass
  { kind: "dontPass", label: "Don't Pass" },
  // Row 4: Pass Line
  { kind: "pass", label: "Pass Line" },
  // Row 5: Any 7
  { kind: "any7", label: "Any 7" },
  // Row 6-7: Hardways (9:1 left, 7:1 right)
  { kind: "hard6", label: "Hard 6" },
  { kind: "hard10", label: "Hard 10" },
  { kind: "hard8", label: "Hard 8" },
  { kind: "hard4", label: "Hard 4" },
  // Row 8: Yo / Horn / C&E
  { kind: "yo", label: "Yo-11" },
  { kind: "horn", label: "Horn" },
  { kind: "ce", label: "C & E" },
  // Row 9: Any Craps
  { kind: "anyCraps", label: "Any Craps" },
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

// True odds payouts for pass/come odds
const PASS_ODDS_PAYOUTS: Record<number, [number, number]> = {
  4:  [2, 1],   // 2:1
  5:  [3, 2],   // 3:2
  6:  [6, 5],   // 6:5
  8:  [6, 5],   // 6:5
  9:  [3, 2],   // 3:2
  10: [2, 1],   // 2:1
};

// Lay odds payouts for don't pass/don't come odds (inverse of pass odds)
const DONT_PASS_ODDS_PAYOUTS: Record<number, [number, number]> = {
  4:  [1, 2],   // 1:2
  5:  [2, 3],   // 2:3
  6:  [5, 6],   // 5:6
  8:  [5, 6],   // 5:6
  9:  [2, 3],   // 2:3
  10: [1, 2],   // 1:2
};

// 3-4-5x odds multipliers
const MAX_ODDS_MULTIPLIER: Record<number, number> = {
  4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3,
};

export function placePayoutStr(num: number): string {
  const p = PLACE_PAYOUTS[num];
  if (!p) return "?";
  return `${p[0]}:${p[1]}`;
}

export function isBetAvailable(kind: CrapsBetKind, point: number | null): boolean {
  // Come/Don't Come only available during point phase
  if (kind === "come" || kind === "dontCome") return point !== null;
  // Odds only when point is established
  if (kind === "passOdds" || kind === "dontPassOdds") return point !== null;
  if (kind === "comeOdds" || kind === "dontComeOdds") return point !== null;
  return true;
}

/** Max odds bet allowed under 3-4-5x rules */
function maxOddsBet(flatBet: number, point: number): number {
  const mult = MAX_ODDS_MULTIPLIER[point];
  if (!mult) return 0;
  return flatBet * mult;
}

export function placeBet(state: AppState): void {
  const cs = state.craps;
  const pos = BET_POSITIONS[cs.cursorPos];
  if (!pos) return;

  if (!isBetAvailable(pos.kind, cs.point)) {
    state.message = cs.point === null
      ? "Only available after point is set"
      : "";
    return;
  }

  const amount = cs.betAmount;
  if (amount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  // Odds bets are placed via 'o' hotkey, not regular placement
  if (pos.kind === "passOdds" || pos.kind === "dontPassOdds" ||
      pos.kind === "comeOdds" || pos.kind === "dontComeOdds") {
    state.message = "Use 'o' to place odds bets";
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
  // Come/Don't Come: one active (unpointed) bet at a time
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
  // Hardway bets: one per number, stackable
  else if (pos.kind === "hard4" || pos.kind === "hard6" || pos.kind === "hard8" || pos.kind === "hard10") {
    const existing = cs.bets.find(b => b.kind === pos.kind);
    if (existing) {
      existing.amount += amount;
    } else {
      cs.bets.push({ kind: pos.kind, amount });
    }
  }
  // Single-roll propositions
  else if (pos.kind === "any7" || pos.kind === "anyCraps" || pos.kind === "yo" ||
           pos.kind === "horn" || pos.kind === "ce") {
    const existing = cs.bets.find(b => b.kind === pos.kind);
    if (existing) {
      existing.amount += amount;
    } else {
      cs.bets.push({ kind: pos.kind, amount });
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

/** Place odds bet behind Pass/Don't Pass or Come/Don't Come */
export function placeOddsBet(state: AppState): void {
  const cs = state.craps;
  const pos = BET_POSITIONS[cs.cursorPos];
  if (!pos) return;

  if (cs.point === null) {
    state.message = "No point established — can't place odds";
    return;
  }

  const amount = cs.betAmount;
  if (amount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  // Pass Line odds
  if (pos.kind === "pass") {
    const passBet = cs.bets.find(b => b.kind === "pass" && !b.point);
    if (!passBet) {
      state.message = "No Pass Line bet to back with odds";
      return;
    }
    const maxOdds = maxOddsBet(passBet.amount, cs.point);
    const existingOdds = cs.bets.find(b => b.kind === "passOdds");
    const currentOdds = existingOdds ? existingOdds.amount : 0;
    if (currentOdds + amount > maxOdds) {
      state.message = `Max odds: $${maxOdds} (${MAX_ODDS_MULTIPLIER[cs.point]}x)`;
      return;
    }
    if (existingOdds) {
      existingOdds.amount += amount;
    } else {
      cs.bets.push({ kind: "passOdds", amount });
    }
    state.balance -= amount;
    state.message = `Pass odds: $${currentOdds + amount}`;
    return;
  }

  // Don't Pass odds
  if (pos.kind === "dontPass") {
    const dpBet = cs.bets.find(b => b.kind === "dontPass" && !b.point);
    if (!dpBet) {
      state.message = "No Don't Pass bet to lay odds against";
      return;
    }
    const existingOdds = cs.bets.find(b => b.kind === "dontPassOdds");
    if (existingOdds) {
      existingOdds.amount += amount;
    } else {
      cs.bets.push({ kind: "dontPassOdds", amount });
    }
    state.balance -= amount;
    const total = existingOdds ? existingOdds.amount : amount;
    state.message = `Don't Pass odds: $${total}`;
    return;
  }

  // Come bet odds (for come bets that have an established point)
  if (pos.kind === "come") {
    const comeBets = cs.bets.filter(b => b.kind === "come" && b.point);
    if (comeBets.length === 0) {
      state.message = "No Come bet with a point to back with odds";
      return;
    }
    // Place odds on the most recent come bet with a point
    const comeBet = comeBets[comeBets.length - 1]!;
    const maxOdds = maxOddsBet(comeBet.amount, comeBet.point!);
    const existingOdds = cs.bets.find(b => b.kind === "comeOdds" && b.point === comeBet.point);
    const currentOdds = existingOdds ? existingOdds.amount : 0;
    if (currentOdds + amount > maxOdds) {
      state.message = `Max odds: $${maxOdds} (${MAX_ODDS_MULTIPLIER[comeBet.point!]}x)`;
      return;
    }
    if (existingOdds) {
      existingOdds.amount += amount;
    } else {
      cs.bets.push({ kind: "comeOdds", amount, point: comeBet.point });
    }
    state.balance -= amount;
    state.message = `Come (${comeBet.point}) odds: $${currentOdds + amount}`;
    return;
  }

  // Don't Come odds
  if (pos.kind === "dontCome") {
    const dcBets = cs.bets.filter(b => b.kind === "dontCome" && b.point);
    if (dcBets.length === 0) {
      state.message = "No Don't Come bet with a point to lay odds against";
      return;
    }
    const dcBet = dcBets[dcBets.length - 1]!;
    const existingOdds = cs.bets.find(b => b.kind === "dontComeOdds" && b.point === dcBet.point);
    if (existingOdds) {
      existingOdds.amount += amount;
    } else {
      cs.bets.push({ kind: "dontComeOdds", amount, point: dcBet.point });
    }
    state.balance -= amount;
    const total = existingOdds ? existingOdds.amount : amount;
    state.message = `Don't Come (${dcBet.point}) odds: $${total}`;
    return;
  }

  state.message = "Select Pass/Don't Pass/Come/Don't Come for odds";
}

export function removeBet(state: AppState): void {
  const cs = state.craps;
  const pos = BET_POSITIONS[cs.cursorPos];
  if (!pos) return;

  // For odds bets, try to remove associated odds
  if (pos.kind === "pass") {
    const oddsIdx = cs.bets.findIndex(b => b.kind === "passOdds");
    if (oddsIdx !== -1) {
      state.balance += cs.bets[oddsIdx]!.amount;
      cs.bets.splice(oddsIdx, 1);
      state.message = "Pass odds removed";
      return;
    }
  }
  if (pos.kind === "dontPass") {
    const oddsIdx = cs.bets.findIndex(b => b.kind === "dontPassOdds");
    if (oddsIdx !== -1) {
      state.balance += cs.bets[oddsIdx]!.amount;
      cs.bets.splice(oddsIdx, 1);
      state.message = "Don't Pass odds removed";
      return;
    }
  }

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
    // Come/Don't Come bets with points are locked, as are their odds
    if (bet.point && (bet.kind === "come" || bet.kind === "dontCome" ||
                      bet.kind === "comeOdds" || bet.kind === "dontComeOdds")) {
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
    cs.dice = cs.rollTarget;
    cs.rollFrame = ANIM_FRAMES;
    finishRoll(state);
    render();
    return;
  }

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
  const isHard = d1 === d2;

  cs.rollHistory.push(sum);
  if (cs.rollHistory.length > 20) cs.rollHistory.shift();

  let totalWin = 0;
  let totalLoss = 0;
  const messages: string[] = [];

  const isComingOut = cs.point === null;

  // ===== SINGLE-ROLL BETS (resolve every roll) =====

  // --- Field ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "field") {
      const fieldResult = resolveField(sum, bet.amount);
      if (fieldResult > 0) {
        totalWin += fieldResult + bet.amount;
        messages.push(`Field wins $${fieldResult}`);
      } else {
        totalLoss += bet.amount;
        messages.push("Field loses");
      }
      cs.bets.splice(i, 1);
    }
  }

  // --- Any 7 (pays 4:1) ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "any7") {
      if (sum === 7) {
        const win = bet.amount * 4;
        totalWin += win + bet.amount;
        messages.push(`Any 7 wins $${win}`);
      } else {
        totalLoss += bet.amount;
        messages.push("Any 7 loses");
      }
      cs.bets.splice(i, 1);
    }
  }

  // --- Any Craps (2,3,12 pays 7:1) ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "anyCraps") {
      if (sum === 2 || sum === 3 || sum === 12) {
        const win = bet.amount * 7;
        totalWin += win + bet.amount;
        messages.push(`Any Craps wins $${win}`);
      } else {
        totalLoss += bet.amount;
        messages.push("Any Craps loses");
      }
      cs.bets.splice(i, 1);
    }
  }

  // --- Yo-11 (pays 15:1) ---
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "yo") {
      if (sum === 11) {
        const win = bet.amount * 15;
        totalWin += win + bet.amount;
        messages.push(`Yo-11 wins $${win}`);
      } else {
        totalLoss += bet.amount;
        messages.push("Yo loses");
      }
      cs.bets.splice(i, 1);
    }
  }

  // --- Horn (split 4 ways: 2,3,11,12) ---
  // 2 pays 30:1, 12 pays 30:1, 3 pays 15:1, 11 pays 15:1
  // Bet is split into 4 units. Win on one, lose the other 3.
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "horn") {
      const unit = bet.amount / 4;
      if (sum === 2) {
        const win = Math.floor(unit * 30) - (bet.amount - unit);
        totalWin += bet.amount + win;
        messages.push(`Horn (2) wins $${win}`);
      } else if (sum === 12) {
        const win = Math.floor(unit * 30) - (bet.amount - unit);
        totalWin += bet.amount + win;
        messages.push(`Horn (12) wins $${win}`);
      } else if (sum === 3) {
        const win = Math.floor(unit * 15) - (bet.amount - unit);
        totalWin += bet.amount + win;
        messages.push(`Horn (3) wins $${win}`);
      } else if (sum === 11) {
        const win = Math.floor(unit * 15) - (bet.amount - unit);
        totalWin += bet.amount + win;
        messages.push(`Horn (11) wins $${win}`);
      } else {
        totalLoss += bet.amount;
        messages.push("Horn loses");
      }
      cs.bets.splice(i, 1);
    }
  }

  // --- C & E (Craps-Eleven split: any craps 3:1, eleven 7:1) ---
  // Split two ways: half on any craps, half on eleven
  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "ce") {
      const half = bet.amount / 2;
      if (sum === 2 || sum === 3 || sum === 12) {
        // Craps half wins 3:1, eleven half loses
        const win = Math.floor(half * 3);
        totalWin += bet.amount + win;
        messages.push(`C&E craps wins $${win}`);
      } else if (sum === 11) {
        // Eleven half wins 7:1, craps half loses
        const win = Math.floor(half * 7);
        totalWin += bet.amount + win;
        messages.push(`C&E eleven wins $${win}`);
      } else {
        totalLoss += bet.amount;
        messages.push("C&E loses");
      }
      cs.bets.splice(i, 1);
    }
  }

  // ===== HARDWAY BETS (multi-roll: persist until result) =====

  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "hard4" || bet.kind === "hard6" || bet.kind === "hard8" || bet.kind === "hard10") {
      const hardNum = parseInt(bet.kind.replace("hard", ""), 10);
      if (sum === hardNum && isHard) {
        // Hard way wins: 7:1 for 4/10, 9:1 for 6/8
        const payout = (hardNum === 4 || hardNum === 10) ? 7 : 9;
        const win = bet.amount * payout;
        totalWin += win + bet.amount;
        messages.push(`Hard ${hardNum} wins $${win}!`);
        cs.bets.splice(i, 1);
      } else if (sum === 7 || (sum === hardNum && !isHard)) {
        // Lose on 7 or easy way
        totalLoss += bet.amount;
        const reason = sum === 7 ? "7-out" : `easy ${hardNum}`;
        messages.push(`Hard ${hardNum} loses (${reason})`);
        cs.bets.splice(i, 1);
      }
      // Otherwise hardway stays
    }
  }

  // ===== PLACE BETS =====

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
    }
  }

  // ===== COME BETS WITH POINTS + COME ODDS =====

  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "come" && bet.point) {
      if (sum === bet.point) {
        totalWin += bet.amount * 2;
        messages.push(`Come (${bet.point}) wins!`);
        // Also resolve come odds
        const oddsIdx = cs.bets.findIndex(b => b.kind === "comeOdds" && b.point === bet.point);
        if (oddsIdx !== -1) {
          const oddsBet = cs.bets[oddsIdx]!;
          const oddsPayout = PASS_ODDS_PAYOUTS[bet.point!];
          if (oddsPayout) {
            const win = Math.floor(oddsBet.amount * oddsPayout[0] / oddsPayout[1]);
            totalWin += win + oddsBet.amount;
            messages.push(`Come odds wins $${win}`);
          }
          cs.bets.splice(oddsIdx, 1);
          // Adjust index if needed
          if (oddsIdx < i) i--;
        }
        cs.bets.splice(i, 1);
      } else if (sum === 7) {
        totalLoss += bet.amount;
        messages.push(`Come (${bet.point}) loses`);
        const oddsIdx = cs.bets.findIndex(b => b.kind === "comeOdds" && b.point === bet.point);
        if (oddsIdx !== -1) {
          if (isComingOut) {
            // Come odds are "off" during come-out — return to player
            totalWin += cs.bets[oddsIdx]!.amount;
            messages.push(`Come odds returned`);
          } else {
            totalLoss += cs.bets[oddsIdx]!.amount;
          }
          cs.bets.splice(oddsIdx, 1);
          if (oddsIdx < i) i--;
        }
        cs.bets.splice(i, 1);
      }
    }
  }

  // ===== DON'T COME BETS WITH POINTS + DON'T COME ODDS =====

  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "dontCome" && bet.point) {
      if (sum === 7) {
        totalWin += bet.amount * 2;
        messages.push(`Don't Come (${bet.point}) wins!`);
        // Don't Come odds
        const oddsIdx = cs.bets.findIndex(b => b.kind === "dontComeOdds" && b.point === bet.point);
        if (oddsIdx !== -1) {
          const oddsBet = cs.bets[oddsIdx]!;
          const oddsPayout = DONT_PASS_ODDS_PAYOUTS[bet.point!];
          if (oddsPayout) {
            const win = Math.floor(oddsBet.amount * oddsPayout[0] / oddsPayout[1]);
            totalWin += win + oddsBet.amount;
            messages.push(`DC odds wins $${win}`);
          }
          cs.bets.splice(oddsIdx, 1);
          if (oddsIdx < i) i--;
        }
        cs.bets.splice(i, 1);
      } else if (sum === bet.point) {
        totalLoss += bet.amount;
        messages.push(`Don't Come (${bet.point}) loses`);
        const oddsIdx = cs.bets.findIndex(b => b.kind === "dontComeOdds" && b.point === bet.point);
        if (oddsIdx !== -1) {
          totalLoss += cs.bets[oddsIdx]!.amount;
          cs.bets.splice(oddsIdx, 1);
          if (oddsIdx < i) i--;
        }
        cs.bets.splice(i, 1);
      }
    }
  }

  // ===== FRESH COME BETS (no point yet) =====

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
        bet.point = sum;
        messages.push(`Come point: ${sum}`);
      }
    }
  }

  // ===== FRESH DON'T COME BETS =====

  for (let i = cs.bets.length - 1; i >= 0; i--) {
    const bet = cs.bets[i]!;
    if (bet.kind === "dontCome" && !bet.point) {
      if (sum === 2 || sum === 3) {
        totalWin += bet.amount * 2;
        messages.push("Don't Come wins!");
        cs.bets.splice(i, 1);
      } else if (sum === 12) {
        totalWin += bet.amount; // push
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

  // ===== PASS LINE + PASS ODDS =====

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
      // Pass odds win at true odds
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "passOdds") {
          const oddsPayout = PASS_ODDS_PAYOUTS[cs.point!];
          if (oddsPayout) {
            const win = Math.floor(bet.amount * oddsPayout[0] / oddsPayout[1]);
            totalWin += win + bet.amount;
            messages.push(`Pass odds wins $${win}`);
          }
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
      // Don't pass odds lose
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "dontPassOdds") {
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
      // Pass odds lose
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "passOdds") {
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
      // Don't pass odds win at true odds (inverse)
      for (let i = cs.bets.length - 1; i >= 0; i--) {
        const bet = cs.bets[i]!;
        if (bet.kind === "dontPassOdds") {
          const oddsPayout = DONT_PASS_ODDS_PAYOUTS[cs.point!];
          if (oddsPayout) {
            const win = Math.floor(bet.amount * oddsPayout[0] / oddsPayout[1]);
            totalWin += win + bet.amount;
            messages.push(`DP odds wins $${win}`);
          }
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
    cursorPos: 10, // Start on Pass Line
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

/** Get payout info string for display */
export function getBetPayoutInfo(kind: CrapsBetKind): string {
  switch (kind) {
    case "pass":
    case "dontPass":
    case "come":
    case "dontCome":
      return "Pays 1:1";
    case "field":
      return "2 pays 2:1, 12 pays 3:1, rest 1:1";
    case "place4":
    case "place10":
      return "Pays 9:5";
    case "place5":
    case "place9":
      return "Pays 7:5";
    case "place6":
    case "place8":
      return "Pays 7:6";
    case "passOdds":
      return "True odds: 2:1 (4/10), 3:2 (5/9), 6:5 (6/8)";
    case "dontPassOdds":
      return "Lay odds: 1:2 (4/10), 2:3 (5/9), 5:6 (6/8)";
    case "comeOdds":
      return "True odds behind Come";
    case "dontComeOdds":
      return "Lay odds behind Don't Come";
    case "hard4":
    case "hard10":
      return "Pays 7:1";
    case "hard6":
    case "hard8":
      return "Pays 9:1";
    case "any7":
      return "Pays 4:1";
    case "anyCraps":
      return "Pays 7:1 (2,3,12)";
    case "yo":
      return "Pays 15:1 (11)";
    case "horn":
      return "2/12 pay 30:1, 3/11 pay 15:1";
    case "ce":
      return "Craps 3:1, Eleven 7:1";
  }
  return "";
}

/** Check if cursor is on an odds-eligible position */
export function canPlaceOdds(cs: CrapsState): boolean {
  if (cs.point === null) return false;
  const pos = BET_POSITIONS[cs.cursorPos];
  if (!pos) return false;
  if (pos.kind === "pass") return cs.bets.some(b => b.kind === "pass" && !b.point);
  if (pos.kind === "dontPass") return cs.bets.some(b => b.kind === "dontPass" && !b.point);
  if (pos.kind === "come") return cs.bets.some(b => b.kind === "come" && b.point);
  if (pos.kind === "dontCome") return cs.bets.some(b => b.kind === "dontCome" && b.point);
  return false;
}
