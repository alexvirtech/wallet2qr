"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import SignInButtons, { providerDisplayName } from "@/components/SignInButtons";
import { encrypt, decrypt, encryptV2, decryptV2 } from "@/lib/compat/crypto";
import { buildQrUrl, buildQrUrlV2, parseEnvelope, decryptPayload, decryptPayloadV2 } from "@/lib/compat/qrPayload";
import { fetchPepper } from "@/lib/compat/fetchPepper";
import type { PepperResponse } from "@/lib/compat/fetchPepper";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PASSWORD = "TestPass1!";

type LogEntry = { time: string; label: string; value: string; ok: boolean };

function log(entries: LogEntry[], label: string, value: string, ok: boolean): LogEntry[] {
  return [...entries, { time: new Date().toLocaleTimeString(), label, value, ok }];
}

export default function TestPepperPage() {
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);

  function addLog(label: string, value: string, ok: boolean) {
    setLogs((prev) => log(prev, label, value, ok));
  }

  async function runV1Test() {
    setLogs([]);
    addLog("Test", "v1 round-trip (no account binding)", true);

    const url = buildQrUrl(TEST_MNEMONIC, TEST_PASSWORD);
    addLog("buildQrUrl", url.slice(0, 80) + "...", true);

    const env = parseEnvelope(url);
    addLog("parseEnvelope", `v=${env.v}, ds length=${env.ds.length}`, env.v === 1);

    const result = decryptPayload(env.ds, TEST_PASSWORD);
    const match = result === TEST_MNEMONIC;
    addLog("decryptPayload", match ? "PASS — mnemonic matches" : `FAIL — got: ${result}`, match);

    const wrongPw = decryptPayload(env.ds, "wrongPassword");
    addLog("decrypt wrong password", wrongPw === null ? "PASS — returned null" : "FAIL — should be null", wrongPw === null);

    addLog("v1 result", match ? "ALL PASSED" : "FAILED", match);
  }

  async function runV2Test() {
    setLogs([]);
    setRunning(true);

    addLog("Test", "v2 round-trip (account-bound)", true);
    addLog("Auth status", status, status === "authenticated");

    if (status !== "authenticated") {
      addLog("SKIP", "Not signed in — sign in first, then re-run", false);
      setRunning(false);
      return;
    }

    addLog("Session", `email=${session?.user?.email}, provider=${(session as any)?.provider ?? "??"}, sub=${(session as any)?.sub ? "present" : "missing"}`, true);

    let pepperData: PepperResponse;
    try {
      pepperData = await fetchPepper();
      addLog("fetchPepper", `provider=${pepperData.provider}, sub_hash=${pepperData.sub_hash}, pepper=${pepperData.pepper.slice(0, 8)}...`, true);
    } catch (err: any) {
      addLog("fetchPepper", `FAIL — ${err.message}`, false);
      setRunning(false);
      return;
    }

    const url = buildQrUrlV2(TEST_MNEMONIC, TEST_PASSWORD, pepperData.pepper, pepperData.provider, pepperData.sub_hash);
    addLog("buildQrUrlV2", url.slice(0, 80) + "...", true);

    const env = parseEnvelope(url);
    const isV2 = env.v === 2;
    addLog("parseEnvelope", `v=${env.v}, pep=${isV2 ? (env as any).pep : "n/a"}, sh=${isV2 ? (env as any).sh?.slice(0, 8) + "..." : "n/a"}`, isV2);

    const result = decryptPayloadV2(env.ds, TEST_PASSWORD, pepperData.pepper);
    const match = result === TEST_MNEMONIC;
    addLog("decryptPayloadV2 (correct pepper)", match ? "PASS — mnemonic matches" : `FAIL — got: ${result}`, match);

    const wrongPepper = decryptPayloadV2(env.ds, TEST_PASSWORD, "wrongPepperValue");
    addLog("decryptPayloadV2 (wrong pepper)", wrongPepper === null ? "PASS — returned null" : "FAIL — should be null", wrongPepper === null);

    const wrongPw = decryptPayloadV2(env.ds, "wrongPassword", pepperData.pepper);
    addLog("decryptPayloadV2 (wrong password)", wrongPw === null ? "PASS — returned null" : "FAIL — should be null", wrongPw === null);

    const v1attempt = decryptPayload(env.ds, TEST_PASSWORD);
    addLog("v1 decrypt on v2 ciphertext", v1attempt === null ? "PASS — returned null (can't decrypt without pepper)" : "FAIL — should be null", v1attempt === null);

    const allPassed = match && wrongPepper === null && wrongPw === null && v1attempt === null;
    addLog("v2 result", allPassed ? "ALL PASSED" : "SOME FAILED", allPassed);
    setRunning(false);
  }

  async function runPepperDeterminismTest() {
    setLogs([]);
    setRunning(true);

    addLog("Test", "Pepper determinism (same account → same pepper)", true);

    if (status !== "authenticated") {
      addLog("SKIP", "Not signed in", false);
      setRunning(false);
      return;
    }

    try {
      const p1 = await fetchPepper();
      addLog("Pepper call 1", `${p1.pepper.slice(0, 12)}...`, true);

      const p2 = await fetchPepper();
      addLog("Pepper call 2", `${p2.pepper.slice(0, 12)}...`, true);

      const match = p1.pepper === p2.pepper && p1.sub_hash === p2.sub_hash;
      addLog("Determinism", match ? "PASS — identical peppers" : "FAIL — peppers differ", match);
    } catch (err: any) {
      addLog("fetchPepper", `FAIL — ${err.message}`, false);
    }
    setRunning(false);
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-2">Pepper Test Page</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Interactive test for v1 (password-only) and v2 (account-bound) encrypt/decrypt flows.
      </p>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 space-y-3">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
          Auth: <span className={status === "authenticated" ? "text-green-600" : "text-red-500"}>{status}</span>
          {session?.user?.email && <span className="text-gray-500 ml-2">({session.user.email})</span>}
          {status === "authenticated" && (session as any)?.provider && (
            <span className="text-gray-400 ml-1">via {providerDisplayName((session as any).provider)}</span>
          )}
        </p>
        <div className="space-y-2">
          <SignInButtons compact activeProviderId={status === "authenticated" ? (session as any)?.provider : null} />
          {status === "authenticated" && (
            <button onClick={() => signOut()} className="bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-bold py-1 px-3 rounded">
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={runV1Test} disabled={running} className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded disabled:opacity-50">
          Test v1 (no account)
        </button>
        <button onClick={runV2Test} disabled={running} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded disabled:opacity-50">
          Test v2 (account-bound)
        </button>
        <button onClick={runPepperDeterminismTest} disabled={running} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 px-4 rounded disabled:opacity-50">
          Test pepper determinism
        </button>
        <button onClick={() => setLogs([])} className="bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-bold py-2 px-4 rounded">
          Clear
        </button>
      </div>

      <div className="text-xs text-gray-400 mb-2">
        Using test mnemonic: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{TEST_MNEMONIC.split(" ").slice(0, 4).join(" ")}...</code> / password: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{TEST_PASSWORD}</code>
      </div>

      {logs.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-3 py-1.5 text-gray-500">Time</th>
                <th className="px-3 py-1.5 text-gray-500">Step</th>
                <th className="px-3 py-1.5 text-gray-500">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => (
                <tr key={i} className={`border-t border-gray-100 dark:border-gray-800 ${entry.ok ? "" : "bg-red-50 dark:bg-red-900/20"}`}>
                  <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{entry.time}</td>
                  <td className="px-3 py-1.5 font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">{entry.label}</td>
                  <td className={`px-3 py-1.5 break-all ${entry.ok ? "text-gray-600 dark:text-gray-400" : "text-red-600 dark:text-red-400 font-bold"}`}>{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
