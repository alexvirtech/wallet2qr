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

function estimateTxSize(inputCount: number, outputCount: number, memoLength = 0): number {
  // P2WPKH: ~10.5 vbytes overhead + 68 vbytes per input + 31 vbytes per output
  let size = Math.ceil(10.5 + inputCount * 68 + outputCount * 31);
  if (memoLength > 0) {
    // OP_RETURN output: 8 (value) + 1 (script len) + 1 (OP_RETURN) + push op + data
    size += 8 + 1 + 1 + (memoLength <= 75 ? 1 : 2) + memoLength;
  }
  return size;
}

export function estimateFee(
  utxoCount: number,
  feeRate: number,
  hasChange: boolean,
  memoLength = 0
): number {
  const outputs = hasChange ? 2 : 1;
  return estimateTxSize(utxoCount, outputs, memoLength) * feeRate;
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
  feeRate: number,
  memoLength = 0
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

    const feeNoChange = estimateFee(selected.length, feeRate, false, memoLength);
    const feeWithChange = estimateFee(selected.length, feeRate, true, memoLength);

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
    `Insufficient funds: have ${total} sats, need ${amountSats + estimateFee(sorted.length, feeRate, false, memoLength)} sats`
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

function buildOpReturnScript(memo: string): Uint8Array {
  const data = new TextEncoder().encode(memo);
  if (data.length > 80) throw new Error("OP_RETURN memo too long (max 80 bytes)");
  const parts: number[] = [0x6a]; // OP_RETURN
  if (data.length <= 75) {
    parts.push(data.length);
  } else {
    parts.push(0x4c, data.length); // OP_PUSHDATA1
  }
  const script = new Uint8Array(parts.length + data.length);
  script.set(parts);
  script.set(data, parts.length);
  return script;
}

export async function sendBtcWithMemo(
  privateKeyHex: string,
  senderAddress: string,
  recipientAddress: string,
  amountSats: number,
  feeRate: number,
  memo: string,
  onStep?: (step: string) => void
): Promise<string> {
  onStep?.("Fetching UTXOs...");
  const utxos = await fetchUtxos(senderAddress);

  onStep?.("Planning transaction...");
  const memoLength = new TextEncoder().encode(memo).length;
  const plan = planTransaction(utxos, amountSats, feeRate, memoLength);

  onStep?.("Building transaction...");
  const privKey = hex.decode(privateKeyHex);
  const pubKey = secp256k1.getPublicKey(privKey, true);
  const payment = btc.p2wpkh(pubKey);

  const tx = new btc.Transaction({ allowUnknownOutputs: true });

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
  tx.addOutput({ script: buildOpReturnScript(memo), amount: BigInt(0) });

  if (plan.change > 0) {
    tx.addOutputAddress(senderAddress, BigInt(plan.change));
  }

  onStep?.("Signing transaction...");
  tx.sign(privKey);
  tx.finalize();

  onStep?.("Broadcasting transaction...");
  const rawTx = hex.encode(tx.extract());
  const txHash = await broadcastTx(rawTx);

  onStep?.("Transaction broadcast successfully!");
  return txHash;
}
