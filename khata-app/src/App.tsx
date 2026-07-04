import { useCallback, useEffect, useState } from "react";
import {
  confirmTransaction,
  fetchBalance,
  fetchInsights,
  parseTransaction,
  syncOfflineQueue,
} from "./api/khataApi";
import BalanceSummary from "./components/BalanceSummary";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import InsightBar from "./components/InsightBar";
import OnboardingFlow from "./components/OnboardingFlow";
import PremiumGate from "./components/PremiumGate";
import TrustModal from "./components/TrustModal";
import {
  canViewPartySummary,
  dismissVatMessageFor30Days,
  hasCompletedOnboarding,
  incrementTransactionCount,
  isFreeTierLimitReached,
  markUpgradeDismissedThisSession,
  setPhoneId,
  wasUpgradeDismissedThisSession,
} from "./lib/featureFlags";
import { pickVisibleInsights, type InsightItem } from "./lib/insightEngine";
import { buildEsewaLink, buildKhaltiLink } from "./lib/paymentReconcile";
import type { BalanceSummaryData, ChatMessage, KhataConfirmationCard } from "./types";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [ready, setReady] = useState(hasCompletedOnboarding());
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Namaste! Mobile Khata ma tapai lai ke record garne?",
    },
  ]);
  const [pendingCard, setPendingCard] = useState<KhataConfirmationCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showTrust, setShowTrust] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [insightsDismissed, setInsightsDismissed] = useState(false);
  const [balance, setBalance] = useState<BalanceSummaryData>({
    udhaar_out_total: 0,
    udhaar_in_total: 0,
    recent_credit_sales: [],
    recent_payments_in: [],
  });
  const [activeChip, setActiveChip] = useState<"out" | "in" | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<{ esewa: string; khalti: string } | null>(
    null,
  );

  const refreshBalance = useCallback(async () => {
    try {
      const data = await fetchBalance();
      setBalance(data);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshInsights = useCallback(async () => {
    try {
      const data = await fetchInsights();
      setInsights(pickVisibleInsights(data.insights as InsightItem[]));
    } catch {
      /* ignore */
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      await syncOfflineQueue();
      await refreshBalance();
      await refreshInsights();
    } finally {
      setSyncing(false);
    }
  }, [refreshBalance, refreshInsights]);

  useEffect(() => {
    if (!ready) return;
    refreshBalance();
    refreshInsights();
  }, [ready, refreshBalance, refreshInsights]);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      runSync();
    };
    const handleOffline = () => setOffline(true);
    const handleVisible = () => {
      if (document.visibilityState === "visible") runSync();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [runSync]);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 3500);
  };

  if (!ready) {
    return (
      <OnboardingFlow
        onComplete={(phone) => {
          setPhoneId(phone);
          setReady(true);
        }}
      />
    );
  }

  const handleSend = async (text: string) => {
    setMessages((prev) => [...prev, { id: createId(), role: "user", text }]);
    setLoading(true);
    setPendingCard(null);
    try {
      const result = await parseTransaction(text);
      if (result.clarifying_question) {
        setMessages((prev) => [
          ...prev,
          { id: createId(), role: "assistant", text: result.clarifying_question! },
        ]);
        return;
      }
      if (result.card) setPendingCard(result.card);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          text: error instanceof Error ? error.message : "Could not parse entry",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingCard) return;
    const card = pendingCard;
    if (isFreeTierLimitReached()) {
      if (!wasUpgradeDismissedThisSession()) setShowPremium(true);
    }
    setLoading(true);
    try {
      const result = await confirmTransaction(card);
      setPendingCard(null);
      incrementTransactionCount();
      if (result.offline) {
        showToast("Saved offline — will sync when connected");
      } else {
        showToast("Transaction saved ✓");
        if (card.intent === "khata_credit_sale") {
          setPaymentLinks({
            esewa: buildEsewaLink(card.amount, card.party ?? "Khata payment"),
            khalti: buildKhaltiLink(card.amount, card.party ?? "Khata payment"),
          });
        }
      }
      await refreshBalance();
      await refreshInsights();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPendingCard(null);
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "assistant", text: "Ok, kei gardina." },
    ]);
  };

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-[#f5f6fa]">
      <header className="border-b border-gray-200 bg-white px-3 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Mobile Khata</h1>
            <p className="mt-0.5 text-[11px] text-gray-500">Chat-first personal ledger</p>
          </div>
          <button
            type="button"
            onClick={() => setShowTrust(true)}
            className="text-[11px] text-[#1557b0]"
          >
            Privacy
          </button>
        </div>
        {(offline || syncing) && (
          <p className="mt-1 text-[11px] text-amber-700">
            {offline ? "Offline mode" : "Syncing…"}
          </p>
        )}
      </header>

      {!insightsDismissed && (
        <InsightBar
          insights={insights}
          onDismiss={() => setInsightsDismissed(true)}
          onPartyClick={() => {
            if (!canViewPartySummary() && !wasUpgradeDismissedThisSession()) {
              setShowPremium(true);
            }
          }}
          onGrowthLadderYes={() => {
            setMessages((prev) => [
              ...prev,
              {
                id: createId(),
                role: "assistant",
                text:
                  "NPR 50 lakh pachhi darta garna parne huna sakchha. Thulo byapar bhaye Sutra ERP Pro le formal billing ra VAT report garna madat garchha.",
              },
            ]);
            setInsights((prev) => prev.filter((item) => item.type !== "growth_ladder"));
          }}
          onGrowthLadderNo={() => {
            dismissVatMessageFor30Days();
            setInsights((prev) => prev.filter((item) => item.type !== "growth_ladder"));
          }}
        />
      )}

      <BalanceSummary
        udhaarOut={balance.udhaar_out_total}
        udhaarIn={balance.udhaar_in_total}
        recentCreditSales={balance.recent_credit_sales}
        recentPaymentsIn={balance.recent_payments_in}
        activeChip={activeChip}
        onChipClick={(chip) => {
          if (chip === "out" && balance.recent_credit_sales.length > 10 && !canViewPartySummary()) {
            if (!wasUpgradeDismissedThisSession()) setShowPremium(true);
          }
          setActiveChip(chip);
        }}
        onCloseList={() => setActiveChip(null)}
      />

      <ChatWindow
        messages={messages}
        pendingCard={pendingCard}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <InputBar disabled={loading} onSend={handleSend} />

      <TrustModal open={showTrust} onClose={() => setShowTrust(false)} />
      <PremiumGate
        open={showPremium}
        onDismiss={() => {
          markUpgradeDismissedThisSession();
          setShowPremium(false);
        }}
      />

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-[12px] text-white shadow-lg">
          <p>{toast}</p>
          {paymentLinks && (
            <div className="mt-2 flex gap-2">
              <a href={paymentLinks.esewa} className="rounded bg-white/10 px-2 py-1 text-[11px]">
                Send eSewa link
              </a>
              <a href={paymentLinks.khalti} className="rounded bg-white/10 px-2 py-1 text-[11px]">
                Send Khalti link
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
