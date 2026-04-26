"use client";

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

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-300 cursor-pointer"
    >
      {showAll && <option value="all">All Networks</option>}
      {activeKeys.map((key) => (
        <option key={key} value={key}>
          {allNetworks[key]?.name ?? key}
        </option>
      ))}
    </select>
  );
}
