// Pai Gow Poker — key handling

import type { AppState, PaiGowState } from "../types";
import type { KeyEvent } from "../keybindings";
import { deal, toggleLowHand, autoArrange, confirmArrangement, newRound, startSpreadAnim, skipSpreadAnim, resortPlayerCards } from "./game";

function cycleSortMode(pg: PaiGowState): void {
  const modes = ['ascending', 'descending', 'unsorted'] as const;
  const idx = modes.indexOf(pg.sortMode);
  pg.sortMode = modes[(idx + 1) % modes.length]!;
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

  // Result phase
  if (pg.phase === 'result') {
    if (key.name === 'return') {
      newRound(state);
    } else if (key.name === 's') {
      cycleSortMode(pg);
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
        } else {
          toggleLowHand(state, pg.cursor);
        }
        break;
      case 'a':
        autoArrange(state);
        break;
      case 'd':
        if (pg.lowHand.length !== 2) {
          state.message = 'Select exactly 2 cards for the low hand';
          return;
        }
        confirmArrangement(state);
        if (state.paigow.phase === 'result') startSpreadAnim(state, render);
        break;
      case 'c':
        pg.lowHand = [];
        pg.foulMessage = '';
        break;
      case 's':
        cycleSortMode(pg);
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

  // Betting phase
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
      if (pg.betAmount < 5) pg.betAmount = 5;
      else if (pg.betAmount < 10) pg.betAmount = 10;
      else if (pg.betAmount < 25) pg.betAmount = 25;
      else if (pg.betAmount < 50) pg.betAmount = 50;
      else pg.betAmount += 25;
      break;
    case 'down':
    case 'left':
      if (pg.betAmount > 50) pg.betAmount -= 25;
      else if (pg.betAmount > 25) pg.betAmount = 25;
      else if (pg.betAmount > 10) pg.betAmount = 10;
      else if (pg.betAmount > 5) pg.betAmount = 5;
      else if (pg.betAmount > 1) pg.betAmount = 1;
      break;
    case 'q':
    case 'escape':
      state.screen = 'menu';
      state.message = '';
      break;
  }
}
