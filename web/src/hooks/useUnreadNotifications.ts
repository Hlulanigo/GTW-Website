import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadNotificationCount() {
  const { user } = useAuth();

  const { data } = useQuery<{ count: number }>({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api.get("/api/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 20000,
  });

  return data?.count ?? 0;
}
