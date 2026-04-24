import { executeRoute, type Route, type RouteExtended } from "@lifi/sdk";
import type { Hex } from "viem";
import { initLifiWithSigner, initLifiWithSolana } from "./client";

export async function executeLifiRoute(
  route: Route,
  privateKey: string,
  chainType: "evm" | "solana",
  chainId: number,
  onUpdate?: (updated: RouteExtended) => void
): Promise<RouteExtended> {
  if (chainType === "solana") {
    initLifiWithSolana(privateKey);
  } else {
    initLifiWithSigner((`0x${privateKey.replace(/^0x/, "")}`) as Hex, chainId);
  }

  return executeRoute(route, {
    updateRouteHook: (updated) => {
      onUpdate?.(updated);
    },
  });
}
