import {
  getQuote,
  convertQuoteToRoute,
  type QuoteRequest,
  type LiFiStep,
  type Route,
} from "@lifi/sdk";
import { INTEGRATOR } from "./client";

const FEE = parseFloat(process.env.NEXT_PUBLIC_LIFI_FEE_BPS || "0") / 10000;
const FEE_RECEIVER = process.env.NEXT_PUBLIC_LIFI_FEE_RECEIVER || "";

export async function fetchQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
}): Promise<{ step: LiFiStep; route: Route }> {
  const request: QuoteRequest = {
    fromChain: params.fromChain,
    toChain: params.toChain,
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    integrator: INTEGRATOR,
    ...(FEE > 0 && FEE_RECEIVER ? { fee: FEE, referrer: FEE_RECEIVER } : {}),
  };

  const step = await getQuote(request);
  const route = convertQuoteToRoute(step);
  return { step, route };
}
