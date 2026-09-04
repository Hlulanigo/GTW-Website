import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Package, Clock, User, MessageCircle, Star, Navigation, Phone, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { OSMMap } from "@/components/OSMMap";

const statusColors: Record<string, string> = {
  Pending: "bg-slate-100 dark:bg-navy-secondary text-slate-500",
  Paid: "bg-info/10 text-info",
  Accepted: "bg-warning/10 text-warning",
  "Picked Up": "bg-primary/10 text-primary",
  "In Transit": "bg-primary/10 text-primary",
  Arrived: "bg-success/10 text-success",
  Delivered: "bg-success/10 text-success",
  Expired: "bg-error/10 text-error",
};

function StarRating({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl transition-colors ${star <= rating ? "text-warning" : "text-slate-200 dark:text-navy-secondary"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function IncomingParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const { data: parcel, isLoading } = useQuery({
    queryKey: ["parcel", id],
    queryFn: () => api.get<any>(`/api/parcels/${id}`),
    enabled: !!id,
  });

  const handleSubmitReview = async () => {
    const carrierId = parcel?.transporterId || parcel?.carrierId;
    if (!carrierId) return;
    setSubmittingReview(true);
    try {
      await api.post("/api/reviews", {
        parcelId: parseInt(id!),
        revieweeId: carrierId,
        rating,
        comment: comment.trim(),
      });
      toast.success("Review submitted!");
      setShowReview(false);
      qc.invalidateQueries({ queryKey: ["parcel", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

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
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Parcel not found</p>
        </div>
      </div>
    );
  }

  const isDelivered = parcel.status === "Delivered" || parcel.status === "Arrived";
  const statusCfg = statusColors[parcel.status] || "bg-slate-100 text-slate-500";

  const fromAddress = parcel.origin || parcel.fromAddress;
  const toAddress = parcel.destination || parcel.toAddress;

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Parcel #${parcel.id}`} showBack />
      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusCfg}`}>
                {parcel.status}
              </span>
              <span className="text-xs text-slate-400">Incoming Parcel</span>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <div className="w-px h-8 bg-slate-200 dark:bg-navy-light" />
                <div className="w-2.5 h-2.5 rounded-full border-2 border-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-medium">From</p>
                  <p className="font-medium text-navy dark:text-white">{fromAddress}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-medium">To</p>
                  <p className="font-medium text-navy dark:text-white">{toAddress}</p>
                </div>
              </div>
            </div>

            <OSMMap
              originLat={parcel.originLat}
              originLng={parcel.originLng}
              destinationLat={parcel.destinationLat}
              destinationLng={parcel.destinationLng}
              originLabel={fromAddress}
              destinationLabel={toAddress}
              height="220px"
              className="mt-3"
            />
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-navy dark:text-white">Parcel Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                <p className="text-xs text-slate-400">Size</p>
                <p className="font-semibold text-navy dark:text-white capitalize">{parcel.size}</p>
              </div>
              {(parcel.compensation ?? parcel.price) && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <p className="text-xs text-slate-400">Value</p>
                  <p className="font-semibold text-primary">R{(parcel.compensation ?? parcel.price)?.toLocaleString()}</p>
                </div>
              )}
              {(parcel.deliveryWindowEnd || parcel.deadline) && (
                <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                  <p className="text-xs text-slate-400">Expected By</p>
                  <p className="font-semibold text-navy dark:text-white">{new Date(parcel.deliveryWindowEnd || parcel.deadline).toLocaleDateString()}</p>
                </div>
              )}
            </div>
            {parcel.description && (
              <div className="bg-slate-50 dark:bg-navy-secondary rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-1">Description</p>
                <p className="text-sm text-navy dark:text-white">{parcel.description}</p>
              </div>
            )}
            {parcel.specialInstructions && (
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-3">
                <p className="text-xs text-warning font-medium mb-1">Special Instructions</p>
                <p className="text-sm text-navy dark:text-white">{parcel.specialInstructions}</p>
              </div>
            )}
          </div>

          {parcel.senderName && (
            <div className="card p-5">
              <h3 className="font-semibold text-navy dark:text-white mb-3">Sender</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold">{parcel.senderName[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-navy dark:text-white">{parcel.senderName}</p>
                  {parcel.senderRating && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star size={11} className="text-warning fill-warning" />
                      <span className="text-xs text-slate-400">{parseFloat(parcel.senderRating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(parcel.transporterId || parcel.carrierId) && (
            <div className="card p-5">
              <h3 className="font-semibold text-navy dark:text-white mb-3">Carrier</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                  <User size={18} className="text-success" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-navy dark:text-white">{parcel.carrierName || "Your Carrier"}</p>
                  <p className="text-xs text-slate-400">Assigned carrier</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(parcel.transporterId || parcel.carrierId) && (
              <button
                onClick={() => navigate(`/parcels/${parcel.id}/chat`)}
                className="btn-outline w-full py-3 flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                Message Carrier
              </button>
            )}

            {isDelivered && !parcel.reviewed && (parcel.transporterId || parcel.carrierId) && (
              <button
                onClick={() => setShowReview(!showReview)}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                <Star size={16} />
                Rate Your Carrier
              </button>
            )}
          </div>

          {showReview && (
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-navy dark:text-white">Rate Your Carrier</h3>
              <div className="flex flex-col items-center gap-2">
                <StarRating rating={rating} onChange={setRating} />
                <p className="text-sm text-slate-400">
                  {rating === 5 ? "Excellent!" : rating === 4 ? "Good" : rating === 3 ? "Average" : rating === 2 ? "Below Average" : "Poor"}
                </p>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience (optional)..."
                rows={3}
                className="input-field resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowReview(false)} className="flex-1 btn-outline py-2.5">Cancel</button>
                <button onClick={handleSubmitReview} disabled={submittingReview} className="flex-1 btn-primary py-2.5">
                  {submittingReview ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : "Submit Review"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
