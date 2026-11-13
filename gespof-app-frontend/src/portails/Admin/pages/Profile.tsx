import { Shield } from "lucide-react";
import { PageProfil } from "@/shared/components/profil/PageProfil";

export default function Profile() {
  return (
    <PageProfil
      portal="admin"
      badgeService={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2ff] px-2.5 py-[4px] text-[11.5px] font-semibold text-[#1e4d8c]">
          <Shield size={12} />
          Administration
        </span>
      }
      activite={{
        kpiPrincipal: "Comptes gérés",
        kpiPrincipalSous: "au total",
        kpiSecondaire: "Ce mois-ci",
        kpiSecondaireSous: "actions d'administration",
      }}
    />
  );
}
