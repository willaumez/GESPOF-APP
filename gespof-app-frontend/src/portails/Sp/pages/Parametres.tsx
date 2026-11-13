import { useState } from "react";
import { Plus } from "lucide-react";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { SpBoutonPrimaire } from "@/portails/Sp/components/layout/SpBoutonsPage";
import { BibliothequeSections } from "@/portails/Sp/components/parametres/fiche-bleue/BibliothequeSections";

/**
 * Paramètres SP — Prototype v2 (onglet Bibliothèque Sections).
 */
export default function Parametres() {
  const [demandeAjout, setDemandeAjout] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <SpPageHeader
        eyebrow="Paramétrage · Fiche Bleue"
        title="Paramètres"
        description="Bibliothèque des sections utilisées pour composer la Fiche Bleue et la Fiche d'exécution."
        actions={
          <SpBoutonPrimaire onClick={() => setDemandeAjout((n) => n + 1)}>
            <Plus size={16} />
            Ajouter une section
          </SpBoutonPrimaire>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0] px-3">
          <span
            className="flex h-[46px] items-center gap-2 px-3 text-sm font-semibold text-[#0f172a]"
            style={{ boxShadow: "inset 0 -2px 0 #c9960a" }}
          >
            Bibliothèque Sections
          </span>
        </div>
        <BibliothequeSections maquette demandeAjout={demandeAjout} />
      </div>
    </div>
  );
}
