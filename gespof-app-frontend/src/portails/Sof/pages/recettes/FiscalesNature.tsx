import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { SOF_VERT } from "@/portails/Sof/components/SofCards";

const LIGNES = [
  { code: "RF1", libelle: "Impôt sur les sociétés", montant: 12.4e9 },
  { code: "RF2", libelle: "IRPP", montant: 8.1e9 },
  { code: "RF5", libelle: "Précompte TVA", montant: 3.2e9 },
  { code: "RF12", libelle: "TVA intérieure", montant: 15.6e9 },
  { code: "RF36", libelle: "IS pétrolier", montant: 22.0e9 },
  { code: "RF76", libelle: "RMP", montant: 9.8e9 },
  { code: "RF80", libelle: "Redevance superficiaire", montant: 1.4e9 },
  { code: "RF137", libelle: "À répartir", montant: 2.124e8, _fw: 1 },
];

/**
 * Ventilation par nature (codes RF) — maquette fis-nature (phase 8).
 */
export default function FiscalesNature() {
  return (
    <SofEtatTablePage
      config={{
        titre: "Ventilation par nature",
        description: "Ventilation des recettes fiscales par code RF.",
        remplace: "Codes RF* · Methods.RecettesImpots",
        sousTitre: "RF137 « à répartir » en alerte",
        colonnes: [
          { key: "code", label: "Code RF", mono: true, width: "90px" },
          { key: "libelle", label: "Libellé" },
          { key: "montant", label: "Montant", align: "r", montant: true },
        ],
        lignes: LIGNES,
        totalKeys: ["montant"],
        actionsExtra: (
          <button
            type="button"
            onClick={() =>
              toast.message("Réaffectation RF137 — brancher sur tables fiscales + import VIDR.")
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium text-[#334155]"
          >
            <RefreshCw className="size-4" style={{ color: SOF_VERT }} />
            Réaffecter « à répartir »
          </button>
        ),
      }}
    />
  );
}
