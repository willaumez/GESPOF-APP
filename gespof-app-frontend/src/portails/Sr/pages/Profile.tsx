import { PageProfil } from "@/shared/components/profil/PageProfil";

export default function Profile() {
  return (
    <PageProfil
      portal="sr"
      badgeService={
        <span className="rounded-full border border-[#e2e8f0] bg-white px-2.5 py-[4px] text-[11.5px] font-semibold text-[#475569]">
          Service Règlement
        </span>
      }
      activite={{
        kpiPrincipal: "Fiches de dépôt",
        kpiPrincipalSous: "au total",
        kpiSecondaire: "Ce mois-ci",
        kpiSecondaireSous: "fiches envoyées",
      }}
    />
  );
}
