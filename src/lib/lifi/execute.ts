import { executeRoute, type Route, type RouteExtended } from "@lifi/sdk";

export async function executeLifiRoute(
  route: Route,
  onUpdate?: (updated: RouteExtended) => void
): Promise<RouteExtended> {
  return executeRoute(route, {
    updateRouteHook: (updated) => {
      onUpdate?.(updated);
    },
  });
}
