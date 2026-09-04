import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface TopBarProps {
  title?: string;
  subtitle?: ReactNode;
  showBack?: boolean;
  right?: ReactNode;
}

export function TopBar({ title, subtitle, showBack, right }: TopBarProps) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-navy-mid/90 backdrop-blur-md border-b border-slate-200/60 dark:border-navy-light/60 safe-top">
      <div className="flex items-center h-14 px-4 gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-light transition-colors"
          >
            <ChevronLeft size={22} className="text-navy dark:text-white" />
          </button>
        )}
        {title && (
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-navy dark:text-white truncate">{title}</h1>
            {subtitle && <div className="mt-0.5">{subtitle}</div>}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {right}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-light transition-colors md:hidden"
          >
            {isDark ? <Sun size={18} className="text-slate-400" /> : <Moon size={18} className="text-slate-400" />}
          </button>
        </div>
      </div>
    </header>
  );
}
