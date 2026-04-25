import type { RoutingMode } from "./settings";

export interface RouteOption {
  networkId: string;
  networkName: string;
  asset: string;
  estimatedFee: string;
  estimatedTime: string;
  score: number;
}

const NETWORK_FEE_ESTIMATES: Record<string, { fee: string; time: string; priority: number }> = {
  arbitrum:  { fee: "~$0.01",  time: "~2s",   priority: 1 },
  solana:    { fee: "~$0.001", time: "~1s",   priority: 2 },
  bnb:       { fee: "~$0.05",  time: "~3s",   priority: 3 },
  avalanche: { fee: "~$0.03",  time: "~2s",   priority: 4 },
  ethereum:  { fee: "~$2-10",  time: "~15s",  priority: 5 },
  bitcoin:   { fee: "~$1-5",   time: "~10m",  priority: 10 },
};

export function suggestRoutes(
  activeNetworks: string[],
  _routingMode: RoutingMode,
  isSmallPayment: boolean
): RouteOption[] {
  const routes: RouteOption[] = [];

  for (const netId of activeNetworks) {
    if (netId === "bitcoin") continue;

    const est = NETWORK_FEE_ESTIMATES[netId];
    if (!est) continue;

    let score = est.priority;
    if (isSmallPayment && netId === "ethereum") score += 10;

    routes.push({
      networkId: netId,
      networkName: netId.charAt(0).toUpperCase() + netId.slice(1),
      asset: "USDT",
      estimatedFee: est.fee,
      estimatedTime: est.time,
      score,
    });
  }

  return routes.sort((a, b) => a.score - b.score);
}

export function getBestRoute(
  activeNetworks: string[],
  routingMode: RoutingMode,
  amountUsd: number
): RouteOption | null {
  const isSmall = amountUsd < 100;
  const routes = suggestRoutes(activeNetworks, routingMode, isSmall);
  return routes[0] ?? null;
}

export function getRouteSummaryText(route: RouteOption): string {
  return `Best route: ${route.asset} on ${route.networkName}. Fee ${route.estimatedFee}, ${route.estimatedTime}.`;
}
