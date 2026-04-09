export type Screen = "menu" | "roulette" | "blackjack" | "paigow" | "craps" | "options" | "login" | "deposit" | "withdraw";

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
  paigow: {
    defaultSort: PaiGowSortMode;
    coloredSuits: boolean;
  };
}

export type LoginPhase = "email-input" | "sending" | "code-input" | "verifying" | "error";

export interface AuthState {
  loggedIn: boolean;
  email: string;
  token: string;
  userId: number;
  phase: LoginPhase;
  emailInput: string;
  codeInput: string;
  error: string;
}

export type WalletPhase = "loading" | "ready" | "error";
export type WithdrawPhase = "address-input" | "amount-input" | "confirm" | "code-sending" | "code-input" | "sending" | "success" | "error";

export interface DepositEntry {
  from: string;
  amount: string; // base units
  tx_hash: string;
}

export interface WithdrawalEntry {
  to: string;
  amount: string; // base units
  tx_hash: string;
}

export interface WalletState {
  // Deposit
  depositPhase: WalletPhase;
  walletAddress: string;
  usdcBalance: string; // raw base units
  copied: boolean;
  deposits: DepositEntry[];
  withdrawals: WithdrawalEntry[];
  pollTimer: ReturnType<typeof setInterval> | null;
  // Withdraw
  withdrawPhase: WithdrawPhase;
  withdrawAddress: string;
  withdrawAmount: string;
  withdrawCode: string;
  txHash: string;
  error: string;
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
  paigow: PaiGowState;
  craps: CrapsState;
  options: GameOptions;
  optionsCursor: number;
  auth: AuthState;
  wallet: WalletState;
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

// Pai Gow Poker types
export type PaiGowPhase = 'betting' | 'arranging' | 'result';

export interface PaiGowCard {
  rank: Rank | 'Joker';
  suit: Suit | 'wild';
}

export type PokerHandRank =
  | 'five-aces'
  | 'royal-flush'
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'one-pair'
  | 'high-card';

export interface PokerHandEval {
  rank: PokerHandRank;
  value: number;        // numeric value for comparison (higher = better)
  name: string;         // display name, e.g. "Pair of Aces"
}

export type PaiGowSortMode = 'ascending' | 'descending';

export interface PaiGowState {
  phase: PaiGowPhase;
  deck: PaiGowCard[];
  playerCards: PaiGowCard[];    // all 7 cards
  dealerCards: PaiGowCard[];    // all 7 cards
  lowHand: number[];            // indices into playerCards for 2-card hand
  cursor: number;               // card selection cursor (0-6)
  dealerHigh: PaiGowCard[];     // dealer's arranged 5-card hand
  dealerLow: PaiGowCard[];      // dealer's arranged 2-card hand
  betAmount: number;
  winAmount: number;
  resultMessage: string;
  foulMessage: string;          // shown if arrangement is invalid
  sortMode: PaiGowSortMode;
  coloredSuits: boolean;
  spreadFrame: number;          // 0 = no anim, >0 = spreading cards
  sortFrame: number;            // 0 = no anim, >0 = sort animation
}

// Craps types
export type CrapsPhase = "betting" | "rolling" | "result";

export type CrapsBetKind =
  | "pass"
  | "dontPass"
  | "come"
  | "dontCome"
  | "field"
  | "place4"
  | "place5"
  | "place6"
  | "place8"
  | "place9"
  | "place10"
  | "passOdds"
  | "dontPassOdds"
  | "comeOdds"
  | "dontComeOdds"
  | "hard4"
  | "hard6"
  | "hard8"
  | "hard10"
  | "any7"
  | "anyCraps"
  | "yo"
  | "horn"
  | "ce"
  | "aces"
  | "aceDeuce"
  | "twelve";

export interface CrapsBet {
  kind: CrapsBetKind;
  amount: number;
  point?: number; // for come/don't come bets and their odds that have established a point
}

export interface CrapsState {
  phase: CrapsPhase;
  point: number | null;          // null = come-out roll, number = point phase
  bets: CrapsBet[];
  betAmount: number;             // current chip size
  cursorPos: number;             // index into bet positions array
  dice: [number, number];        // current dice values
  rollHistory: number[];         // last N roll sums
  rollFrame: number;             // animation frame counter
  rollTarget: [number, number];  // final dice values
  winAmount: number;             // amount won on last roll
  lossAmount: number;            // amount lost on last roll
  message: string;               // roll result message
  skipAnim: boolean;             // user pressed Enter to skip animation
}

// Game module interface — each game implements this for TUI dispatch
export interface GameModule {
  handleKey(state: AppState, key: import("./keybindings").KeyEvent, render: () => void): void;
  render(state: AppState): string[];
  renderHotkeys(width: number, state: AppState): string[];
}
