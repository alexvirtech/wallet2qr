"use client";

import { useState, useRef, useEffect } from "react";
import { allNetworks } from "@/lib/wallet/networks";
import { useSettings } from "@/lib/wallet/settings";

interface NetworkSwitcherProps {
  current: string;
  onChange: (key: string) => void;
  showAll?: boolean;
}

export default function NetworkSwitcher({
  current,
  onChange,
  showAll,
}: NetworkSwitcherProps) {
  const { getActiveNetworkKeys } = useSettings();
  const activeKeys = getActiveNetworkKeys();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const options: { value: string; label: string }[] = [];
  if (showAll) options.push({ value: "all", label: "All Networks" });
  for (const key of activeKeys) {
    options.push({ value: key, label: allNetworks[key]?.name ?? key });
  }

  const selected = options.find((o) => o.value === current);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-300 cursor-pointer bg-white min-w-[160px] justify-between"
      >
        <span className="truncate">{selected?.label ?? "Select"}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-full min-w-[180px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                o.value === current
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
