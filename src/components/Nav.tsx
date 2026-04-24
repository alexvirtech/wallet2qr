"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/state/session";

const links = [
  { href: "/wallet-to-qr", label: "Wallet → QR" },
  { href: "/qr-to-wallet", label: "QR → Wallet" },
];

export default function Nav() {
  const pathname = usePathname();
  const { isUnlocked, lock } = useSession();

  return (
    <header className="bg-m-blue-dark-2 text-white">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight">
          wallet2qr
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`hover:text-m-blue-light-4 transition-colors ${
                pathname.startsWith(l.href) ? "text-m-blue-light-4 font-bold" : ""
              }`}
            >
              {l.label}
            </Link>
          ))}
          {isUnlocked && (
            <>
              <Link
                href="/wallet"
                className={`hover:text-m-blue-light-4 transition-colors ${
                  pathname === "/wallet" ? "text-m-blue-light-4 font-bold" : ""
                }`}
              >
                Wallet
              </Link>
              <Link
                href="/wallet/settings"
                className={`hover:text-m-blue-light-4 transition-colors ${
                  pathname === "/wallet/settings"
                    ? "text-m-blue-light-4 font-bold"
                    : ""
                }`}
              >
                Settings
              </Link>
              <button
                onClick={lock}
                className="ml-2 bg-m-red hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded"
              >
                Lock
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
