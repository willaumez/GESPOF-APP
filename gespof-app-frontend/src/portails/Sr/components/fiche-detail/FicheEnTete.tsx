import {
  Download,
  FileText,
  Loader2,
  Plus,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import { BoutonAcces } from "@/shared/components/ui/bouton-acces";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { BoutonPleinEcran } from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type { FicheDepotDetail } from "@/portails/Sr/types";
import { STATUT_CFG } from "./constants";
import { formaterDateHeureFr, formaterDateSansHeure } from "./utils";

const theme = getPortalMenu("sr").theme;

const STATUT_TAG: Record<string, { bg: string; fg: string }> = {
  envoyee: { bg: "#ecfdf5", fg: "#047857" },
  recue: { bg: "#fffbeb", fg: "#b45309" },
  cree: { bg: "#f1f5f9", fg: "#475569" },
};

interface FicheEnTeteProps {
  reference: string;
  detail: FicheDepotDetail | null;
  loading: boolean;
  aDesActions: boolean;
  peutEnvoyerCetteFiche: boolean;
  pretPourEnvoiSp?: boolean;
  peutSupprimer: boolean;
  afficheBarreActions: boolean;
  onImprimer: () => void;
  onTelechargerXlsx: () => void;
  telechargementEnCours?: boolean;
  onDemanderEnvoi: () => void;
  onDemanderSuppression: () => void;
  onAjouterLigne?: () => void;
  onOuvrirFicheBleue?: () => void;
  chargementFicheBleue?: boolean;
  /** Afficher le relevé consolidé en plein écran. */
  pleinEcranActif?: boolean;
  onBasculerPleinEcran?: () => void;
  peutPleinEcran?: boolean;
}

export function FicheEnTete({
  reference,
  detail,
  loading,
  aDesActions,
  peutEnvoyerCetteFiche,
  pretPourEnvoiSp = true,
  peutSupprimer,
  afficheBarreActions,
  onImprimer,
  onTelechargerXlsx,
  telechargementEnCours = false,
  onDemanderEnvoi,
  onDemanderSuppression,
  onAjouterLigne,
  onOuvrirFicheBleue,
  chargementFicheBleue = false,
  pleinEcranActif = false,
  onBasculerPleinEcran,
  peutPleinEcran = false,
}: FicheEnTeteProps) {
  const st = detail ? (STATUT_CFG[detail.statut] ?? STATUT_CFG.cree) : null;
  const tag = detail
    ? (STATUT_TAG[detail.statut] ?? STATUT_TAG.cree)
    : STATUT_TAG.cree;
  const envoiBloque = peutEnvoyerCetteFiche && !pretPourEnvoiSp;
  const brouillon = detail?.statut === "cree";

  return (
    <div className="flex w-full flex-col gap-4">
      {/* En-tête — maquette genCfg */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div
            className="font-mono text-xs"
            style={{
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
              color: theme.textColor,
            }}
          >
            Fiche de dépôt · {st?.label ?? "…"}
          </div>
          <h1
            className="m-0 text-[28px] font-semibold tracking-[-0.01em] text-[#0f172a]"
            style={{
              fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
              lineHeight: 1.2,
            }}
          >
            {reference}
          </h1>
          <div className="text-[14.5px] text-[#475569] text-pretty">
            Règlements consolidés par famille avant transmission au Service de
            Prévision.
          </div>
        </div>

        {afficheBarreActions ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!detail}
              onClick={onImprimer}
              className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <Printer size={16} />
              Imprimer
            </button>
            <button
              type="button"
              disabled={!detail || telechargementEnCours}
              onClick={onTelechargerXlsx}
              className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              {telechargementEnCours ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Télécharger .xlsx
            </button>

            {onOuvrirFicheBleue ? (
              <button
                type="button"
                disabled={chargementFicheBleue}
                onClick={onOuvrirFicheBleue}
                className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                {chargementFicheBleue ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                Fiche Bleue
              </button>
            ) : null}

            {peutPleinEcran && onBasculerPleinEcran ? (
              <BoutonPleinEcran
                actif={pleinEcranActif}
                onToggle={onBasculerPleinEcran}
                libelleEnter="Afficher le relevé en plein écran"
                libelleQuitter="Quitter le plein écran"
              />
            ) : null}

            {brouillon && onAjouterLigne ? (
              <button
                type="button"
                onClick={onAjouterLigne}
                className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc]"
              >
                <Plus size={16} />
                Ajouter une ligne
              </button>
            ) : null}

            {peutSupprimer ? (
              <BoutonAcces acces="SUPPRIMER_FICHE_DEPOT" asChild>
                <button
                  type="button"
                  onClick={onDemanderSuppression}
                  className="flex h-[38px] items-center gap-2 rounded-md border border-[#fecaca] bg-white px-3.5 text-sm font-medium text-[#b91c1c] transition-colors hover:bg-[#fef2f2]"
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
              </BoutonAcces>
            ) : null}

            {peutEnvoyerCetteFiche ? (
              <BoutonAcces acces="VALIDER_FICHE_DEPOT" asChild>
                <button
                  type="button"
                  disabled={envoiBloque}
                  onClick={onDemanderEnvoi}
                  className="flex h-[38px] items-center gap-2 rounded-md border-0 px-4 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                  style={{ background: theme.ctaColor }}
                  onMouseEnter={(e) => {
                    if (!envoiBloque)
                      e.currentTarget.style.background = theme.hoverColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.ctaColor;
                  }}
                >
                  <Send size={16} />
                  Envoyer au SP
                </button>
              </BoutonAcces>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Meta — maquette hasMeta */}
      <div
        className="grid overflow-hidden rounded-lg border border-[#e2e8f0] bg-white"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          boxShadow: `inset 0 3px 0 ${theme.topColor}`,
        }}
      >
        {(
          [
            {
              l: "Date de présentation",
              v: loading ? null : formaterDateSansHeure(detail?.date_presentation),
            },
            {
              l: "Générée par",
              v: loading
                ? null
                : detail
                  ? `${detail.genere_par.nom_complet}`
                  : "—",
            },
            {
              l: "Création",
              v: loading ? null : formaterDateHeureFr(detail?.date_creation),
            },
            {
              l: "Montant total",
              v: loading
                ? null
                : detail
                  ? `${formatMontant(detail.montant_total)} FCFA`
                  : "—",
              mono: true,
            },
            {
              l: "Statut",
              tag: true,
              v: loading ? null : (st?.label ?? "—"),
            },
          ] as const
        ).map((m) => (
          <div
            key={m.l}
            className="flex flex-col gap-1 border-r border-[#f1f5f9] px-[18px] py-4 last:border-r-0"
          >
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              {m.l}
            </span>
            {m.v === null ? (
              <Skeleton className="h-5 w-24" />
            ) : "tag" in m && m.tag ? (
              <span>
                <span
                  className="rounded px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: tag.bg, color: tag.fg }}
                >
                  {m.v}
                </span>
              </span>
            ) : (
              <span
                className="text-[14.5px] font-semibold tabular-nums text-[#0f172a]"
                style={{
                  fontFamily:
                    "mono" in m && m.mono
                      ? '"IBM Plex Mono", ui-monospace, monospace'
                      : undefined,
                }}
              >
                {m.v}
              </span>
            )}
          </div>
        ))}
      </div>

      {aDesActions && brouillon ? (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-[#e2e8f0] px-[18px] py-3 text-[13.5px] leading-[1.55] text-[#334155]"
          style={{ background: theme.bgColor }}
        >
          <span className="pt-0.5" style={{ color: theme.textColor }}>
            ⓘ
          </span>
          Fiche en brouillon : cliquez sur une ligne pour la modifier avant
          l&apos;envoi au Service de Prévision.
        </div>
      ) : null}
    </div>
  );
}
