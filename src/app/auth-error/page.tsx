"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration. Check the provider credentials.",
  AccessDenied: "Access was denied. You may have declined the sign-in request.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An authentication error occurred. Please try again.",
};

function ErrorContent() {
  const params = useSearchParams();
  const errorType = params.get("error") ?? "Default";
  const message = ERROR_MESSAGES[errorType] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Sign-in Failed</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Error: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{errorType}</code>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="text-sm text-blue-500 hover:text-blue-700 font-bold border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2"
          >
            Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="text-sm text-gray-500 hover:text-gray-700 font-bold border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
