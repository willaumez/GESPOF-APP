import { SofImportDepotPage } from "@/portails/Sof/components/SofImportDepotPage";
import { DEPOT_FISCALES_IG } from "@/portails/Sof/pages/imports/depotConfigs";

export default function Page() {
  return <SofImportDepotPage config={DEPOT_FISCALES_IG} />;
}
