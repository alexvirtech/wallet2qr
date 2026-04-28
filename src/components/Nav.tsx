"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession as useAuthSession, signOut } from "next-auth/react";
import { useSession } from "@/lib/state/session";
import { providerDisplayName } from "@/components/SignInButtons";

const links = [
  { href: "/wallet-to-qr", label: "Wallet → QR" },
  { href: "/qr-to-wallet", label: "QR → Wallet" },
];

export default function Nav() {
  const pathname = usePathname();
  const { isUnlocked, readOnly, lock } = useSession();
  const { data: authSession, status: authStatus } = useAuthSession();
  const [open, setOpen] = useState(false);

  const isSignedIn = authStatus === "authenticated";

  const linkClass = (href: string) =>
    `block py-2 sm:py-0 hover:text-m-blue-light-4 transition-colors ${
      pathname.startsWith(href) ? "text-m-blue-light-4 font-bold" : ""
    }`;

  const exactClass = (href: string) =>
    `block py-2 sm:py-0 hover:text-m-blue-light-4 transition-colors ${
      pathname === href ? "text-m-blue-light-4 font-bold" : ""
    }`;

  const authBadge = isSignedIn ? (
    <span className="text-[10px] text-gray-300 truncate max-w-[140px]" title={authSession?.user?.email ?? ""}>
      {authSession?.user?.email?.split("@")[0]}
      <span className="text-gray-500 ml-0.5">
        via {providerDisplayName((authSession as any)?.provider ?? "")}
      </span>
    </span>
  ) : null;

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
          {isSignedIn ? (
            <div className="flex items-center gap-2 ml-1 border-l border-white/20 pl-3">
              {authBadge}
              <button
                onClick={() => signOut()}
                className="text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                Sign&nbsp;out
              </button>
            </div>
          ) : (
            <Link href="/wallet-to-qr" className="text-[10px] text-gray-400 hover:text-white ml-1 border-l border-white/20 pl-3">
              Sign&nbsp;in
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-3 sm:hidden">
          {isSignedIn && (
            <span className="text-[9px] text-gray-400 truncate max-w-[100px]">
              {authSession?.user?.email?.split("@")[0]}
            </span>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="flex flex-col justify-center gap-1.5 w-7 h-7"
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
          {isSignedIn ? (
            <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-2">
              <span className="text-[10px] text-gray-300">
                {authSession?.user?.email}
                {(authSession as any)?.provider && (
                  <span className="text-gray-500 ml-1">via {providerDisplayName((authSession as any).provider)}</span>
                )}
              </span>
              <button
                onClick={() => { setOpen(false); signOut(); }}
                className="text-[10px] text-gray-400 hover:text-white"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/wallet-to-qr"
              onClick={() => setOpen(false)}
              className="block pt-2 border-t border-white/10 mt-2 text-[10px] text-gray-400 hover:text-white"
            >
              Sign in with Google, Apple, GitHub, or Microsoft
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
