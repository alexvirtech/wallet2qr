"use client";

import { signIn } from "next-auth/react";

export const providers = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Apple",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-700 dark:text-gray-200">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    ),
  },
  {
    id: "github",
    label: "GitHub",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-700 dark:text-gray-200">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.02-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.02 1.6 1.02 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
      </svg>
    ),
  },
  {
    id: "microsoft-entra-id",
    label: "Microsoft",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/>
        <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/>
        <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/>
        <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/>
      </svg>
    ),
  },
] as const;

interface SignInButtonsProps {
  callbackUrl?: string;
  onBeforeSignIn?: () => void;
  compact?: boolean;
  activeProviderId?: string | null;
}

export default function SignInButtons({ callbackUrl, onBeforeSignIn, compact, activeProviderId }: SignInButtonsProps) {
  const visible = providers.filter((p) => p.id !== "apple");

  const handleSignIn = (providerId: string) => {
    onBeforeSignIn?.();
    signIn(providerId, callbackUrl ? { callbackUrl } : undefined);
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {visible.map((p) => {
          const active = p.id === activeProviderId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSignIn(p.id)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-md border transition-colors cursor-pointer ${
                active
                  ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-400/50"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              } text-gray-700 dark:text-gray-200`}
              title={`Sign in with ${p.label}`}
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {visible.map((p) => {
        const active = p.id === activeProviderId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSignIn(p.id)}
            className={`flex items-center justify-center gap-1.5 text-sm font-bold py-2 px-2 rounded-lg border transition-all cursor-pointer ${
              active
                ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-400/50 shadow-sm"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-sm"
            } text-gray-700 dark:text-gray-200`}
          >
            {p.icon}
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function providerDisplayName(providerId: string): string {
  return providers.find((p) => p.id === providerId)?.label ?? providerId;
}
