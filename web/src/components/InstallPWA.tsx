import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa_install_dismissed_at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_FOR_MS) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "dismissed") {
        localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      }
    } finally {
      setDeferred(null);
      setVisible(false);
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl bg-navy text-white shadow-2xl border border-white/10 px-4 py-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Download size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install The GTW</p>
          <p className="text-xs text-slate-300 truncate">
            Add to your home screen for a faster, app-like experience.
          </p>
        </div>
        <button
          onClick={handleInstall}
          disabled={installing}
          className="text-xs font-semibold bg-primary hover:bg-primary/90 active:scale-95 transition px-3 py-2 rounded-lg disabled:opacity-60"
        >
          {installing ? "..." : "Install"}
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-slate-400 hover:text-white p-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
