import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
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
          <header>
            <Link href="/" aria-label="PORTWELL home" style={{ display: "inline-flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="PORTWELL" width={40} height={40} />
            </Link>
            <nav className="row">
              <Link href="/subscriptions">My subscriptions</Link>
              <ConnectButton />
            </nav>
          </header>
          <main>
            <p className="banner">
              Peer-shared education, not financial advice. Sharers are independent peers. Returns are never
              guaranteed. Payments are held in NEAR escrow and released weekly.
            </p>
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
