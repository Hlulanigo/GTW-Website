import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, Package, Truck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { useRealtimeEvents, usePresence } from "@/lib/realtime";

function formatLastSeen(ts: number | null): string {
  if (!ts) return "Offline";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "Active just now";
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs}h ago`;
  return `Last seen ${Math.floor(hrs / 24)}d ago`;
}

interface NormalizedMessage {
  id: number | string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  parcelId?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  otherUserId?: string;
  otherUserName?: string;
}

export default function ConversationPage() {
  const { id, parcelId } = useParams<{ id?: string; parcelId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isParcelChat = !!parcelId;
  const convId = id;

  const messagesQueryKey = isParcelChat ? ["parcel-messages", parcelId] : ["messages", convId];
  const { data: rawMessages = [], isLoading } = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () =>
      isParcelChat
        ? api.get<any[]>(`/api/parcels/${parcelId}/messages`)
        : api.get<any[]>(`/api/conversations/${convId}/messages`),
    enabled: !!(parcelId || convId),
    // 30s safety refetch only — realtime handles instant updates
    refetchInterval: 30000,
  });

  // Realtime: append new messages instantly
  useRealtimeEvents((evt) => {
    if (evt.type === "message:new") {
      if (isParcelChat && evt.parcelId === parcelId) {
        queryClient.setQueryData<any[]>(messagesQueryKey, (prev = []) => {
          if (prev.some((m) => m.id === evt.message.id)) return prev;
          return [...prev, evt.message];
        });
      } else if (!isParcelChat) {
        queryClient.invalidateQueries({ queryKey: messagesQueryKey });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    }
    if (evt.type === "parcel:status" && parcelId && evt.parcelId === parcelId) {
      queryClient.invalidateQueries({ queryKey: ["parcel", parcelId] });
    }
  }, [parcelId, convId, isParcelChat]);

  const messages: NormalizedMessage[] = rawMessages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    text: m.content ?? m.text ?? "",
    createdAt: m.createdAt,
  }));

  const { data: conv } = useQuery({
    queryKey: ["conversation", convId],
    queryFn: () => api.get<Conversation>(`/api/conversations/${convId}`),
    enabled: !!convId && !isParcelChat,
  });

  const { data: parcel } = useQuery({
    queryKey: ["parcel", parcelId],
    queryFn: () => api.get<any>(`/api/parcels/${parcelId}`),
    enabled: isParcelChat && !!parcelId,
  });

  const senderRole = isParcelChat && parcel
    ? parcel.transporterId === user?.uid
      ? "carrier"
      : parcel.receiverId === user?.uid
        ? "receiver"
        : parcel.senderId === user?.uid
          ? "sender"
          : "sender"
    : "sender";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (msgText: string) =>
      isParcelChat
        ? api.post(`/api/parcels/${parcelId}/messages`, { content: msgText, senderRole })
        : api.post(`/api/conversations/${convId}/messages`, { text: msgText }),
    onSuccess: () => {
      if (isParcelChat) {
        queryClient.invalidateQueries({ queryKey: ["parcel-messages", parcelId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["messages", convId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
      setText("");
    },
  });

  const handleSend = () => {
    if (!text.trim() || sendMutation.isPending) return;
    sendMutation.mutate(text.trim());
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const titleText = isParcelChat
    ? parcel
      ? `${parcel.origin} → ${parcel.destination}`
      : "Parcel Chat"
    : conv?.otherUserName || "Chat";

  const targetParcelId = isParcelChat ? parcelId : conv?.parcelId;

  // Presence: show online status of the "other" main party
  const otherUserId: string | null = isParcelChat && parcel
    ? (senderRole === "carrier" ? parcel.senderId : (parcel.transporterId || parcel.senderId))
    : (conv?.otherUserId ?? null);
  const presence = usePresence([otherUserId]);
  const otherPresence = otherUserId ? presence[otherUserId] : null;
  const isOnline = otherPresence?.online ?? false;
  const onTheMove = parcel?.status === "Picked Up" || parcel?.status === "In Transit";

  const subtitle = (
    <div className="flex items-center gap-2 text-xs">
      {otherUserId && (
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-slate-400"}`} />
          {isOnline ? "Online" : formatLastSeen(otherPresence?.lastSeen ?? null)}
        </span>
      )}
      {onTheMove && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-semibold">
          <Truck size={11} /> On the move
        </span>
      )}
    </div>
  );

  let lastDate = "";

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={titleText}
        subtitle={subtitle as any}
        showBack
        right={
          targetParcelId ? (
            <button
              onClick={() => navigate(`/parcels/${targetParcelId}`)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Package size={14} />
              <span className="hidden sm:inline">View Parcel</span>
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy px-4 py-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-navy-light flex items-center justify-center mb-4">
              <Package size={28} className="text-slate-400" />
            </div>
            <p className="font-semibold text-navy dark:text-white">No messages yet</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Send a message to get started</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            const msgDate = formatDate(msg.createdAt);
            const showDate = msgDate !== lastDate;
            lastDate = msgDate;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center justify-center py-3">
                    <span className="text-xs text-slate-400 bg-slate-200 dark:bg-navy-light px-3 py-1 rounded-full">
                      {msgDate}
                    </span>
                  </div>
                )}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-2`}>
                  {!isMe && msg.senderName && (
                    <p className="text-xs text-slate-400 mb-1 ml-1">{msg.senderName}</p>
                  )}
                  <div
                    className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                      isMe
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-white dark:bg-navy-mid text-navy dark:text-white rounded-bl-sm shadow-sm"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-slate-400"} text-right`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white dark:bg-navy-mid border-t border-slate-200 dark:border-navy-light p-3 safe-bottom">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-slate-100 dark:bg-navy-light text-navy dark:text-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-32 overflow-y-auto leading-5"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="w-11 h-11 bg-primary rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-all shadow-orange"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
