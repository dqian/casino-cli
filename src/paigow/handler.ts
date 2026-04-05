// Pai Gow Poker — key handling

import type { AppState } from "../types";
import type { KeyEvent } from "../keybindings";
import { deal, toggleLowHand, autoArrange, confirmArrangement, newRound } from "./game";

export function handlePaiGowKey(state: AppState, key: KeyEvent, _render: () => void): void {
  const pg = state.paigow;

  // Result phase
  if (pg.phase === 'result') {
    if (key.name === 'return') {
      newRound(state);
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
          // Enter with 2 selected = confirm arrangement (same as 'd')
          confirmArrangement(state);
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
        break;
      case 'c':
        pg.lowHand = [];
        pg.foulMessage = '';
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
      return;
    case 's': {
      const modes = ['ascending', 'descending', 'unsorted'] as const;
      const idx = modes.indexOf(pg.sortMode);
      pg.sortMode = modes[(idx + 1) % modes.length]!;
      state.message = `Sort: ${pg.sortMode}`;
      return;
    }
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
