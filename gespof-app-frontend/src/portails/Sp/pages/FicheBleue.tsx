import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { SpBoutonPrimaire } from "@/portails/Sp/components/layout/SpBoutonsPage";
import { VueListeFichesBleues } from "@/portails/Sp/components/fiche-bleue/VueListeFichesBleues";

/**
 * Fiche Bleue — liste archive Prototype v2
 * (programmation quotidienne, accès détail via aperçu).
 */
export default function FicheBleue() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <SpPageHeader
        eyebrow="Fiches journalières · Programmation"
        title="Fiche Bleue"
        description="Programmation quotidienne de la trésorerie : sections, rubriques et montants programmés."
        actions={
          <SpBoutonPrimaire onClick={() => void navigate("/sp/fiche-matinale")}>
            <Plus size={16} />
            Nouvelle Fiche Bleue
          </SpBoutonPrimaire>
        }
      />
      <VueListeFichesBleues maquette />
    </div>
  );
}
