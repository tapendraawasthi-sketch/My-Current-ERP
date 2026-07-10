import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Globe, ListTodo, ScanLine, BarChart3, Send, X, Loader2 } from "lucide-react";
import { useNiosStore, type NiosShellTab } from "../../store/niosStore";
import { useStore } from "../../store/useStore";
import { niosChat, resolveNiosUrl } from "../../nios/client/niosClient";
import { getNiosSessionScope } from "../../nios/session";

const TABS: { id: NiosShellTab; label: string; icon: React.ReactNode }[] = [
  { id: "chat", label: "Chat", icon: <Bot size={14} /> },
  { id: "state", label: "State", icon: <Globe size={14} /> },
  { id: "tasks", label: "Tasks", icon: <ListTodo size={14} /> },
  { id: "ocr", label: "OCR", icon: <ScanLine size={14} /> },
  { id: "bench", label: "Bench", icon: <BarChart3 size={14} /> },
];

export const NiosShell: React.FC = () => {
  const {
    isOpen,
    activeTab,
    messages,
    loading,
    worldStateSummary,
    tasks,
    benchmarkResult,
    ocrDraft,
    togglePanel,
    setTab,
    addMessage,
    setLoading,
    setWorldStateSummary,
    setTasks,
    setBenchmarkResult,
    setOcrDraft,
  } = useNiosStore();

  const balance = useStore((s) => (s as { balance?: Record<string, number> }).balance);
  const [input, setInput] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [qualityGates, setQualityGates] = useState<Record<string, unknown> | null>(null);
  const [archScore, setArchScore] = useState<Record<string, unknown> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const refreshState = useCallback(async () => {
    const scope = getNiosSessionScope();
    const res = await fetch(`${resolveNiosUrl()}/world-state/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "general", balance, ...scope }),
    });
    if (res.ok) {
      const data = await res.json();
      setWorldStateSummary(data.summary as Record<string, unknown>);
    }
  }, [balance, setWorldStateSummary]);

  const refreshTasks = useCallback(async () => {
    const res = await fetch(`${resolveNiosUrl()}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setTasks((data.tasks as Array<{ id: string; title: string; status: string }>) || []);
    }
  }, [setTasks]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "state") refreshState();
    if (activeTab === "tasks") refreshTasks();
  }, [isOpen, activeTab, refreshState, refreshTasks]);

  const sendChat = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addMessage({ id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date() });
    setLoading(true);
    try {
      const result = await niosChat({ message: text, balance: balance || undefined });
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        intent: result.intent,
        confidence: result.confidence,
        engine: result.engine,
        timestamp: new Date(),
      });
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "request failed"}`,
        timestamp: new Date(),
      });
    } finally {
      setLoading(false);
    }
  };

  const runOcr = async () => {
    if (!ocrText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${resolveNiosUrl()}/ocr/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrText }),
      });
      const data = await res.json();
      setOcrDraft(data);
    } finally {
      setLoading(false);
    }
  };

  const runOcrImage = async (file: File) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${resolveNiosUrl()}/ocr/invoice/image`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setOcrDraft(data);
      if (data.ok && data.fields) {
        setOcrText((prev) => prev || `Invoice ${data.fields.invoice_number || ""} — Rs.${data.fields.grand_total || ""}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const runBenchmark = async () => {
    setLoading(true);
    try {
      const [benchRes, gateRes, archRes] = await Promise.all([
        fetch(`${resolveNiosUrl()}/benchmarks/nightly/run`, { method: "POST" }),
        fetch(`${resolveNiosUrl()}/quality-gates`),
        fetch(`${resolveNiosUrl()}/architecture/score`),
      ]);
      const data = await benchRes.json();
      setBenchmarkResult(data);
      if (gateRes.ok) {
        setQualityGates(await gateRes.json());
      }
      if (archRes.ok) {
        setArchScore(await archRes.json());
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[420px] max-h-[70vh] bg-white border border-gray-300 rounded-md shadow-lg flex flex-col z-[9998]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-[#1e2433] text-white rounded-t-md">
        <div>
          <h2 className="text-[13px] font-semibold">NIOS Intelligence</h2>
          <p className="text-[10px] text-gray-300">Nepal Intelligence Operating System</p>
        </div>
        <button onClick={togglePanel} className="p-1 hover:bg-[#273148] rounded" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="flex border-b border-gray-200 bg-[#f5f6fa]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium ${
              activeTab === t.id
                ? "text-[#1557b0] border-b-2 border-[#1557b0] bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-[280px]">
        {activeTab === "chat" && (
          <div className="space-y-2">
            {messages.length === 0 && (
              <p className="text-[11px] text-gray-500">Ask about balances, tax, simulations, or ERP navigation.</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`text-[12px] px-2.5 py-2 rounded-md ${
                  m.role === "user" ? "bg-[#eef2ff] text-gray-800 ml-6" : "bg-gray-50 text-gray-700 mr-6"
                }`}
              >
                {m.content}
                {m.engine && (
                  <div className="text-[10px] text-gray-400 mt-1">{m.engine} · {m.intent}</div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {activeTab === "state" && (
          <div className="space-y-2 text-[12px] text-gray-700">
            <button onClick={refreshState} className="h-7 px-2.5 text-[11px] border border-gray-300 rounded-md hover:bg-gray-50">
              Refresh
            </button>
            {worldStateSummary ? (
              <pre className="text-[11px] bg-gray-50 p-2 rounded-md overflow-x-auto">
                {JSON.stringify(worldStateSummary, null, 2)}
              </pre>
            ) : (
              <p className="text-[11px] text-gray-500">No world state loaded.</p>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-2">
            <button
              onClick={async () => {
                await fetch(`${resolveNiosUrl()}/tasks/monitor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                refreshTasks();
              }}
              className="h-7 px-2.5 text-[11px] bg-[#1557b0] text-white rounded-md hover:bg-[#0f4a96]"
            >
              Run monitors
            </button>
            {tasks.map((t) => (
              <div key={t.id} className="text-[12px] px-2 py-1.5 border border-gray-200 rounded-md">
                <div className="font-medium text-gray-800">{t.title}</div>
                <div className="text-[10px] text-gray-500 uppercase">{t.status}</div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-[11px] text-gray-500">No autonomous tasks.</p>}
          </div>
        )}

        {activeTab === "ocr" && (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-gray-600">Upload invoice photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) runOcrImage(file);
              }}
              className="w-full text-[11px] border border-gray-300 rounded-md p-1.5 bg-white"
            />
            <label className="block text-[11px] font-medium text-gray-600 mt-2">Or paste OCR text</label>
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              placeholder="Paste invoice OCR text…"
              className="w-full h-24 px-2.5 py-2 text-[12px] border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
            <button onClick={runOcr} disabled={loading} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">
              Extract draft invoice
            </button>
            {ocrDraft && (
              <pre className="text-[10px] bg-gray-50 p-2 rounded-md overflow-x-auto max-h-40">
                {JSON.stringify(ocrDraft.draft || ocrDraft, null, 2)}
              </pre>
            )}
          </div>
        )}

        {activeTab === "bench" && (
          <div className="space-y-2">
            <button onClick={runBenchmark} disabled={loading} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">
              Run nightly suites
            </button>
            {benchmarkResult && (
              <div className="text-[12px] space-y-2">
                <div className={`px-2 py-1 rounded-md ${benchmarkResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {benchmarkResult.ok ? "All passed" : "Failures detected"} — {String(benchmarkResult.total_passed)}/{String((benchmarkResult.total_passed as number) + (benchmarkResult.total_failed as number))}
                </div>
                {qualityGates && (
                  <div className="border border-gray-200 rounded-md p-2 space-y-1">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">Quality Gates</div>
                    {(qualityGates.gates as Array<{ name: string; value: number; target: number; passed: boolean }> || []).map((g) => (
                      <div key={g.name} className={`text-[11px] flex justify-between ${g.passed ? "text-green-700" : "text-red-700"}`}>
                        <span>{g.name}</span>
                        <span>{g.value} / {g.target}</span>
                      </div>
                    ))}
                    <div className="text-[10px] text-gray-500">
                      Provenance {String(qualityGates.provenance_coverage)} · Contract {String(qualityGates.contract_adoption_pct)}%
                      {qualityGates.p95_latency_ms != null && ` · P95 ${String(qualityGates.p95_latency_ms)}ms`}
                    </div>
                  </div>
                )}
                {archScore && (
                  <div className={`border rounded-md p-2 ${archScore.passed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">Architecture Score</div>
                    <div className="text-[13px] font-semibold text-gray-800">
                      {String(archScore.overall)} / {String(archScore.target)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {archScore.passed ? "Meets 9.95+ threshold" : "Below pass threshold"}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === "chat" && (
        <div className="p-2 border-t border-gray-200 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Message NIOS…"
            className="flex-1 h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
          <button onClick={sendChat} disabled={loading} className="h-8 w-8 flex items-center justify-center bg-[#1557b0] hover:bg-[#0f4a96] text-white rounded-md">
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
