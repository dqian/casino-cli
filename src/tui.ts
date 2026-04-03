import type { AppState, RouletteState, CursorZone } from "./types";
import { parseKey } from "./keybindings";
import { renderScreen, MENU_ITEMS } from "./renderer";
import * as t from "./theme";
import { placeBet, removeBet, clearBets, spin, newRound, totalBets } from "./roulette/game";
import { VGRID_ROWS, VGRID_COLS } from "./roulette/board";

const CHIP_SIZES = [1, 5, 10, 25, 50, 100, 500];

function createRouletteState(): RouletteState {
  return {
    phase: "betting",
    bets: [],
    betAmount: 10,
    cursorZone: "grid",
    cursorVR: 0,
    cursorVC: 0,
    result: null,
    spinFrame: 0,
    spinTarget: 0,
    spinHighlight: 0,
    winAmount: 0,
    spinHistory: [],
    showResultTimer: null,
  };
}

function createState(): AppState {
  return {
    screen: "menu",
    balance: 1000,
    menuCursor: 0,
    message: "",
    messageTimeout: null,
    roulette: createRouletteState(),
  };
}

function cleanup(): void {
  process.stdout.write(t.mouseOff + t.showCursor + t.reset + t.altScreenOff);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

export function startTui(): void {
  if (!process.stdin.isTTY) {
    console.error("Not a TTY.");
    process.exit(1);
  }

  const state = createState();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");
  process.stdout.write(t.altScreenOn + t.hideCursor);

  const render = () => renderScreen(state);
  render();

  process.stdout.on("resize", render);

  const exit = () => {
    cleanup();
    process.exit(0);
  };

  process.on("SIGINT", exit);
  process.on("SIGTERM", exit);

  process.stdin.on("data", (data: string | Buffer) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    const key = parseKey(buf);

    if (key.ctrl && key.name === "c") {
      exit();
      return;
    }

    if (state.screen === "menu") {
      handleMenuKey(state, key, exit);
    } else if (state.screen === "roulette") {
      handleRouletteKey(state, key, render);
    }

    render();
  });
}

function handleMenuKey(state: AppState, key: ReturnType<typeof parseKey>, exit: () => void): void {
  switch (key.name) {
    case "up":
      state.menuCursor = Math.max(0, state.menuCursor - 1);
      state.message = "";
      break;
    case "down":
      state.menuCursor = Math.min(MENU_ITEMS.length - 1, state.menuCursor + 1);
      state.message = "";
      break;
    case "return": {
      const item = MENU_ITEMS[state.menuCursor]!;
      if (item.screen) {
        state.screen = item.screen;
        if (item.screen === "roulette") {
          state.roulette = createRouletteState();
        }
        state.message = "";
      } else {
        state.message = `${item.name} is coming soon!`;
      }
      break;
    }
    case "q":
      exit();
      break;
  }
}

function handleRouletteKey(state: AppState, key: ReturnType<typeof parseKey>, render: () => void): void {
  const rs = state.roulette;

  if (rs.phase === "spinning") {
    if (key.name === "return") {
      // Skip to result
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
// Zones layout:
//   zero          (top, above grid)
//   grid + dozen  (grid is main area, dozen is to the right)
//   column        (below grid, the 2:1 row)
//   outside       (below column, 6 outside bets)

function navigateUp(rs: RouletteState): void {
  switch (rs.cursorZone) {
    case "zero":
      break; // already at top
    case "grid":
      if (rs.cursorVR > 0) {
        rs.cursorVR--;
      } else if (rs.cursorVR === 0) {
        // Go to zero-split border (vr=-1), snap to even vc
        rs.cursorVR = -1;
        rs.cursorVC = rs.cursorVC % 2 === 0 ? rs.cursorVC : Math.max(0, rs.cursorVC - 1);
      } else {
        // vr=-1 → zero zone
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
      // Down from zero → zero-split border
      rs.cursorZone = "grid";
      rs.cursorVR = -1;
      rs.cursorVC = 2; // center split
      break;
    case "grid":
      if (rs.cursorVR < VGRID_ROWS - 1) {
        rs.cursorVR++;
      } else {
        rs.cursorZone = "column";
        // Map grid vc to column position (0-2)
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
      break; // row 1 is bottom
  }
}

function navigateLeft(rs: RouletteState): void {
  switch (rs.cursorZone) {
    case "zero":
      break;
    case "grid":
      if (rs.cursorVR === -1) {
        // Zero-split border: only even positions (0, 2, 4)
        if (rs.cursorVC >= 2) rs.cursorVC -= 2;
      } else if (rs.cursorVC > -1) {
        rs.cursorVC--;
      }
      break;
    case "dozen": {
      // Left from dozen → back to grid at rightmost cell
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
        // Zero-split border: only even positions (0, 2, 4)
        if (rs.cursorVC <= 2) rs.cursorVC += 2;
      } else if (rs.cursorVC < VGRID_COLS - 1) {
        rs.cursorVC++;
      } else {
        // Right from rightmost grid column → dozen zone
        rs.cursorZone = "dozen";
        rs.cursorVC = gridVRToDOzen(rs.cursorVR);
      }
      break;
    case "dozen":
      break; // rightmost zone
    case "column":
      if (rs.cursorVC < 2) rs.cursorVC++;
      break;
    case "outside":
      if (rs.cursorVC < 2) rs.cursorVC++;
      break;
  }
}

// Map grid virtual row to dozen index (0-2)
function gridVRToDOzen(vr: number): number {
  const tableRow = Math.floor(vr / 2) + 1; // 1-12
  if (tableRow <= 4) return 0;
  if (tableRow <= 8) return 1;
  return 2;
}

// Map dozen index to grid virtual row (center of that dozen's rows)
function dozenToGridVR(dozenIdx: number): number {
  // Dozen 0 covers table rows 1-4 → vr 0-6, center at vr 3
  // Dozen 1 covers table rows 5-8 → vr 8-14, center at vr 11
  // Dozen 2 covers table rows 9-12 → vr 16-22, center at vr 19
  return dozenIdx * 8 + 3;
}
