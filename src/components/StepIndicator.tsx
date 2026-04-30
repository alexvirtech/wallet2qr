"use client"

import React from "react"

export type StepStatus = "pending" | "active" | "complete" | "failed"

export interface Step {
  label: string
  status: StepStatus
}

const statusIcon: Record<StepStatus, React.JSX.Element> = {
  pending: (
    <span className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
  ),
  active: (
    <span className="w-5 h-5 rounded-full border-2 border-blue-400 bg-blue-400/20 flex items-center justify-center flex-shrink-0">
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
    </span>
  ),
  complete: (
    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  ),
  failed: (
    <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  ),
}

const statusColor: Record<StepStatus, string> = {
  pending: "text-gray-400 dark:text-gray-500",
  active: "text-blue-600 dark:text-blue-400 font-bold",
  complete: "text-green-700 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
}

export default function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          {statusIcon[s.status]}
          <span className={`text-xs leading-tight ${statusColor[s.status]}`}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}
