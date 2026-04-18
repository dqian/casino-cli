import type { AppState, Card, BaccaratBetType } from "../types";
import { createShoe, drawCard } from "../shared/cards";

// Baccarat card value: A=1, 2-9=face value, 10/J/Q/K=0
export function baccaratCardValue(card: Card): number {
  if (card.rank === 'A') return 1;
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J' || card.rank === '10') return 0;
  return parseInt(card.rank);
}

// Hand value = sum of card values mod 10
export function baccaratHandValue(cards: Card[]): number {
  let total = 0;
  for (const card of cards) {
    total += baccaratCardValue(card);
  }
  return total % 10;
}

// Staged cards for deal animation — drawn upfront, added one at a time
interface DealStage {
  p1: Card;
  b1: Card;
  p2: Card;
  b2: Card;
  playerThird: Card | null;
  bankerThird: Card | null;
}

let dealStage: DealStage | null = null;

// Determine if player draws third card (returns true if player draws)
function playerDrawsThird(playerValue: number): boolean {
  return playerValue <= 5;
}

// Determine if banker draws third card based on banker total and player's third card
function bankerDrawsThird(bankerValue: number, playerThirdCard: Card | null): boolean {
  // If player stood (no third card), banker draws on 0-5
  if (!playerThirdCard) {
    return bankerValue <= 5;
  }

  const pThird = baccaratCardValue(playerThirdCard);

  switch (bankerValue) {
    case 0:
    case 1:
    case 2:
      return true; // always draws
    case 3:
      return pThird !== 8; // draws unless player's third was 8
    case 4:
      return pThird >= 2 && pThird <= 7; // draws on 2-7
    case 5:
      return pThird >= 4 && pThird <= 7; // draws on 4-7
    case 6:
      return pThird === 6 || pThird === 7; // draws on 6-7
    case 7:
      return false; // stands
    default:
      return false; // 8-9 natural, should not reach here
  }
}

export function deal(state: AppState): boolean {
  const bc = state.baccarat;

  if (bc.betAmount > state.balance) {
    state.message = "Not enough balance!";
    return false;
  }

  // Auto-shuffle when past the cut card
  if (bc.shoe.length <= bc.cutCard) {
    const nd = state.options.baccarat.numDecks;
    bc.shoe = createShoe(nd);
    bc.numDecks = nd;
    const base = nd * 5;
    bc.cutCard = base + Math.floor(Math.random() * (nd * 15 + 1));
    state.message = "Shoe reshuffled!";
  }

  state.balance -= bc.betAmount;

  // Draw initial 4 cards
  const p1 = drawCard(bc.shoe);
  const b1 = drawCard(bc.shoe);
  const p2 = drawCard(bc.shoe);
  const b2 = drawCard(bc.shoe);

  // Calculate initial values to determine third cards
  const playerInitial = (baccaratCardValue(p1) + baccaratCardValue(p2)) % 10;
  const bankerInitial = (baccaratCardValue(b1) + baccaratCardValue(b2)) % 10;

  let playerThird: Card | null = null;
  let bankerThird: Card | null = null;

  // Check for naturals (8 or 9)
  const isNatural = playerInitial >= 8 || bankerInitial >= 8;

  if (!isNatural) {
    // Player third card rule
    if (playerDrawsThird(playerInitial)) {
      playerThird = drawCard(bc.shoe);
    }

    // Banker third card rule
    if (bankerDrawsThird(bankerInitial, playerThird)) {
      bankerThird = drawCard(bc.shoe);
    }
  }

  dealStage = { p1, b1, p2, b2, playerThird, bankerThird };

  // Set up empty hands
  bc.playerCards = [];
  bc.bankerCards = [];
  bc.winAmount = 0;
  bc.resultMessage = "";
  bc.cardAnim = null;
  state.message = "";
  return true;
}

function resolveRound(state: AppState): void {
  const bc = state.baccarat;
  const playerVal = baccaratHandValue(bc.playerCards);
  const bankerVal = baccaratHandValue(bc.bankerCards);

  let winner: 'player' | 'banker' | 'tie';
  if (playerVal > bankerVal) {
    winner = 'player';
  } else if (bankerVal > playerVal) {
    winner = 'banker';
  } else {
    winner = 'tie';
  }

  const isNatural = (bc.playerCards.length === 2 && playerVal >= 8) ||
                    (bc.bankerCards.length === 2 && bankerVal >= 8);

  // Calculate payout
  if (bc.betType === winner) {
    switch (bc.betType) {
      case 'player':
        // 1:1 payout
        state.balance += bc.betAmount * 2;
        bc.winAmount = bc.betAmount;
        break;
      case 'banker':
        // 1:1 minus 5% commission
        const payout = bc.betAmount * 2;
        const commission = Math.floor(bc.betAmount * 0.05);
        state.balance += payout - commission;
        bc.winAmount = bc.betAmount - commission;
        break;
      case 'tie':
        // 8:1 payout
        state.balance += bc.betAmount + bc.betAmount * 8;
        bc.winAmount = bc.betAmount * 8;
        break;
    }
  } else if (winner === 'tie' && bc.betType !== 'tie') {
    // Tie returns bet on player/banker bets
    state.balance += bc.betAmount;
    bc.winAmount = 0;
  } else {
    bc.winAmount = -bc.betAmount;
  }

  // Result message
  const naturalStr = isNatural ? "Natural! " : "";
  if (winner === 'player') {
    bc.resultMessage = `${naturalStr}Player wins! ${playerVal} vs ${bankerVal}`;
  } else if (winner === 'banker') {
    bc.resultMessage = `${naturalStr}Banker wins! ${bankerVal} vs ${playerVal}`;
  } else {
    bc.resultMessage = `${naturalStr}Tie! ${playerVal} - ${bankerVal}`;
  }

  bc.phase = "result";
}

export function newRound(state: AppState): void {
  state.baccarat.phase = "betting";
  state.baccarat.playerCards = [];
  state.baccarat.bankerCards = [];
  state.baccarat.winAmount = 0;
  state.baccarat.resultMessage = "";
  state.baccarat.cardAnim = null;
  state.message = "";
}

// --- Card animation ---

const CARD_ANIM_FRAMES = 8;
const CARD_ANIM_DELAY = 40;
let animSkipped = false;
let animGeneration = 0;

function animateCard(
  state: AppState,
  render: () => void,
  target: 'player' | 'banker',
  onDone: () => void,
): void {
  const bc = state.baccarat;

  if (animSkipped) {
    bc.cardAnim = null;
    onDone();
    return;
  }

  const gen = ++animGeneration;
  bc.cardAnim = { target, frame: 0 };
  render();

  const step = () => {
    if (gen !== animGeneration) return;

    if (!bc.cardAnim || animSkipped) {
      bc.cardAnim = null;
      onDone();
      return;
    }
    bc.cardAnim.frame++;
    if (bc.cardAnim.frame >= CARD_ANIM_FRAMES) {
      bc.cardAnim = null;
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
  state.baccarat.cardAnim = null;
}

export function startDealAnimation(state: AppState, render: () => void): void {
  animSkipped = false;
  const bc = state.baccarat;
  const stage = dealStage;
  if (!stage) return;
  dealStage = null;
  bc.phase = "dealing";

  // Step 1: player card 1
  bc.playerCards.push(stage.p1);
  animateCard(state, render, 'player', () => {
    // Step 2: banker card 1
    bc.bankerCards.push(stage.b1);
    animateCard(state, render, 'banker', () => {
      // Step 3: player card 2
      bc.playerCards.push(stage.p2);
      animateCard(state, render, 'player', () => {
        // Step 4: banker card 2
        bc.bankerCards.push(stage.b2);
        animateCard(state, render, 'banker', () => {
          // Step 5: player third card (if any)
          if (stage.playerThird) {
            bc.playerCards.push(stage.playerThird);
            animateCard(state, render, 'player', () => {
              // Step 6: banker third card (if any)
              if (stage.bankerThird) {
                bc.bankerCards.push(stage.bankerThird);
                animateCard(state, render, 'banker', () => {
                  resolveRound(state);
                  render();
                });
              } else {
                resolveRound(state);
                render();
              }
            });
          } else if (stage.bankerThird) {
            // No player third, but banker draws third
            bc.bankerCards.push(stage.bankerThird);
            animateCard(state, render, 'banker', () => {
              resolveRound(state);
              render();
            });
          } else {
            // No third cards (natural or both stand)
            resolveRound(state);
            render();
          }
        });
      });
    });
  });
}

export function skipDeal(state: AppState): void {
  const bc = state.baccarat;
  if (bc.phase !== "dealing") return;
  skipCardAnim(state);

  const stage = dealStage;
  if (stage) {
    dealStage = null;
    if (bc.playerCards.length < 2) {
      if (bc.playerCards.length === 0) bc.playerCards.push(stage.p1);
      bc.bankerCards.length === 0 && bc.bankerCards.push(stage.b1);
      bc.playerCards.length < 2 && bc.playerCards.push(stage.p2);
      bc.bankerCards.length < 2 && bc.bankerCards.push(stage.b2);
      if (stage.playerThird) bc.playerCards.push(stage.playerThird);
      if (stage.bankerThird) bc.bankerCards.push(stage.bankerThird);
    }
  }

  resolveRound(state);
}
