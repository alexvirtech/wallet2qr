import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { secp256k1 } from "@noble/curves/secp256k1";
import { getDataSourceSetting } from "./settings";

const MEMPOOL_API = "https://mempool.space/api";

interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
}

interface FeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  minimumFee: number;
}

export type FeeSpeed = "fast" | "medium" | "slow";

export async function fetchFeeRates(): Promise<FeeRates> {
  const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
  if (!res.ok) throw new Error("Failed to fetch fee rates");
  return res.json();
}

export function getFeeRate(rates: FeeRates, speed: FeeSpeed): number {
  switch (speed) {
    case "fast":
      return rates.fastestFee;
    case "medium":
      return rates.halfHourFee;
    case "slow":
      return rates.hourFee;
  }
}

async function fetchUtxos(address: string): Promise<Utxo[]> {
  const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
  if (!res.ok) throw new Error("Failed to fetch UTXOs");
  return res.json();
}

function estimateTxSize(inputCount: number, outputCount: number): number {
  // P2WPKH: ~10.5 vbytes overhead + 68 vbytes per input + 31 vbytes per output
  return Math.ceil(10.5 + inputCount * 68 + outputCount * 31);
}

export function estimateFee(
  utxoCount: number,
  feeRate: number,
  hasChange: boolean
): number {
  const outputs = hasChange ? 2 : 1;
  return estimateTxSize(utxoCount, outputs) * feeRate;
}

export interface BtcTxPlan {
  inputs: Utxo[];
  sendAmount: number;
  fee: number;
  change: number;
  feeRate: number;
}

export function planTransaction(
  utxos: Utxo[],
  amountSats: number,
  feeRate: number
): BtcTxPlan {
  const sorted = [...utxos]
    .filter((u) => u.status.confirmed)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) throw new Error("No confirmed UTXOs available");

  const selected: Utxo[] = [];
  let total = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.value;

    const feeNoChange = estimateFee(selected.length, feeRate, false);
    const feeWithChange = estimateFee(selected.length, feeRate, true);

    if (total >= amountSats + feeWithChange) {
      const change = total - amountSats - feeWithChange;
      // Dust threshold: 546 sats for P2WPKH
      if (change < 546) {
        return {
          inputs: selected,
          sendAmount: amountSats,
          fee: total - amountSats,
          change: 0,
          feeRate,
        };
      }
      return {
        inputs: selected,
        sendAmount: amountSats,
        fee: feeWithChange,
        change,
        feeRate,
      };
    }

    if (total >= amountSats + feeNoChange && total < amountSats + feeWithChange) {
      return {
        inputs: selected,
        sendAmount: amountSats,
        fee: total - amountSats,
        change: 0,
        feeRate,
      };
    }
  }

  throw new Error(
    `Insufficient funds: have ${total} sats, need ${amountSats + estimateFee(sorted.length, feeRate, false)} sats`
  );
}

export async function buildAndSignTx(
  privateKeyHex: string,
  senderAddress: string,
  recipientAddress: string,
  plan: BtcTxPlan
): Promise<string> {
  const privKey = hex.decode(privateKeyHex);
  const pubKey = secp256k1.getPublicKey(privKey, true);
  const payment = btc.p2wpkh(pubKey);

  const tx = new btc.Transaction();

  for (const utxo of plan.inputs) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: payment.script,
        amount: BigInt(utxo.value),
      },
    });
  }

  tx.addOutputAddress(recipientAddress, BigInt(plan.sendAmount));

  if (plan.change > 0) {
    tx.addOutputAddress(senderAddress, BigInt(plan.change));
  }

  tx.sign(privKey);
  tx.finalize();

  return hex.encode(tx.extract());
}

export async function broadcastTx(rawHex: string): Promise<string> {
  if (getDataSourceSetting() !== "direct") {
    try {
      const res = await fetch("/api/ew/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: "bitcoin", tx: rawHex }),
      });
      if (res.ok) return res.text();
    } catch {}
  }

  const res = await fetch(`${MEMPOOL_API}/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: rawHex,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Broadcast failed: ${text}`);
  }
  return res.text();
}

export async function prepareBtcSend(
  senderAddress: string,
  amountSats: number,
  feeRate: number
): Promise<BtcTxPlan> {
  const utxos = await fetchUtxos(senderAddress);
  return planTransaction(utxos, amountSats, feeRate);
}

export async function sendBtc(
  privateKeyHex: string,
  senderAddress: string,
  recipientAddress: string,
  amountSats: number,
  feeRate: number
): Promise<string> {
  const utxos = await fetchUtxos(senderAddress);
  const plan = planTransaction(utxos, amountSats, feeRate);
  const rawTx = await buildAndSignTx(
    privateKeyHex,
    senderAddress,
    recipientAddress,
    plan
  );
  return broadcastTx(rawTx);
}
