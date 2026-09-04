import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { ParcelCard } from "@/components/ParcelCard";

export default function IncomingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const { data: incoming = [], isLoading } = useQuery({
    queryKey: ["incoming", user?.uid],
    queryFn: () => api.get<any[]>(`/api/parcels?receiverId=${user?.uid}`),
    enabled: !!user,
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Incoming Parcels" />
      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-20 md:pb-4">
        <div className="p-4 space-y-3 max-w-lg mx-auto">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse h-24" />
            ))
          ) : incoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-navy-secondary flex items-center justify-center mb-4">
                <Package size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-navy dark:text-white">No incoming parcels</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Parcels addressed to you will appear here</p>
            </div>
          ) : (
            incoming.map((p) => (
              <ParcelCard key={p.id} parcel={p} onClick={() => navigate(`/incoming/${p.id}`)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
