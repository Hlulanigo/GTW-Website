import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Filter, Package, Truck, MapPin, ArrowRight, Send, Clock, CheckCircle, Cpu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import { TopBar } from "@/components/TopBar";
import { ParcelCard } from "@/components/ParcelCard";
import { useParseSearchIntent, type SearchFilters } from "@/hooks/useAI";

const sizes = ["All", "small", "medium", "large"];

export default function BrowsePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { mode, setMode } = useMode();
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("All");
  const [aiQuery, setAiQuery] = useState("");
  const [aiFilters, setAiFilters] = useState<SearchFilters | null>(null);
  const parseIntentMut = useParseSearchIntent();

  const handleAISearch = async () => {
    const q = aiQuery.trim();
    if (!q) return;
    try {
      const { filters } = await parseIntentMut.mutateAsync(q);
      setAiFilters(filters);
      const loc = filters.to || filters.from;
      if (loc) setSearch(loc);
      if (filters.size) setSizeFilter(filters.size);
    } catch {
      // surface inline via badge below
    }
  };

  const clearAIFilters = () => {
    setAiFilters(null);
    setAiQuery("");
  };

  const { data: parcels = [], isLoading, refetch } = useQuery({
    queryKey: ["parcels", mode],
    queryFn: () => api.get<any[]>("/api/parcels"),
    refetchInterval: 30000,
  });

  const filtered = parcels.filter((p) => {
    const origin = p.origin || p.fromAddress || "";
    const destination = p.destination || p.toAddress || "";
    const matchesSearch =
      !search ||
      origin.toLowerCase().includes(search.toLowerCase()) ||
      destination.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesSize = sizeFilter === "All" || p.size === sizeFilter;

    let matchesAI = true;
    if (aiFilters) {
      if (aiFilters.from && !origin.toLowerCase().includes(aiFilters.from.toLowerCase())) matchesAI = false;
      if (aiFilters.to && !destination.toLowerCase().includes(aiFilters.to.toLowerCase())) matchesAI = false;
      if (aiFilters.fragile && !p.isFragile) matchesAI = false;
      if (typeof aiFilters.maxPrice === "number" && (p.compensation ?? 0) > aiFilters.maxPrice) matchesAI = false;
      if (typeof aiFilters.minPrice === "number" && (p.compensation ?? 0) < aiFilters.minPrice) matchesAI = false;
      if (aiFilters.dateFilter && p.pickupDate) {
        const pd = new Date(p.pickupDate);
        if (aiFilters.dateFilter === "today") {
          if (pd.toDateString() !== new Date().toDateString()) matchesAI = false;
        } else if (aiFilters.dateFilter === "thisWeek") {
          const now = new Date();
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (!(pd >= now && pd <= weekFromNow)) matchesAI = false;
        }
      }
    }

    if (mode === "carrier") return matchesSearch && matchesSize && matchesAI && (p.status === "Paid" || p.status === "Pending");
    return matchesSearch && matchesSize && matchesAI;
  });

  const myParcels = parcels.filter((p) => p.senderId === profile?.id);
  const myDeliveries = parcels.filter((p) => p.transporterId === profile?.id);

  const stats = mode === "carrier"
    ? {
        inTransit: myDeliveries.filter((p) => ["Accepted", "Picked Up", "In Transit", "Arrived"].includes(p.status)).length,
        pending: filtered.length,
        delivered: myDeliveries.filter((p) => p.status === "Delivered").length,
        total: myDeliveries.length,
      }
    : {
        inTransit: myParcels.filter((p) => p.status === "In Transit").length,
        pending: myParcels.filter((p) => p.status === "Pending" || p.status === "Paid").length,
        delivered: myParcels.filter((p) => p.status === "Delivered").length,
        total: myParcels.length,
      };

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title=""
        right={
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-navy-secondary rounded-full md:hidden">
            {(["sender", "carrier"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 capitalize
                  ${mode === m ? "bg-primary text-white" : "text-slate-500 dark:text-slate-400"}`}
              >
                {m}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-20 md:pb-4">
        <div className="px-4 pt-4 pb-2">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-navy dark:text-white">
              {mode === "carrier" ? "Find Jobs" : "Browse Parcels"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              {mode === "carrier"
                ? "Accept deliveries along your route"
                : "Search for parcels to send"}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {(mode === "carrier"
              ? [
                  { label: "Active", value: stats.inTransit, color: "text-blue-500", bg: "bg-blue-500/10", icon: Truck },
                  { label: "Available", value: stats.pending, color: "text-warning", bg: "bg-warning/10", icon: Clock },
                  { label: "Completed", value: stats.delivered, color: "text-success", bg: "bg-success/10", icon: CheckCircle },
                  { label: "All Jobs", value: stats.total, color: "text-violet-500", bg: "bg-violet-500/10", icon: Package },
                ]
              : [
                  { label: "In Transit", value: stats.inTransit, color: "text-primary", bg: "bg-primary/10", icon: Truck },
                  { label: "Pending", value: stats.pending, color: "text-warning", bg: "bg-warning/10", icon: Clock },
                  { label: "Delivered", value: stats.delivered, color: "text-success", bg: "bg-success/10", icon: CheckCircle },
                  { label: "My Parcels", value: stats.total, color: "text-violet-500", bg: "bg-violet-500/10", icon: Package },
                ]
            ).map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={`card p-2.5 text-center ${s.bg}`}>
                  <Icon size={14} className={`${s.color} mx-auto mb-1`} />
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(mode === "carrier"
              ? [
                  { label: "Find Jobs", icon: Search, color: "text-blue-500", bg: "bg-blue-500/10", action: () => {} },
                  { label: "Deliveries", icon: Truck, color: "text-primary", bg: "bg-primary/10", action: () => navigate("/deliveries") },
                  { label: "My Routes", icon: ArrowRight, color: "text-violet-500", bg: "bg-violet-500/10", action: () => navigate("/routes") },
                ]
              : [
                  { label: "Send", icon: Send, color: "text-success", bg: "bg-success/10", action: () => navigate("/create-parcel") },
                  { label: "Track", icon: Search, color: "text-primary", bg: "bg-primary/10", action: () => navigate("/my-parcels") },
                  { label: "History", icon: Clock, color: "text-violet-500", bg: "bg-violet-500/10", action: () => navigate("/my-parcels") },
                ]
            ).map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  onClick={qa.action}
                  className={`card py-3 flex flex-col items-center gap-1.5 hover:shadow-md active:scale-95 transition-all ${qa.bg}`}
                >
                  <Icon size={18} className={qa.color} />
                  <span className={`text-xs font-semibold ${qa.color}`}>{qa.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative mb-2">
            <Cpu size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
            <input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAISearch(); } }}
              placeholder='Try "fragile boxes to Cape Town this week"'
              className="input-field pl-10 pr-20 border-primary/40"
            />
            {aiQuery && (
              <button
                type="button"
                onClick={handleAISearch}
                disabled={parseIntentMut.isPending}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-60"
              >
                {parseIntentMut.isPending ? "..." : "Go"}
              </button>
            )}
          </div>

          {aiFilters && (
            <div className="flex items-center gap-2 flex-wrap mb-3 text-xs">
              <span className="flex items-center gap-1 text-primary font-semibold">
                <Cpu size={11} /> AI:
              </span>
              {aiFilters.from && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">from {aiFilters.from}</span>}
              {aiFilters.to && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">to {aiFilters.to}</span>}
              {aiFilters.size && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{aiFilters.size}</span>}
              {aiFilters.dateFilter && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{aiFilters.dateFilter === "today" ? "today" : "this week"}</span>}
              {aiFilters.fragile && <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning">fragile</span>}
              {typeof aiFilters.minPrice === "number" && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">≥ R{aiFilters.minPrice}</span>}
              {typeof aiFilters.maxPrice === "number" && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">≤ R{aiFilters.maxPrice}</span>}
              <button onClick={clearAIFilters} className="text-slate-400 hover:text-slate-600 ml-1">clear</button>
            </div>
          )}

          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by location..."
              className="input-field pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSizeFilter(s)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 capitalize
                  ${sizeFilter === s
                    ? "bg-primary text-white shadow-orange"
                    : "bg-white dark:bg-navy-mid text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-light"
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-navy-secondary rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-200 dark:bg-navy-secondary rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-navy-secondary rounded w-2/3" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-navy-secondary flex items-center justify-center mb-4">
                <Package size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-navy dark:text-white">No parcels found</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {search ? "Try a different search" : "Check back later"}
              </p>
            </div>
          ) : (
            filtered.map((parcel) => (
              <ParcelCard
                key={parcel.id}
                parcel={parcel}
                onClick={() => navigate(`/parcels/${parcel.id}`)}
              />
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => mode === "carrier" ? navigate("/routes") : navigate("/create-parcel")}
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 ${mode === "carrier" ? "bg-blue-500" : "bg-primary shadow-orange"} rounded-full flex items-center justify-center z-50 active:scale-95 transition-all`}
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}
