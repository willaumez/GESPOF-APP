import { Sunrise } from "lucide-react";
import { PageProfil } from "@/shared/components/profil/PageProfil";

export default function Profile() {
  return (
    <PageProfil
      portal="sp"
      badgeService={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdfaf0] px-2.5 py-[4px] text-[11.5px] font-semibold text-[#9a7408]">
          <Sunrise size={12} />
          Service de Prévision
        </span>
      }
      activite={{
        kpiPrincipal: "Journées de trésorerie",
        kpiPrincipalSous: "au total",
        kpiSecondaire: "Ce mois-ci",
        kpiSecondaireSous: "fiches traitées",
      }}
    />
  );
}
