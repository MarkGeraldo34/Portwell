import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";

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
            <Link href="/">
              <strong>PORTWELL</strong>
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
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
