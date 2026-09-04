import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Truck, Star, CheckCircle, UserMinus, UserPlus, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";

type TabType = "carriers" | "contacts";

export default function ConnectionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("carriers");

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections", user?.uid],
    queryFn: () => api.get<any[]>(`/api/users/${user?.uid}/connections`),
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: (connectedUserId: string) =>
      api.delete(`/api/users/${user?.uid}/connections/${connectedUserId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      toast.success("Connection removed");
    },
    onError: (err: any) => toast.error(err.message || "Failed to remove connection"),
  });

  const handleRemove = (userId: string, name: string) => {
    if (confirm(`Remove ${name} from your ${activeTab === "carriers" ? "trusted carriers" : "saved contacts"}?`)) {
      removeMutation.mutate(userId);
    }
  };

  const trustedCarriers = connections.filter((c: any) => c.type === "carrier" || !c.type);
  const savedContacts = connections.filter((c: any) => c.type === "contact");
  const displayed = activeTab === "carriers" ? trustedCarriers : savedContacts;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Connections" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          <div className="flex gap-1 p-1 bg-white dark:bg-navy-mid rounded-xl shadow-sm">
            {([
              { id: "carriers" as TabType, label: "Trusted Carriers", icon: Truck },
              { id: "contacts" as TabType, label: "Saved Contacts", icon: Users },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === id
                    ? "bg-primary text-white shadow-orange"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="card p-4 flex items-start gap-3 bg-primary/5 border border-primary/20">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              {activeTab === "carriers" ? <Truck size={14} className="text-primary" /> : <Users size={14} className="text-primary" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-navy dark:text-white">
                {activeTab === "carriers" ? "Trusted Carriers" : "Saved Contacts"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {activeTab === "carriers"
                  ? "Carriers you've worked with and trust. You can request them directly for your parcels."
                  : "Saved contacts you frequently send parcels to. They're suggested when creating new parcels."}
              </p>
            </div>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-navy dark:text-white text-sm">
                {activeTab === "carriers" ? "Trusted Carriers" : "Saved Contacts"}
              </h3>
              <span className="text-xs text-slate-400">{displayed.length} total</span>
            </div>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-4 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-secondary shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-200 dark:bg-navy-secondary rounded w-1/2" />
                    <div className="h-3 bg-slate-200 dark:bg-navy-secondary rounded w-1/3" />
                  </div>
                </div>
              ))
            ) : displayed.length === 0 ? (
              <div className="py-12 text-center px-4">
                <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-navy-secondary flex items-center justify-center mx-auto mb-3">
                  {activeTab === "carriers"
                    ? <Truck size={28} className="text-slate-400" />
                    : <Users size={28} className="text-slate-400" />
                  }
                </div>
                <p className="font-semibold text-navy dark:text-white">
                  {activeTab === "carriers" ? "No trusted carriers yet" : "No saved contacts yet"}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {activeTab === "carriers"
                    ? "After a successful delivery, you can save that carrier"
                    : "Add contacts when creating a parcel"}
                </p>
              </div>
            ) : (
              displayed.map((conn: any) => {
                const person = conn.connectedUser || conn;
                const name = person.name || person.connectedUser?.name || "Unknown";
                const rating = person.rating || person.connectedUser?.rating;
                const verified = person.verified || person.connectedUser?.verified;
                const connectedUserId = conn.connectedUserId || conn.id;
                return (
                  <div key={conn.id || conn.connectedUserId} className="px-4 py-4 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-base">{name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-navy dark:text-white truncate">{name}</p>
                        {verified && (
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <CheckCircle size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                      {rating != null && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star size={11} className="text-warning fill-warning" />
                          <span className="text-xs text-slate-400">{parseFloat(rating).toFixed(1)}</span>
                        </div>
                      )}
                      {conn.note && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{conn.note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(connectedUserId, name)}
                      disabled={removeMutation.isPending}
                      className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center hover:bg-error/20 transition-colors shrink-0"
                    >
                      <UserMinus size={16} className="text-error" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="card p-4 space-y-2 bg-slate-50 dark:bg-navy-mid">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">How to add connections</p>
            <div className="space-y-2">
              {[
                "Complete a delivery successfully",
                "Open the parcel detail page",
                "Tap 'Save as Trusted Carrier' or 'Save Contact'",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <p className="text-sm text-navy dark:text-white">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
