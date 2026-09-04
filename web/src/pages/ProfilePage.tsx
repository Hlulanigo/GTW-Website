import { useState } from "react";
import { User, Mail, Phone, Star, Wallet, LogOut, Moon, Sun, ChevronRight, Settings, Shield, Edit2, Users, CreditCard, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { TopBar } from "@/components/TopBar";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { profile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/login");
  };

  const menuItems = [
    { icon: Wallet, label: "Wallet", sublabel: `R${((profile?.walletBalance ?? 0) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, path: "/wallet" },
    { icon: CreditCard, label: "Payment History", sublabel: "Receipts & payments", path: "/payment-history" },
    { icon: Star, label: "Reviews", sublabel: `${profile?.rating ?? 5.0} ★`, path: "/reviews" },
    { icon: Users, label: "Connections", sublabel: "Trusted carriers & contacts", path: "/connections" },
    { icon: Crown, label: "Subscription", sublabel: `${profile?.subscriptionStatus ? profile.subscriptionStatus.charAt(0).toUpperCase() + profile.subscriptionStatus.slice(1) : "Free"} plan`, path: "/subscriptions" },
    { icon: Shield, label: "Disputes", sublabel: "Manage disputes", path: "/disputes" },
    { icon: Settings, label: "Settings", sublabel: "Account settings", path: "/settings" },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Profile" />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-navy pb-20 md:pb-4">
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center shrink-0">
                {profile?.photoUrl ? (
                  <img src={profile.photoUrl} className="w-16 h-16 rounded-3xl object-cover" alt="avatar" />
                ) : (
                  <span className="text-primary font-bold text-2xl">{profile?.name?.[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-navy dark:text-white truncate">{profile?.name || "User"}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm truncate">{profile?.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star size={12} className="text-warning fill-warning" />
                  <span className="text-sm font-medium text-navy dark:text-white">{profile?.rating?.toFixed(1) ?? "5.0"}</span>
                  <span className="text-slate-400 text-sm">rating</span>
                </div>
              </div>
              <button
                onClick={() => navigate("/profile/edit")}
                className="p-2 rounded-xl bg-slate-100 dark:bg-navy-secondary hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors"
              >
                <Edit2 size={16} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {profile?.walletBalance !== undefined && (
              <div className="mt-4 p-3 bg-primary/10 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-primary" />
                  <span className="text-sm font-medium text-navy dark:text-white">Wallet Balance</span>
                </div>
                <span className="font-bold text-primary">R{((profile.walletBalance ?? 0) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            {menuItems.map(({ icon: Icon, label, sublabel, path }) => (
              <button key={label} onClick={() => navigate(path)}
                className="flex items-center gap-3 w-full px-4 py-4 hover:bg-slate-50 dark:hover:bg-navy-light/50 transition-colors text-left first:rounded-t-2xl last:rounded-b-2xl">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-secondary flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-slate-500 dark:text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-navy dark:text-white text-sm">{label}</p>
                  <p className="text-xs text-slate-400">{sublabel}</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
              </button>
            ))}
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <button onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-4 py-4 hover:bg-slate-50 dark:hover:bg-navy-light/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-secondary flex items-center justify-center shrink-0">
                {isDark ? <Sun size={15} className="text-slate-500" /> : <Moon size={15} className="text-slate-500" />}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-navy dark:text-white text-sm">{isDark ? "Light mode" : "Dark mode"}</p>
                <p className="text-xs text-slate-400">Switch appearance</p>
              </div>
            </button>

            <button onClick={handleLogout} disabled={loggingOut}
              className="flex items-center gap-3 w-full px-4 py-4 hover:bg-error/5 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              <div className="w-8 h-8 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                <LogOut size={15} className="text-error" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-error text-sm">{loggingOut ? "Signing out..." : "Sign out"}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
