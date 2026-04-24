"use client";

import { networks, networkKeys, type NetworkConfig } from "@/lib/wallet/networks";

interface NetworkSwitcherProps {
  current: string;
  onChange: (key: string) => void;
}

export default function NetworkSwitcher({
  current,
  onChange,
}: NetworkSwitcherProps) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-300 cursor-pointer"
    >
      {networkKeys.map((key) => {
        const net: NetworkConfig = networks[key];
        return (
          <option key={key} value={key}>
            {net.name}
          </option>
        );
      })}
    </select>
  );
}
