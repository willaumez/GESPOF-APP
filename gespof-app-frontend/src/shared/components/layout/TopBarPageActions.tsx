import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const TopBarPageSlotContext = createContext<HTMLElement | null>(null);

export function TopBarPageSlotProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <TopBarPageSlotContext.Provider value={slot}>
      {children}
    </TopBarPageSlotContext.Provider>
  );
}

/** Rend le contenu dans l’emplacement dédié de la topbar. */
export function TopBarPageActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarPageSlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
}
