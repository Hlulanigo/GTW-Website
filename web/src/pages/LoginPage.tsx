import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields"); return; }
    setLoading(true); setError("");
    try {
      await signIn(email.trim(), password);
      navigate("/browse");
    } catch (err: any) {
      const code = err.code || err.message || "";
      if (code.includes("invalid-credential") || code.includes("user-not-found") || code.includes("wrong-password")) {
        setError("Incorrect email or password.");
      } else if (code.includes("too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true); setError("");
    try {
      await signInWithGoogle();
      navigate("/browse");
    } catch (err: any) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[52%] bg-navy flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse 90% 65% at 30% -10%, rgba(249,115,22,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(99,102,241,0.1) 0%, transparent 60%)"
          }} />
          <div className="absolute inset-0" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            maskImage: "radial-gradient(ellipse 80% 80% at 30% 50%, black 20%, transparent 75%)"
          }} />
        </div>

        <Link to="/" className="flex items-center relative z-10">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="The GTW" className="h-9 w-auto object-contain brightness-0 invert" />
        </Link>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold px-3 py-1.5 mb-6 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live Network
          </div>
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Send parcels.<br />
            <span className="text-primary">Earn on every trip.</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm mb-10">
            The GTW connects people who need to send parcels with travelers going the same way — no middlemen, just community.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { num: "4,800+", label: "Deliveries" },
              { num: "98%", label: "On-time rate" },
              { num: "4.9★", label: "Avg. rating" },
            ].map(({ num, label }) => (
              <div key={label} className="bg-white/5 border border-white/8 rounded-2xl p-4">
                <div className="text-xl font-extrabold text-white">{num}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <div className="text-yellow-400 text-sm mb-2 tracking-wide">★★★★★</div>
            <p className="text-slate-300 text-sm leading-relaxed italic">
              "I matched with a carrier within the hour and my parcel arrived the same day — cheaper than any courier I've ever used."
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white text-xs font-bold">A</div>
              <div>
                <div className="text-white text-xs font-semibold">Amara K.</div>
                <div className="text-slate-500 text-xs">Sender — Lagos</div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-slate-600 text-xs relative z-10">&copy; 2024 The GTW. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface dark:bg-navy-mid">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center mb-8">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="The GTW" className="h-14 sm:h-16 w-auto object-contain" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-navy dark:text-white tracking-tight">Welcome back</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Sign in to your account to continue</p>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-500 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="input-field pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Password</label>
                  <Link to="/forgot-password" className="text-xs text-primary font-semibold hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-base">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  : "Sign In"}
              </button>
            </form>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-navy-light" />
              <span className="text-xs text-slate-400 font-medium">or</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-navy-light" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full h-12 flex items-center justify-center gap-3 border-2 border-slate-200 dark:border-navy-light rounded-full font-semibold text-navy dark:text-white hover:bg-slate-50 dark:hover:bg-navy-secondary transition-all text-sm"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:underline">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
