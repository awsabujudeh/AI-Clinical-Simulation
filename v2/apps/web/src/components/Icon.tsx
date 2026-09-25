import type { CSSProperties } from "react";
const paths = {
  history: "M5 4h14v12H9l-4 4V4Z M8 8h8 M8 12h5",
  exam: "M6 3v6a4 4 0 0 0 8 0V3 M4 3h4 M12 3h4 M10 13v3a4 4 0 0 0 8 0v-3 M18 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  investigation: "M7 3h10 M9 3v7l-5 8a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-8V3 M7 15h10",
  medication: "M5 19a5 5 0 0 1 0-7l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7 0Z M8 9l7 7",
  procedure: "M5 7h14v14H5V7Z M9 7V3h6v4 M9 14h6 M12 11v6",
  diagnosis: "M8 4H5v17h14V4h-3 M8 2h8v5H8V2Z M8 12l2 2 5-5 M8 18h8",
  arrow: "M4 12h15 M14 6l6 6-6 6", home: "M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-7h6v7",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1",
  book: "M12 5C8 2 4 3 3 4v16c4-2 7-1 9 0 2-1 5-2 9 0V4c-3-2-6-2-9 1Z M12 5v15",
  faculty: "M3 8l9-5 9 5-9 5-9-5Z M6 10v7c4 3 8 3 12 0v-7 M21 8v9",
  check: "M5 12l4 4L19 6", alert: "M12 3 2 21h20L12 3Z M12 9v5 M12 17v1",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, className = "", style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg className={`icon ${name === "arrow" ? "icon--directional" : ""} ${className}`} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
