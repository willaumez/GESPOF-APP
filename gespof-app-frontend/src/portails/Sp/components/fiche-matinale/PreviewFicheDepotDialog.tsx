import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightLeft, CheckCheck, FileText, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { formatMontant } from "@/shared/lib/format";
import { detailFicheDepot } from "@/portails/Sp/api/fiches-depot";
import { depensesJour, validerDepensesJour } from "@/portails/Sp/api/journees-tresorerie";
import {
  CLASSE_LIGNE_RAPPROCHEE, clesDepensesFiche, formaterDateHeure, idLigneDepot,
  titreRapprochement,
} from "@/portails/Sp/components/rapprochement/rapprochement";
import type {
  EtatDepensesJour, FamilleDepense, RapprochementElement,
} from "@/portails/Sp/types/journee-tresorerie.interface";
import { TableauFicheDepotExcel } from "@/portails/Sp/components/fiche-depot/TableauFicheDepotExcel";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type {
  FicheDepotDetailSp, FicheDepotResumeSp, LigneMouvementSp,
} from "@/portails/Sp/types/fiche-depot.interface";

function formaterMontant(valeur: string | number): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? String(valeur) : formate;
}

/**
 * Rapprochement d'une ligne : absent (undefined) quand la ligne n'est pas dans la
 * liste validée de la journée. Une ligne rapprochée est surlignée en vert.
 */
type RapprochementDeLigne = (
  famille: FamilleDepense,
  ligne: LigneMouvementSp,
) => RapprochementElement | null | undefined;

function TableauMouvements({
  titre,
  famille,
  lignes,
  rapprochementDe,
}: {
  titre: string;
  famille: FamilleDepense;
  lignes: LigneMouvementSp[];
  rapprochementDe?: RapprochementDeLigne;
}) {
  if (lignes.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-foreground">{titre}</p>
      <Table containerClassName="rounded-xl border">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Bénéficiaire</TableHead>
            <TableHead className="w-28">N° OV</TableHead>
            <TableHead className="w-28">Banque</TableHead>
            <TableHead className="w-36 text-right">Dépenses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((l) => {
            const rapprochement = rapprochementDe?.(famille, l);
            return (
            <TableRow
              key={l.id}
              className={rapprochement ? CLASSE_LIGNE_RAPPROCHEE : undefined}
              title={titreRapprochement(rapprochement)}
            >
              <TableCell className="font-medium">{l.beneficiaire || "—"}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {l.numero_ov ?? "—"}
              </TableCell>
              <TableCell>{l.banque ?? "—"}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formaterMontant(l.depenses)}
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TableauSystacGroupes({
  lignes,
  rapprochementDe,
}: {
  lignes: LigneMouvementSp[];
  rapprochementDe?: RapprochementDeLigne;
}) {
  if (lignes.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-foreground">SYSTAC (groupes)</p>
      <Table containerClassName="rounded-xl border">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Désignation</TableHead>
            <TableHead className="w-36 text-right">Montant groupé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((l) => {
            const rapprochement = rapprochementDe?.("systac", l);
            return (
            <TableRow
              key={l.id}
              className={rapprochement ? CLASSE_LIGNE_RAPPROCHEE : undefined}
              title={titreRapprochement(rapprochement)}
            >
              <TableCell className="font-medium">
                {l.designation || l.beneficiaire || "—"}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formaterMontant(l.montant_groupe ?? l.depenses)}
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Détail d'une fiche de dépôt. Avec `referenceJournee`, chaque ligne affiche son
 * rapprochement avec la Fiche d'exécution (liste des dépenses validée de la journée).
 */
export function ContenuDetailFicheDepot({
  reference,
  referenceJournee,
}: {
  reference: string;
  referenceJournee?: string;
}) {
  const [chargement, setChargement] = useState(false);
  const [fiche, setFiche] = useState<FicheDepotDetailSp | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [etatDepenses, setEtatDepenses] = useState<EtatDepensesJour | null>(null);

  useEffect(() => {
    if (!referenceJournee) return;
    let annule = false;
    void depensesJour(referenceJournee)
      .then((e) => {
        if (!annule) setEtatDepenses(e);
      })
      .catch(() => {
        if (!annule) setEtatDepenses(null);
      });
    return () => {
      annule = true;
    };
  }, [referenceJournee, reference]);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setFiche(null);
    setIntrouvable(false);
    void detailFicheDepot(reference)
      .then((detail) => {
        if (!annule) setFiche(detail);
      })
      .catch(() => {
        if (!annule) setIntrouvable(true);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [reference]);

  if (chargement) {
    return (
      <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (introuvable || !fiche) {
    return (
      <div
        className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center"
        role="status"
      >
        <FileText className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-[13.5px] text-muted-foreground">
          Fiche de dépôt introuvable.
        </p>
      </div>
    );
  }

  // Rapprochements indexés par clé de dépense (même clé que côté serveur).
  const listeValidee = referenceJournee ? etatDepenses?.depenses_jour ?? null : null;
  const parCle = new Map(
    (listeValidee?.depenses ?? []).map((d) => [d.cle, d.rapprochement] as const),
  );
  const clesLignes = listeValidee ? clesDepensesFiche(fiche) : new Map<string, string>();
  const rapprochementDe: RapprochementDeLigne | undefined = referenceJournee
    ? (famille, ligne) => {
        const cle = clesLignes.get(idLigneDepot(famille, ligne));
        return cle !== undefined && parCle.has(cle) ? parCle.get(cle) ?? null : undefined;
      }
    : undefined;
  const nombreLignes = clesLignes.size;
  const nombreRapprochees = [...clesLignes.values()]
    .filter((cle) => parCle.get(cle) != null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
        <p className="text-[15px] font-semibold tabular-nums text-foreground">
          {fiche.reference}
        </p>
        <Badge variant="outline" className="capitalize text-[11px]">
          {fiche.statut.replace("_", " ")}
        </Badge>
        <span>Présentation {fiche.date_presentation}</span>
        <span aria-hidden>·</span>
        <span>{fiche.genere_par.nom_complet}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ["Total", fiche.montant_total],
          ["Numéraire", fiche.total_numeraire],
          ["SYGMA", fiche.total_sigma],
          ["SYSTAC", fiche.total_systac],
        ].map(([label, valeur]) => (
          <div key={label} className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-[15px] font-bold tabular-nums">
              {formaterMontant(valeur)}
            </p>
          </div>
        ))}
      </div>

      {referenceJournee && etatDepenses ? (
        listeValidee ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[12.5px] text-emerald-950">
            <Link2 className="size-4 shrink-0 text-emerald-600" />
            <span>
              <span className="font-semibold tabular-nums">
                {nombreRapprochees} / {nombreLignes}
              </span>{" "}
              ligne{nombreLignes > 1 ? "s" : ""} rapprochée{nombreRapprochees > 1 ? "s" : ""} avec la Fiche
              d&apos;exécution.
            </span>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
            Les dépenses de la journée ne sont pas encore validées : aucun rapprochement avec la
            Fiche d&apos;exécution pour le moment.
          </div>
        )
      ) : null}

      <TableauMouvements
        titre="Numéraire"
        famille="numeraire"
        lignes={fiche.mouvements_numeraire}
        rapprochementDe={listeValidee ? rapprochementDe : undefined}
      />
      <TableauMouvements
        titre="SYGMA"
        famille="sygma"
        lignes={fiche.mouvements_sygma}
        rapprochementDe={listeValidee ? rapprochementDe : undefined}
      />
      <TableauSystacGroupes
        lignes={fiche.mouvements_systac}
        rapprochementDe={listeValidee ? rapprochementDe : undefined}
      />

      {fiche.mouvements_numeraire.length === 0
        && fiche.mouvements_sygma.length === 0
        && fiche.mouvements_systac.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground" role="status">
          Aucun mouvement groupé trouvé sur cette fiche.
        </p>
      ) : null}
    </div>
  );
}

interface PreviewFicheDepotDialogProps {
  reference: string | null;
  onClose: () => void;
  /** Plusieurs fiches du jour : liste à gauche pour basculer l'aperçu. */
  fichesDisponibles?: FicheDepotResumeSp[];
  /** Journée dont les dépenses sont validées puis rapprochées (bouton « Valider »). */
  referenceJournee?: string;
  /** Journée clôturée : la liste validée ne peut plus être modifiée. */
  lectureSeule?: boolean;
}

export function PreviewFicheDepotDialog({
  reference,
  onClose,
  fichesDisponibles,
  referenceJournee,
  lectureSeule = false,
}: PreviewFicheDepotDialogProps) {
  const navigate = useNavigate();
  const theme = getPortalMenu("sp").theme;
  const ouvert = reference !== null;
  const liste = fichesDisponibles ?? [];
  const modeListe = liste.length > 1;

  const [apercuRef, setApercuRef] = useState<string | null>(reference);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [detailExcel, setDetailExcel] = useState<FicheDepotDetailSp | null>(null);
  const [chargementExcel, setChargementExcel] = useState(false);
  const [etatCharge, setEtat] = useState<EtatDepensesJour | null>(null);
  const [validation, setValidation] = useState(false);

  // État de la liste validée de la journée (fusion des fiches de dépôt).
  useEffect(() => {
    if (!ouvert || !referenceJournee) return;
    let annule = false;
    void depensesJour(referenceJournee)
      .then((e) => {
        if (!annule) setEtat(e);
      })
      .catch(() => {
        if (!annule) setEtat(null);
      });
    return () => {
      annule = true;
    };
  }, [ouvert, referenceJournee]);

  // Hors journée (archives, listes) : simple aperçu, sans validation.
  const etat = ouvert && referenceJournee ? etatCharge : null;
  const listeValidee = etat?.depenses_jour ?? null;
  const nonIntegrees = new Set(etat?.fiches_non_integrees ?? []);
  const aJour = listeValidee != null && nonIntegrees.size === 0;
  const nbNouvelles = etat?.nouvelles ?? 0;

  function ouvrirRapprochement() {
    if (!referenceJournee) return;
    setPleinEcran(false);
    onClose();
    void navigate(
      `/sp/fiche-matinale/rapprochement-depenses/${encodeURIComponent(referenceJournee)}`,
    );
  }

  async function valider() {
    if (!referenceJournee || validation) return;
    setValidation(true);
    try {
      const { depenses_jour, nouvelles } = await validerDepensesJour(referenceJournee);
      const pluriel = (n: number) => (n > 1 ? "s" : "");
      toast.success(
        listeValidee
          ? `Liste mise à jour : ${nouvelles} nouvelle${pluriel(nouvelles)} dépense${pluriel(nouvelles)} (sans doublon), ${depenses_jour.nombre} au total.`
          : `Liste validée : ${depenses_jour.nombre} dépense${pluriel(depenses_jour.nombre)} de ${depenses_jour.fiches.length} fiche${pluriel(depenses_jour.fiches.length)}.`,
      );
      setEtat(await depensesJour(referenceJournee));
    } catch (e) {
      toast.error(messageDonneesOuDefaut(
        e instanceof Error ? e.message : null,
        "Impossible de valider les dépenses.",
      ));
    } finally {
      setValidation(false);
    }
  }

  useEffect(() => {
    setApercuRef(reference);
    setPleinEcran(false);
  }, [reference]);

  useEffect(() => {
    if (!pleinEcran || !apercuRef) {
      setDetailExcel(null);
      return;
    }
    let annule = false;
    setChargementExcel(true);
    void detailFicheDepot(apercuRef)
      .then((d) => {
        if (!annule) setDetailExcel(d);
      })
      .catch(() => {
        if (!annule) setDetailExcel(null);
      })
      .finally(() => {
        if (!annule) setChargementExcel(false);
      });
    return () => {
      annule = true;
    };
  }, [pleinEcran, apercuRef]);

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        if (!o) {
          setPleinEcran(false);
          onClose();
        }
      }}
    >
      <TooltipProvider>
      <DialogContent
        className={cn(
          "flex h-[min(92vh,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0",
          modeListe
            ? "w-[min(96vw,80rem)] sm:max-w-[80rem]"
            : "w-[min(96vw,72rem)] sm:max-w-[72rem]",
        )}
        onEscapeKeyDown={(e) => {
          if (pleinEcran) {
            e.preventDefault();
            setPleinEcran(false);
          }
        }}
      >
        <div className="flex min-h-0 flex-1">
          {modeListe ? (
            <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30 sm:w-64">
              <p className="shrink-0 border-b px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Fiches du jour
              </p>
              <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {liste.map((item) => {
                  const apercue = item.reference === apercuRef;
                  return (
                    <li key={item.reference}>
                      <button
                        type="button"
                        onClick={() => setApercuRef(item.reference)}
                        className={cn(
                          "mb-1 flex w-full flex-col rounded-lg border px-2.5 py-2 text-left transition-colors",
                          apercue ? "border-2 shadow-sm" : "border-transparent hover:bg-background/80",
                        )}
                        style={apercue ? { borderColor: theme.topColor } : undefined}
                      >
                        <span className="truncate text-[12.5px] font-semibold tabular-nums">
                          {item.reference}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {formaterMontant(item.montant_total)}
                        </span>
                        {listeValidee ? (
                          nonIntegrees.has(item.reference) ? (
                            <span className="mt-1 inline-flex w-fit items-center gap-0.5 rounded bg-amber-200 px-1 text-[9.5px] font-semibold uppercase text-amber-950">
                              <Sparkles className="size-2.5" />
                              Non intégrée
                            </span>
                          ) : (
                            <span className="mt-1 inline-flex w-fit items-center gap-0.5 rounded bg-emerald-100 px-1 text-[9.5px] font-semibold uppercase text-emerald-800">
                              <CheckCheck className="size-2.5" />
                              Intégrée
                            </span>
                          )
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <DialogHeader className="space-y-1 border-b px-6 py-4 pr-12 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    Aperçu — {apercuRef ?? "Fiche de dépôt"}
                    {aJour ? (
                      <Badge className="gap-1 border-transparent bg-emerald-600 text-[10px] font-semibold uppercase tracking-wide text-white">
                        <CheckCheck className="size-3" />
                        Validée
                      </Badge>
                    ) : null}
                  </DialogTitle>
                  <DialogDescription>
                    {listeValidee ? (
                      <>
                        Liste validée le {formaterDateHeure(listeValidee.validee_le)}
                        {listeValidee.validee_par ? ` par ${listeValidee.validee_par}` : ""} :{" "}
                        <span className="font-medium text-foreground">
                          {listeValidee.nombre} dépense{listeValidee.nombre > 1 ? "s" : ""}
                        </span>{" "}
                        issues de {listeValidee.fiches.length} fiche{listeValidee.fiches.length > 1 ? "s" : ""}, sans doublon.
                      </>
                    ) : (
                      "Fiche de dépôt envoyée par le Service Règlement."
                    )}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {referenceJournee && etat ? (
                    <>
                      {!lectureSeule && !aJour && etat.fiches_disponibles.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1.5 text-white hover:opacity-90"
                          style={{ background: theme.ctaColor }}
                          disabled={validation}
                          onClick={() => void valider()}
                          title="Fusionner toutes les fiches de dépôt de la journée (sans doublon)"
                        >
                          {validation ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCheck className="size-3.5" />
                          )}
                          Valider
                        </Button>
                      ) : null}
                      {listeValidee ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={aJour ? "default" : "outline"}
                          className={cn("h-8 gap-1.5", aJour && "text-white hover:opacity-90")}
                          style={aJour ? { background: theme.ctaColor } : undefined}
                          onClick={ouvrirRapprochement}
                        >
                          <ArrowRightLeft className="size-3.5" />
                          Rapprochement
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  <BoutonPleinEcran
                    actif={pleinEcran}
                    onToggle={() => setPleinEcran((v) => !v)}
                    libelleEnter="Afficher la Fiche de dépôt en plein écran"
                  />
                </div>
              </div>
            </DialogHeader>

            {listeValidee && nonIntegrees.size > 0 ? (
              <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-[12.5px] text-amber-950">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  {nonIntegrees.size > 1 ? "Fiches reçues" : "Fiche reçue"} après la validation
                  ({[...nonIntegrees].join(", ")}) :{" "}
                  <span className="font-semibold">
                    {nbNouvelles} nouvelle{nbNouvelles > 1 ? "s" : ""} dépense{nbNouvelles > 1 ? "s" : ""}
                  </span>
                  . Les éléments déjà validés ne seront pas dupliqués
                  {lectureSeule ? "." : " : cliquez sur « Valider » pour les intégrer."}
                </p>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {apercuRef ? (
                <ContenuDetailFicheDepot reference={apercuRef} referenceJournee={referenceJournee} />
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t px-6 py-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>

      <OverlayPleinEcran
        ouvert={pleinEcran && ouvert}
        titre="Fiche de dépôt"
        sousTitre={apercuRef ?? undefined}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Fiche de dépôt en plein écran"
      >
        <TableauFicheDepotExcel
          fiche={detailExcel}
          chargement={chargementExcel}
        />
      </OverlayPleinEcran>
      </TooltipProvider>
    </Dialog>
  );
}
