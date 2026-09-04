import React, { createContext, useContext, useState, useCallback } from "react";

export type AppMode = "sender" | "carrier";

interface ModeContextValue {
  mode: AppMode;
  isCarrierMode: boolean;
  isSenderMode: boolean;
  setMode: (m: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const MODE_STORAGE_KEY = "parcelpeer_mode";

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return saved === "sender" || saved === "carrier" ? saved : "sender";
  });

  const setMode = useCallback((m: AppMode) => {
    setModeState(m);
    localStorage.setItem(MODE_STORAGE_KEY, m);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "sender" ? "carrier" : "sender");
  }, [mode, setMode]);

  return (
    <ModeContext.Provider
      value={{
        mode,
        isCarrierMode: mode === "carrier",
        isSenderMode: mode === "sender",
        setMode,
        toggleMode,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
