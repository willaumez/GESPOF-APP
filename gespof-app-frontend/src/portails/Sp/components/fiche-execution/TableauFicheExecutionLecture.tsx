import type { ReactNode } from "react";
import { Inbox, Loader2, Sunrise } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { getPortalMenu } from "@/shared/config/menu";
import {
  formaterMontantFcfa,
  formaterTauxRealise,
  parseMontantNombre,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  FicheExecutionDetail,
  SectionFicheExecution,
} from "@/portails/Sp/types/fiche-execution.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";

function estZero(valeur: string): boolean {
  const n = parseMontantNombre(valeur);
  return n !== null && n === 0;
}

function estNegatif(valeur: string): boolean {
  const n = parseMontantNombre(valeur);
  return n !== null && n < 0;
}

/**
 * Totaux d'exécution (hors solde d'ouverture) : le solde bancaire fausse
 * le taux si on utilise les montants_total_* API qui l'incluent.
 */
function totauxExecutionHorsSolde(sections: SectionFicheExecution[]): {
  programme: number;
  realise: number;
  ecart: number;
} {
  let programme = 0;
  let realise = 0;
  for (const s of sections) {
    if (s.type === "solde") continue;
    programme += parseMontantNombre(s.montant_programme) ?? 0;
    realise += parseMontantNombre(s.montant_realise) ?? 0;
  }
  const ecart = realise === 0 ? 0 : programme - realise;
  return { programme, realise, ecart };
}

interface LigneAplat {
  id: number;
  nom: string;
  type: TypeSectionBibliotheque;
  niveau: number;
  programme: string;
  realise: string;
  ecart: string;
  estRacine: boolean;
  nonProgramme: boolean;
}

function aplatirSections(
  sections: SectionFicheExecution[],
  niveau = 0,
  typeRacine?: TypeSectionBibliotheque,
): LigneAplat[] {
  const out: LigneAplat[] = [];
  for (const s of sections) {
    const type = niveau === 0 ? s.type : (typeRacine ?? s.type);
    out.push({
      id: s.id,
      nom: s.nom,
      type,
      niveau,
      programme: s.montant_programme,
      realise: s.montant_realise,
      ecart: s.montant_ecart,
      estRacine: niveau === 0,
      nonProgramme: Boolean(s.non_programme),
    });
    if (s.sous_sections.length > 0) {
      out.push(...aplatirSections(s.sous_sections, niveau + 1, type));
    }
  }
  return out;
}

function couleurEcart(ecart: string): string {
  if (estNegatif(ecart)) return "#b91c1c";
  const n = Number(ecart.replace(",", "."));
  if (Number.isFinite(n) && n > 0) return "#047857";
  return "#64748b";
}

const GRILLE_FE =
  "minmax(240px, 2fr) repeat(3, minmax(140px, 1fr)) 80px";

interface TableauFicheExecutionLectureProps {
  fiche: FicheExecutionDetail | null;
  chargement?: boolean;
  introuvable?: boolean;
  /** Affiche l'en-tête « Fiche d'exécution » (référence mono + sous-titre). */
  avecEnTete?: boolean;
  /** Plein écran : pas de bordure / rayon (déjà collé au viewport). */
  sansCadre?: boolean;
  actions?: ReactNode;
}

/**
 * Lecture seule — même présentation que l'onglet Fiche d'exécution (maquette v2).
 */
export function TableauFicheExecutionLecture({
  fiche,
  chargement = false,
  introuvable = false,
  avecEnTete = false,
  sansCadre = false,
  actions,
}: TableauFicheExecutionLectureProps) {
  const theme = getPortalMenu("sp").theme;
  const lignes = fiche ? aplatirSections(fiche.sections) : [];
  const heureMaj = fiche?.date_dernier_mise_jour
    ? new Date(fiche.date_dernier_mise_jour).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const totaux = fiche
    ? totauxExecutionHorsSolde(fiche.sections)
    : { programme: 0, realise: 0, ecart: 0 };
  const totalTaux = formaterTauxRealise(totaux.programme, totaux.realise);

  const enTete = avecEnTete ? (
    <div
      className="flex shrink-0 flex-wrap items-center border-b border-[#e2e8f0]"
      style={{ gap: 12, padding: "14px 18px" }}
    >
      <div className="flex min-w-0 flex-col" style={{ gap: 2 }}>
        <span className="text-[15px] font-semibold text-[#0f172a]">
          Fiche d&apos;exécution{" "}
          <span
            className="font-normal text-[#64748b]"
            style={{
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
              fontSize: 12,
            }}
          >
            {fiche?.reference ?? "—"}
          </span>
        </span>
        <span className="text-[12.5px] text-[#64748b]">
          {chargement
            ? "Chargement de la composition…"
            : introuvable
              ? "Fiche introuvable."
              : heureMaj
                ? `Dernière mise à jour à ${heureMaj} · montants en FCFA`
                : "Montants en FCFA"}
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-4">
        {fiche && !chargement && !introuvable ? (
          <div
            className="flex flex-wrap items-end gap-5 text-right"
            aria-label="Totaux d'exécution (hors solde)"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Programmé
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-[#0f172a]">
                {formaterMontantFcfa(totaux.programme)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Réalisé
              </span>
              <span
                className="text-[13px] font-bold tabular-nums"
                style={{ color: theme.textColor }}
              >
                {formaterMontantFcfa(totaux.realise)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Écart
              </span>
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{ color: couleurEcart(String(totaux.ecart)) }}
              >
                {formaterMontantFcfa(totaux.ecart)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Taux
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-[#0f172a]">
                {totalTaux}
              </span>
            </div>
          </div>
        ) : null}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  ) : null;

  let corps: ReactNode;
  if (chargement) {
    corps = (
      <div className="flex min-h-[160px] flex-1 items-center justify-center text-[#64748b]">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  } else if (introuvable || !fiche) {
    corps = (
      <div
        className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 text-center"
        role="status"
      >
        <Sunrise className="size-6 text-[#64748b]" aria-hidden />
        <p className="text-[13.5px] text-[#64748b]">
          Fiche d&apos;exécution introuvable.
        </p>
      </div>
    );
  } else {
    corps = (
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain">
        <div style={{ minWidth: 760 }}>
            <div
              className="grid items-center border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
              style={{
                gridTemplateColumns: GRILLE_FE,
                gap: 12,
                padding: "9px 18px",
              }}
            >
              <span>Rubrique</span>
              <span className="text-right">Programmé</span>
              <span className="text-right">Réalisé</span>
              <span className="text-right">Écart</span>
              <span className="text-right">Taux</span>
            </div>

            {lignes.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-[#64748b]">
                <Inbox className="size-5" aria-hidden />
                <span className="text-[13px]">Aucune recette ni dépense.</span>
              </div>
            ) : (
              lignes.map((ligne) => {
                const afficherEcart =
                  ligne.type !== "solde" && !estZero(ligne.realise);
                if (ligne.estRacine) {
                  return (
                    <div
                      key={ligne.id}
                      className="grid items-center border-y border-[#e2e8f0] text-[12.5px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        gridTemplateColumns: GRILLE_FE,
                        gap: 12,
                        minHeight: 38,
                        padding: "0 18px",
                        background: theme.bgColor,
                        color: theme.textColor,
                      }}
                    >
                      <span>{ligne.nom}</span>
                      <span className="text-right tabular-nums tracking-normal">
                        {formaterMontantFcfa(ligne.programme)}
                      </span>
                      <span className="text-right tabular-nums tracking-normal">
                        {ligne.type === "solde"
                          ? formaterMontantFcfa(ligne.programme)
                          : formaterMontantFcfa(ligne.realise)}
                      </span>
                      <span />
                      <span />
                    </div>
                  );
                }
                return (
                  <div
                    key={ligne.id}
                    className="grid items-center border-b border-[#f1f5f9] text-[14px]"
                    style={{
                      gridTemplateColumns: GRILLE_FE,
                      gap: 12,
                      minHeight: 42,
                      padding: "0 18px 0 30px",
                      background: ligne.nonProgramme ? "#fffbeb" : "#fff",
                    }}
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className="min-w-0 break-words whitespace-normal leading-snug"
                        style={styleIndentSection(
                          Math.max(0, ligne.niveau - 1),
                        )}
                      >
                        {ligne.nom}
                      </span>
                      {ligne.nonProgramme ? (
                        <span className="text-[11px] font-semibold text-[#b45309]">
                          Hors programme
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right tabular-nums text-[#475569]">
                      {formaterMontantFcfa(ligne.programme)}
                    </span>
                    <span className="text-right font-medium tabular-nums">
                      {ligne.type === "solde"
                        ? formaterMontantFcfa(ligne.programme)
                        : formaterMontantFcfa(ligne.realise)}
                    </span>
                    <span
                      className="text-right tabular-nums"
                      style={{
                        color: afficherEcart
                          ? couleurEcart(ligne.ecart)
                          : "#64748b",
                      }}
                    >
                      {afficherEcart ? formaterMontantFcfa(ligne.ecart) : ""}
                    </span>
                    <span className="text-right tabular-nums text-[#64748b]">
                      {ligne.type === "solde"
                        ? ""
                        : formaterTauxRealise(ligne.programme, ligne.realise)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white",
        !sansCadre && "rounded-lg border border-[#e2e8f0]",
      )}
    >
      {enTete}
      {corps}
    </div>
  );
}
