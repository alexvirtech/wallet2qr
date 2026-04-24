"use client";

import { useState, useCallback } from "react";
import { useSession } from "@/lib/state/session";

interface PasswordModalProps {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PasswordModal({
  title,
  onConfirm,
  onCancel,
}: PasswordModalProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { verifyPassword } = useSession();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (verifyPassword(input)) {
        onConfirm();
      } else {
        setError("Wrong password");
        setInput("");
      }
    },
    [input, verifyPassword, onConfirm]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-m-blue-dark-2 rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="Enter your password"
            autoFocus
            className="px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 mb-2"
          />
          {error && <p className="text-m-red text-sm mb-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1.5 px-4 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
