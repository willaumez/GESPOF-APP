import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { Portail } from "@/shared/hooks/auth-context";

/**
 * Horloge top bar — maquette Prototype v2
 * (icône · heure mono, séparateurs latéraux).
 */
export function HorlogeTopBar({ portal: _portal }: { portal: Portail }) {
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
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
      className="hidden h-7 shrink-0 items-center gap-1.5 whitespace-nowrap border-x border-[#e2e8f0] px-3 text-[13px] text-[#475569] @2xl/topbar:flex"
    >
      <Clock size={15} strokeWidth={1.7} className="shrink-0" />
      <b
        className="font-mono font-semibold tabular-nums text-[#0f172a]"
        style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
      >
        {heure}
      </b>
    </time>
  );
}
