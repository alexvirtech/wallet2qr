"use client"

import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus"

export default function OfflineModeBanner() {
  const online = useOnlineStatus()

  return (
    <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
      online
        ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
        : "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
    }`}>
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
        online ? "bg-blue-400" : "bg-green-500 animate-pulse"
      }`} />
      {online ? (
        <span>
          <strong>Online</strong> — after identity verification, you may disconnect before entering sensitive data.
        </span>
      ) : (
        <span>
          <strong>Offline</strong> — sensitive data is processed locally. No outgoing network requests.
        </span>
      )}
    </div>
  )
}
