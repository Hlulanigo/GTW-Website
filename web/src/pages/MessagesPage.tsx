import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { useRealtimeEvents, usePresence } from "@/lib/realtime";

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.uid],
    queryFn: () => api.get<any[]>(`/api/users/${user?.uid}/conversations`),
    enabled: !!user,
    // 60s safety refetch — realtime keeps us live
    refetchInterval: 60000,
  });

  // Refresh the conversation list whenever a new message comes in for any of our chats
  useRealtimeEvents((evt) => {
    if (evt.type === "message:new") {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.uid] });
    }
  }, [user?.uid]);

  // Track presence of all conversation partners so we can show a green dot
  const partnerIds = conversations
    .map((c: any) => c.otherUserId || c.userId)
    .filter(Boolean) as string[];
  const presence = usePresence(partnerIds);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Messages" />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-20 md:pb-4">
        <div className="p-4 space-y-2 max-w-lg mx-auto">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse flex gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-navy-secondary shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-navy-secondary rounded w-2/3" />
                  <div className="h-3 bg-slate-200 dark:bg-navy-secondary rounded w-1/2" />
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-navy-secondary flex items-center justify-center mb-4">
                <MessageCircle size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-navy dark:text-white">No messages yet</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Messages about your parcels will appear here
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const initials = (conv.userName || "?").charAt(0).toUpperCase();
              const hasUnread = conv.unread;
              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/conversations/${conv.id}`)}
                  className="card w-full p-4 flex items-center gap-3 hover:shadow-lg active:scale-[0.98] transition-all duration-150 text-left"
                >
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${hasUnread ? "bg-primary text-white" : "bg-primary/20 text-primary"}`}>
                      {initials}
                    </div>
                    {(() => {
                      const pid = conv.otherUserId || conv.userId;
                      const isOnline = pid && presence[pid]?.online;
                      return isOnline ? (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-navy-mid" />
                      ) : null;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${hasUnread ? "font-bold text-navy dark:text-white" : "font-semibold text-navy dark:text-white"}`}>
                        {conv.userName || "Unknown"}
                      </p>
                      {conv.lastMessageTime && (
                        <span className="text-xs text-slate-400 shrink-0">
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${hasUnread ? "text-navy dark:text-white font-medium" : "text-slate-500 dark:text-slate-400"}`}>
                      {conv.lastMessage || "Start a conversation"}
                    </p>
                  </div>
                  {hasUnread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
