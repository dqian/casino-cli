import type { AppState } from "../types";
import type { KeyEvent } from "../keybindings";
import { getWallet, getWalletBalance, getWalletDeposits, withdraw } from "../auth/client";
import { spawn } from "node:child_process";

const MAX_ADDRESS_LENGTH = 42; // 0x + 40 hex chars

export function handleDepositKey(state: AppState, key: KeyEvent, render: () => void): void {
  if (state.wallet.depositPhase === "loading") return;

  if (key.name === "escape" || key.name === "q") {
    stopPolling(state);
    state.screen = "menu";
    return;
  }

  // 'r' to refresh balance only
  if (key.name === "r" && state.wallet.depositPhase === "ready") {
    refreshBalance(state, render);
    return;
  }

  // 'c' or Enter to copy address
  if ((key.name === "c" || key.name === "return") && state.wallet.depositPhase === "ready" && state.wallet.walletAddress) {
    copyToClipboard(state.wallet.walletAddress);
    state.wallet.copied = true;
    render();
    setTimeout(() => { state.wallet.copied = false; render(); }, 2000);
  }
}

export function handleWithdrawKey(state: AppState, key: KeyEvent, render: () => void): void {
  const w = state.wallet;

  if (w.withdrawPhase === "sending") return;

  if (key.name === "escape") {
    if (w.withdrawPhase === "amount-input") {
      w.withdrawPhase = "address-input";
      w.withdrawAmount = "";
      return;
    }
    if (w.withdrawPhase === "confirm") {
      w.withdrawPhase = "amount-input";
      return;
    }
    state.screen = "menu";
    resetWithdraw(state);
    return;
  }

  if (key.name === "q" && w.withdrawPhase === "address-input" && w.withdrawAddress === "") {
    state.screen = "menu";
    resetWithdraw(state);
    return;
  }

  if (w.withdrawPhase === "address-input") {
    handleAddressInput(state, key, render);
  } else if (w.withdrawPhase === "amount-input") {
    handleAmountInput(state, key, render);
  } else if (w.withdrawPhase === "confirm") {
    handleConfirm(state, key, render);
  } else if (w.withdrawPhase === "success" || w.withdrawPhase === "error") {
    state.screen = "menu";
    resetWithdraw(state);
  }
}

function handleAddressInput(state: AppState, key: KeyEvent, _render: () => void): void {
  const w = state.wallet;

  if (key.name === "return" && /^0x[0-9a-fA-F]{40}$/.test(w.withdrawAddress)) {
    w.withdrawPhase = "amount-input";
    w.error = "";
    return;
  }

  if (key.name === "backspace") {
    w.withdrawAddress = w.withdrawAddress.slice(0, -1);
    return;
  }

  if (key.raw.length === 1 && !key.ctrl && w.withdrawAddress.length < MAX_ADDRESS_LENGTH) {
    const ch = key.raw;
    if (/[0-9a-fA-Fx]/.test(ch)) {
      w.withdrawAddress += ch;
    }
  }
}

function handleAmountInput(state: AppState, key: KeyEvent, render: () => void): void {
  const w = state.wallet;

  if (key.name === "return" && w.withdrawAmount.length > 0) {
    const parsed = parseFloat(w.withdrawAmount);
    if (isNaN(parsed) || parsed <= 0) {
      w.error = "Enter a valid amount";
      return;
    }
    w.error = "";
    w.withdrawPhase = "confirm";
    return;
  }

  if (key.name === "backspace") {
    w.withdrawAmount = w.withdrawAmount.slice(0, -1);
    return;
  }

  if (key.raw.length === 1 && !key.ctrl && w.withdrawAmount.length < 20) {
    const ch = key.raw;
    if (/[0-9]/.test(ch) || (ch === "." && !w.withdrawAmount.includes("."))) {
      w.withdrawAmount += ch;
    }
  }
}

function handleConfirm(state: AppState, key: KeyEvent, render: () => void): void {
  const w = state.wallet;

  if (key.name === "y" || key.name === "Y") {
    w.withdrawPhase = "sending";
    render();

    const parsed = parseFloat(w.withdrawAmount);
    const baseUnits = Math.floor(parsed * 1_000_000).toString();

    withdraw(state.auth.token, w.withdrawAddress, baseUnits).then((res) => {
      if (res.error) {
        w.withdrawPhase = "error";
        w.error = res.error;
      } else {
        w.withdrawPhase = "success";
        w.txHash = res.tx_hash || "";
      }
      render();
    }).catch(() => {
      w.withdrawPhase = "error";
      w.error = "Could not reach server";
      render();
    });
    return;
  }

  if (key.name === "n" || key.name === "N") {
    w.withdrawPhase = "amount-input";
  }
}

/** Full wallet load — address, balance, and recent deposits. Starts auto-refresh. */
export function loadWallet(state: AppState, render: () => void): void {
  state.wallet.depositPhase = "loading";
  render();

  // Start 10s polling
  stopPolling(state);
  state.wallet.pollTimer = setInterval(() => {
    if (state.screen === "deposit") {
      refreshBalance(state, render);
    } else {
      stopPolling(state);
    }
  }, 10_000);

  getWallet(state.auth.token).then((res) => {
    if (res.error) {
      state.wallet.depositPhase = "error";
      state.wallet.error = res.error;
      render();
      return;
    }

    state.wallet.walletAddress = res.wallet_address || "";
    state.wallet.usdcBalance = res.usdc_balance || "0";
    state.wallet.depositPhase = "ready";
    render();

    // Load deposits in background
    getWalletDeposits(state.auth.token).then((depRes) => {
      state.wallet.deposits = (depRes.transfers || []).map((t) => ({
        from: t.from,
        amount: t.amount,
        tx_hash: t.tx_hash,
      }));
      render();
    }).catch(() => {});
  }).catch(() => {
    state.wallet.depositPhase = "error";
    state.wallet.error = "Could not reach server";
    render();
  });
}

/** Lightweight balance-only refresh. */
function refreshBalance(state: AppState, render: () => void): void {
  getWalletBalance(state.auth.token).then((res) => {
    if (res.usdc_balance) {
      state.wallet.usdcBalance = res.usdc_balance;
    }
    render();
  }).catch(() => {});

  // Also refresh deposits
  getWalletDeposits(state.auth.token).then((res) => {
    state.wallet.deposits = (res.transfers || []).map((t) => ({
      from: t.from,
      amount: t.amount,
      tx_hash: t.tx_hash,
    }));
    render();
  }).catch(() => {});
}

function stopPolling(state: AppState): void {
  if (state.wallet.pollTimer) {
    clearInterval(state.wallet.pollTimer);
    state.wallet.pollTimer = null;
  }
}

function resetWithdraw(state: AppState): void {
  state.wallet.withdrawPhase = "address-input";
  state.wallet.withdrawAddress = "";
  state.wallet.withdrawAmount = "";
  state.wallet.txHash = "";
  state.wallet.error = "";
}

function copyToClipboard(text: string): void {
  const proc = process.platform === "darwin"
    ? spawn("pbcopy")
    : spawn("xclip", ["-selection", "clipboard"]);
  proc.stdin.write(text);
  proc.stdin.end();
}
