import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import type { Portail } from "@/shared/hooks/auth-context";

/** « Lun. 05 oct. » */
function dateCourte(d: Date): string {
  const jour = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const mois = d.toLocaleDateString("fr-FR", { month: "short" });
  const capitalise = jour.charAt(0).toUpperCase() + jour.slice(1);
  return `${capitalise} ${String(d.getDate()).padStart(2, "0")} ${mois}`;
}

/**
 * Date et heure actuelles, compactes, dans la barre du haut (toutes les pages,
 * menu replié ou non). Remplace l'ancien encadré en tête de page.
 */
export function HorlogeTopBar({ portal }: { portal: Portail }) {
  const theme = getPortalMenu(portal).theme;
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    // Recalage sur le début de chaque minute : l'heure change pile au bon moment.
    let intervalle: number | undefined;
    const delai = window.setTimeout(() => {
      setMaintenant(new Date());
      intervalle = window.setInterval(() => setMaintenant(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(delai);
      window.clearInterval(intervalle);
    };
  }, []);

  const heure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;

  return (
    <time
      dateTime={maintenant.toISOString()}
      title={maintenant.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
      className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[12.5px] text-foreground/70 @3xl/topbar:flex"
    >
      <Clock className="size-3.5" style={{ color: theme.iconColor }} />
      <span className="hidden font-medium @5xl/topbar:inline">{dateCourte(maintenant)}</span>
      <span className="hidden opacity-40 @5xl/topbar:inline">·</span>
      <span className="font-mono font-bold tabular-nums" style={{ color: theme.iconColor }}>
        {heure}
      </span>
    </time>
  );
}
