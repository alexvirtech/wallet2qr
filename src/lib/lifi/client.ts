import { createConfig, type SDKConfig } from "@lifi/sdk";

const INTEGRATOR = process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "wallet2qr";
const FEE_BPS = parseInt(process.env.NEXT_PUBLIC_LIFI_FEE_BPS || "50", 10);

export const LIFI_FEE = FEE_BPS / 10000; // 0.005 = 0.5%

export function initLifi(): SDKConfig {
  return createConfig({
    integrator: INTEGRATOR,
  });
}

export { INTEGRATOR };
