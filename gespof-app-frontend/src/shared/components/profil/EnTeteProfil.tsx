import type { ReactNode } from "react";
import { getPortalMenu } from "@/shared/config/menu";
import type { Portail } from "@/shared/hooks/auth-context";

interface EnTeteProfilProps {
  portal: Portail;
  loading: boolean;
  initiales: string;
  nomAffichage: string;
  roleLibelle: string;
  estActif: boolean;
  matricule: string;
  /** Badge supplémentaire (ex. service de rattachement). */
  badgeService?: ReactNode;
}

/**
 * En-tête de la page Profil (nom, rôle, matricule) — fond clair teinté par le
 * thème du portail. Les classes d'animation `p-*` sont définies par la page Profil.
 */
export function EnTeteProfil({
  portal,
  loading,
  initiales,
  nomAffichage,
  roleLibelle,
  estActif,
  matricule,
  badgeService,
}: EnTeteProfilProps) {
  const theme = getPortalMenu(portal).theme;

  return (
    <div
      className="p-fade-up relative overflow-hidden rounded-2xl px-8 py-8 text-[#0f172a]"
      style={{
        background: `linear-gradient(135deg,#ffffff 0%,${theme.bgColor} 55%,${theme.iconBg} 100%)`,
        border: `1px solid ${theme.topColor}26`,
        borderLeft: `4px solid ${theme.topColor}`,
        boxShadow: `0 6px 24px ${theme.topColor}14`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle,${theme.topColor}14 1px,transparent 1px)`,
          backgroundSize: "38px 38px",
        }}
      />

      <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        {loading ? (
          <div className="h-[86px] w-[86px] shrink-0 animate-pulse rounded-full bg-[#0f172a]/10" />
        ) : (
          <div
            className="p-pop-in p-pulse flex h-[86px] w-[86px] shrink-0 items-center justify-center rounded-full text-[30px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg,${theme.ctaColor},${theme.hoverColor})`,
              border: "3px solid #ffffff",
              animationDelay: "0.12s",
            }}
          >
            {initiales}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2">
              <div className="h-7 w-48 animate-pulse rounded-lg bg-[#0f172a]/10" />
              <div className="h-5 w-32 animate-pulse rounded-full bg-[#0f172a]/10" />
            </div>
          ) : (
            <>
              <h2
                className="p-slide-left truncate text-[26px] font-bold leading-tight text-[#0f172a]"
                style={{ animationDelay: "0.18s" }}
              >
                {nomAffichage}
              </h2>
              <div
                className="p-fade-in mt-2.5 flex flex-wrap items-center gap-2"
                style={{ animationDelay: "0.28s" }}
              >
                <span
                  className="rounded-full px-3 py-[5px] text-[11.5px] font-semibold"
                  style={{
                    background: `${theme.topColor}1a`,
                    color: theme.hoverColor,
                    border: `1px solid ${theme.topColor}40`,
                  }}
                >
                  {roleLibelle}
                </span>
                <span
                  className="flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[11.5px] font-semibold"
                  style={
                    estActif
                      ? { background: "rgba(5,150,105,0.10)", color: "#047857", border: "1px solid rgba(5,150,105,0.28)" }
                      : { background: "rgba(220,38,38,0.08)", color: "#b91c1c", border: "1px solid rgba(220,38,38,0.25)" }
                  }
                >
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{
                      background: estActif ? "#10b981" : "#dc2626",
                      animation: estActif ? "pulseRing 2.2s infinite" : "none",
                    }}
                  />
                  {estActif ? "Actif" : "Inactif"}
                </span>
                {badgeService ? (
                  <span className="flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-white/80 px-3 py-[5px] text-[11.5px] font-semibold text-[#475569]">
                    {badgeService}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div
          className="p-fade-in shrink-0 self-start rounded-xl border bg-white/80 px-4 py-2.5 text-right"
          style={{ borderColor: `${theme.topColor}26`, animationDelay: "0.32s" }}
        >
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Matricule
          </p>
          {loading ? (
            <div className="mt-1 h-6 w-20 animate-pulse rounded bg-[#0f172a]/10" />
          ) : (
            <p
              className="mt-1 font-mono text-[19px] font-bold tracking-wide"
              style={{ color: theme.hoverColor }}
            >
              {matricule}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
