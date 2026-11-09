import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Rubik } from "next/font/google";

const rubik = Rubik({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-rubik" });
import { WalletProvider } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { CoolModeEverywhere } from "@/components/CoolMode";
import { WarpBackground } from "@/components/WarpBackground";
import { CONTRACT_CONFIGURED } from "@/lib/config";

export const metadata: Metadata = {
  title: "PORTWELL",
  description: "Learn ways to earn crypto from peers who have done it, paid monthly through NEAR escrow.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={rubik.variable}>
      <body>
        <WalletProvider>
          <CoolModeEverywhere />
          <WarpBackground fixed />
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
              <Link href="/share" className="icon-btn" aria-label="Share a post" title="Share a post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
                  <path d="M12 13.5V8" />
                  <path d="M9.4 10.4L12 7.8l2.6 2.6" />
                </svg>
              </Link>
              <Link href="/subscriptions" className="icon-btn" aria-label="My subscriptions" title="My subscriptions">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M3 10h18" />
                  <path d="M7 15h4" />
                </svg>
              </Link>
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
