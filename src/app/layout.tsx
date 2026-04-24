import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { SessionProvider } from "@/lib/state/session";
import { SettingsProvider } from "@/lib/wallet/settings";

export const metadata: Metadata = {
  title: "wallet2qr — Your crypto wallet, sealed in a QR code",
  description:
    "Convert a BIP-39 mnemonic phrase into an encrypted QR code and back. Lightweight multi-chain crypto wallet.",
  openGraph: {
    title: "wallet2qr",
    description: "Your crypto wallet, sealed in a QR code.",
    url: "https://wallet2qr.com",
    siteName: "wallet2qr",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <SettingsProvider>
            <div className="min-h-screen flex flex-col">
              <Nav />
              <main className="flex-1">{children}</main>
              <footer className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                &copy; {new Date().getFullYear()} wallet2qr. All rights reserved.
              </footer>
            </div>
          </SettingsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
