import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Zap, Truck, Crosshair, Navigation, Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

type Frequency = "one_time" | "daily" | "weekly" | "monthly";
type MaxParcelSize = "small" | "medium" | "large";

const frequencies: { value: Frequency; label: string; desc: string }[] = [
  { value: "one_time", label: "One-time", desc: "Single trip" },
  { value: "daily", label: "Daily", desc: "Every day" },
  { value: "weekly", label: "Weekly", desc: "Once a week" },
  { value: "monthly", label: "Monthly", desc: "Once a month" },
];

const parcelSizes: { value: MaxParcelSize; label: string; desc: string }[] = [
  { value: "small", label: "Small", desc: "Envelopes, docs" },
  { value: "medium", label: "Medium", desc: "Shoe box size" },
  { value: "large", label: "Large", desc: "Moving box size" },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDeliverySlot() {
  const now = new Date();
  const hour = now.getHours();
  const isSameDay = hour < 15;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const deliveryDate = new Date(today);
  if (!isSameDay) deliveryDate.setDate(deliveryDate.getDate() + 1);
  const departureTime = isSameDay ? "09:00" : "18:00";
  return {
    isSameDay,
    today,
    deliveryDate,
    departureTime,
    badge: isSameDay ? "SAME-DAY SERVICE" : "NEXT MORNING SERVICE",
    departureLabel: isSameDay ? "DEPART TODAY" : "DEPART TONIGHT",
    arrivalLabel: isSameDay ? "ARRIVE TODAY" : "ARRIVE TOMORROW",
    departureSub: isSameDay ? "This morning onwards" : "Evening pickup window",
    arrivalSub: isSameDay ? "Same day · by evening" : "Tomorrow · by 9 AM",
    departureDisplay: today,
    arrivalDisplay: deliveryDate,
  };
}

export default function CreateRoutePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const slot = useMemo(() => getDeliverySlot(), []);

  const [origin, setOrigin] = useState("");
  const [originLat, setOriginLat] = useState<number | undefined>();
  const [originLng, setOriginLng] = useState<number | undefined>();
  const [destination, setDestination] = useState("");
  const [destinationLat, setDestinationLat] = useState<number | undefined>();
  const [destinationLng, setDestinationLng] = useState<number | undefined>();
  const [frequency, setFrequency] = useState<Frequency>("one_time");
  const [maxParcelSize, setMaxParcelSize] = useState<MaxParcelSize>("medium");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  const distanceKm = useMemo(() => {
    if (originLat == null || originLng == null || destinationLat == null || destinationLng == null) return null;
    return haversineKm(originLat, originLng, destinationLat, destinationLng);
  }, [originLat, originLng, destinationLat, destinationLng]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`,
            { headers: { "User-Agent": "ParcelPeer/1.0" } }
          );
          const data = await res.json();
          if (data?.display_name) {
            const shortName =
              data.name || data.address?.city || data.address?.town ||
              data.address?.village || data.address?.suburb || data.display_name.split(",")[0];
            setOrigin(shortName);
            setOriginLat(pos.coords.latitude);
            setOriginLng(pos.coords.longitude);
          }
        } catch {}
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/routes", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route created successfully!");
      navigate("/routes");
    },
    onError: (err: any) => setError(err.message || "Failed to create route"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim()) { setError("Please enter a departure location"); return; }
    if (!destination.trim()) { setError("Please enter a destination location"); return; }
    setError("");
    const departureDateTime = new Date(slot.today);
    const [h, m] = slot.departureTime.split(":").map(Number);
    departureDateTime.setHours(h, m, 0, 0);
    createMutation.mutate({
      carrierId: user?.uid,
      origin: origin.trim(),
      originLat: originLat ?? null,
      originLng: originLng ?? null,
      destination: destination.trim(),
      destinationLat: destinationLat ?? null,
      destinationLng: destinationLng ?? null,
      departureDate: departureDateTime.toISOString(),
      departureTime: slot.departureTime,
      frequency,
      maxParcelSize,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Add Route" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg mx-auto">

          {/* Route */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-navy dark:text-white text-sm uppercase tracking-wide">Route</h3>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-3.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <div className="w-px h-10 bg-slate-200 dark:bg-navy-light" />
                <div className="w-2.5 h-2.5 rounded-full border-2 border-primary" />
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium uppercase">From *</label>
                  <div className="relative">
                    <AddressAutocomplete
                      value={origin}
                      onChange={(val, lat, lng) => { setOrigin(val); setOriginLat(lat); setOriginLng(lng); }}
                      placeholder="Departure location"
                    />
                    {!origin && (
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={isLocating}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-full transition-colors"
                      >
                        {isLocating
                          ? <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
                          : <Crosshair size={11} />}
                        {isLocating ? "Locating…" : "Use my location"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium uppercase">To *</label>
                  <AddressAutocomplete
                    value={destination}
                    onChange={(val, lat, lng) => { setDestination(val); setDestinationLat(lat); setDestinationLng(lng); }}
                    placeholder="Destination location"
                  />
                </div>
              </div>
            </div>

            {distanceKm != null && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 border border-primary/20 rounded-full px-3 py-1.5 w-fit">
                <Navigation size={12} />
                ~{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`} trip
              </div>
            )}
          </div>

          {/* Express Service Card */}
          <div className="card p-4 border-2 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full">
                <Zap size={11} />
                {slot.badge}
              </div>
              <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                <Truck size={12} />
                Express delivery
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{slot.departureLabel}</p>
                <p className="font-semibold text-sm text-navy dark:text-white">
                  {slot.departureDisplay.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="text-[10px] font-bold text-primary">{slot.departureSub}</p>
              </div>
              <div className="flex items-center gap-1 text-primary/50">
                <div className="w-6 h-px bg-primary/30" />
                <div className="w-2 h-2 border-t-2 border-r-2 border-primary/50 rotate-45 -ml-1" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{slot.arrivalLabel}</p>
                <p className="font-semibold text-sm text-navy dark:text-white">
                  {slot.arrivalDisplay.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className={`text-[10px] font-bold ${slot.isSameDay ? "text-green-500" : "text-orange-500"}`}>
                  {slot.arrivalSub}
                </p>
              </div>
            </div>
          </div>

          {/* Frequency */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              <h3 className="font-semibold text-navy dark:text-white">How often?</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {frequencies.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFrequency(value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    frequency === value
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-navy-light"
                  }`}
                >
                  <p className={`text-sm font-semibold ${frequency === value ? "text-primary" : "text-navy dark:text-white"}`}>{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              <h3 className="font-semibold text-navy dark:text-white">Parcel Capacity</h3>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase block mb-2">Max Parcel Size</label>
              <div className="grid grid-cols-3 gap-2">
                {parcelSizes.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMaxParcelSize(value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      maxParcelSize === value
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 dark:border-navy-light"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${maxParcelSize === value ? "text-primary" : "text-navy dark:text-white"}`}>{label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium uppercase block mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra info for senders..."
                rows={2}
                className="input-field resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full h-14 text-base font-semibold">
            {createMutation.isPending
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              : "Create Route"}
          </button>
        </form>
      </div>
    </div>
  );
}
