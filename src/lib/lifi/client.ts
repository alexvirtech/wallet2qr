import { createConfig, type SDKConfig } from "@lifi/sdk";

const INTEGRATOR = process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "wallet2qr";

export function initLifi(): SDKConfig {
  return createConfig({
    integrator: INTEGRATOR,
  });
}

export { INTEGRATOR };
