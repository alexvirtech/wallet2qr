"use client";

import { providers } from "@/components/SignInButtons";

const visible = providers.filter((p) => p.id !== "apple");

interface ProviderSelectorProps {
  selectedId: string | null;
  onToggle: (id: string) => void;
  sessionProviderId?: string;
  hintProviderId?: string;
}

export default function ProviderSelector({
  selectedId,
  onToggle,
  sessionProviderId,
  hintProviderId,
}: ProviderSelectorProps) {
  return (
    <div className="flex gap-2">
      {visible.map((p) => {
        const isSelected = p.id === selectedId;
        const isSignedIn = p.id === sessionProviderId;
        const isHint = p.id === hintProviderId;

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`flex items-center gap-1.5 text-sm font-bold py-2 px-3 rounded-lg border-2 transition-all cursor-pointer ${
              isSelected
                ? isSignedIn
                  ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-400/40"
                  : "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-400/40"
                : isHint
                  ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            } text-gray-700 dark:text-gray-200`}
          >
            {p.icon}
            <span>{p.label}</span>
            {isSelected && isSignedIn && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400 ml-0.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
