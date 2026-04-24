import {
  getQuote,
  convertQuoteToRoute,
  type QuoteRequest,
  type LiFiStep,
  type Route,
} from "@lifi/sdk";
import { INTEGRATOR } from "./client";

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
  };

  const step = await getQuote(request);
  const route = convertQuoteToRoute(step);
  return { step, route };
}
