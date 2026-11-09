import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { CoolModeEverywhere } from "@/components/CoolMode";
import { CONTRACT_CONFIGURED } from "@/lib/config";

export const metadata: Metadata = {
  title: "PORTWELL",
  description: "Learn ways to earn crypto from peers who have done it, paid monthly through NEAR escrow.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <CoolModeEverywhere />
          <header>
            <Link href="/" aria-label="PORTWELL home" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                style={{ filter: "brightness(1.35) saturate(1.25) drop-shadow(0 0 10px rgba(217,47,84,.55)) drop-shadow(0 0 18px rgba(59,120,255,.35))" }}
              />
              <strong style={{ fontSize: 22, letterSpacing: 0, textTransform: "none" }}>Portwell</strong>
            </Link>
            <nav className="row">
              <Link href="/subscriptions">My subscriptions</Link>
              <ConnectButton />
            </nav>
          </header>
          <main>
            {!CONTRACT_CONFIGURED && (
              <p className="banner" role="alert">
                Demo mode: no escrow contract is configured, so subscriptions and payments are disabled.
              </p>
            )}
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
