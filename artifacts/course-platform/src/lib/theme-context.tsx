import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "forest";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

const ALL_THEMES: Theme[] = ["dark", "light", "forest"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("vka-theme");
      if (stored === "light" || stored === "dark" || stored === "forest") return stored;
    } catch {}
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light", "forest");
    root.classList.add(theme);
    try {
      localStorage.setItem("vka-theme", theme);
    } catch {}
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () =>
    setThemeState(t => ALL_THEMES[(ALL_THEMES.indexOf(t) + 1) % ALL_THEMES.length]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
