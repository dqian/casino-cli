import type { AppState, RouletteState } from "../types";
import type { KeyEvent } from "../keybindings";
import { placeBet, removeBet, clearBets, spin, newRound, totalBets } from "./game";
import { VGRID_ROWS, VGRID_COLS } from "./board";

const CHIP_SIZES = [1, 5, 10, 25, 50, 100, 500];

export function handleRouletteKey(state: AppState, key: KeyEvent, render: () => void): void {
  const rs = state.roulette;

  if (rs.phase === "spinning") {
    if (key.name === "return") {
      rs.spinFrame = 9999;
    }
    return;
  }

  if (rs.phase === "result") {
    if (key.name === "return" || key.name === "up" || key.name === "down" || key.name === "left" || key.name === "right") {
      newRound(state);
    } else if (key.name === "escape" || key.name === "q") {
      state.screen = "menu";
      state.message = "";
    }
    return;
  }

  switch (key.name) {
    case "up":
      navigateUp(rs);
      state.message = "";
      break;
    case "down":
      navigateDown(rs);
      state.message = "";
      break;
    case "left":
      navigateLeft(rs);
      state.message = "";
      break;
    case "right":
      navigateRight(rs);
      state.message = "";
      break;
    case " ":
      placeBet(state);
      break;
    case "x":
      removeBet(state);
      break;
    case "return":
      spin(state, render);
      break;
    case "c":
      clearBets(state);
      break;
    case "+":
    case "=": {
      const idx = CHIP_SIZES.indexOf(rs.betAmount);
      if (idx >= 0 && idx < CHIP_SIZES.length - 1) {
        rs.betAmount = CHIP_SIZES[idx + 1]!;
      }
      break;
    }
    case "-":
    case "_": {
      const idx = CHIP_SIZES.indexOf(rs.betAmount);
      if (idx > 0) {
        rs.betAmount = CHIP_SIZES[idx - 1]!;
      }
      break;
    }
    case "w":
      rs.wheelMode = rs.wheelMode === "arrow" ? "ball" : "arrow";
      state.message = `Wheel: ${rs.wheelMode === "arrow" ? "Arrow" : "Ball"} mode`;
      break;
    case "q":
    case "escape": {
      const betTotal = totalBets(state);
      if (betTotal > 0) {
        clearBets(state);
      }
      state.screen = "menu";
      state.message = "";
      break;
    }
  }
}

// --- Navigation ---

function navigateUp(rs: RouletteState): void {
  switch (rs.cursorZone) {
    case "zero":
      break;
    case "grid":
      if (rs.cursorVR > 0) {
        rs.cursorVR--;
      } else if (rs.cursorVR === 0) {
        rs.cursorVR = -1;
        rs.cursorVC = Math.min(rs.cursorVC, VGRID_COLS - 1);
      } else {
        rs.cursorZone = "zero";
        rs.cursorVC = 0;
      }
      break;
    case "dozen":
      if (rs.cursorVC > 0) {
        rs.cursorVC--;
      }
      break;
    case "column":
      rs.cursorZone = "grid";
      rs.cursorVR = VGRID_ROWS - 1;
      rs.cursorVC = Math.min(VGRID_COLS - 1, rs.cursorVC * 2);
      break;
    case "outside":
      if (rs.cursorVR > 0) {
        rs.cursorVR = 0;
        rs.cursorVC = Math.min(2, rs.cursorVC);
      } else {
        rs.cursorZone = "column";
        rs.cursorVC = Math.min(2, rs.cursorVC);
      }
      break;
  }
}

function navigateDown(rs: RouletteState): void {
  switch (rs.cursorZone) {
    case "zero":
      rs.cursorZone = "grid";
      rs.cursorVR = -1;
      rs.cursorVC = 2;
      break;
    case "grid":
      if (rs.cursorVR < VGRID_ROWS - 1) {
        rs.cursorVR++;
      } else {
        rs.cursorZone = "column";
        const vc = rs.cursorVC < 0 ? 0 : rs.cursorVC >= VGRID_COLS ? 2 : Math.floor(rs.cursorVC / 2);
        rs.cursorVC = vc;
      }
      break;
    case "dozen":
      if (rs.cursorVC < 2) {
        rs.cursorVC++;
      }
      break;
    case "column":
      rs.cursorZone = "outside";
      rs.cursorVR = 0;
      rs.cursorVC = Math.min(2, rs.cursorVC);
      break;
    case "outside":
      if (rs.cursorVR === 0) {
        rs.cursorVR = 1;
        rs.cursorVC = Math.min(2, rs.cursorVC);
      }
      break;
  }
}

function navigateLeft(rs: RouletteState): void {
  switch (rs.cursorZone) {
    case "zero":
      break;
    case "grid":
      if (rs.cursorVR === -1) {
        if (rs.cursorVC > 0) rs.cursorVC--;
      } else if (rs.cursorVC > -1) {
        rs.cursorVC--;
      }
      break;
    case "dozen": {
      const dozenIdx = rs.cursorVC;
      rs.cursorZone = "grid";
      rs.cursorVR = dozenToGridVR(dozenIdx);
      rs.cursorVC = VGRID_COLS - 1;
      break;
    }
    case "column":
      if (rs.cursorVC > 0) rs.cursorVC--;
      break;
    case "outside":
      if (rs.cursorVC > 0) rs.cursorVC--;
      break;
  }
}

function navigateRight(rs: RouletteState): void {
  switch (rs.cursorZone) {
    case "zero":
      break;
    case "grid":
      if (rs.cursorVR === -1) {
        if (rs.cursorVC < VGRID_COLS - 1) rs.cursorVC++;
      } else if (rs.cursorVC < VGRID_COLS - 1) {
        rs.cursorVC++;
      } else {
        rs.cursorZone = "dozen";
        rs.cursorVC = gridVRToDozen(rs.cursorVR);
      }
      break;
    case "dozen":
      break;
    case "column":
      if (rs.cursorVC < 2) rs.cursorVC++;
      break;
    case "outside":
      if (rs.cursorVC < 2) rs.cursorVC++;
      break;
  }
}

function gridVRToDozen(vr: number): number {
  const tableRow = Math.floor(vr / 2) + 1;
  if (tableRow <= 4) return 0;
  if (tableRow <= 8) return 1;
  return 2;
}

function dozenToGridVR(dozenIdx: number): number {
  return dozenIdx * 8 + 3;
}
