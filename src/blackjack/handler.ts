import type { AppState } from "../types";
import type { KeyEvent } from "../keybindings";
import {
  deal, hit, resolveHit, stand, doubleDown, resolveDouble, split,
  dealerPlay, skipDealer, newBjRound, startDealAnimation,
  animateHit, animateDouble, skipCardAnim,
  takeInsurance, declineInsurance,
} from "./game";
import { stepBet } from "../shared/render";

export function handleBlackjackKey(state: AppState, key: KeyEvent, render: () => void): void {
  const bj = state.blackjack;

  // Card animation in progress: Enter skips
  if (bj.cardAnim) {
    if (key.name === "return") {
      skipCardAnim(state);
    }
    return;
  }

  // Insurance phase: y/n
  if (bj.phase === "insurance") {
    if (key.name === "y") {
      takeInsurance(state);
    } else if (key.name === "n") {
      declineInsurance(state);
    }
    return;
  }

  // Dealer phase: only Enter to skip
  if (bj.phase === "dealer") {
    if (key.name === "return") {
      skipDealer(state);
    }
    return;
  }

  // Result phase
  if (bj.phase === "result") {
    if (key.name === "return") {
      newBjRound(state);
    } else if (key.name === "h") {
      bj.showHint = !bj.showHint;
    } else if (key.name === "c") {
      bj.showCount = !bj.showCount;
    } else if (key.name === "q" || key.name === "escape") {
      state.screen = "menu";
      state.message = "";
    }
    return;
  }

  // Playing phase
  if (bj.phase === "playing") {
    switch (key.name) {
      case "return":
        hit(state);
        animateHit(state, render, () => {
          resolveHit(state);
          render();
          startDealerIfNeeded(state, render);
        });
        return;
      case "s": stand(state); break;
      case "d":
        doubleDown(state);
        if (bj.playerHands[bj.activeHand]?.doubled) {
          animateDouble(state, render, () => {
            resolveDouble(state);
            render();
            startDealerIfNeeded(state, render);
          });
          return;
        }
        break;
      case "p": split(state); break;
      case "h":
        bj.showHint = !bj.showHint;
        return;
      case "c":
        bj.showCount = !bj.showCount;
        return;
      case "q":
      case "escape":
        state.screen = "menu";
        state.message = "";
        return;
    }
    startDealerIfNeeded(state, render);
    return;
  }

  // Betting phase
  switch (key.name) {
    case "return":
      deal(state);
      startDealAnimation(state, render);
      return;
    case "h":
      bj.showHint = !bj.showHint;
      return;
    case "c":
      bj.showCount = !bj.showCount;
      return;
    case "up":
    case "right":
      bj.betAmount = stepBet(bj.betAmount, 'up');
      break;
    case "down":
    case "left":
      bj.betAmount = stepBet(bj.betAmount, 'down');
      break;
    case "q":
    case "escape":
      state.screen = "menu";
      state.message = "";
      break;
  }
}

function startDealerIfNeeded(state: AppState, render: () => void): void {
  if (state.blackjack.phase === "dealer") {
    render();
    dealerPlay(state, render);
  }
}
