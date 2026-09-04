import { useState } from "react";
import { Bell, Package, MessageCircle, MapPin, CheckCircle, XCircle, Truck, Star, AlertCircle, Check, CheckCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: string | null;
  isRead: boolean;
  createdAt: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "new_message":
      return { Icon: MessageCircle, bg: "bg-blue-500/10", color: "text-blue-500" };
    case "parcel_accepted":
    case "new_incoming_parcel":
      return { Icon: Package, bg: "bg-primary/10", color: "text-primary" };
    case "parcel_status_change":
    case "confirm_delivery":
      return { Icon: Truck, bg: "bg-purple-500/10", color: "text-purple-500" };
    case "carrier_nearby":
      return { Icon: MapPin, bg: "bg-amber-500/10", color: "text-amber-500" };
    case "route_booking_request":
      return { Icon: AlertCircle, bg: "bg-blue-500/10", color: "text-blue-500" };
    case "route_booking_approved":
      return { Icon: CheckCircle, bg: "bg-success/10", color: "text-success" };
    case "route_booking_declined":
      return { Icon: XCircle, bg: "bg-error/10", color: "text-error" };
    case "new_review":
      return { Icon: Star, bg: "bg-amber-500/10", color: "text-amber-500" };
    default:
      return { Icon: Bell, bg: "bg-slate-100 dark:bg-navy-light", color: "text-slate-500 dark:text-slate-400" };
  }
}

function getNotificationLink(notification: Notification): string | null {
  try {
    const data = notification.data ? JSON.parse(notification.data) : {};
    if (data.parcelId) return `/parcels/${data.parcelId}`;
    if (data.conversationId) return `/conversations/${data.conversationId}`;
    if (data.routeId) return `/routes/${data.routeId}`;
  } catch {}
  return null;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications", filter],
    queryFn: () => api.get(`/api/notifications?limit=50${filter === "unread" ? "&unread=true" : ""}`),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/api/notifications/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    const link = getNotificationLink(notification);
    if (link) navigate(link);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy pb-20 md:pb-0">
      <TopBar
        title="Notifications"
        subtitle={
          unreadCount > 0 ? (
            <span className="text-xs text-slate-400">{unreadCount} unread</span>
          ) : null
        }
        right={
          unreadCount > 0 ? (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          ) : undefined
        }
      />

      {/* Filter tabs */}
      <div className="sticky top-14 z-30 bg-white dark:bg-navy-mid border-b border-slate-200 dark:border-navy-light">
        <div className="flex px-4 gap-4">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                filter === f
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {f === "unread" && unreadCount > 0 ? `Unread (${unreadCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col gap-0 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-4 border-b border-slate-100 dark:border-navy-light/50 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-light shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-navy-light rounded w-2/3" />
                  <div className="h-3 bg-slate-100 dark:bg-navy-light/70 rounded w-full" />
                  <div className="h-2.5 bg-slate-100 dark:bg-navy-light/50 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-navy-light flex items-center justify-center mb-4">
              <Bell size={28} className="text-slate-400" />
            </div>
            <p className="font-semibold text-navy dark:text-white">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              {filter === "unread"
                ? "You're all caught up!"
                : "You'll be notified about your parcels, messages, and deliveries here."}
            </p>
            {filter === "unread" && (
              <button
                onClick={() => setFilter("all")}
                className="mt-4 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-mid mt-2 rounded-2xl overflow-hidden shadow-sm">
            {notifications.map((notification, i) => {
              const { Icon, bg, color } = getNotificationIcon(notification.type);
              const hasLink = !!getNotificationLink(notification);
              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  disabled={!hasLink && notification.isRead}
                  className={`w-full flex items-start gap-3 px-4 py-4 text-left transition-colors
                    ${i > 0 ? "border-t border-slate-100 dark:border-navy-light/50" : ""}
                    ${!notification.isRead
                      ? "bg-primary/[0.03] dark:bg-primary/[0.06] hover:bg-primary/[0.06] dark:hover:bg-primary/[0.09]"
                      : hasLink
                        ? "hover:bg-slate-50 dark:hover:bg-navy-light/30"
                        : "cursor-default"
                    }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon size={18} className={color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!notification.isRead ? "font-semibold text-navy dark:text-white" : "font-medium text-slate-700 dark:text-slate-200"}`}>
                        {notification.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {timeAgo(notification.createdAt)}
                        </span>
                        {!notification.isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                      {notification.body}
                    </p>
                    {!notification.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead.mutate(notification.id);
                        }}
                        className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
                      >
                        <Check size={11} />
                        Mark as read
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
