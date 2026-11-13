import { useNavigate, useSearchParams } from "react-router-dom";
import { Sunrise } from "lucide-react";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { SpBoutonPrimaire } from "@/portails/Sp/components/layout/SpBoutonsPage";
import { VueJourneeDuJour } from "@/portails/Sp/components/archives/VueJourneeDuJour";
import { VueListeJournees } from "@/portails/Sp/components/archives/VueListeJournees";
import { getPortalMenu } from "@/shared/config/menu";

type VueJournees = "jour" | "liste";

function lireVue(valeur: string | null): VueJournees {
  return valeur === "jour" ? "jour" : "liste";
}

/**
 * Journées de trésorerie — Prototype v2
 * (onglets Journée du jour / Toutes les journées).
 */
export default function JourneesTresorerie() {
  const navigate = useNavigate();
  const theme = getPortalMenu("sp").theme;
  const [searchParams, setSearchParams] = useSearchParams();
  const vue = lireVue(searchParams.get("vue"));

  function changerVue(prochaine: VueJournees) {
    if (prochaine === "jour") {
      setSearchParams({ vue: "jour" }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <SpPageHeader
        eyebrow="Gestion · Archives des journées"
        title="Journées de trésorerie"
        description="Historique des journées ouvertes et clôturées, avec leurs fiches rattachées."
        actions={
          <SpBoutonPrimaire
            onClick={() => void navigate("/sp/fiche-matinale")}
          >
            <Sunrise size={16} />
            Ouvrir la journée du jour
          </SpBoutonPrimaire>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0] px-3">
          {(
            [
              { id: "jour" as const, label: "Journée du jour" },
              { id: "liste" as const, label: "Toutes les journées" },
            ] as const
          ).map((tb) => {
            const on = vue === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => changerVue(tb.id)}
                className="flex h-[46px] items-center gap-2 px-3 text-sm whitespace-nowrap"
                style={{
                  fontWeight: on ? 600 : 500,
                  color: on ? theme.textColor : "#64748b",
                  boxShadow: on ? `inset 0 -2px 0 ${theme.topColor}` : undefined,
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>
        <div className="p-0">
          {vue === "jour" ? (
            <div className="p-4 sm:p-5">
              <VueJourneeDuJour />
            </div>
          ) : (
            <VueListeJournees maquette />
          )}
        </div>
      </div>
    </div>
  );
}
