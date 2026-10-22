import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import type { Portail } from "@/shared/hooks/auth-context";
import { portalThemeVars } from "@/shared/lib/color";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/shared/components/ui/tooltip";

interface BoutonPleinEcranProps {
  actif?: boolean;
  onToggle: () => void;
  /** Libellé tooltip / aria quand on propose d'entrer en plein écran. */
  libelleEnter?: string;
  /** Libellé tooltip / aria quand on propose de quitter. */
  libelleQuitter?: string;
}

export function BoutonPleinEcran({
  actif = false,
  onToggle,
  libelleEnter = "Plein écran",
  libelleQuitter = "Quitter le plein écran",
}: BoutonPleinEcranProps) {
  const libelle = actif ? libelleQuitter : libelleEnter;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          aria-label={libelle}
          aria-pressed={actif}
          onClick={onToggle}
        >
          {actif ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{libelle}</TooltipContent>
    </Tooltip>
  );
}

interface OverlayPleinEcranProps {
  ouvert: boolean;
  titre: string;
  sousTitre?: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  /** Thème du portail (couleurs CSS variables). Défaut : SP. */
  portail?: Portail;
}

/** Overlay plein viewport (portail body) pour afficher un tableau / contenu. */
export function OverlayPleinEcran({
  ouvert,
  titre,
  sousTitre,
  onClose,
  actions,
  children,
  ariaLabel,
  portail = "sp",
}: OverlayPleinEcranProps) {
  const theme = getPortalMenu(portail).theme;

  useEffect(() => {
    if (!ouvert) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    const overflowAvant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflowAvant;
    };
  }, [ouvert, onClose]);

  if (!ouvert) return null;

  return createPortal(
    // pointer-events-auto : ouvert depuis un Dialog Radix modal, <body> est en
    // pointer-events: none — sans cela le plein écran ne réagit plus aux clics.
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? titre}
      // Rendu dans <body>, hors du shell du portail : on réapplique ses couleurs
      // (--primary, --accent, --ring), sinon sélections et cases cochées perdent le thème.
      style={portalThemeVars(theme.topColor)}
    >
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
        style={{ borderBottomColor: `${theme.topColor}55` }}
      >
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {titre}
          </p>
          {sousTitre ? (
            <p className="truncate text-[12px] text-muted-foreground">
              {sousTitre}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <BoutonPleinEcran actif onToggle={onClose} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        {children}
      </div>
    </div>,
    document.body,
  );
}
