import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { clsx } from 'clsx';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={clsx(
        "relative flex items-center w-16 h-8 rounded-full p-1 transition-all duration-300",
        isDark 
          ? "bg-theme-surface/50 border-theme-border/50" 
          : "bg-blue-100/50 border-white/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"
      )}
      style={{
        backdropFilter: 'blur(10px)',
        borderWidth: '1px',
      }}
    >
      {/* Sliding thumb */}
      <div 
        className={clsx(
          "absolute h-6 w-7 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isDark 
            ? "translate-x-7 bg-theme-surface-2/80 shadow-md" 
            : "translate-x-0 bg-white/60 shadow-sm border border-white/80"
        )}
      />

      <div className="flex justify-between items-center w-full px-1 z-10">
        <Sun className={clsx(
          "w-4 h-4 transition-colors duration-300", 
          isDark ? "text-amber-500/50" : "text-amber-500"
        )} />
        <Moon className={clsx(
          "w-3.5 h-3.5 transition-colors duration-300 mr-0.5", 
          isDark ? "text-indigo-200" : "text-slate-400/50"
        )} />
      </div>
    </button>
  );
};
