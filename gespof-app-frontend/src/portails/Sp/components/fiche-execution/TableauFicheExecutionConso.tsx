import { Inbox, Loader2 } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import {
  estConteneurTypeSection,
  formaterMontantFcfa,
  LIBELLE_GROUPE_TYPE,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  ColonneConso,
  LigneConso,
  MatriceFicheExecutionConso,
} from "@/portails/Sp/types/fiche-execution-conso.interface";

const theme = getPortalMenu("sp").theme;

function valeurCellule(
  ligne: LigneConso,
  colonne: ColonneConso,
): string | null {
  if (colonne.type === "total") {
    return ligne.totaux_semaine[colonne.cle] ?? null;
  }
  return (
    ligne.valeurs[colonne.cle] ??
    (colonne.date ? ligne.valeurs[colonne.date] : null)
  );
}

function grilleColonnes(colonnes: ColonneConso[], vue: string): string {
  const largeurPeriode = vue === "annee" ? "130px" : "140px";
  const periodes = colonnes
    .filter((c) => c.type !== "total")
    .map(() => largeurPeriode)
    .join(" ");
  return `minmax(230px, 1.6fr)${periodes ? ` ${periodes}` : ""} 160px`;
}

function largeurMin(colonnes: ColonneConso[], vue: string): number {
  const n = colonnes.filter((c) => c.type !== "total").length;
  const largeurPeriode = vue === "annee" ? 130 : 140;
  return 230 + n * largeurPeriode + 160 + (n + 2) * 12;
}

interface TableauFicheExecutionConsoProps {
  matrice: MatriceFicheExecutionConso | null;
  chargement?: boolean;
  /** Conservé pour compatibilité (plein écran retiré de la page maquette). */
  maxHeightClassName?: string;
}

/**
 * Tableau consolidé — grille Prototype v2 (Rubrique · périodes · Total).
 */
export function TableauFicheExecutionConso({
  matrice,
  chargement = false,
}: TableauFicheExecutionConsoProps) {
  const colonnes = matrice?.colonnes ?? [];
  const lignes = matrice?.lignes ?? [];
  const vue = matrice?.vue ?? "semaine";
  const periodes = colonnes.filter((c) => c.type !== "total");
  const colonneTotal = colonnes.find((c) => c.type === "total") ?? null;
  const grille = grilleColonnes(colonnes, vue);
  const minW = largeurMin(colonnes, vue);

  const idPremiereRecette = lignes.find(
    (l) => l.est_racine && l.type === "recette",
  )?.id;
  const idPremiereDepense = lignes.find(
    (l) => l.est_racine && l.type === "depense",
  )?.id;

  if (chargement && !matrice) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[#64748b]">
        <Loader2 className="size-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (!matrice || lignes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-[18px] py-8 text-[#64748b]">
        <Inbox className="size-5" />
        <span className="text-sm">
          Aucune rubrique consolidée pour cette période.
        </span>
      </div>
    );
  }

  function celluleMontant(brut: string | null, options?: { strong?: boolean }) {
    return (
      <span
        className="min-w-0 text-right tabular-nums"
        style={{
          fontWeight: options?.strong ? 600 : 400,
          color: "#0f172a",
          lineHeight: 1.35,
        }}
      >
        {brut == null ? "—" : formaterMontantFcfa(brut)}
      </span>
    );
  }

  function ligneGroupe(type: "recette" | "depense") {
    const libelle = type === "recette" ? "Recettes" : "Dépenses";
    return (
      <div
        key={`groupe-${type}`}
        className="grid items-center border-b border-[#f1f5f9] text-[13.5px]"
        style={{
          gridTemplateColumns: grille,
          gap: 12,
          minHeight: 46,
          padding: "8px 18px",
          background: theme.bgColor,
        }}
      >
        <span
          className="font-semibold"
          style={{ color: theme.textColor, lineHeight: 1.35 }}
        >
          {libelle}
        </span>
        {periodes.map((c) => (
          <span key={`g-${type}-${c.cle}`} />
        ))}
        <span />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: minW }}>
        <div
          className="grid items-center border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
          style={{
            gridTemplateColumns: grille,
            gap: 12,
            padding: "10px 18px",
          }}
        >
          <span>Rubrique</span>
          {periodes.map((colonne) => (
            <span key={colonne.cle} className="text-right">
              {colonne.libelle}
            </span>
          ))}
          <span className="text-right">{colonneTotal?.libelle ?? "Total"}</span>
        </div>

        {lignes.flatMap((ligne) => {
          const afficherGroupe =
            ligne.est_racine &&
            (ligne.type === "recette" || ligne.type === "depense") &&
            ligne.id ===
              (ligne.type === "recette"
                ? idPremiereRecette
                : idPremiereDepense) &&
            !estConteneurTypeSection(ligne.nom, ligne.type, true);

          const estSectionConteneur =
            ligne.est_racine &&
            (ligne.type === "recette" || ligne.type === "depense") &&
            estConteneurTypeSection(ligne.nom, ligne.type, true);

          const fondSection =
            estSectionConteneur || (ligne.est_racine && ligne.type === "solde");
          const indent = styleIndentSection(
            ligne.est_racine ? 0 : Math.max(1, ligne.niveau),
          );

          const row = (
            <div
              key={ligne.id}
              className="grid items-center border-b border-[#f1f5f9] text-[13.5px]"
              style={{
                gridTemplateColumns: grille,
                gap: 12,
                minHeight: 46,
                padding: "8px 18px",
                background: fondSection ? theme.bgColor : "#fff",
              }}
            >
              <span
                className="min-w-0 break-words whitespace-normal"
                style={{
                  marginLeft: indent.marginLeft,
                  paddingLeft: indent.paddingLeft,
                  fontWeight:
                    ligne.est_racine || !ligne.est_feuille ? 600 : 400,
                  color:
                    fondSection || ligne.est_racine
                      ? theme.textColor
                      : "#0f172a",
                  lineHeight: 1.35,
                }}
                title={
                  ligne.est_racine &&
                  (ligne.type === "recette" || ligne.type === "depense")
                    ? LIBELLE_GROUPE_TYPE[ligne.type]
                    : ligne.nom
                }
              >
                {ligne.nom}
              </span>
              {periodes.map((colonne) => (
                <span key={`${ligne.id}-${colonne.cle}`} className="text-right">
                  {celluleMontant(valeurCellule(ligne, colonne))}
                </span>
              ))}
              <span className="text-right">
                {colonneTotal
                  ? celluleMontant(valeurCellule(ligne, colonneTotal), {
                      strong: true,
                    })
                  : null}
              </span>
            </div>
          );

          return afficherGroupe
            ? [ligneGroupe(ligne.type as "recette" | "depense"), row]
            : [row];
        })}
      </div>
    </div>
  );
}
