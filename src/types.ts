export type Screen = "menu" | "roulette" | "blackjack" | "options";

export type MenuItem = {
  name: string;
  screen: Screen | null; // null = coming soon
  label: string;
};

export type MoneyMode = "play" | "real";

export interface GameOptions {
  roulette: {
    defaultWheelMode: WheelMode;
    tableMax: number | null; // null = no limit
  };
  blackjack: {
    numDecks: number;
  };
}

export interface AppState {
  screen: Screen;
  balance: number;
  moneyMode: MoneyMode;
  menuCursor: number;
  menuAnimFrame: number;
  message: string;
  messageTimeout: ReturnType<typeof setTimeout> | null;
  roulette: RouletteState;
  blackjack: BlackjackState;
  options: GameOptions;
  optionsCursor: number;
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

// Blackjack types
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type Suit = '♠' | '♥' | '♦' | '♣';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'bust';

export interface BlackjackHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  stood: boolean;
  result: HandResult | null;
}

export type BlackjackPhase = 'betting' | 'insurance' | 'playing' | 'dealer' | 'result';

export interface BlackjackState {
  phase: BlackjackPhase;
  shoe: Card[];
  cutCard: number;              // cards remaining when cut card is hit
  numDecks: number;             // deck count used for current shoe
  playerHands: BlackjackHand[];
  activeHand: number;
  dealerCards: Card[];
  dealerRevealed: boolean;
  betAmount: number;
  winAmount: number;
  cardAnim: CardAnim | null;  // slide-in animation for any card
  showHint: boolean;
  showCount: boolean;
  runningCount: number;         // Hi-Lo running count
  insuranceBet: number;         // 0 = no insurance taken
}

export interface CardAnim {
  target: 'dealer' | 'player';  // which hand is receiving the card
  frame: number;                // current animation frame
}
