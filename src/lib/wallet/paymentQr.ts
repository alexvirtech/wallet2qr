export interface PaymentRequest {
  type: "wallet2qr_payment_request";
  version: "1.0";
  recipient: {
    label?: string;
    addresses: { networkId: string; address: string }[];
  };
  payment: {
    amount?: string;
    currency?: string;
    preferredAssets?: string[];
    preferredNetworkId?: string;
    expiresAt?: string;
    memo?: string;
  };
  routing: {
    allowAutoRouting: boolean;
    allowSwap: boolean;
    allowBridge: boolean;
  };
}

export function buildPaymentRequest(opts: {
  addresses: { networkId: string; address: string }[];
  label?: string;
  amount?: string;
  currency?: string;
  preferredAssets?: string[];
  preferredNetworkId?: string;
  memo?: string;
}): PaymentRequest {
  return {
    type: "wallet2qr_payment_request",
    version: "1.0",
    recipient: {
      label: opts.label,
      addresses: opts.addresses,
    },
    payment: {
      amount: opts.amount,
      currency: opts.currency || "USD",
      preferredAssets: opts.preferredAssets || ["USDT", "USDC"],
      preferredNetworkId: opts.preferredNetworkId || "auto",
      memo: opts.memo,
    },
    routing: {
      allowAutoRouting: true,
      allowSwap: true,
      allowBridge: true,
    },
  };
}

export function encodePaymentQr(request: PaymentRequest): string {
  return JSON.stringify(request);
}

export function decodePaymentQr(data: string): PaymentRequest | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === "wallet2qr_payment_request") return parsed;
    return null;
  } catch {
    return null;
  }
}
