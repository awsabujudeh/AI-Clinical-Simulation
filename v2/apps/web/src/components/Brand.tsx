import { useTheme } from "../app/theme";
/** Owner raster crops, not a redrawn mark. Replace slots with approved vectors later. */
export function Brand({ full = false }: { full?: boolean }) {
  const { theme } = useTheme();
  return full ? <img className="brand-art brand-art--full" src={`/brand/balsim-${theme}.png`} alt="BALSIM — Practice today, better care tomorrow" />
    : <span className="brand-lockup"><img src={`/brand/balsim-mark-${theme}.png`} alt="" /><span><b>BALSIM</b><small>بَلسِم</small></span></span>;
}
