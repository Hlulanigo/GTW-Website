import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Bell, Eye, Globe, LogOut, ChevronRight, Shield, Trash2, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, changePassword, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all fields"); return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters"); return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match"); return;
    }
    setPasswordLoading(true); setPasswordError("");
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setShowPasswordForm(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      const code = err.code || "";
      if (code.includes("wrong-password") || code.includes("invalid-credential")) {
        setPasswordError("Current password is incorrect");
      } else {
        setPasswordError(err.message || "Failed to change password");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to sign out?")) return;
    await logout();
    navigate("/login");
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${value ? "bg-primary" : "bg-slate-200 dark:bg-navy-secondary"}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? "left-7" : "left-1"}`} />
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <User size={16} className="text-primary" />
                <h3 className="font-semibold text-navy dark:text-white text-sm">Account</h3>
              </div>
            </div>
            <button
              onClick={() => navigate("/profile/edit")}
              className="flex items-center justify-between w-full px-4 py-4 hover:bg-slate-50 dark:hover:bg-navy-light/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-navy dark:text-white">Edit Profile</p>
                <p className="text-xs text-slate-400">Update your name, photo, and bio</p>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                <h3 className="font-semibold text-navy dark:text-white text-sm">Notifications</h3>
              </div>
            </div>
            {[
              { label: "Push Notifications", sublabel: "Delivery updates and messages", value: pushNotifications, onChange: setPushNotifications },
              { label: "Email Notifications", sublabel: "Order confirmations and receipts", value: emailNotifications, onChange: setEmailNotifications },
            ].map(({ label, sublabel, value, onChange }) => (
              <div key={label} className="flex items-center justify-between px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-navy dark:text-white">{label}</p>
                  <p className="text-xs text-slate-400">{sublabel}</p>
                </div>
                <Toggle value={value} onChange={onChange} />
              </div>
            ))}
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-primary" />
                <h3 className="font-semibold text-navy dark:text-white text-sm">Privacy</h3>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="text-sm font-medium text-navy dark:text-white">Show Online Status</p>
                <p className="text-xs text-slate-400">Let others see when you're active</p>
              </div>
              <Toggle value={showOnlineStatus} onChange={setShowOnlineStatus} />
            </div>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                <h3 className="font-semibold text-navy dark:text-white text-sm">Appearance</h3>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-between w-full px-4 py-4 hover:bg-slate-50 dark:hover:bg-navy-light/50 transition-colors"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-navy dark:text-white">{isDark ? "Dark Mode" : "Light Mode"}</p>
                <p className="text-xs text-slate-400">Currently using {isDark ? "dark" : "light"} theme</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                {isDark ? "Dark" : "Light"}
              </span>
            </button>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <h3 className="font-semibold text-navy dark:text-white text-sm">Security</h3>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="flex items-center justify-between w-full px-4 py-4 hover:bg-slate-50 dark:hover:bg-navy-light/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock size={16} className="text-slate-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-navy dark:text-white">Change Password</p>
                  <p className="text-xs text-slate-400">Update your account password</p>
                </div>
              </div>
              <ChevronRight size={16} className={`text-slate-300 transition-transform ${showPasswordForm ? "rotate-90" : ""}`} />
            </button>

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="px-4 py-4 space-y-3 bg-slate-50 dark:bg-navy-secondary">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="input-field"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="input-field"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="input-field"
                />
                {passwordError && (
                  <p className="text-sm text-error">{passwordError}</p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowPasswordForm(false); setPasswordError(""); }} className="flex-1 btn-outline py-2.5 text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={passwordLoading} className="flex-1 btn-primary py-2.5 text-sm">
                    {passwordLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                    ) : "Update"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-navy-light">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-4 hover:bg-error/5 transition-colors rounded-2xl"
            >
              <div className="w-8 h-8 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                <LogOut size={15} className="text-error" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-error">Sign Out</p>
                <p className="text-xs text-slate-400">Sign out of your account</p>
              </div>
            </button>
          </div>

          {profile && (
            <p className="text-center text-xs text-slate-400">
              Signed in as {profile.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
