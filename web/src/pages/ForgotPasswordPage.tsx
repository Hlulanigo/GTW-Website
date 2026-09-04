import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError("Please enter a valid email address"); return; }
    setLoading(true); setError("");
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      const code = err.code || "";
      if (code.includes("user-not-found")) setError("No account found with this email address.");
      else if (code.includes("invalid-email")) setError("Invalid email address.");
      else if (code.includes("too-many-requests")) setError("Too many attempts. Please try again later.");
      else setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
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
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-6">
            <KeyRound size={28} className="text-primary" />
          </div>
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Happens to<br />
            <span className="text-primary">the best of us.</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm mb-10">
            Enter your email and we'll send you a secure link to reset your password. It only takes a minute.
          </p>

          <div className="space-y-3">
            {[
              { step: "1", text: "Enter your registered email address" },
              { step: "2", text: "Check your inbox for the reset link" },
              { step: "3", text: "Create a new password and sign in" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">{step}</div>
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs relative z-10">&copy; 2024 The GTW. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface dark:bg-navy-mid">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center mb-8">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="The GTW" className="h-14 sm:h-16 w-auto object-contain" />
          </div>

          {sent ? (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-navy dark:text-white">Check your inbox</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed">
                  We've sent password reset instructions to
                </p>
                <p className="font-semibold text-primary mt-1">{email}</p>
              </div>

              <div className="bg-white dark:bg-navy-mid border border-slate-200 dark:border-navy-light rounded-2xl p-5 text-left space-y-3">
                {[
                  "Open the email from The GTW",
                  "Click the 'Reset Password' link",
                  "Create your new password",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{i + 1}</span>
                    </div>
                    <p className="text-sm text-navy dark:text-white">{step}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="btn-outline w-full py-3 text-sm"
              >
                Try a different email
              </button>
              <Link to="/login" className="block text-center text-sm text-primary font-semibold hover:underline">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-navy dark:hover:text-white transition-colors mb-6">
                  <ArrowLeft size={15} />
                  Back to Sign In
                </Link>
                <h1 className="text-2xl font-extrabold text-navy dark:text-white tracking-tight">Forgot your password?</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm leading-relaxed">
                  No worries. Enter your email and we'll send you a reset link right away.
                </p>
              </div>

              <div className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-500 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="input-field pl-10"
                        autoFocus
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-base">
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                      : "Send Reset Link"}
                  </button>
                </form>

                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Remembered it?{" "}
                  <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
