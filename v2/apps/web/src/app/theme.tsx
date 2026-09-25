import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
export type Theme = "bright" | "dark";
const KEY = "balsim.theme.v1";
const ThemeContext = createContext<{ theme: Theme; toggle(): void }>({ theme: "bright", toggle() {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem(KEY) === "dark" ? "dark" : "bright"; } catch { return "bright"; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    let icon = document.querySelector<HTMLLinkElement>('link[data-balsim-icon]');
    if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; icon.dataset.balsimIcon = "true"; document.head.append(icon); }
    icon.href = `/brand/balsim-mark-${theme}.png`;
    try { localStorage.setItem(KEY, theme); } catch { /* Preference storage is optional. */ }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggle: () => setTheme(v => v === "bright" ? "dark" : "bright") }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
