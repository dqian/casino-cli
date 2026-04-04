export type Screen = "menu" | "roulette";

export type MenuItem = {
  name: string;
  screen: Screen | null; // null = coming soon
  label: string;
};

export type MoneyMode = "play" | "real";

export interface AppState {
  screen: Screen;
  balance: number;
  moneyMode: MoneyMode;
  menuCursor: number;
  menuAnimFrame: number;
  message: string;
  messageTimeout: ReturnType<typeof setTimeout> | null;
  roulette: RouletteState;
}

export type RoulettePhase = "betting" | "spinning" | "result";

export type BetType =
  | { kind: "straight"; number: number }
  | { kind: "split"; numbers: [number, number] }
  | { kind: "street"; row: number }
  | { kind: "trio"; numbers: [number, number, number] }
  | { kind: "corner"; numbers: [number, number, number, number] }
  | { kind: "sixline"; rows: [number, number] }
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

export type CursorZone = "zero" | "grid" | "column" | "dozen" | "outside";
export type WheelMode = "arrow" | "ball";

export interface RouletteState {
  phase: RoulettePhase;
  bets: Bet[];
  betAmount: number;          // current chip size
  cursorZone: CursorZone;
  cursorVR: number;           // virtual row within zone
  cursorVC: number;           // virtual col within zone
  result: number | null;      // last spin result
  spinFrame: number;          // animation frame counter
  spinTarget: number;         // final landing number
  spinHighlight: number;      // currently highlighted number during animation
  spinHalfStep: boolean;      // pointer between numbers (shifted by half slot)
  winAmount: number;          // amount won on last spin
  spinHistory: number[];       // last N spin results
  showResultTimer: ReturnType<typeof setTimeout> | null;
  wheelMode: WheelMode;
  ballRow: number;             // 0-3 for bounce lines, 4 = settled on wheel
  ballCol: number;             // horizontal offset from center
  ballY: number;               // continuous vertical position (0=top, 3=floor)
  ballVY: number;              // vertical velocity
  ballVX: number;              // horizontal velocity
  ballBouncing: boolean;       // ball still in motion
}
