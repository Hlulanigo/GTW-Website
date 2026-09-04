import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet, Plus, CreditCard, RefreshCw, Zap, History } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { useNavigate } from "react-router-dom";

interface Transaction {
  id: number;
  type: "credit" | "debit";
  amount: number;
  description: string;
  createdAt: string;
  status: string;
}

export default function WalletPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [topupAmount, setTopupAmount] = useState("");
  const [showTopup, setShowTopup] = useState(false);
  const [topupError, setTopupError] = useState("");
  const [autoTopup, setAutoTopup] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState("100");
  const [autoAmount, setAutoAmount] = useState("200");
  const [showAutoTopup, setShowAutoTopup] = useState(false);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.uid],
    queryFn: () => api.get<Transaction[]>(`/api/wallet/transactions`),
    enabled: !!user,
  });

  const topupMutation = useMutation({
    mutationFn: (amount: number) =>
      api.post<{ authorization_url: string; reference: string }>("/api/wallet/topup/initialize", {
        amount,
        currency: "ZAR",
        email: profile?.email || user?.email,
      }),
    onSuccess: (data) => {
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setTopupError("Unable to open payment page");
      }
    },
    onError: (err: any) => setTopupError(err.message || "Top-up failed"),
  });

  const handleTopup = () => {
    const amt = parseFloat(topupAmount);
    if (!amt || amt <= 0) { setTopupError("Enter a valid amount"); return; }
    if (amt < 5) { setTopupError("Minimum top-up is R5"); return; }
    setTopupError("");
    topupMutation.mutate(amt);
  };

  const [autoTopupSaving, setAutoTopupSaving] = useState(false);
  const [autoTopupError, setAutoTopupError] = useState("");

  const handleSaveAutoTopup = async () => {
    const threshold = parseFloat(autoThreshold);
    const amount = parseFloat(autoAmount);
    if (!threshold || threshold <= 0) { setAutoTopupError("Enter a valid threshold"); return; }
    if (!amount || amount <= 0) { setAutoTopupError("Enter a valid top-up amount"); return; }
    setAutoTopupSaving(true);
    setAutoTopupError("");
    try {
      await api.patch("/api/auto-topup", {
        enabled: autoTopup,
        triggerAmount: Math.round(threshold * 100),
        topupAmount: Math.round(amount * 100),
      });
      qc.invalidateQueries({ queryKey: ["auto-topup"] });
    } catch (err: any) {
      setAutoTopupError(err.message || "Failed to save settings");
    } finally {
      setAutoTopupSaving(false);
    }
  };

  const balance = (profile?.walletBalance ?? 0) / 100;

  const formatMoney = (cents: number) =>
    (cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const quickAmounts = [50, 100, 200, 500];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Wallet" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-2xl mx-auto">

          <div className="rounded-2xl bg-gradient-to-br from-primary to-orange-600 p-6 text-white shadow-orange">
            <p className="text-sm font-medium text-white/70 mb-1">Available Balance</p>
            <p className="text-4xl font-bold tracking-tight">R{balance.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTopup(true)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                <Plus size={16} />
                Add Funds
              </button>
              <button
                onClick={() => refreshProfile()}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/payment-history")}
              className="card p-4 flex items-center gap-3 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <History size={16} className="text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-navy dark:text-white">Payment History</p>
                <p className="text-xs text-slate-400">View receipts</p>
              </div>
            </button>
            <button
              onClick={() => setShowAutoTopup(!showAutoTopup)}
              className="card p-4 flex items-center gap-3 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${autoTopup ? "bg-success/10" : "bg-slate-100 dark:bg-navy-secondary"}`}>
                <Zap size={16} className={autoTopup ? "text-success" : "text-slate-400"} />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-navy dark:text-white">Auto Top-up</p>
                <p className="text-xs text-slate-400">{autoTopup ? "Enabled" : "Off"}</p>
              </div>
            </button>
          </div>

          {showAutoTopup && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-navy dark:text-white">Auto Top-up</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Automatically add funds when balance is low</p>
                </div>
                <button
                  onClick={() => setAutoTopup(!autoTopup)}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${autoTopup ? "bg-success" : "bg-slate-200 dark:bg-navy-secondary"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${autoTopup ? "left-6" : "left-1"}`} />
                </button>
              </div>
              {autoTopup && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Top up when balance drops below</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R</span>
                      <input type="number" value={autoThreshold} onChange={(e) => setAutoThreshold(e.target.value)} className="input-field pl-8" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Amount to add each time</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R</span>
                      <input type="number" value={autoAmount} onChange={(e) => setAutoAmount(e.target.value)} className="input-field pl-8" />
                    </div>
                  </div>
                  {autoTopupError && (
                    <p className="text-xs text-red-500">{autoTopupError}</p>
                  )}
                  <button
                    onClick={handleSaveAutoTopup}
                    disabled={autoTopupSaving}
                    className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
                  >
                    {autoTopupSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : "Save Auto Top-up"}
                  </button>
                </div>
              )}
            </div>
          )}

          {showTopup && (
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-navy dark:text-white">Add Funds</h3>
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setTopupAmount(String(a))}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      topupAmount === String(a)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 dark:border-navy-lighter text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    R{a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R</span>
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="Custom amount"
                    className="input-field pl-8"
                  />
                </div>
              </div>
              {topupError && (
                <p className="text-error text-sm">{topupError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowTopup(false); setTopupAmount(""); setTopupError(""); }}
                  className="flex-1 btn-outline py-2.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTopup}
                  disabled={topupMutation.isPending}
                  className="flex-1 btn-primary py-2.5"
                >
                  {topupMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : "Top Up"}
                </button>
              </div>
            </div>
          )}

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3">
              <h3 className="font-semibold text-navy dark:text-white">Transaction History</h3>
            </div>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-4 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-navy-lighter shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-slate-200 dark:bg-navy-lighter rounded w-2/3" />
                    <div className="h-3 bg-slate-200 dark:bg-navy-lighter rounded w-1/3" />
                  </div>
                  <div className="h-4 bg-slate-200 dark:bg-navy-lighter rounded w-16" />
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CreditCard size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No transactions yet</p>
                <p className="text-xs text-slate-400 mt-1">Your transactions will appear here</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="px-4 py-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.type === "credit" ? "bg-success/10" : "bg-error/10"
                  }`}>
                    {tx.type === "credit"
                      ? <ArrowDownLeft size={18} className="text-success" />
                      : <ArrowUpRight size={18} className="text-error" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy dark:text-white truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400">{formatDate(tx.createdAt)}</p>
                  </div>
                  <span className={`font-bold text-sm shrink-0 ${tx.type === "credit" ? "text-success" : "text-error"}`}>
                    {tx.type === "credit" ? "+" : "-"}R{formatMoney(Math.abs(tx.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
