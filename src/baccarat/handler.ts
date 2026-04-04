import type { AppState, BaccaratBetType } from "../types";
import type { KeyEvent } from "../keybindings";
import { deal, newRound, startDealAnimation, skipCardAnim, skipDeal } from "./game";

const BET_TYPES: BaccaratBetType[] = ['player', 'banker', 'tie'];

export function handleBaccaratKey(state: AppState, key: KeyEvent, render: () => void): void {
  const bc = state.baccarat;

  // Card animation in progress: Enter skips
  if (bc.cardAnim) {
    if (key.name === "return") {
      skipCardAnim(state);
    }
    return;
  }

  // Dealing phase: Enter to skip
  if (bc.phase === "dealing") {
    if (key.name === "return") {
      skipDeal(state);
    } else if (key.name === "q" || key.name === "escape") {
      skipDeal(state);
      state.screen = "menu";
      state.message = "";
    }
    return;
  }

  // Result phase
  if (bc.phase === "result") {
    if (key.name === "return") {
      newRound(state);
    } else if (key.name === "q" || key.name === "escape") {
      state.screen = "menu";
      state.message = "";
    }
    return;
  }

  // Betting phase
  switch (key.name) {
    case "return":
      if (!deal(state)) return; // deal failed (insufficient balance)
      startDealAnimation(state, render);
      return;
    case "left": {
      const idx = BET_TYPES.indexOf(bc.betType);
      bc.betType = BET_TYPES[(idx - 1 + BET_TYPES.length) % BET_TYPES.length]!;
      state.message = "";
      break;
    }
    case "right": {
      const idx = BET_TYPES.indexOf(bc.betType);
      bc.betType = BET_TYPES[(idx + 1) % BET_TYPES.length]!;
      state.message = "";
      break;
    }
    case "up":
      if (bc.betAmount < 5) bc.betAmount = 5;
      else if (bc.betAmount < 10) bc.betAmount = 10;
      else if (bc.betAmount < 25) bc.betAmount = 25;
      else if (bc.betAmount < 50) bc.betAmount = 50;
      else bc.betAmount += 25;
      break;
    case "down":
      if (bc.betAmount > 50) bc.betAmount -= 25;
      else if (bc.betAmount > 25) bc.betAmount = 25;
      else if (bc.betAmount > 10) bc.betAmount = 10;
      else if (bc.betAmount > 5) bc.betAmount = 5;
      else if (bc.betAmount > 1) bc.betAmount = 1;
      break;
    case "q":
    case "escape":
      state.screen = "menu";
      state.message = "";
      break;
  }
}
