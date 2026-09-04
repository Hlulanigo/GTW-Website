import { Link, useLocation } from "react-router-dom";
import { Package, Search, Send, MessageCircle, User, Truck, MapPin, Bell } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { useState, useEffect, useRef } from "react";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotifications";

const senderTabs = [
  { path: "/browse", icon: Search, label: "Browse" },
  { path: "/my-parcels", icon: Send, label: "My Parcels" },
  { path: "/incoming", icon: Package, label: "Incoming" },
  { path: "/messages", icon: MessageCircle, label: "Messages" },
  { path: "/profile", icon: User, label: "Profile" },
];

const carrierTabs = [
  { path: "/browse", icon: Search, label: "Jobs" },
  { path: "/deliveries", icon: Truck, label: "Deliveries" },
  { path: "/routes", icon: MapPin, label: "Routes" },
  { path: "/messages", icon: MessageCircle, label: "Messages" },
  { path: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const location = useLocation();
  const { mode } = useMode();
  const tabs = mode === "carrier" ? carrierTabs : senderTabs;
  const unreadCount = useUnreadNotificationCount();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const currentY = target.scrollTop !== undefined ? target.scrollTop : (e.target as any).scrollY ?? 0;

      if (currentY > lastScrollY.current + 8) {
        setVisible(false);
      } else if (currentY < lastScrollY.current - 8) {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };

    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", handleScroll, { capture: true });
  }, []);

  useEffect(() => {
    setVisible(true);
    lastScrollY.current = 0;
  }, [location.pathname]);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-navy-mid border-t border-slate-200 dark:border-navy-light safe-bottom transition-transform duration-300 ease-in-out ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + "/");
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 min-w-0 flex-1
                ${active
                  ? mode === "carrier" ? "text-blue-500" : "text-primary"
                  : "text-slate-400 dark:text-slate-500"}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium truncate ${active ? (mode === "carrier" ? "text-blue-500" : "text-primary") : ""}`}>{label}</span>
            </Link>
          );
        })}
        {/* Notifications bell */}
        {(() => {
          const active = location.pathname === "/notifications";
          return (
            <Link
              to="/notifications"
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 min-w-0 flex-1
                ${active
                  ? mode === "carrier" ? "text-blue-500" : "text-primary"
                  : "text-slate-400 dark:text-slate-500"}`}
            >
              <div className="relative">
                <Bell size={22} strokeWidth={active ? 2.5 : 1.8} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium truncate ${active ? (mode === "carrier" ? "text-blue-500" : "text-primary") : ""}`}>Alerts</span>
            </Link>
          );
        })()}
      </div>
    </nav>
  );
}
