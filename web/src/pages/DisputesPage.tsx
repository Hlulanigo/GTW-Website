import { useState } from "react";
import { Shield, AlertCircle, CheckCircle, Clock, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { useNavigate } from "react-router-dom";

interface Dispute {
  id: number;
  parcelId: number;
  reason: string;
  subject?: string;
  status: "open" | "under_review" | "in_review" | "resolved" | "closed";
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
  refundAmount?: number;
}

const statusConfig = {
  open: { label: "Open", color: "bg-warning/10 text-warning", icon: Clock },
  under_review: { label: "Under Review", color: "bg-info/10 text-info", icon: Shield },
  in_review: { label: "In Review", color: "bg-info/10 text-info", icon: Shield },
  resolved: { label: "Resolved", color: "bg-success/10 text-success", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-slate-100 dark:bg-navy-light text-slate-500", icon: AlertCircle },
};

type FilterTab = "all" | "open" | "resolved";

export default function DisputesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["disputes", user?.uid],
    queryFn: () => api.get<Dispute[]>(`/api/disputes`),
    enabled: !!user,
  });

  const openCount = disputes.filter((d) => d.status === "open" || d.status === "under_review" || d.status === "in_review").length;
  const resolvedCount = disputes.filter((d) => d.status === "resolved" || d.status === "closed").length;

  const filtered = disputes.filter((d) => {
    if (filter === "open") return d.status === "open" || d.status === "under_review" || d.status === "in_review";
    if (filter === "resolved") return d.status === "resolved" || d.status === "closed";
    return true;
  });

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: disputes.length },
    { id: "open", label: "Open", count: openCount },
    { id: "resolved", label: "Resolved", count: resolvedCount },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Disputes" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-2xl mx-auto">

          <div className="card p-4 flex items-start gap-3 bg-info/5 border border-info/20">
            <Shield size={18} className="text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-navy dark:text-white">Dispute Resolution</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Open a dispute from a parcel's detail page. Our team reviews disputes within 48 hours.
              </p>
            </div>
          </div>

          <div className="flex gap-1 p-1 bg-white dark:bg-navy-mid rounded-xl shadow-sm">
            {filterTabs.map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  filter === id ? "bg-primary text-white shadow-orange" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    filter === id ? "bg-white/20" : "bg-slate-100 dark:bg-navy-secondary text-slate-400"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-navy dark:text-white">Your Disputes</h3>
              <span className="text-xs text-slate-400">{filtered.length} dispute{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-slate-200 dark:bg-navy-lighter rounded w-1/3" />
                    <div className="h-5 bg-slate-200 dark:bg-navy-lighter rounded-full w-20" />
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-navy-lighter rounded w-2/3" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {filter === "open" ? "No open disputes" : filter === "resolved" ? "No resolved disputes" : "No disputes"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {filter === "all" ? "You have no active or past disputes" : ""}
                </p>
              </div>
            ) : (
              filtered.map((dispute) => {
                const cfg = statusConfig[dispute.status] ?? statusConfig.open;
                const StatusIcon = cfg.icon;
                return (
                  <button
                    key={dispute.id}
                    onClick={() => navigate(`/parcels/${dispute.parcelId}`)}
                    className="w-full px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-navy-light/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div>
                        <p className="text-sm font-semibold text-navy dark:text-white">
                          {dispute.subject || `Parcel #${dispute.parcelId}`}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(dispute.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          {dispute.resolvedAt && ` · Resolved ${new Date(dispute.resolvedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.color}`}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                    </div>
                    {dispute.reason && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{dispute.reason}</p>
                    )}
                    {dispute.refundAmount != null && dispute.refundAmount > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-success/10 rounded-full px-3 py-1">
                        <p className="text-xs font-semibold text-success">Refund: R{dispute.refundAmount}</p>
                      </div>
                    )}
                    {dispute.resolution && (
                      <div className="mt-2 bg-success/5 rounded-xl px-3 py-2">
                        <p className="text-xs text-slate-400 font-medium">Resolution</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{dispute.resolution}</p>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
