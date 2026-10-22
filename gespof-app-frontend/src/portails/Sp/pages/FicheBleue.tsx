import { VueFicheBleueDuJour } from "@/portails/Sp/components/fiche-bleue/VueFicheBleueDuJour";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";

/** Fiche Bleue de la journée de trésorerie choisie dans la TopBar. */
export default function FicheBleue() {
  const { dateIso } = useJourneeSelectionnee();

  return <VueFicheBleueDuJour key={dateIso} />;
}
