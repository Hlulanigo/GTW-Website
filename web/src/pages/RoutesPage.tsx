import { useNavigate } from "react-router-dom";
import { MapPin, Plus, Calendar, Package, Weight, Repeat, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";

const frequencyLabels: Record<string, string> = {
  one_time: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const statusConfig: Record<string, { color: string; dot: string }> = {
  Active:    { color: "bg-success/10 text-success",  dot: "bg-success" },
  Completed: { color: "bg-primary/10 text-primary",  dot: "bg-primary" },
  Expired:   { color: "bg-warning/10 text-warning",  dot: "bg-warning" },
  Cancelled: { color: "bg-error/10 text-error",      dot: "bg-error" },
};

export default function RoutesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["routes", user?.uid],
    queryFn: () => api.get<any[]>(`/api/users/${user?.uid}/routes`),
    enabled: !!user,
  });

  const activeCount = routes.filter((r) => r.status === "Active").length;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="My Routes" />
      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-24 md:pb-6">
        <div className="p-4 max-w-lg mx-auto space-y-3">

          {/* Summary pill */}
          {routes.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-success/10 rounded-2xl">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-medium text-success">
                {activeCount} active {activeCount === 1 ? "route" : "routes"}
              </span>
              <span className="text-xs text-success/60 ml-auto">{routes.length} total</span>
            </div>
          )}

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse h-28" />
            ))
          ) : routes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-navy-secondary flex items-center justify-center mb-4">
                <MapPin size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-navy dark:text-white">No routes yet</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Post a travel route to earn on the way</p>
              <button onClick={() => navigate("/routes/create")} className="btn-primary mt-5 px-6 py-2.5 text-sm">
                Add My First Route
              </button>
            </div>
          ) : (
            routes.map((route) => {
              const cfg = statusConfig[route.status] || statusConfig.Active;
              const origin = route.origin || route.fromCity || "—";
              const destination = route.destination || route.toCity || "—";
              const originCity = origin.split(",")[0];
              const destCity = destination.split(",")[0];
              const capacity = route.availableCapacity ?? 0;
              const used = route.capacityUsed ?? 0;
              const available = capacity - used;

              return (
                <div
                  key={route.id}
                  onClick={() => navigate(`/routes/${route.id}`)}
                  className="card p-4 cursor-pointer active:scale-[0.98] hover:shadow-lg transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${cfg.color}`}>
                        {route.status}
                      </span>
                      {route.frequency && route.frequency !== "one_time" && (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 flex items-center gap-1">
                          <Repeat size={9} />
                          {frequencyLabels[route.frequency]}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                  </div>

                  {/* Route line */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex flex-col items-center gap-0.5 mt-1 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <div className="w-px h-5 bg-slate-200 dark:bg-navy-light" />
                      <div className={`w-2 h-2 rounded-full border-2 ${route.status === "Active" ? "border-success" : "border-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">From</p>
                        <p className="text-sm font-semibold text-navy dark:text-white truncate">{origin}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">To</p>
                        <p className="text-sm font-semibold text-navy dark:text-white truncate">{destination}</p>
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 pt-2.5 border-t border-slate-100 dark:border-navy-light flex-wrap">
                    {route.departureDate && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Calendar size={12} />
                        <span className="text-xs">
                          {new Date(route.departureDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                          {route.departureTime ? ` · ${route.departureTime}` : ""}
                        </span>
                      </div>
                    )}
                    {route.maxParcelSize && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Package size={12} />
                        <span className="text-xs capitalize">{route.maxParcelSize} max</span>
                      </div>
                    )}
                    {capacity > 0 && (
                      <div className={`flex items-center gap-1 ml-auto ${available > 0 ? "text-success" : "text-error"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${available > 0 ? "bg-success" : "bg-error"}`} />
                        <span className="text-xs font-medium">{available > 0 ? `${available} slots left` : "Full"}</span>
                      </div>
                    )}
                    {route.pricePerKg && (
                      <span className="text-xs font-bold text-primary">R{route.pricePerKg}/kg</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <button
        onClick={() => navigate("/routes/create")}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-orange z-50 active:scale-95 transition-all"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}
