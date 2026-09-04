import { CreditCard, CheckCircle, Clock, XCircle, AlertCircle, Receipt, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";

interface Payment {
  id: number;
  parcelId: number;
  amount: number;
  totalAmount: number;
  status: "success" | "pending" | "failed" | "cancelled";
  paymentMethod: string;
  reference: string;
  createdAt: string;
}

const statusConfig = {
  success: { label: "Success", icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
  pending: { label: "Pending", icon: Clock, color: "text-warning", bg: "bg-warning/10" },
  failed: { label: "Failed", icon: XCircle, color: "text-error", bg: "bg-error/10" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-slate-400", bg: "bg-slate-100 dark:bg-navy-secondary" },
};

function formatAmount(amount: number) {
  return `R${(amount / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentHistoryPage() {
  const { user } = useAuth();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", user?.uid],
    queryFn: () => api.get<Payment[]>("/api/payments/history"),
    enabled: !!user,
  });

  const totalSpent = payments
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + p.totalAmount, 0);

  const successCount = payments.filter((p) => p.status === "success").length;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Payment History" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-2xl mx-auto">

          {!isLoading && payments.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4 text-center">
                <p className="text-xs text-slate-400 font-medium uppercase mb-1">Total Spent</p>
                <p className="text-xl font-bold text-primary">{formatAmount(totalSpent)}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-xs text-slate-400 font-medium uppercase mb-1">Successful</p>
                <p className="text-xl font-bold text-success">{successCount} payments</p>
              </div>
            </div>
          )}

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-navy dark:text-white">All Payments</h3>
              <span className="text-xs text-slate-400">{payments.length} total</span>
            </div>

            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-5 animate-pulse">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1.5">
                      <div className="h-3.5 bg-slate-200 dark:bg-navy-secondary rounded w-28" />
                      <div className="h-3 bg-slate-200 dark:bg-navy-secondary rounded w-20" />
                    </div>
                    <div className="h-6 bg-slate-200 dark:bg-navy-secondary rounded-full w-20" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-slate-200 dark:bg-navy-secondary rounded w-16" />
                    <div className="h-4 bg-slate-200 dark:bg-navy-secondary rounded w-16" />
                  </div>
                </div>
              ))
            ) : payments.length === 0 ? (
              <div className="py-14 text-center px-4">
                <CreditCard size={36} className="text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-navy dark:text-white">No payments yet</p>
                <p className="text-slate-400 text-sm mt-1">Your payment history will appear here</p>
              </div>
            ) : (
              payments.map((payment) => {
                const cfg = statusConfig[payment.status] || statusConfig.cancelled;
                const StatusIcon = cfg.icon;
                return (
                  <div key={payment.id} className="px-4 py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm text-navy dark:text-white">
                          Parcel #{payment.parcelId}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(payment.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-navy-light mt-1">
                      <div>
                        <p className="text-xs text-slate-400">Amount</p>
                        <p className="text-sm font-semibold text-navy dark:text-white">{formatAmount(payment.amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total (with fee)</p>
                        <p className="text-sm font-bold text-primary">{formatAmount(payment.totalAmount)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={13} className="text-slate-400" />
                        <span className="text-xs text-slate-400 capitalize">
                          {payment.paymentMethod === "paystack" ? "Paystack" : payment.paymentMethod || "Card"}
                        </span>
                      </div>
                      {payment.status === "success" && (
                        <button
                          onClick={() => window.open(`/api/payments/${payment.id}/receipt`, "_blank")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                          <Receipt size={13} />
                          View Receipt
                        </button>
                      )}
                    </div>

                    {payment.reference && (
                      <p className="text-xs text-slate-300 dark:text-navy-lighter mt-1 font-mono truncate">
                        Ref: {payment.reference}
                      </p>
                    )}
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
