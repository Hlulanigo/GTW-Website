import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Search, X, Crosshair, Truck, Navigation, Camera, Cpu } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { queryClient } from "@/lib/queryClient";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useAnalyzeParcelPhoto } from "@/hooks/useAI";

const sizes = [
  { key: "small", label: "Small", desc: "Fits in a bag" },
  { key: "medium", label: "Medium", desc: "Backpack size" },
  { key: "large", label: "Large", desc: "Both hands" },
] as const;

const descriptionChips: Record<string, string[]> = {
  small: ["Documents", "Phone", "Jewellery", "Keys", "Medicine"],
  medium: ["Clothing", "Books", "Shoes", "Electronics", "Food"],
  large: ["Furniture", "Appliance", "Bicycle Parts", "Tools", "Sports Gear"],
};

interface UserResult { id: string; name: string; email: string; }

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
  return {
    isSameDay,
    pickupDate: today,
    deliveryDate,
    badge: isSameDay ? "SAME-DAY SERVICE" : "NEXT MORNING SERVICE",
    pickupLabel: isSameDay ? "PICKUP NOW" : "PICKUP TONIGHT",
    deliveryLabel: isSameDay ? "DELIVERED TODAY" : "DELIVERED TOMORROW MORNING",
    pickupSub: isSameDay ? "Within the hour" : "Before end of day",
    deliverySub: isSameDay ? "Same day · by evening" : "Tomorrow · by 9 AM",
    deliveryDeadlineHour: isSameDay ? 20 : 9,
  };
}

export default function CreateParcelPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const deliverySlot = useMemo(() => getDeliverySlot(), []);

  const [origin, setOrigin] = useState("");
  const [originLat, setOriginLat] = useState<number | undefined>();
  const [originLng, setOriginLng] = useState<number | undefined>();
  const [destination, setDestination] = useState("");
  const [destinationLat, setDestinationLat] = useState<number | undefined>();
  const [destinationLng, setDestinationLng] = useState<number | undefined>();
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [compensation, setCompensation] = useState("");
  const [compensationAutoSet, setCompensationAutoSet] = useState(false);
  const [description, setDescription] = useState("");
  const [receiverSearch, setReceiverSearch] = useState("");
  const [selectedReceiver, setSelectedReceiver] = useState<UserResult | null>(null);
  const [error, setError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [isFragile, setIsFragile] = useState(false);
  const analyzePhotoMut = useAnalyzeParcelPhoto();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") setPhotoDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAutoFillFromPhoto = async () => {
    if (!photoDataUrl) return;
    try {
      const details = await analyzePhotoMut.mutateAsync(photoDataUrl);
      setSize(details.size);
      setWeight(String(details.weight));
      setIsFragile(details.isFragile);
      if (details.description) setDescription(details.description);
    } catch (e: any) {
      setError(e?.message || "AI unavailable");
    }
  };

  const distanceKm = useMemo(() => {
    if (originLat == null || originLng == null || destinationLat == null || destinationLng == null) return null;
    return haversineKm(originLat, originLng, destinationLat, destinationLng);
  }, [originLat, originLng, destinationLat, destinationLng]);

  useEffect(() => {
    if (distanceKm == null) return;
    const sizeMultiplier = size === "small" ? 1 : size === "medium" ? 1.5 : 2.2;
    const suggested = Math.round((30 + distanceKm * 1.2) * sizeMultiplier);
    setCompensation(suggested.toString());
    setCompensationAutoSet(true);
  }, [distanceKm, size]);

  const detectLocation = async () => {
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

  const { data: users = [], isFetching: searchLoading } = useQuery({
    queryKey: ["users-search", receiverSearch],
    queryFn: () => api.get<UserResult[]>(`/api/users/search?q=${encodeURIComponent(receiverSearch)}`),
    enabled: receiverSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/parcels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcels"] });
      navigate("/my-parcels");
    },
    onError: (err: any) => setError(err.message || "Failed to create parcel"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !compensation) {
      setError("Please fill in all required fields"); return;
    }
    setError("");
    const deliveryEnd = new Date(deliverySlot.deliveryDate);
    deliveryEnd.setHours(deliverySlot.deliveryDeadlineHour, 0, 0, 0);
    createMutation.mutate({
      senderId: user?.uid,
      origin,
      originLat: originLat ?? null,
      originLng: originLng ?? null,
      destination,
      destinationLat: destinationLat ?? null,
      destinationLng: destinationLng ?? null,
      size,
      compensation: parseFloat(compensation),
      description: description || null,
      pickupDate: deliverySlot.pickupDate.toISOString(),
      deliveryWindowStart: deliverySlot.deliveryDate.toISOString(),
      deliveryWindowEnd: deliveryEnd.toISOString(),
      receiverId: selectedReceiver?.id || null,
      receiverEmail: selectedReceiver?.email || null,
      weight: weight ? parseFloat(weight) : null,
      isFragile,
      photoUrl: photoDataUrl,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Create Parcel" showBack />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-6">
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg mx-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-500 text-sm">{error}</div>
          )}

          {/* Route */}
          <div className="card p-4 space-y-4">
            <h2 className="font-semibold text-navy dark:text-white text-sm uppercase tracking-wide">Route</h2>

            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-3.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <div className="w-px h-10 bg-slate-200 dark:bg-navy-light" />
                <div className="w-2.5 h-2.5 rounded-full border-2 border-primary" />
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Pickup Address *
                  </label>
                  <div className="relative">
                    <AddressAutocomplete
                      value={origin}
                      onChange={(val, lat, lng) => { setOrigin(val); setOriginLat(lat); setOriginLng(lng); }}
                      placeholder="Where to pick up"
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
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Delivery Address *
                  </label>
                  <AddressAutocomplete
                    value={destination}
                    onChange={(val, lat, lng) => { setDestination(val); setDestinationLat(lat); setDestinationLng(lng); }}
                    placeholder="Where to deliver"
                  />
                </div>
              </div>
            </div>

            {distanceKm != null && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 border border-primary/20 rounded-full px-3 py-1.5 w-fit">
                <Navigation size={12} />
                ~{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`} between locations
              </div>
            )}
          </div>

          {/* Express Service Card */}
          <div className="card p-4 border-2 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full">
                <Zap size={11} />
                {deliverySlot.badge}
              </div>
              <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                <Truck size={12} />
                Cars on the move
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{deliverySlot.pickupLabel}</p>
                <p className="font-semibold text-sm text-navy dark:text-white">
                  {deliverySlot.pickupDate.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="text-[10px] font-bold text-primary">{deliverySlot.pickupSub}</p>
              </div>
              <div className="flex items-center gap-1 text-primary/50">
                <div className="w-6 h-px bg-primary/30" />
                <div className="w-2 h-2 border-t-2 border-r-2 border-primary/50 rotate-45 -ml-1" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{deliverySlot.deliveryLabel}</p>
                <p className="font-semibold text-sm text-navy dark:text-white">
                  {deliverySlot.deliveryDate.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className={`text-[10px] font-bold ${deliverySlot.isSameDay ? "text-green-500" : "text-orange-500"}`}>
                  {deliverySlot.deliverySub}
                </p>
              </div>
            </div>
          </div>

          {/* Parcel Details */}
          <div className="card p-4 space-y-4">
            <h2 className="font-semibold text-navy dark:text-white text-sm uppercase tracking-wide">Parcel Details</h2>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                Photo (optional)
              </label>
              {photoDataUrl ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-navy-light mb-2">
                  <img src={photoDataUrl} alt="Parcel" className="w-full h-40 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-light cursor-pointer hover:border-primary hover:bg-primary/5 transition-all mb-2">
                  <Camera size={24} className="text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Add a photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              )}
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={handleAutoFillFromPhoto}
                  disabled={analyzePhotoMut.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 border-primary bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-60"
                >
                  {analyzePhotoMut.isPending ? (
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Cpu size={14} />
                  )}
                  {analyzePhotoMut.isPending ? "Analyzing..." : "Auto-fill from photo"}
                </button>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">Size *</label>
              <div className="flex gap-2">
                {sizes.map((s) => (
                  <button type="button" key={s.key} onClick={() => setSize(s.key)}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-semibold transition-all border-2 flex flex-col items-center
                      ${size === s.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 dark:border-navy-light text-slate-500 dark:text-slate-400"}`}>
                    {s.label}
                    <span className="text-[10px] font-normal mt-0.5 opacity-70">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Compensation (R) *
                </label>
                {compensationAutoSet && distanceKm != null && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <Zap size={9} /> Auto-suggested
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R</span>
                <input
                  type="number"
                  value={compensation}
                  onChange={(e) => { setCompensation(e.target.value); setCompensationAutoSet(false); }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="input-field pl-8"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                Description
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {descriptionChips[size].map((chip) => (
                  <button
                    type="button"
                    key={chip}
                    onClick={() => setDescription(chip)}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                      description === chip
                        ? "bg-primary border-primary text-white"
                        : "border-slate-200 dark:border-navy-light text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's in the parcel?"
                className="input-field resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                  Fragile
                </label>
                <button
                  type="button"
                  onClick={() => setIsFragile((v) => !v)}
                  className={`w-full h-[42px] rounded-xl border-2 text-sm font-semibold transition-all ${
                    isFragile
                      ? "border-warning bg-warning/10 text-warning"
                      : "border-slate-200 dark:border-navy-light text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {isFragile ? "Yes — handle with care" : "No"}
                </button>
              </div>
            </div>
          </div>

          {/* Receiver */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-navy dark:text-white text-sm uppercase tracking-wide">Receiver (Optional)</h2>
            {selectedReceiver ? (
              <div className="flex items-center gap-3 bg-primary/10 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">{selectedReceiver.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-navy dark:text-white">{selectedReceiver.name}</p>
                  <p className="text-xs text-slate-500">{selectedReceiver.email}</p>
                </div>
                <button type="button" onClick={() => { setSelectedReceiver(null); setReceiverSearch(""); }} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={receiverSearch}
                  onChange={(e) => setReceiverSearch(e.target.value)}
                  placeholder="Search by name or email"
                  className="input-field pl-10"
                />
              </div>
            )}
            {!selectedReceiver && receiverSearch.length >= 2 && (
              <div className="space-y-1">
                {searchLoading ? (
                  <p className="text-sm text-slate-400 text-center py-2">Searching...</p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2">No users found</p>
                ) : (
                  users.map((u) => (
                    <button type="button" key={u.id}
                      onClick={() => { setSelectedReceiver(u); setReceiverSearch(""); }}
                      className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-light transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-secondary flex items-center justify-center shrink-0">
                        <span className="font-bold text-sm text-slate-500">{u.name[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-navy dark:text-white">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full h-14 text-base font-semibold">
            {createMutation.isPending
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              : "Create Parcel"}
          </button>
        </form>
      </div>
    </div>
  );
}
