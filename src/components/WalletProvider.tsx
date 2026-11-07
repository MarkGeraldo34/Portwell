"use client";

import "@near-wallet-selector/modal-ui/styles.css";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { actionCreators } from "@near-js/transactions";
import { CONTRACT_ID, CONTRACT_CONFIGURED, NETWORK } from "@/lib/config";

const GAS = 100_000_000_000_000n; // 100 Tgas

interface WalletCtx {
  accountId: string | null;
  ready: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  /** Sign and send one function call to the escrow contract. */
  call: (method: string, args?: object, depositYocto?: bigint) => Promise<void>;
}

const Ctx = createContext<WalletCtx | null>(null);

export function useWallet(): WalletCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | undefined;
    (async () => {
      const s = await setupWalletSelector({ network: NETWORK, modules: [setupMeteorWallet(), setupMyNearWallet()] });
      setSelector(s);
      setModal(setupModal(s, { contractId: CONTRACT_CONFIGURED ? CONTRACT_ID : `unset.${NETWORK === "mainnet" ? "near" : "testnet"}` }));
      const sync = () => setAccountId(s.store.getState().accounts.find((a) => a.active)?.accountId ?? null);
      sync();
      sub = s.store.observable.subscribe(sync);
    })().catch(console.error);
    return () => sub?.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (!selector) return;
    const wallet = await selector.wallet();
    await wallet.signOut();
  }, [selector]);

  const call = useCallback(
    async (method: string, args: object = {}, deposit = 0n) => {
      if (!selector) throw new Error("Wallet not ready");
      if (!CONTRACT_CONFIGURED) throw new Error("Payments are disabled: no contract is configured yet");
      const wallet = await selector.wallet();
      await wallet.signAndSendTransaction({
        receiverId: CONTRACT_ID,
        actions: [actionCreators.functionCall(method, args, GAS, deposit)],
      });
    },
    [selector],
  );

  return (
    <Ctx.Provider value={{ accountId, ready: !!selector, signIn: () => modal?.show(), signOut, call }}>
      {children}
    </Ctx.Provider>
  );
}
