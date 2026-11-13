import { FileText } from "lucide-react";
import { PageProfil } from "@/shared/components/profil/PageProfil";

export default function Profile() {
  return (
    <PageProfil
      portal="sof"
      badgeService={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f1ea] px-2.5 py-[4px] text-[11.5px] font-semibold text-[#1e6650]">
          <FileText size={12} />
          Service des Opérations Financières
        </span>
      }
      activite={{
        kpiPrincipal: "Opérations saisies",
        kpiPrincipalSous: "au total",
        kpiSecondaire: "Ce mois-ci",
        kpiSecondaireSous: "recettes & dépenses",
      }}
    />
  );
}
