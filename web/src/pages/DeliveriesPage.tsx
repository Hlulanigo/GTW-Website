import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, DollarSign, CheckCircle, Clock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";

type FilterTab = "active" | "completed" | "all";

const STATUS_ORDER = ["Accepted", "Picked Up", "In Transit", "Arrived", "Delivered"];
const ACTIVE_STATUSES = new Set(["Accepted", "Picked Up", "In Transit", "Arrived"]);

const statusColors: Record<string, string> = {
  Accepted: "bg-warning/10 text-warning",
  "Picked Up": "bg-primary/10 text-primary",
  "In Transit": "bg-primary/10 text-primary",
  Arrived: "bg-violet-500/10 text-violet-500",
  Delivered: "bg-success/10 text-success",
};

function ProgressBar({ status }: { status: string }) {
  const idx = STATUS_ORDER.indexOf(status);
  const progress = idx >= 0 ? ((idx + 1) / STATUS_ORDER.length) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-slate-100 dark:bg-navy-light rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("active");

  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ["deliveries", user?.uid],
    queryFn: () => api.get<any[]>(`/api/parcels?transporterId=${user?.uid}`),
    enabled: !!user,
  });

  const activeCount = deliveries.filter((p) => ACTIVE_STATUSES.has(p.status)).length;
  const completedCount = deliveries.filter((p) => p.status === "Delivered").length;
  const totalEarned = deliveries
    .filter((p) => p.status === "Delivered")
    .reduce((sum, p) => sum + parseFloat(p.compensation || p.price || 0), 0);

  const filtered = deliveries.filter((p) => {
    if (filter === "active") return ACTIVE_STATUSES.has(p.status);
    if (filter === "completed") return p.status === "Delivered";
    return true;
  });

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "active", label: "Active", count: activeCount },
    { id: "completed", label: "Completed", count: completedCount },
    { id: "all", label: "All", count: deliveries.length },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="My Deliveries" />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-20 md:pb-4">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-warning">{activeCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Active</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-success">{completedCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Done</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-primary">R{totalEarned.toFixed(0)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Earned</p>
            </div>
          </div>

          <div className="flex gap-1 p-1 bg-white dark:bg-navy-mid rounded-xl shadow-sm">
            {filterTabs.map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  filter === id
                    ? "bg-primary text-white shadow-orange"
                    : "text-slate-500 dark:text-slate-400"
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

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse h-28" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-navy-secondary flex items-center justify-center mb-4">
                <Truck size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-navy dark:text-white">
                {filter === "active" ? "No active deliveries" : filter === "completed" ? "No completed deliveries yet" : "No deliveries yet"}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {filter === "active" ? "Accept jobs from the Browse screen" : "Completed deliveries will appear here"}
              </p>
              {filter === "active" && (
                <button onClick={() => navigate("/browse")} className="btn-primary mt-4 px-6 py-2.5 text-sm">
                  Find Jobs
                </button>
              )}
            </div>
          ) : (
            filtered.map((parcel) => {
              const statusColor = statusColors[parcel.status] || "bg-slate-100 text-slate-500";
              return (
                <button
                  key={parcel.id}
                  onClick={() => navigate(`/parcels/${parcel.id}`)}
                  className="card w-full p-4 text-left hover:shadow-lg active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div className="w-px h-5 bg-slate-200 dark:bg-navy-light" />
                        <div className="w-2 h-2 rounded-full border-2 border-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-medium text-navy dark:text-white truncate">{parcel.fromAddress || parcel.origin}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{parcel.toAddress || parcel.destination}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-bold text-primary">R{parseFloat(parcel.compensation || parcel.price || 0).toFixed(0)}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor} mt-1 inline-block`}>
                        {parcel.status}
                      </span>
                    </div>
                  </div>

                  {parcel.status !== "Delivered" && (
                    <div className="mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-slate-400">Progress</span>
                        <span className="text-xs text-slate-400">
                          {STATUS_ORDER.indexOf(parcel.status) + 1}/{STATUS_ORDER.length}
                        </span>
                      </div>
                      <ProgressBar status={parcel.status} />
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-slate-300 dark:text-navy-light">Accepted</span>
                        <span className="text-xs text-slate-300 dark:text-navy-light">Delivered</span>
                      </div>
                    </div>
                  )}

                  {parcel.status === "Delivered" && (
                    <div className="mt-2 flex items-center gap-2 text-success">
                      <CheckCircle size={14} />
                      <span className="text-xs font-medium">Delivery complete</span>
                      {parcel.deliveredAt && (
                        <span className="text-xs text-slate-400 ml-auto">
                          {new Date(parcel.deliveredAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
