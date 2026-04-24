"use client";

import { useState } from "react";
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
        <Link href="/" className="text-xl font-bold tracking-tight">
          wallet2qr
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          {links.map((l) => (
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
          {links.map((l) => (
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
