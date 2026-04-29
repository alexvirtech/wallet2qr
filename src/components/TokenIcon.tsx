"use client";

import { useState } from "react";
import { getTokenIconUrl } from "@/lib/wallet/tokenIcons";
import { getCachedIcon } from "@/lib/wallet/prices";
import type { AssetCategory } from "@/lib/wallet/assets";

const AVATAR_COLORS: Record<AssetCategory, string> = {
  gas: "bg-orange-500",
  stablecoin: "bg-green-500",
  defi: "bg-purple-500",
  ecosystem: "bg-blue-500",
};

interface TokenIconProps {
  symbol: string;
  category: AssetCategory;
  networkKey: string;
  tokenAddress: string;
  size?: number;
  className?: string;
}

export default function TokenIcon({
  symbol,
  category,
  networkKey,
  tokenAddress,
  size = 36,
  className = "",
}: TokenIconProps) {
  const [failed, setFailed] = useState(false);
  const cachedIcon = getCachedIcon(networkKey, tokenAddress);
  const url = cachedIcon || getTokenIconUrl(networkKey, symbol, tokenAddress);

  if (failed || !url) {
    return (
      <div
        className={`rounded-full ${AVATAR_COLORS[category]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {symbol[0]}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
