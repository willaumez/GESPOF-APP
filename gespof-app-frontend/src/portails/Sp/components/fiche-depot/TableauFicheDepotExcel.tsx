import { useMemo } from "react";
import { FileText, Loader2 } from "lucide-react";
import {
  TableauExcelResizable,
  type ColonneExcelDef,
  type LigneExcelDef,
} from "@/portails/Sp/components/plein-ecran/TableauExcelResizable";
import { formatMontant } from "@/shared/lib/format";
import type {
  FicheDepotDetailSp,
  LigneMouvementSp,
} from "@/portails/Sp/types/fiche-depot.interface";

function formaterMontant(valeur: string | number): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? String(valeur) : formate;
}

const COLONNES_MOUVEMENT: ColonneExcelDef[] = [
  {
    id: "beneficiaire",
    label: "Bénéficiaire / Désignation",
    defaultSize: "40%",
    minSize: "20%",
  },
  {
    id: "ov",
    label: "N° OV",
    defaultSize: "15%",
    minSize: "10%",
    align: "center",
  },
  {
    id: "banque",
    label: "Banque",
    defaultSize: "20%",
    minSize: "12%",
  },
  {
    id: "depenses",
    label: "Dépenses (FCFA)",
    defaultSize: "25%",
    minSize: "14%",
    align: "right",
  },
];

function lignesDepuisMouvements(
  prefixe: string,
  titreSection: string,
  lignes: LigneMouvementSp[],
  modeSystac = false,
): LigneExcelDef[] {
  if (lignes.length === 0) return [];
  const out: LigneExcelDef[] = [
    {
      key: `${prefixe}-titre`,
      groupe: true,
      groupeClassName: "bg-muted/80",
      cells: {
        beneficiaire: (
          <span className="truncate text-[12px] font-bold tracking-wide">
            {titreSection}
          </span>
        ),
        ov: null,
        banque: null,
        depenses: null,
      },
    },
  ];

  for (const l of lignes) {
    out.push({
      key: `${prefixe}-${l.id}`,
      cells: {
        beneficiaire: (
          <span className="truncate font-medium">
            {modeSystac
              ? (l.designation || l.beneficiaire || "—")
              : (l.beneficiaire || "—")}
          </span>
        ),
        ov: (
          <span className="tabular-nums text-muted-foreground">
            {modeSystac ? "—" : (l.numero_ov ?? "—")}
          </span>
        ),
        banque: (
          <span className="truncate">
            {modeSystac ? "—" : (l.banque ?? "—")}
          </span>
        ),
        depenses: (
          <span className="truncate font-semibold tabular-nums">
            {formaterMontant(
              modeSystac ? (l.montant_groupe ?? l.depenses) : l.depenses,
            )}
          </span>
        ),
      },
    });
  }
  return out;
}

export function TableauFicheDepotExcel({
  fiche,
  chargement,
}: {
  fiche: FicheDepotDetailSp | null;
  chargement?: boolean;
}) {
  const lignesExcel = useMemo(() => {
    if (!fiche) return [];
    return [
      ...lignesDepuisMouvements("num", "Numéraire", fiche.mouvements_numeraire),
      ...lignesDepuisMouvements("syg", "SYGMA", fiche.mouvements_sygma),
      ...lignesDepuisMouvements("sys", "SYSTAC (groupes)", fiche.mouvements_systac, true),
    ];
  }, [fiche]);

  if (chargement && !fiche) {
    return (
      <div className="flex h-full min-h-44 items-center justify-center rounded-xl border text-muted-foreground">
        <div className="flex items-center gap-2 text-[13px]">
          <Loader2 className="size-5 animate-spin" />
          Chargement de la Fiche de dépôt…
        </div>
      </div>
    );
  }

  if (!fiche) {
    return (
      <div
        className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center"
        role="status"
      >
        <FileText className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">
          Aucune Fiche de dépôt à afficher.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap gap-2">
        {[
          ["Total", fiche.montant_total],
          ["Numéraire", fiche.total_numeraire],
          ["SYGMA", fiche.total_sigma],
          ["SYSTAC", fiche.total_systac],
        ].map(([label, valeur]) => (
          <div
            key={label}
            className="min-w-[8rem] flex-1 rounded-lg border bg-muted/40 px-3 py-2"
          >
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-[14px] font-bold tabular-nums">
              {formaterMontant(valeur)}
            </p>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <TableauExcelResizable
          colonnes={COLONNES_MOUVEMENT}
          lignes={lignesExcel}
          videMessage="Aucun mouvement groupé sur cette fiche."
          classNameBordure="border-2 border-primary/40"
        />
      </div>
    </div>
  );
}
