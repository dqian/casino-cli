import type { AppState, Card } from "../types";
import { createShoe, drawCard, handValue, isBlackjack, isBusted, hiLoValue } from "./deck";

// Staged cards for deal animation — cards are drawn upfront,
// then added to hands one at a time as the animation plays
let dealStage: { p1: Card; d1: Card; p2: Card; d2: Card } | null = null;

function countCard(state: AppState, card: Card): void {
  state.blackjack.runningCount += hiLoValue(card);
}

export function deal(state: AppState): void {
  const bj = state.blackjack;

  if (bj.betAmount > state.balance) {
    state.message = "Not enough balance!";
    return;
  }

  // Auto-shuffle when past the cut card
  if (bj.shoe.length <= bj.cutCard) {
    const nd = state.options.blackjack.numDecks;
    bj.shoe = createShoe(nd);
    bj.numDecks = nd;
    const base = nd * 5;
    bj.cutCard = base + Math.floor(Math.random() * (nd * 15 + 1));
    bj.runningCount = 0;
    state.message = "Shoe reshuffled!";
  }

  state.balance -= bj.betAmount;

  // Draw all 4 cards upfront, stage for animation
  dealStage = {
    p1: drawCard(bj.shoe),
    d1: drawCard(bj.shoe),
    p2: drawCard(bj.shoe),
    d2: drawCard(bj.shoe),
  };

  // Set up empty hands
  bj.playerHands = [{
    cards: [],
    bet: bj.betAmount,
    doubled: false,
    stood: false,
    result: null,
  }];
  bj.activeHand = 0;
  bj.dealerCards = [];
  bj.dealerRevealed = false;
  bj.winAmount = 0;
  bj.cardAnim = null;
  bj.insuranceBet = 0;
  state.message = "";
}

function checkInsurance(state: AppState): boolean {
  const bj = state.blackjack;
  if (bj.dealerCards[0]?.rank !== 'A') return false;
  const cost = Math.floor(bj.betAmount / 2);
  if (cost > state.balance) return false;
  bj.phase = "insurance";
  return true;
}

export function takeInsurance(state: AppState): void {
  const bj = state.blackjack;
  const cost = Math.floor(bj.betAmount / 2);
  if (cost > state.balance) {
    state.message = "Not enough balance!";
    bj.insuranceBet = 0;
    finishDeal(state);
    return;
  }
  state.balance -= cost;
  bj.insuranceBet = cost;
  finishDeal(state);
}

export function declineInsurance(state: AppState): void {
  state.blackjack.insuranceBet = 0;
  finishDeal(state);
}

function finishDeal(state: AppState): void {
  const bj = state.blackjack;
  const cards = bj.playerHands[0]!.cards;
  const playerBj = isBlackjack(cards);
  const dealerBj = isBlackjack(bj.dealerCards);

  // Resolve insurance side bet
  let insuranceMsg = "";
  if (bj.insuranceBet > 0) {
    if (dealerBj) {
      state.balance += bj.insuranceBet * 3; // return + 2:1
      insuranceMsg = ` Insurance +$${bj.insuranceBet * 2}`;
    } else {
      insuranceMsg = ` Insurance lost`;
    }
  }

  if (playerBj || dealerBj) {
    bj.dealerRevealed = true;
    countCard(state, bj.dealerCards[1]!);
    if (playerBj && dealerBj) {
      bj.playerHands[0]!.result = "push";
      state.balance += bj.betAmount;
      bj.winAmount = 0;
      state.message = "Both blackjack — Push!" + insuranceMsg;
    } else if (playerBj) {
      const payout = Math.floor(bj.betAmount * 1.5);
      bj.playerHands[0]!.result = "blackjack";
      state.balance += bj.betAmount + payout;
      bj.winAmount = payout;
      state.message = "Blackjack! 3:2" + insuranceMsg;
    } else {
      bj.playerHands[0]!.result = "lose";
      bj.winAmount = -bj.betAmount;
      state.message = "Dealer blackjack!" + insuranceMsg;
    }
    bj.phase = "result";
    return;
  }

  if (insuranceMsg) state.message = insuranceMsg.trim();
  bj.phase = "playing";
}

export function hit(state: AppState): void {
  const bj = state.blackjack;
  if (bj.phase !== "playing") return;

  const hand = bj.playerHands[bj.activeHand];
  if (!hand || hand.stood) return;

  const card = drawCard(bj.shoe);
  hand.cards.push(card);
  countCard(state, card);
}

export function resolveHit(state: AppState): void {
  const bj = state.blackjack;
  const hand = bj.playerHands[bj.activeHand];
  if (!hand) return;

  if (isBusted(hand.cards)) {
    hand.result = "bust";
    hand.stood = true;
    advanceHand(state);
  } else if (handValue(hand.cards).value === 21) {
    hand.stood = true;
    advanceHand(state);
  }
}

export function stand(state: AppState): void {
  const bj = state.blackjack;
  if (bj.phase !== "playing") return;

  const hand = bj.playerHands[bj.activeHand];
  if (!hand || hand.stood) return;

  hand.stood = true;
  advanceHand(state);
}

export function doubleDown(state: AppState): void {
  const bj = state.blackjack;
  if (bj.phase !== "playing") return;

  const hand = bj.playerHands[bj.activeHand];
  if (!hand || hand.stood || hand.cards.length !== 2) return;
  if (hand.bet > state.balance) {
    state.message = "Not enough balance to double!";
    return;
  }

  state.balance -= hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  const card = drawCard(bj.shoe);
  hand.cards.push(card);
  countCard(state, card);
  hand.stood = true;
}

export function resolveDouble(state: AppState): void {
  const bj = state.blackjack;
  const hand = bj.playerHands[bj.activeHand];
  if (!hand) return;

  if (isBusted(hand.cards)) {
    hand.result = "bust";
  }
  advanceHand(state);
}

export function split(state: AppState): void {
  const bj = state.blackjack;
  if (bj.phase !== "playing") return;

  const hand = bj.playerHands[bj.activeHand];
  if (!hand || hand.stood || hand.cards.length !== 2) return;

  const [c1, c2] = hand.cards;
  if (!c1 || !c2 || c1.rank !== c2.rank) return;
  if (hand.bet > state.balance) {
    state.message = "Not enough balance to split!";
    return;
  }
  if (bj.playerHands.length >= 4) {
    state.message = "Maximum splits reached!";
    return;
  }

  state.balance -= hand.bet;

  const draw1 = drawCard(bj.shoe);
  const draw2 = drawCard(bj.shoe);
  countCard(state, draw1);
  countCard(state, draw2);

  hand.cards = [c1, draw1];
  const newHand = {
    cards: [c2, draw2] as typeof hand.cards,
    bet: hand.bet,
    doubled: false,
    stood: false,
    result: null as typeof hand.result,
  };

  bj.playerHands.splice(bj.activeHand + 1, 0, newHand);

  // Split aces: one card only per hand
  if (c1.rank === 'A') {
    hand.stood = true;
    newHand.stood = true;
    advanceHand(state);
  }

  state.message = "";
}

function advanceHand(state: AppState): void {
  const bj = state.blackjack;

  for (let i = bj.activeHand + 1; i < bj.playerHands.length; i++) {
    if (!bj.playerHands[i]!.stood) {
      bj.activeHand = i;
      return;
    }
  }

  // All hands done
  const allBusted = bj.playerHands.every(h => h.result === "bust");
  if (allBusted) {
    bj.dealerRevealed = true;
    countCard(state, bj.dealerCards[1]!);
    bj.phase = "result";
    const totalBet = bj.playerHands.reduce((s, h) => s + h.bet, 0);
    bj.winAmount = -totalBet;
    state.message = bj.playerHands.length === 1 ? "Bust!" : "";
    return;
  }

  bj.phase = "dealer";
  bj.dealerRevealed = true;
  countCard(state, bj.dealerCards[1]!);
}

export function dealerPlay(state: AppState, render: () => void): void {
  const bj = state.blackjack;
  if (bj.phase !== "dealer") return;

  const { value } = handValue(bj.dealerCards);

  if (value < 17) {
    const card = drawCard(bj.shoe);
    bj.dealerCards.push(card);
    countCard(state, card);
    animateCard(state, render, 'dealer', () => {
      if (bj.phase !== "dealer") return; // skipped
      dealerPlay(state, render);
    });
  } else {
    resolveAllHands(state);
    bj.phase = "result";
    render();
  }
}

export function skipDealer(state: AppState): void {
  const bj = state.blackjack;
  if (bj.phase !== "dealer") return;
  bj.cardAnim = null;

  while (handValue(bj.dealerCards).value < 17) {
    const card = drawCard(bj.shoe);
    bj.dealerCards.push(card);
    countCard(state, card);
  }
  resolveAllHands(state);
  bj.phase = "result";
}

function resolveAllHands(state: AppState): void {
  const bj = state.blackjack;
  const dealerVal = handValue(bj.dealerCards).value;
  const dealerBust = dealerVal > 21;
  let totalReturn = 0;

  for (const hand of bj.playerHands) {
    if (hand.result === "bust") continue;

    const playerVal = handValue(hand.cards).value;

    if (dealerBust || playerVal > dealerVal) {
      hand.result = "win";
      totalReturn += hand.bet * 2;
    } else if (playerVal === dealerVal) {
      hand.result = "push";
      totalReturn += hand.bet;
    } else {
      hand.result = "lose";
    }
  }

  state.balance += totalReturn;

  const totalBet = bj.playerHands.reduce((s, h) => s + h.bet, 0);
  bj.winAmount = totalReturn - totalBet;

  if (bj.playerHands.length === 1) {
    const hand = bj.playerHands[0]!;
    switch (hand.result) {
      case "win": state.message = dealerBust ? "Dealer busts!" : "You win!"; break;
      case "push": state.message = "Push!"; break;
      case "lose": state.message = "Dealer wins!"; break;
    }
  } else {
    const wins = bj.playerHands.filter(h => h.result === "win").length;
    const pushes = bj.playerHands.filter(h => h.result === "push").length;
    const losses = bj.playerHands.filter(h => h.result === "lose" || h.result === "bust").length;
    state.message = `${wins}W ${pushes}P ${losses}L`;
  }
}

export function newBjRound(state: AppState): void {
  state.blackjack.phase = "betting";
  state.blackjack.playerHands = [];
  state.blackjack.dealerCards = [];
  state.blackjack.dealerRevealed = false;
  state.blackjack.activeHand = 0;
  state.blackjack.winAmount = 0;
  state.blackjack.cardAnim = null;
  state.blackjack.insuranceBet = 0;
  state.message = "";
}

const CARD_ANIM_FRAMES = 8;
const CARD_ANIM_DELAY = 40;
let animSkipped = false;
let animGeneration = 0;

function animateCard(
  state: AppState,
  render: () => void,
  target: 'dealer' | 'player',
  onDone: () => void,
): void {
  const bj = state.blackjack;

  // If skip was triggered, resolve instantly
  if (animSkipped) {
    bj.cardAnim = null;
    onDone();
    return;
  }

  const gen = ++animGeneration;
  bj.cardAnim = { target, frame: 0 };
  render();

  const step = () => {
    // Stale timer — this animation was already resolved
    if (gen !== animGeneration) return;

    if (!bj.cardAnim || animSkipped) {
      bj.cardAnim = null;
      onDone();
      return;
    }
    bj.cardAnim.frame++;
    if (bj.cardAnim.frame >= CARD_ANIM_FRAMES) {
      bj.cardAnim = null;
      render();
      onDone();
      return;
    }
    render();
    setTimeout(step, CARD_ANIM_DELAY);
  };
  setTimeout(step, CARD_ANIM_DELAY);
}

export function skipCardAnim(state: AppState): void {
  animSkipped = true;
  animGeneration++;
  state.blackjack.cardAnim = null;
}

export function startDealAnimation(state: AppState, render: () => void): void {
  animSkipped = false;
  const bj = state.blackjack;
  const stage = dealStage;
  if (!stage) return;
  dealStage = null;

  // Step 1: player card 1
  bj.playerHands[0]!.cards.push(stage.p1);
  countCard(state, stage.p1);
  animateCard(state, render, 'player', () => {
    // Step 2: dealer card 1
    bj.dealerCards.push(stage.d1);
    countCard(state, stage.d1);
    animateCard(state, render, 'dealer', () => {
      // Step 3: player card 2
      bj.playerHands[0]!.cards.push(stage.p2);
      countCard(state, stage.p2);
      animateCard(state, render, 'player', () => {
        // Step 4: dealer card 2 (face down — don't count yet)
        bj.dealerCards.push(stage.d2);
        animateCard(state, render, 'dealer', () => {
          // Check if insurance should be offered
          if (!checkInsurance(state)) {
            finishDeal(state);
          }
          render();
        });
      });
    });
  });
}

export function animateHit(state: AppState, render: () => void, onDone: () => void): void {
  animSkipped = false;
  animateCard(state, render, 'player', onDone);
}

export function animateDouble(state: AppState, render: () => void, onDone: () => void): void {
  animSkipped = false;
  animateCard(state, render, 'player', onDone);
}

export function canSplit(state: AppState): boolean {
  const bj = state.blackjack;
  const hand = bj.playerHands[bj.activeHand];
  if (!hand || hand.cards.length !== 2 || hand.stood) return false;
  if (bj.playerHands.length >= 4) return false;
  if (hand.bet > state.balance) return false;
  return hand.cards[0]!.rank === hand.cards[1]!.rank;
}

export function canDouble(state: AppState): boolean {
  const bj = state.blackjack;
  const hand = bj.playerHands[bj.activeHand];
  if (!hand || hand.cards.length !== 2 || hand.stood) return false;
  return hand.bet <= state.balance;
}
