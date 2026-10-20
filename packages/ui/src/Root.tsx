import { createContext, type HTMLAttributes, useContext, useState } from "react";
import type { Mode, ThemeId } from "./themes.ts";

const PortalContext = createContext<HTMLElement | null>(null);

/** Where menus and popovers render: inside the nearest LupinRoot, so they keep its theme. */
export function usePortalTarget(): HTMLElement | null {
  const el = useContext(PortalContext);
  return el ?? (typeof document === "undefined" ? null : document.body);
}

export type Motion = "full" | "reduced" | "none";

export type LupinRootProps = HTMLAttributes<HTMLDivElement> & {
  theme?: ThemeId;
  mode?: Mode;
  /** Leave unset to follow the system "reduce motion" setting. */
  motion?: Motion;
};

/** Sets the theme and mode for everything inside it. Put one at the top of your desktop. */
export function LupinRoot({ theme = "peli", mode = "light", motion, className, children, ...rest }: LupinRootProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setEl}
      className={className ? `lui ${className}` : "lui"}
      data-lui-theme={theme}
      data-lui-mode={mode}
      data-lui-motion={motion}
      {...rest}
    >
      <PortalContext.Provider value={el}>{children}</PortalContext.Provider>
    </div>
  );
}
