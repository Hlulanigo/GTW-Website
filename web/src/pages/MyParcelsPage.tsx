import { useNavigate } from "react-router-dom";
import { Package, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { ParcelCard } from "@/components/ParcelCard";
import { useState } from "react";

const statuses = ["All", "Pending", "Paid", "Accepted", "In Transit", "Delivered"];

export default function MyParcelsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("All");

  const { data: parcels = [], isLoading, refetch } = useQuery({
    queryKey: ["my-parcels", user?.uid],
    queryFn: () => api.get<any[]>(`/api/parcels?senderId=${user?.uid}`),
    enabled: !!user,
  });

  const filtered = statusFilter === "All" ? parcels : parcels.filter((p) => p.status === statusFilter);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="My Parcels" />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-20 md:pb-4">
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150
                  ${statusFilter === s
                    ? "bg-primary text-white shadow-orange"
                    : "bg-white dark:bg-navy-mid text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-light"
                  }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-navy-secondary rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-200 dark:bg-navy-secondary rounded w-1/2" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-navy-secondary flex items-center justify-center mb-4">
                <Package size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-navy dark:text-white">No parcels yet</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Tap + to create your first parcel</p>
              <button onClick={() => navigate("/create-parcel")} className="btn-primary mt-4 px-6 py-2.5 text-sm">
                Create Parcel
              </button>
            </div>
          ) : (
            filtered.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} onClick={() => navigate(`/parcels/${parcel.id}`)} />
            ))
          )}
        </div>
      </div>

      <button onClick={() => navigate("/create-parcel")}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-orange z-50 active:scale-95 transition-all">
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}
