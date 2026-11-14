import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Rubik } from "next/font/google";

const rubik = Rubik({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-rubik" });
import { WalletProvider } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { CoolModeEverywhere } from "@/components/CoolMode";
import { WarpBackground } from "@/components/WarpBackground";
import { SideNav } from "@/components/SideNav";
import { SubscriptionsIcon } from "@/components/SubscriptionsIcon";
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
              <SubscriptionsIcon />
              <ConnectButton />
            </nav>
          </header>
          <div className="shell">
            <SideNav />
            <main>
            {!CONTRACT_CONFIGURED && (
              <p className="banner" role="alert">
                Demo mode: no escrow contract is configured, so subscriptions and payments are disabled.
              </p>
            )}
            {children}
            </main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
