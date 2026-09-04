import { useParams, useNavigate } from "react-router-dom";
import { Package, MessageCircle, AlertTriangle, Weight, Clock, User, Phone, Calendar, ChevronLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { queryClient } from "@/lib/queryClient";
import { OSMMap } from "@/components/OSMMap";
import { toast } from "sonner";

const statusConfig: Record<string, { color: string; label: string; description: string }> = {
  Pending:     { color: "bg-slate-100 dark:bg-navy-secondary text-slate-500",  label: "Pending",     description: "Waiting for payment" },
  Paid:        { color: "bg-sky-500/10 text-sky-500",                           label: "Paid",        description: "Ready for a carrier" },
  Accepted:    { color: "bg-amber-500/10 text-amber-500",                        label: "Accepted",    description: "Carrier assigned" },
  "Picked Up": { color: "bg-primary/10 text-primary",                           label: "Picked Up",   description: "With the carrier" },
  "In Transit":{ color: "bg-primary/10 text-primary",                           label: "In Transit",  description: "On the way" },
  Arrived:     { color: "bg-success/10 text-success",                           label: "Arrived",     description: "At destination" },
  Delivered:   { color: "bg-success/10 text-success",                           label: "Delivered",   description: "Successfully delivered" },
  Expired:     { color: "bg-error/10 text-error",                               label: "Expired",     description: "Listing expired" },
};

const sizeDetails: Record<string, { label: string; desc: string }> = {
  small:  { label: "Small",  desc: "Fits in a backpack" },
  medium: { label: "Medium", desc: "Shoebox to carry-on bag" },
  large:  { label: "Large",  desc: "Full suitcase or larger" },
};

function RelativeDate({ dateStr }: { dateStr?: string }) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffH = Math.round((d.getTime() - now.getTime()) / 3600000);
  const diffD = Math.round((d.getTime() - now.getTime()) / 86400000);
  let label = "";
  if (diffH < 0)   label = "Overdue";
  else if (diffH < 1)  label = "< 1 hour";
  else if (diffH < 24) label = `In ${diffH} hours`;
  else if (diffD === 1) label = "Tomorrow";
  else if (diffD <= 6)  label = `In ${diffD} days`;
  else label = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <span className={diffH < 0 ? "text-error" : diffH < 12 ? "text-warning" : "text-navy dark:text-white"}>
      {label}
    </span>
  );
}

export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const { data: parcel, isLoading } = useQuery({
    queryKey: ["parcel", id],
    queryFn: () => api.get<any>(`/api/parcels/${id}`),
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: () => api.patch(`/api/parcels/${id}/accept`, { transporterId: user?.uid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcel", id] });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success("Delivery accepted! Check your deliveries.");
    },
    onError: (err: any) => toast.error(err.message || "Could not accept delivery"),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Parcel Details" showBack />
        <div className="flex-1 p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Parcel Details" showBack />
        <div className="flex-1 flex items-center justify-center flex-col gap-3 p-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-navy-secondary flex items-center justify-center">
            <Package size={28} className="text-slate-400" />
          </div>
          <p className="font-semibold text-navy dark:text-white">Parcel not found</p>
          <p className="text-sm text-slate-400">This parcel may have been removed</p>
        </div>
      </div>
    );
  }

  const isCarrier  = parcel.transporterId === user?.uid;
  const isSender   = parcel.senderId === user?.uid;
  const canAccept  = !isCarrier && !isSender && (parcel.status === "Paid" || parcel.status === "Pending");
  const fromAddress = parcel.origin || parcel.fromAddress;
  const toAddress   = parcel.destination || parcel.toAddress;
  const price       = parcel.compensation ?? parcel.price;
  const st  = statusConfig[parcel.status] || statusConfig.Pending;
  const sz  = sizeDetails[parcel.size] || { label: parcel.size, desc: "" };

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Parcel`} showBack />

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          {/* Status + Price hero */}
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${st.color}`}>
                    {st.label}
                  </span>
                  {parcel.isFragile && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-error/10 text-error flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Fragile
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{st.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-extrabold text-3xl text-primary leading-tight">R{price?.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-0.5">carrier payout</p>
              </div>
            </div>

            {/* Route line */}
            <div className="flex items-start gap-3 mb-4">
              <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div className="w-px h-10 bg-slate-200 dark:bg-navy-light" />
                <div className="w-3 h-3 rounded-full border-2 border-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pickup</p>
                  <p className="font-semibold text-navy dark:text-white">{fromAddress}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Delivery</p>
                  <p className="font-semibold text-navy dark:text-white">{toAddress}</p>
                </div>
              </div>
            </div>

            {/* Map */}
            {parcel.originLat && parcel.destinationLat && (
              <OSMMap
                originLat={parcel.originLat}
                originLng={parcel.originLng}
                destinationLat={parcel.destinationLat}
                destinationLng={parcel.destinationLng}
                originLabel={fromAddress}
                destinationLabel={toAddress}
                height="200px"
              />
            )}
          </div>

          {/* Details grid */}
          <div className="card p-4">
            <h3 className="font-semibold text-navy dark:text-white mb-3">Parcel Details</h3>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package size={12} className="text-primary" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Size</p>
                </div>
                <p className="font-bold text-sm text-navy dark:text-white">{sz.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sz.desc}</p>
              </div>
              {parcel.weight && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Weight size={12} className="text-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weight</p>
                  </div>
                  <p className="font-bold text-sm text-navy dark:text-white">{parcel.weight} kg</p>
                </div>
              )}
              {parcel.pickupDate && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar size={12} className="text-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pickup date</p>
                  </div>
                  <p className="font-bold text-sm">
                    <RelativeDate dateStr={parcel.pickupDate} />
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(parcel.pickupDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
              {parcel.declaredValue && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Declared value</p>
                  <p className="font-bold text-sm text-navy dark:text-white">R{parcel.declaredValue.toLocaleString()}</p>
                </div>
              )}
            </div>

            {parcel.description && (
              <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3 mb-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Description</p>
                <p className="text-sm text-navy dark:text-white">{parcel.description}</p>
              </div>
            )}
            {parcel.specialInstructions && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">Special Instructions</p>
                <p className="text-sm text-amber-800 dark:text-amber-300">{parcel.specialInstructions}</p>
              </div>
            )}
          </div>

          {/* Receiver info (visible to carrier or sender) */}
          {(parcel.receiverName || parcel.receiverPhone) && (
            <div className="card p-4">
              <h3 className="font-semibold text-navy dark:text-white mb-3">Receiver</h3>
              <div className="space-y-2">
                {parcel.receiverName && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-navy-secondary flex items-center justify-center shrink-0">
                      <User size={15} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-navy dark:text-white">{parcel.receiverName}</p>
                  </div>
                )}
                {parcel.receiverPhone && (isCarrier || isSender) && (
                  <a href={`tel:${parcel.receiverPhone}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                      <Phone size={15} className="text-success" />
                    </div>
                    <p className="text-sm font-medium text-success">{parcel.receiverPhone}</p>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2.5">
            {canAccept && (
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="btn-primary w-full h-14 text-base font-bold"
              >
                {acceptMutation.isPending
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  : "Accept Delivery — Earn R" + price?.toLocaleString()}
              </button>
            )}
            <button
              onClick={() => navigate(`/parcels/${id}/chat`)}
              className="btn-outline w-full h-12 flex items-center justify-center gap-2 font-semibold"
            >
              <MessageCircle size={18} />
              Message about this parcel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
