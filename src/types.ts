export type Screen = "menu" | "roulette";

export type MenuItem = {
  name: string;
  screen: Screen | null; // null = coming soon
  label: string;
};

export interface AppState {
  screen: Screen;
  balance: number;
  menuCursor: number;
  message: string;
  messageTimeout: ReturnType<typeof setTimeout> | null;
  roulette: RouletteState;
}

export type RoulettePhase = "betting" | "spinning" | "result";

export type BetType =
  | { kind: "straight"; number: number }
  | { kind: "red" }
  | { kind: "black" }
  | { kind: "odd" }
  | { kind: "even" }
  | { kind: "low" }      // 1-18
  | { kind: "high" }     // 19-36
  | { kind: "dozen"; which: 1 | 2 | 3 }
  | { kind: "column"; which: 1 | 2 | 3 };

export interface Bet {
  type: BetType;
  amount: number;
}

export interface RouletteState {
  phase: RoulettePhase;
  bets: Bet[];
  betAmount: number;          // current chip size
  cursorRow: number;          // board cursor row
  cursorCol: number;          // board cursor col
  result: number | null;      // last spin result
  spinFrame: number;          // animation frame counter
  spinTarget: number;         // final landing number
  spinHighlight: number;      // currently highlighted number during animation
  winAmount: number;          // amount won on last spin
  showResultTimer: ReturnType<typeof setTimeout> | null;
}
