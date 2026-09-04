import { Link, useLocation } from "react-router-dom";
import { Package, Search, Send, MessageCircle, User, Truck, MapPin, Sun, Moon, LogOut, Bell } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
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

export function Sidebar() {
  const location = useLocation();
  const { mode, setMode } = useMode();
  const { toggleTheme, isDark } = useTheme();
  const { profile, logout } = useAuth();
  const tabs = mode === "carrier" ? carrierTabs : senderTabs;
  const unreadCount = useUnreadNotificationCount();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-navy-mid border-r border-slate-200 dark:border-navy-light shrink-0">
      <div className="p-6">
        <div className="flex items-center mb-8">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="The GTW" className="h-8 w-auto object-contain" />
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-navy-secondary rounded-full mb-6">
          {(["sender", "carrier"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 capitalize
                ${mode === m
                  ? m === "carrier"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "bg-primary text-white shadow-orange"
                  : "text-slate-500 dark:text-slate-400"}`}
            >
              {m}
            </button>
          ))}
        </div>

        <nav className="space-y-1">
          {tabs.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + "/");
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
                  ${active
                    ? mode === "carrier"
                      ? "bg-blue-500/10 text-blue-500 font-semibold"
                      : "bg-primary/10 text-primary font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-light"
                  }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}

          {/* Notifications link */}
          {(() => {
            const active = location.pathname === "/notifications";
            return (
              <Link
                to="/notifications"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
                  ${active
                    ? mode === "carrier"
                      ? "bg-blue-500/10 text-blue-500 font-semibold"
                      : "bg-primary/10 text-primary font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-light"
                  }`}
              >
                <div className="relative">
                  <Bell size={18} strokeWidth={active ? 2.5 : 1.8} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto text-xs font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })()}
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-2 border-t border-slate-200 dark:border-navy-light">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-light transition-all"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          <span className="text-sm">{isDark ? "Light mode" : "Dark mode"}</span>
        </button>
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-sm">{profile.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy dark:text-white truncate">{profile.name}</p>
              <p className="text-xs text-slate-400 truncate">{profile.email}</p>
            </div>
            <button onClick={logout} className="text-slate-400 hover:text-error transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
