"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/state/session";

const links = [
  { href: "/wallet-to-qr", label: "Wallet → QR" },
  { href: "/qr-to-wallet", label: "QR → Wallet" },
];

export default function Nav() {
  const pathname = usePathname();
  const { isUnlocked, readOnly, lock } = useSession();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) =>
    `block py-2 sm:py-0 hover:text-m-blue-light-4 transition-colors ${
      pathname.startsWith(href) ? "text-m-blue-light-4 font-bold" : ""
    }`;

  const exactClass = (href: string) =>
    `block py-2 sm:py-0 hover:text-m-blue-light-4 transition-colors ${
      pathname === href ? "text-m-blue-light-4 font-bold" : ""
    }`;

  return (
    <header className="bg-m-blue-dark-2 text-white">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Image src="/logo.svg" alt="" width={28} height={28} className="flex-shrink-0" />
          wallet2qr
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          {!isUnlocked &&
            links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
          {isUnlocked && (
            <>
              <Link href="/wallet" className={exactClass("/wallet")}>
                Wallet
              </Link>
              <Link
                href="/wallet/settings"
                className={exactClass("/wallet/settings")}
              >
                Settings
              </Link>
              {readOnly && (
                <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded font-bold">
                  READ-ONLY
                </span>
              )}
              <button
                onClick={lock}
                className="ml-2 bg-m-red hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded"
              >
                Lock
              </button>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="sm:hidden flex flex-col justify-center gap-1.5 w-7 h-7"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-full bg-white transition-transform ${
              open ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-full bg-white transition-opacity ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-full bg-white transition-transform ${
              open ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="sm:hidden border-t border-white/10 px-4 pb-4 text-sm space-y-1">
          {!isUnlocked &&
            links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={linkClass(l.href)}
              >
                {l.label}
              </Link>
            ))}
          {isUnlocked && (
            <>
              <Link
                href="/wallet"
                onClick={() => setOpen(false)}
                className={exactClass("/wallet")}
              >
                Wallet
              </Link>
              <Link
                href="/wallet/settings"
                onClick={() => setOpen(false)}
                className={exactClass("/wallet/settings")}
              >
                Settings
              </Link>
              {readOnly && (
                <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded font-bold inline-block mt-1">
                  READ-ONLY
                </span>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  lock();
                }}
                className="mt-2 bg-m-red hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded"
              >
                Lock
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
