import { Drawer } from "@base-ui/react/drawer";
import { Loader2, Lock } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import type { TableauBordSp } from "@/portails/Sp/types/dashboard.interface";

function nombreMontant(valeur: string | null | undefined): number {
  const n = Number(String(valeur ?? "0").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formaterHeureIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}h${mm}`;
}

interface DrawerPositionTresorerieProps {
  ouvert: boolean;
  onOuvertChange: (ouvert: boolean) => void;
  data: TableauBordSp | null;
  clotureEnCours: boolean;
  disabled?: boolean;
  onCloturer: () => void;
}

/**
 * Tiroir droit « Position de trésorerie » : soldes, répartition et clôture.
 * Déclencheur « Clôturer » ; pour une journée clôturée, le tableau de bord
 * affiche « Réouvrir la journée » à sa place.
 */
export function DrawerPositionTresorerie({
  ouvert,
  onOuvertChange,
  data,
  clotureEnCours,
  disabled = false,
  onCloturer,
}: DrawerPositionTresorerieProps) {
  const theme = getPortalMenu("sp").theme;
  const journee = data?.journee ?? null;
  const ind = data?.indicateurs;
  const cloturee = journee?.etat === "cloture";

  const ouverture = nombreMontant(ind?.solde_ouverture);
  const recettes = nombreMontant(ind?.total_recettes);
  const depenses = nombreMontant(ind?.total_depenses);
  const cloture = nombreMontant(ind?.solde_cloture);
  const flux = recettes + depenses;
  const pctRecettes = flux > 0 ? Math.round((recettes / flux) * 100) : 0;
  const pctDepenses = flux > 0 ? 100 - pctRecettes : 0;

  const horsProgramme = data?.resume.ecarts.nombre_hors_programme ?? 0;
  const enAttente = nombreMontant(ind?.depenses_en_attente);
  const aTraiter = horsProgramme > 0 || enAttente > 0;
  const heureCloture = formaterHeureIso(journee?.date_derniere_mise_a_jour);
  const sousTitreCloture = cloturee
    ? `FCFA · clôturée à ${heureCloture}`
    : `FCFA · clôture estimée à ${heureCloture}`;

  return (
    <Drawer.Root
      open={ouvert}
      onOpenChange={(suivant) => onOuvertChange(suivant)}
      swipeDirection="right"
    >
      <Drawer.Trigger
        disabled={disabled}
        render={
          <Button
            type="button"
            className="h-[38px] gap-2 rounded-md px-4 text-sm font-semibold text-white hover:opacity-90"
            style={{ background: theme.ctaColor }}
            title="Position de trésorerie et clôture de la journée"
            aria-label="Position et clôture"
            disabled={disabled}
          />
        }
      >
        <Lock className="size-4" />
        Position et clôture
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-foreground/15 transition-opacity duration-300",
            "supports-backdrop-filter:backdrop-blur-xs",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            "data-[swiping]:duration-0",
          )}
        />
        <Drawer.Viewport className="fixed inset-0 z-50 flex justify-end pointer-events-none">
          <Drawer.Popup
            className={cn(
              "pointer-events-auto flex h-full w-full max-w-lg flex-col overflow-y-auto outline-none",
              "rounded-l-2xl border-l bg-card text-foreground shadow-xl",
              "origin-right transition-transform duration-300 ease-out",
              "translate-x-[calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-x,0px))]",
              "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
              "data-[swiping]:duration-0",
            )}
            style={{
              background: theme.bgColor,
              borderColor: `${theme.topColor}55`,
            }}
          >
            <Drawer.Content className="flex min-h-full flex-col px-7 py-8 sm:px-8 sm:py-10">
              <Drawer.Title
                className="text-[13px] font-semibold tracking-[0.18em] uppercase"
                style={{ color: theme.iconColor }}
              >
                Position de trésorerie
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                Soldes d&apos;ouverture, recettes, dépenses et clôture de la
                journée
                {journee ? ` ${journee.reference}` : ""}.
              </Drawer.Description>

              <p className="mt-4 font-heading text-[2.75rem] font-bold leading-[1.05] tracking-tight text-foreground tabular-nums sm:text-[3.25rem]">
                {formatMontant(String(cloture))}
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {sousTitreCloture}
              </p>

              <div
                className="my-8 h-px"
                style={{ background: `${theme.topColor}33` }}
              />

              <dl className="space-y-5 text-[16px] leading-snug sm:text-[17px]">
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-muted-foreground">Ouverture</dt>
                  <dd className="text-[18px] font-bold text-foreground tabular-nums sm:text-[20px]">
                    {formatMontant(String(ouverture))}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-muted-foreground">Recettes encaissées</dt>
                  <dd className="text-[18px] font-bold text-emerald-700 tabular-nums sm:text-[20px]">
                    + {formatMontant(String(recettes))}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-muted-foreground">Dépenses payées</dt>
                  <dd className="text-[18px] font-bold text-rose-700 tabular-nums sm:text-[20px]">
                    − {formatMontant(String(depenses))}
                  </dd>
                </div>
              </dl>

              <div className="mt-8">
                <div
                  className="flex h-3.5 overflow-hidden rounded-full"
                  style={{ background: theme.iconBg }}
                  role="img"
                  aria-label={`Répartition : recettes ${pctRecettes} pour cent, dépenses ${pctDepenses} pour cent`}
                >
                  {flux > 0 ? (
                    <>
                      <span
                        className="h-full min-w-0 bg-emerald-600"
                        style={{ width: `${pctRecettes}%` }}
                      />
                      <span
                        className="h-full min-w-0 bg-rose-500"
                        style={{ width: `${pctDepenses}%` }}
                      />
                    </>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                  <span>Recettes {pctRecettes} %</span>
                  <span>Dépenses {pctDepenses} %</span>
                </div>
              </div>

              {aTraiter ? (
                <div
                  className="mt-8 rounded-xl px-4 py-4"
                  style={{
                    background: theme.iconBg,
                    borderLeft: `4px solid ${theme.ctaColor}`,
                  }}
                >
                  <p
                    className="text-[12px] font-semibold tracking-[0.14em] uppercase"
                    style={{ color: theme.iconColor }}
                  >
                    À traiter avant clôture
                  </p>
                  <div className="mt-2 space-y-1 text-[16px] leading-relaxed text-foreground">
                    {horsProgramme > 0 ? (
                      <p>
                        {horsProgramme} dépense
                        {horsProgramme > 1 ? "s" : ""} hors programme
                      </p>
                    ) : null}
                    {enAttente > 0 ? (
                      <p>
                        {formatMontant(String(enAttente))} en attente de
                        paiement
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-auto pt-10" data-base-ui-swipe-ignore>
                <Button
                  type="button"
                  size="lg"
                  disabled={cloturee || clotureEnCours || !journee}
                  className="h-14 w-full text-[14px] font-bold tracking-[0.1em] uppercase shadow-md"
                  style={{ background: theme.ctaColor, color: "#fff" }}
                  onClick={onCloturer}
                >
                  {clotureEnCours ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {cloturee ? "Journée clôturée" : "Clôturer la journée"}
                </Button>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
