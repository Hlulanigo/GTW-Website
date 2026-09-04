import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Package, Clock, Trash2, X, Weight, Repeat, DollarSign, Users, Cpu } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { useMatchInsights, type MatchInsight } from "@/hooks/useAI";

const frequencyLabels: Record<string, string> = {
  one_time: "One-time trip",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  Active:    { label: "Active",    color: "bg-success/10 text-success",  dot: "bg-success" },
  Completed: { label: "Completed", color: "bg-primary/10 text-primary",  dot: "bg-primary" },
  Expired:   { label: "Expired",   color: "bg-warning/10 text-warning",  dot: "bg-warning" },
  Cancelled: { label: "Cancelled", color: "bg-error/10 text-error",      dot: "bg-error" },
};

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: route, isLoading } = useQuery({
    queryKey: ["route", id],
    queryFn: () => api.get<any>(`/api/routes/${id}`),
    enabled: !!id,
  });

  const { data: matchingParcels = [], isLoading: matchingLoading } = useQuery({
    queryKey: ["matching-parcels", id],
    queryFn: () => api.get<any[]>(`/api/routes/${id}/matching-parcels`),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/api/routes/${id}`, { status: "Cancelled" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routes"] }); toast.success("Route cancelled"); navigate("/routes"); },
    onError: (err: any) => toast.error(err.message || "Failed to cancel route"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/routes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routes"] }); toast.success("Route deleted"); navigate("/routes"); },
    onError: (err: any) => toast.error(err.message || "Failed to delete route"),
  });

  const matchInsightsMut = useMatchInsights();
  const [insightsById, setInsightsById] = useState<Record<string, MatchInsight>>({});

  const handleExplainMatches = async () => {
    if (!route || matchingParcels.length === 0) return;
    try {
      const res = await matchInsightsMut.mutateAsync({
        route: {
          origin: route.origin || route.fromCity || "",
          destination: route.destination || route.toCity || "",
          intermediateStops: route.intermediateStops || [],
        },
        parcels: matchingParcels.slice(0, 8).map((p: any) => ({
          id: p.id,
          origin: p.origin || p.fromAddress || "",
          destination: p.destination || p.toAddress || "",
          size: p.size || "medium",
          weight: p.weight ?? null,
          isFragile: p.isFragile ?? null,
          compensation: p.compensation ?? p.price ?? 0,
          senderRating: p.senderRating ?? null,
          description: p.description ?? null,
        })),
      });
      const map: Record<string, MatchInsight> = {};
      for (const i of res.insights) map[i.parcelId] = i;
      setInsightsById(map);
    } catch (e: any) {
      toast.error(e?.message || "AI unavailable");
    }
  };

  const ratingColor = (rating: MatchInsight["rating"]) =>
    rating === "great" ? "text-success" : rating === "good" ? "text-primary" : "text-warning";

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Route Details" showBack />
        <div className="flex-1 p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Route Details" showBack />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Route not found</p>
        </div>
      </div>
    );
  }

  const cfg = statusConfig[route.status] || statusConfig.Active;
  const origin      = route.origin || route.fromCity || "—";
  const destination = route.destination || route.toCity || "—";
  const capacity    = route.availableCapacity ?? 0;
  const used        = route.capacityUsed ?? 0;
  const available   = capacity - used;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Route Details" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          {/* Main card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
              {route.frequency && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-500/10 text-violet-500 flex items-center gap-1">
                  <Repeat size={10} />
                  {frequencyLabels[route.frequency] || route.frequency}
                </span>
              )}
            </div>

            {/* Route line */}
            <div className="flex items-start gap-3 mb-5">
              <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                <div className="w-px h-10 bg-slate-200 dark:bg-navy-light" />
                <div className={`w-3 h-3 rounded-full border-2 ${route.status === "Active" ? "border-success" : "border-slate-400"}`} />
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">From</p>
                  <p className="text-base font-bold text-navy dark:text-white">{origin}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">To</p>
                  <p className="text-base font-bold text-navy dark:text-white">{destination}</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {route.departureDate && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar size={13} className="text-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Departure</p>
                  </div>
                  <p className="text-sm font-bold text-navy dark:text-white">
                    {new Date(route.departureDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {route.departureTime && (
                    <p className="text-xs text-slate-400 mt-0.5">{route.departureTime}</p>
                  )}
                </div>
              )}
              {route.maxParcelSize && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Package size={13} className="text-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Max Size</p>
                  </div>
                  <p className="text-sm font-bold text-navy dark:text-white capitalize">{route.maxParcelSize}</p>
                  {route.maxWeight && (
                    <p className="text-xs text-slate-400 mt-0.5">up to {route.maxWeight}kg</p>
                  )}
                </div>
              )}
              {capacity > 0 && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users size={13} className="text-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Capacity</p>
                  </div>
                  <p className={`text-sm font-bold ${available > 0 ? "text-success" : "text-error"}`}>
                    {available > 0 ? `${available} of ${capacity} free` : "Full"}
                  </p>
                </div>
              )}
              {route.pricePerKg && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign size={13} className="text-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rate</p>
                  </div>
                  <p className="text-sm font-bold text-primary">R{route.pricePerKg}/kg</p>
                </div>
              )}
            </div>

            {route.notes && (
              <div className="mt-3 bg-primary/5 dark:bg-primary/10 rounded-xl p-3 border border-primary/10">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 mb-1">Carrier Notes</p>
                <p className="text-sm text-navy dark:text-white">{route.notes}</p>
              </div>
            )}
          </div>

          {/* Matching parcels */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-light flex items-center justify-between">
              <h3 className="font-semibold text-navy dark:text-white">Matching Parcels</h3>
              <span className="text-xs bg-slate-100 dark:bg-navy-secondary text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                {matchingParcels.length} found
              </span>
            </div>
            {matchingParcels.length > 0 && (
              <div className="px-4 pt-3">
                <button
                  type="button"
                  onClick={handleExplainMatches}
                  disabled={matchInsightsMut.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 border-primary bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-60"
                >
                  {matchInsightsMut.isPending ? (
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Cpu size={14} />
                  )}
                  {matchInsightsMut.isPending
                    ? "Analyzing matches..."
                    : Object.keys(insightsById).length
                    ? "Refresh AI insights"
                    : "Explain matches with AI"}
                </button>
              </div>
            )}
            {matchingLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse h-16" />
              ))
            ) : matchingParcels.length === 0 ? (
              <div className="p-8 text-center">
                <Package size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No matching parcels yet</p>
                <p className="text-xs text-slate-400 mt-1">Parcels along this route will appear here</p>
              </div>
            ) : (
              matchingParcels.map((parcel) => {
                const from = parcel.origin || parcel.fromAddress || "—";
                const to   = parcel.destination || parcel.toAddress || "—";
                const price = parcel.compensation ?? parcel.price;
                return (
                  <button
                    key={parcel.id}
                    onClick={() => navigate(`/parcels/${parcel.id}`)}
                    className="w-full px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-navy-light/50 transition-colors border-b border-slate-100 dark:border-navy-light last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-0.5 mt-1 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <div className="w-px h-4 bg-slate-200 dark:bg-navy-light" />
                        <div className="w-1.5 h-1.5 rounded-full border border-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy dark:text-white truncate">{from}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{to}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary">R{price?.toLocaleString?.()}</p>
                        <p className="text-[10px] text-slate-400 capitalize mt-0.5">{parcel.size}</p>
                      </div>
                    </div>
                    {insightsById[parcel.id] && (
                      <div className={`mt-2 pt-2 border-t border-slate-100 dark:border-navy-light flex items-start gap-2 ${ratingColor(insightsById[parcel.id].rating)}`}>
                        <Cpu size={12} className="mt-0.5 shrink-0" />
                        <span className="text-xs italic">{insightsById[parcel.id].reason}</span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Actions */}
          {route.status === "Active" && (
            <div className="space-y-2">
              <button
                onClick={() => { if (confirm("Cancel this route?")) cancelMutation.mutate(); }}
                disabled={cancelMutation.isPending}
                className="w-full py-3 rounded-xl border-2 border-warning text-warning font-semibold hover:bg-warning/5 transition-colors flex items-center justify-center gap-2"
              >
                <X size={16} />
                Cancel Route
              </button>
              <button
                onClick={() => { if (confirm("Permanently delete this route? This cannot be undone.")) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="w-full py-3 rounded-xl border-2 border-error text-error font-semibold hover:bg-error/5 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete Route
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
