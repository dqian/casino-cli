// Pai Gow Poker — key handling

import type { AppState, PaiGowState } from "../types";
import type { KeyEvent } from "../keybindings";
import {
  deal, toggleLowHand, autoArrange, confirmArrangement, newRound,
  startSpreadAnim, skipSpreadAnim, startSortAnim, skipSortAnim,
  resortPlayerCards,
} from "./game";
import { stepBet } from "../shared/render";

function cycleSortMode(pg: PaiGowState): void {
  pg.sortMode = pg.sortMode === 'ascending' ? 'descending' : 'ascending';
  resortPlayerCards(pg);
}

export function handlePaiGowKey(state: AppState, key: KeyEvent, render: () => void): void {
  const pg = state.paigow;

  // Spread animation: Enter skips
  if (pg.spreadFrame > 0) {
    if (key.name === 'return') {
      skipSpreadAnim(state);
    }
    return;
  }

  // Sort animation: Enter skips
  if (pg.sortFrame > 0) {
    if (key.name === 'return') {
      skipSortAnim(state);
    }
    return;
  }

  // Result phase
  if (pg.phase === 'result') {
    if (key.name === 'return') {
      newRound(state);
    } else if (key.name === 's') {
      startSortAnim(state, render);
    } else if (key.name === 'q' || key.name === 'escape') {
      state.screen = 'menu';
      state.message = '';
    }
    return;
  }

  // Arranging phase
  if (pg.phase === 'arranging') {
    switch (key.name) {
      case 'left':
        pg.cursor = Math.max(0, pg.cursor - 1);
        break;
      case 'right':
        pg.cursor = Math.min(pg.playerCards.length - 1, pg.cursor + 1);
        break;
      case ' ':   // space
        toggleLowHand(state, pg.cursor);
        break;
      case 'return':
        if (pg.lowHand.length === 2) {
          confirmArrangement(state);
          if (state.paigow.phase === 'result') startSpreadAnim(state, render);
        } else if (pg.lowHand.length < 2) {
          toggleLowHand(state, pg.cursor);
        } else {
          state.message = 'Select exactly 2 cards for the low hand';
        }
        break;
      case 'a':
        autoArrange(state);
        break;
      case 'c':
        pg.lowHand = [];
        pg.foulMessage = '';
        break;
      case 's':
        startSortAnim(state, render);
        break;
      case 'k':
        pg.coloredSuits = !pg.coloredSuits;
        break;
      case 'q':
      case 'escape':
        state.screen = 'menu';
        state.message = '';
        break;
    }
    return;
  }

  // Betting phase (no cards to animate — instant sort)
  switch (key.name) {
    case 'return':
      deal(state);
      startSpreadAnim(state, render);
      return;
    case 's':
      cycleSortMode(pg);
      return;
    case 'k':
      pg.coloredSuits = !pg.coloredSuits;
      return;
    case 'up':
    case 'right':
      pg.betAmount = stepBet(pg.betAmount, 'up');
      break;
    case 'down':
    case 'left':
      pg.betAmount = stepBet(pg.betAmount, 'down');
      break;
    case 'q':
    case 'escape':
      state.screen = 'menu';
      state.message = '';
      break;
  }
}
