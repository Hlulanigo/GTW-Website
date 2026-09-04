import { useState } from "react";
import { Check, Star, Zap, Building2, Crown, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";

const PLANS = [
  {
    id: "free",
    name: "Free",
    icon: Star,
    monthlyPrice: 0,
    color: "text-slate-500",
    bg: "bg-slate-100 dark:bg-navy-secondary",
    border: "border-slate-200 dark:border-navy-light",
    features: [
      "Post up to 5 parcels/month",
      "Limited route visibility",
      "Basic support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    icon: Zap,
    monthlyPrice: 9.99,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary",
    popular: true,
    features: [
      "Post up to 50 parcels/month",
      "Full route visibility",
      "Priority matching",
      "Email support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    icon: Crown,
    monthlyPrice: 29.99,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    features: [
      "Unlimited parcels",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
      "API access",
    ],
  },
  {
    id: "business",
    name: "Business",
    icon: Building2,
    monthlyPrice: 99.99,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    features: [
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations",
      "White-label options",
      "SLA guarantee",
    ],
  },
];

export default function SubscriptionsPage() {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [processing, setProcessing] = useState<string | null>(null);

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get<any>("/api/subscription"),
  });

  const currentPlan = profile?.subscriptionStatus || "free";

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) return;
    if (planId === "free") {
      if (!confirm("Are you sure you want to cancel your subscription and downgrade to Free?")) return;
      setProcessing(planId);
      try {
        await api.post("/api/subscription/cancel", {});
        await refreshProfile();
        qc.invalidateQueries({ queryKey: ["subscription"] });
        toast.success("Subscription cancelled. You've been moved to the Free plan.");
      } catch (err: any) {
        toast.error(err.message || "Failed to cancel subscription");
      } finally {
        setProcessing(null);
      }
      return;
    }
    setProcessing(planId);
    try {
      await api.post("/api/subscription/upgrade", { planId, billingCycle: billing });
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["subscription"] });
      toast.success(`Upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upgrade subscription");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Subscription" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          <div className="card p-5 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase">Current Plan</p>
            <p className="text-2xl font-bold text-navy dark:text-white capitalize">{currentPlan}</p>
            {currentPlan !== "free" && (
              <p className="text-xs text-slate-400">
                Renews {subscription?.renewsAt ? new Date(subscription.renewsAt).toLocaleDateString() : "monthly"}
              </p>
            )}
          </div>

          <div className="flex gap-1 p-1 bg-white dark:bg-navy-mid rounded-xl shadow-sm">
            {(["monthly", "yearly"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                  billing === b ? "bg-primary text-white shadow-orange" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {b}
                {b === "yearly" && <span className="ml-1 text-xs opacity-80">save 17%</span>}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isCurrent = currentPlan === plan.id;
              const price = billing === "yearly" ? (plan.monthlyPrice * 10).toFixed(2) : plan.monthlyPrice.toFixed(2);
              const isProcessingThis = processing === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`card p-5 border-2 transition-all relative ${
                    isCurrent ? `${plan.border} shadow-md` : "border-slate-200 dark:border-navy-light"
                  }`}
                >
                  {plan.popular && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-success text-white text-xs font-bold px-3 py-1 rounded-full">
                      Current Plan
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl ${plan.bg} flex items-center justify-center`}>
                        <Icon size={18} className={plan.color} />
                      </div>
                      <div>
                        <p className="font-bold text-navy dark:text-white">{plan.name}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-navy dark:text-white">
                            {plan.monthlyPrice === 0 ? "Free" : `R${price}`}
                          </span>
                          {plan.monthlyPrice > 0 && (
                            <span className="text-xs text-slate-400">
                              /{billing === "yearly" ? "year" : "month"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${plan.bg} flex items-center justify-center shrink-0`}>
                          <Check size={10} className={plan.color} />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent || isProcessingThis}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isCurrent
                        ? "bg-slate-100 dark:bg-navy-secondary text-slate-400 cursor-default"
                        : plan.id === "free"
                        ? "border-2 border-error text-error hover:bg-error/5"
                        : "bg-primary text-white shadow-orange hover:opacity-90"
                    }`}
                  >
                    {isProcessingThis ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                    ) : isCurrent ? "Current Plan" : plan.id === "free" ? "Downgrade to Free" : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-400 leading-relaxed px-4">
            Subscriptions are billed in South African Rand (ZAR). Cancel anytime from this page.
          </p>
        </div>
      </div>
    </div>
  );
}
