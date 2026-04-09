import type { AppState } from "../types";
import type { KeyEvent } from "../keybindings";
import { getWallet, getWalletBalance, getWalletDeposits, withdrawRequest, withdrawConfirm } from "../auth/client";
import { validateEvmAddress } from "./address";
import { spawn } from "node:child_process";

const MAX_ADDRESS_LENGTH = 42; // 0x + 40 hex chars

/** Sync real money balance from on-chain USDC balance. */
function syncRealBalance(state: AppState): void {
  if (state.moneyMode === "real") {
    const baseUnits = BigInt(state.wallet.usdcBalance || "0");
    state.balance = Number(baseUnits) / 1_000_000;
  }
}

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
    return;
  }

  // 1-5 opens tx on basescan
  if (/^[1-5]$/.test(key.name) && state.wallet.depositPhase === "ready") {
    const idx = parseInt(key.name, 10) - 1;
    const entry = state.wallet.deposits.slice(0, 5)[idx];
    if (entry) openTxOnBasescan(entry.tx_hash);
  }
}

export function handleWithdrawKey(state: AppState, key: KeyEvent, render: () => void): void {
  const w = state.wallet;

  if (w.withdrawPhase === "sending" || w.withdrawPhase === "code-sending") return;

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
    if (w.withdrawPhase === "code-input") {
      w.withdrawPhase = "confirm";
      w.withdrawCode = "";
      w.error = "";
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
  } else if (w.withdrawPhase === "code-input") {
    handleWithdrawCode(state, key, render);
  } else if (w.withdrawPhase === "success" || w.withdrawPhase === "error") {
    state.screen = "menu";
    resetWithdraw(state);
  }
}

function handleAddressInput(state: AppState, key: KeyEvent, _render: () => void): void {
  const w = state.wallet;

  if (key.name === "return") {
    const result = validateEvmAddress(w.withdrawAddress);
    if (result.valid) {
      w.withdrawPhase = "amount-input";
      w.error = "";
    } else {
      w.error = result.reason;
    }
    return;
  }

  if (key.name === "backspace") {
    w.withdrawAddress = w.withdrawAddress.slice(0, -1);
    w.error = "";
    return;
  }

  // Number keys 1-5 select from withdrawal history (only when address is empty)
  if (w.withdrawAddress === "" && /^[1-5]$/.test(key.name)) {
    const idx = parseInt(key.name, 10) - 1;
    const historyEntry = w.withdrawals.slice(0, 5)[idx];
    if (historyEntry) {
      w.withdrawAddress = historyEntry.to;
      w.error = "";
      return;
    }
  }

  // Shift+1-5 (!@#$%) opens tx on basescan
  const shiftDigitMap: Record<string, number> = { "!": 0, "@": 1, "#": 2, "$": 3, "%": 4 };
  if (w.withdrawAddress === "" && key.name in shiftDigitMap) {
    const idx = shiftDigitMap[key.name]!;
    const historyEntry = w.withdrawals.slice(0, 5)[idx];
    if (historyEntry) {
      openTxOnBasescan(historyEntry.tx_hash);
      return;
    }
  }

  // Handle paste (multi-char) or single keypress
  if (!key.ctrl && key.raw.length >= 1) {
    for (const ch of key.raw) {
      if (w.withdrawAddress.length >= MAX_ADDRESS_LENGTH) break;
      if (/[0-9a-fA-FxX]/.test(ch)) {
        w.withdrawAddress += ch;
      }
    }
    w.error = "";
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

  // 'm' for MAX — fill full USDC balance
  if (key.name === "m") {
    const raw = BigInt(w.usdcBalance || "0");
    const whole = raw / 1_000_000n;
    const frac = raw % 1_000_000n;
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    w.withdrawAmount = fracStr ? `${whole}.${fracStr}` : `${whole}`;
    w.error = "";
    return;
  }

  if (!key.ctrl && key.raw.length >= 1) {
    for (const ch of key.raw) {
      if (w.withdrawAmount.length >= 20) break;
      if (/[0-9]/.test(ch) || (ch === "." && !w.withdrawAmount.includes("."))) {
        w.withdrawAmount += ch;
      }
    }
  }
}

function handleConfirm(state: AppState, key: KeyEvent, render: () => void): void {
  const w = state.wallet;

  if (key.name === "y" || key.name === "Y") {
    w.withdrawPhase = "code-sending";
    render();

    const parsed = parseFloat(w.withdrawAmount);
    const baseUnits = Math.floor(parsed * 1_000_000).toString();

    withdrawRequest(state.auth.token, w.withdrawAddress, baseUnits).then((res) => {
      if (res.error) {
        w.withdrawPhase = "error";
        w.error = res.error;
      } else {
        w.withdrawPhase = "code-input";
        w.withdrawCode = "";
        w.error = "";
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

function handleWithdrawCode(state: AppState, key: KeyEvent, render: () => void): void {
  const w = state.wallet;

  if (key.name === "backspace") {
    w.withdrawCode = w.withdrawCode.slice(0, -1);
    return;
  }

  // Accept digits only (handles paste too)
  for (const ch of key.raw) {
    if (w.withdrawCode.length >= 6) break;
    if (ch >= "0" && ch <= "9") {
      w.withdrawCode += ch;
    }
  }

  // Auto-submit on 6th digit
  if (w.withdrawCode.length === 6) {
    w.withdrawPhase = "sending";
    w.error = "";
    render();

    const parsed = parseFloat(w.withdrawAmount);
    const baseUnits = Math.floor(parsed * 1_000_000).toString();

    withdrawConfirm(state.auth.token, w.withdrawAddress, baseUnits, w.withdrawCode).then((res) => {
      if (res.error) {
        w.withdrawPhase = "code-input";
        w.withdrawCode = "";
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
    syncRealBalance(state);
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
      syncRealBalance(state);
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
  state.wallet.withdrawCode = "";
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

function openUrl(url: string): void {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

function openTxOnBasescan(txHash: string): void {
  openUrl(`https://basescan.org/tx/${txHash}`);
}
