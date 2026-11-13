import { Fragment } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/components/ui/empty";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { FicheDepotDetail, LigneMouvement } from "@/portails/Sr/types";
import { TYPE_CFG, type SectionMouvement, type TypeMouvement } from "./constants";

const theme = getPortalMenu("sr").theme;

/** Couleurs bandeaux famille — maquette sr-fiche complete */
const SECTION_STYLE: Record<
  TypeMouvement,
  { bg: string; fg: string; label: string }
> = {
  numeraire: { bg: "#fef3c7", fg: "#92400e", label: "NUMÉRAIRE" },
  sigma: { bg: "#ede9fe", fg: "#5b21b6", label: "SYGMA" },
  systac: { bg: "#dbeafe", fg: "#1e40af", label: "SYSTAC" },
};

interface ReleveReglementsProps {
  detail: FicheDepotDetail | null;
  loading: boolean;
  error: boolean;
  sections: SectionMouvement[];
  totalLignesAffichees: number;
  totalLignesTableau: number;
  totalAnime: number;
  totauxSystacCorrespondent: boolean;
  onOuvrirFamille: (type: TypeMouvement) => void;
  peutModifier?: boolean;
  onModifierLigne?: (type: TypeMouvement, ligne: LigneMouvement) => void;
  /** Masque la bande Numéraire + SYGMA + SYSTAC (ex. plein écran). */
  masquerEquation?: boolean;
}

function EquationFamilles({
  sections,
  detail,
  loading,
  totalAnime,
  totalLignesTableau,
  onOuvrirFamille,
}: {
  sections: SectionMouvement[];
  detail: FicheDepotDetail | null;
  loading: boolean;
  totalAnime: number;
  totalLignesTableau: number;
  onOuvrirFamille: (type: TypeMouvement) => void;
}) {
  const items: {
    key: string;
    label: string;
    valeur: string;
    n: string;
    op: string;
    hi?: boolean;
    go?: () => void;
  }[] = sections.map((s, i) => {
    const cfg = TYPE_CFG[s.type];
    const n = s.lignes.length;
    return {
      key: s.type,
      label: cfg.label,
      valeur: formatMontant(String(s.montant)),
      n: `${n} ligne${n !== 1 ? "s" : ""}`,
      op: i === 0 ? "" : "+",
      go: () => onOuvrirFamille(s.type),
    };
  });

  items.push({
    key: "releve",
    label: "Total (FCFA)",
    valeur: formatMontant(String(totalAnime)),
    n: `Relevé · ${totalLignesTableau} ligne${totalLignesTableau !== 1 ? "s" : ""}`,
    op: "=",
    hi: true,
  });

  return (
    <div
      className="flex flex-wrap items-stretch gap-2 rounded-lg border p-2"
      style={{
        background: theme.bgColor,
        borderColor: theme.borderColor,
      }}
    >
      {items.map((q) => (
        <Fragment key={q.key}>
          {q.op ? (
            <span className="flex shrink-0 items-center text-base font-bold text-[#64748b]">
              {q.op}
            </span>
          ) : null}
          <button
            type="button"
            title={q.go ? "Afficher le détail" : undefined}
            disabled={!q.go && !loading}
            onClick={q.go}
            className={cn(
              "flex min-w-0 flex-[1_1_100px] flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-shadow",
              q.go && "cursor-pointer hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,.15)]",
              !q.go && "cursor-default",
            )}
            style={{
              background: q.hi ? theme.iconBg : "#fff",
              borderColor: q.hi ? theme.borderColor : "#e2e8f0",
              color: q.hi ? theme.textColor : "#0f172a",
            }}
            onMouseEnter={(e) => {
              if (q.go) e.currentTarget.style.borderColor = theme.topColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = q.hi
                ? theme.borderColor
                : "#e2e8f0";
            }}
          >
            <span className="flex justify-between gap-1.5 text-[10.5px] font-bold tracking-[0.08em] text-[#64748b] uppercase">
              {q.label}
              {q.go ? (
                <ChevronRight
                  size={14}
                  style={{ color: theme.textColor }}
                />
              ) : null}
            </span>
            <span
              className="truncate text-[13.5px] font-bold tabular-nums"
              style={{ color: q.hi ? theme.textColor : "#0f172a" }}
            >
              {loading ? "…" : q.valeur}
            </span>
            <span className="truncate text-[11.5px] text-[#64748b]">
              {detail || loading ? q.n : "—"}
            </span>
          </button>
        </Fragment>
      ))}
    </div>
  );
}

function beneficiaire(type: TypeMouvement, l: LigneMouvement): string {
  if (type === "systac") return l.designation || l.beneficiaire || "—";
  return l.beneficiaire || "—";
}

function montant(type: TypeMouvement, l: LigneMouvement): number {
  return type === "systac" ? (l.montant_groupe ?? l.depenses) : l.depenses;
}

function TableauComplet({
  sections,
  detail,
  peutModifier,
  onOuvrirFamille,
  onModifierLigne,
}: {
  sections: SectionMouvement[];
  detail: FicheDepotDetail;
  peutModifier?: boolean;
  onOuvrirFamille: (type: TypeMouvement) => void;
  onModifierLigne?: (type: TypeMouvement, ligne: LigneMouvement) => void;
}) {
  const grid =
    "minmax(150px,2fr) 90px 80px minmax(220px,1.15fr)";

  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className="grid gap-3 border-b border-[#e2e8f0] bg-[#f8fafc] px-[18px] py-2.5 text-[11.5px] font-semibold tracking-[0.06em] text-[#64748b] uppercase"
            style={{ gridTemplateColumns: grid }}
          >
            <span>Bénéficiaire / Désignation</span>
            <span className="text-center">N° OV</span>
            <span>Banque</span>
            <span className="text-right">Dépenses (FCFA)</span>
          </div>

          {sections.map(({ type, lignes, total, totalGroupe }) => {
            const style = SECTION_STYLE[type];
            const tot =
              type === "systac" ? (totalGroupe ?? total) : total;

            return (
              <Fragment key={type}>
                <button
                  type="button"
                  onClick={() => onOuvrirFamille(type)}
                  className="grid w-full gap-3 px-[18px] py-2.5 text-left transition-opacity hover:opacity-90"
                  style={{
                    gridTemplateColumns: grid,
                    background: style.bg,
                    color: style.fg,
                  }}
                >
                  <span className="text-[12.5px] font-bold tracking-wide">
                    {style.label}
                  </span>
                  <span />
                  <span />
                  <span className="text-right text-[13px] font-bold tabular-nums">
                    {tot !== undefined
                      ? `${formatMontant(tot)} FCFA`
                      : ""}
                  </span>
                </button>

                {lignes.map((l) => {
                  const cliquable = Boolean(peutModifier && onModifierLigne);
                  const contenu = (
                    <>
                      <span className="min-w-0 truncate font-semibold text-[#0f172a]">
                        {beneficiaire(type, l)}
                      </span>
                      <span
                        className={cn(
                          "text-center tabular-nums",
                          type === "systac" || !l.numero_ov
                            ? "text-[#94a3b8]"
                            : "text-[#475569]",
                        )}
                        style={{
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                          fontSize: 12.5,
                        }}
                      >
                        {type === "systac" ? "—" : (l.numero_ov ?? "—")}
                      </span>
                      <span className="truncate text-[#64748b]">
                        {type === "systac" ? "—" : (l.banque ?? "—")}
                      </span>
                      <span className="text-right font-medium tabular-nums text-[#0f172a]">
                        {formatMontant(String(montant(type, l)))}
                      </span>
                    </>
                  );
                  const classeLigne = cn(
                    "grid w-full gap-3 border-b border-[#f1f5f9] px-[18px] py-2 text-[13.5px] text-left",
                    cliquable && "cursor-pointer hover:bg-[#f8fafc]",
                  );
                  const styleLigne = { gridTemplateColumns: grid };

                  if (cliquable) {
                    return (
                      <button
                        key={`${type}-${l.id}`}
                        type="button"
                        onClick={() => onModifierLigne?.(type, l)}
                        className={classeLigne}
                        style={styleLigne}
                      >
                        {contenu}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={`${type}-${l.id}`}
                      className={classeLigne}
                      style={styleLigne}
                    >
                      {contenu}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}

          <div
            className="grid gap-3 px-[18px] py-2.5 text-[13.5px] font-semibold"
            style={{
              gridTemplateColumns: grid,
              background: theme.bgColor,
              color: theme.textColor,
            }}
          >
            <span>TOTAL GÉNÉRAL</span>
            <span />
            <span />
            <span className="text-right tabular-nums whitespace-nowrap">
              {formatMontant(detail.montant_total)}{" "}
              <span className="font-semibold">(FCFA)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReleveReglements({
  detail,
  loading,
  error,
  sections,
  totalLignesAffichees,
  totalLignesTableau,
  totalAnime,
  totauxSystacCorrespondent: _totauxSystacCorrespondent,
  onOuvrirFamille,
  peutModifier,
  onModifierLigne,
  masquerEquation = false,
}: ReleveReglementsProps) {
  void totalLignesAffichees;

  return (
    <div className="flex w-full flex-col gap-4">
      {masquerEquation ? null : (
        <EquationFamilles
          sections={sections}
          detail={detail}
          loading={loading}
          totalAnime={totalAnime}
          totalLignesTableau={totalLignesTableau}
          onOuvrirFamille={onOuvrirFamille}
        />
      )}

      {loading ? (
        <div className="space-y-2 rounded-lg border border-[#e2e8f0] bg-white p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[#e2e8f0] bg-white py-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-destructive/10 text-destructive"
              >
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Erreur de chargement</EmptyTitle>
              <EmptyDescription>
                Impossible de récupérer les lignes de cette fiche.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : !detail || totalLignesTableau === 0 ? (
        <div className="rounded-lg border border-[#e2e8f0] bg-white py-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Aucune ligne</EmptyTitle>
              <EmptyDescription>
                Cette fiche ne contient aucune ligne de règlement.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <TableauComplet
          sections={sections}
          detail={detail}
          peutModifier={peutModifier}
          onOuvrirFamille={onOuvrirFamille}
          onModifierLigne={onModifierLigne}
        />
      )}
    </div>
  );
}
