"use client"

import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus"

interface StatusRow {
  label: string
  value: string
  safe: boolean
}

export default function SecurityStatusPanel({ rows }: { rows?: StatusRow[] }) {
  const online = useOnlineStatus()

  const defaultRows: StatusRow[] = [
    { label: "Mnemonic transmission", value: "blocked — never sent", safe: true },
    { label: "Encryption / decryption", value: "local browser only", safe: true },
    { label: "Server access to mnemonic", value: "none", safe: true },
    { label: "OAuth tokens for encryption", value: "not used", safe: true },
    { label: "Provider stable ID used", value: "yes (if selected)", safe: true },
    { label: "Internet status", value: online ? "online" : "offline", safe: !online },
  ]

  const items = rows ?? defaultRows

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
          <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
        </svg>
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Security Status</span>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
            <span className="text-gray-500 dark:text-gray-400">{r.label}</span>
            <span className={`font-bold ${r.safe ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
