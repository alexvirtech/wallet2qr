"use client";

import { useState, useCallback } from "react";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";

interface MnemonicInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function MnemonicInput({
  value,
  onChange,
  disabled,
}: MnemonicInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState<12 | 24>(12);

  const handleChange = useCallback(
    (text: string) => {
      onChange(text);
      const trimmed = text.trim();
      if (!trimmed) {
        setError(null);
        return;
      }
      const result = validateBip39Mnemonic(trimmed);
      setError(result.valid ? null : result.error ?? "Invalid mnemonic");
    },
    [onChange]
  );

  const handleGenerate = useCallback(() => {
    const strength = wordCount === 24 ? 256 : 128;
    const phrase = generateMnemonic(wordlist, strength);
    onChange(phrase);
    setError(null);
  }, [wordCount, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-gray-600 dark:text-m-gray-light-1 font-bold text-sm">
          BIP-39 Mnemonic Phrase
        </label>
        <div className="flex items-center gap-2">
          <select
            value={wordCount}
            onChange={(e) => setWordCount(Number(e.target.value) as 12 | 24)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 dark:bg-gray-700 dark:text-gray-300"
            disabled={disabled}
          >
            <option value={12}>12 words</option>
            <option value={24}>24 words</option>
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled}
            className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-1 px-3 rounded disabled:opacity-50"
          >
            Generate New
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter your 12 or 24-word mnemonic phrase..."
        rows={3}
        disabled={disabled}
        className="px-2 py-1 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 font-mono text-sm disabled:opacity-50"
      />
      {error && (
        <p className="text-m-red text-xs mt-1">{error}</p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Enter an existing phrase or generate a new wallet.
      </p>
    </div>
  );
}
