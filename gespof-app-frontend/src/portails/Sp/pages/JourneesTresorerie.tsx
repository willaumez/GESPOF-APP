import { CalendarDays, List } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { formaterDateLongueFr } from "@/shared/lib/format-date-heure";
import { OngletsVueSp } from "@/portails/Sp/components/OngletsVueSp";
import { VueJourneeDuJour } from "@/portails/Sp/components/archives/VueJourneeDuJour";
import { VueListeJournees } from "@/portails/Sp/components/archives/VueListeJournees";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";

type VueJournees = "jour" | "liste";

function lireVue(valeur: string | null): VueJournees {
  return valeur === "liste" ? "liste" : "jour";
}

/** Page « Journée trésorerie » : journée sélectionnée ou liste de toutes les journées. */
export default function JourneesTresorerie() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vue = lireVue(searchParams.get("vue"));
  const { date } = useJourneeSelectionnee();

  function changerVue(prochaine: string) {
    if (prochaine === "liste") {
      setSearchParams({ vue: "liste" }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  }

  return (
    <OngletsVueSp
      valeur={vue}
      onChange={changerVue}
      onglets={[
        { value: "jour", label: formaterDateLongueFr(date), icon: CalendarDays },
        { value: "liste", label: "Toutes les journées", icon: List },
      ]}
    >
      {vue === "jour" ? <VueJourneeDuJour /> : <VueListeJournees />}
    </OngletsVueSp>
  );
}
