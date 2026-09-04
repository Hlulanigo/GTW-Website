import { useState } from "react";
import { Star, TrendingUp, Settings, X, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";

interface Review {
  id: number;
  rating: number;
  comment?: string;
  reviewerName?: string;
  reviewer?: { name: string };
  createdAt: string;
  parcelId?: number;
  reviewType?: string;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={13}
          className={star <= rating ? "text-warning fill-warning" : "text-slate-200 dark:text-navy-secondary"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { user, profile, updateUserProfile } = useAuth();
  const qc = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [visibility, setVisibility] = useState(profile?.reviewsVisibility || "public");
  const [notifications, setNotifications] = useState(profile?.reviewNotifications !== false);
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", user?.uid],
    queryFn: () => api.get<Review[]>(`/api/users/${user?.uid}/reviews`),
    enabled: !!user,
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : profile?.rating ?? 5.0;

  const ratingCounts = [5, 4, 3, 2, 1].map((n) => ({
    stars: n,
    count: reviews.filter((r) => Math.round(r.rating) === n).length,
  }));

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateUserProfile({ reviewsVisibility: visibility, reviewNotifications: notifications });
      toast.success("Review settings saved");
      setShowSettings(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-primary" : "bg-slate-200 dark:bg-navy-secondary"}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? "left-6" : "left-1"}`} />
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Reviews"
        showBack
        right={
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-light transition-colors"
          >
            <Settings size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          {showSettings && (
            <div className="card p-5 space-y-4 border-2 border-primary/20">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-navy dark:text-white">Review Settings</h3>
                <button onClick={() => setShowSettings(false)}>
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Who can see your reviews?</label>
                {(["public", "connections", "private"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl border-2 transition-all capitalize ${
                      visibility === v ? "border-primary bg-primary/5" : "border-slate-200 dark:border-navy-light"
                    }`}
                  >
                    <span className={`text-sm font-medium ${visibility === v ? "text-primary" : "text-navy dark:text-white"}`}>
                      {v === "connections" ? "Connections only" : v.charAt(0).toUpperCase() + v.slice(1)}
                    </span>
                    {visibility === v && <Check size={16} className="text-primary" />}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy dark:text-white">Review Notifications</p>
                  <p className="text-xs text-slate-400">Get notified when someone reviews you</p>
                </div>
                <Toggle value={notifications} onChange={setNotifications} />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-primary w-full py-2.5"
              >
                {savingSettings ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : "Save Settings"}
              </button>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <p className="text-5xl font-bold text-navy dark:text-white">{avgRating.toFixed(1)}</p>
                <div className="flex justify-center mt-1">
                  <StarDisplay rating={Math.round(avgRating)} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {ratingCounts.map(({ stars, count }) => {
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-4 text-right">{stars}</span>
                      <Star size={10} className="text-warning fill-warning shrink-0" />
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-light rounded-full overflow-hidden">
                        <div className="h-full bg-warning rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-5">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-navy dark:text-white">All Reviews</h3>
              <span className="text-xs text-slate-400">{reviews.length} total</span>
            </div>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse space-y-2">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-navy-secondary shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-slate-200 dark:bg-navy-secondary rounded w-1/3" />
                      <div className="h-3 bg-slate-200 dark:bg-navy-secondary rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))
            ) : reviews.length === 0 ? (
              <div className="py-12 text-center px-4">
                <Star size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-navy dark:text-white">No reviews yet</p>
                <p className="text-slate-400 text-sm mt-1">Complete deliveries to receive reviews</p>
              </div>
            ) : (
              reviews.map((review) => {
                const name = review.reviewer?.name || review.reviewerName || "Anonymous";
                const role = review.reviewType === "sender_to_transporter" ? "As Carrier" : "As Sender";
                const roleColor = role === "As Carrier" ? "bg-primary/10 text-primary" : "bg-success/10 text-success";
                return (
                  <div key={review.id} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-sm">{name[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-navy dark:text-white">{name}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColor}`}>
                            {role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StarDisplay rating={review.rating} />
                          <span className="text-xs text-slate-400">
                            {new Date(review.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
