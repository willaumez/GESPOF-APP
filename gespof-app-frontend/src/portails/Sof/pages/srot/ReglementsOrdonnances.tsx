import { DepensesAutomatiseesPage } from "@/portails/Sof/pages/depenses/DepensesAutomatiseesPage";
import { DEPENSES_AUTOMATISEES_CONFIG } from "@/portails/Sof/pages/depenses/depensesAutomatiseesConfig";

export default function ReglementsOrdonnances() {
  return <DepensesAutomatiseesPage config={DEPENSES_AUTOMATISEES_CONFIG.ordonnances} />;
}
