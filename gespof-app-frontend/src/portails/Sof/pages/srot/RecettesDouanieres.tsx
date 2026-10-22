import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronRight, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { ModulePagePlaceholder } from "@/shared/components/module-page/ModulePagePlaceholder";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { extraireLotDouane, listerComptesDouane } from "@/portails/Sof/api/recettes-douanieres";
import { DialogComptesDouane } from "@/portails/Sof/components/recettes-douanieres/DialogComptesDouane";
import { DialogLignesCompte } from "@/portails/Sof/components/recettes-douanieres/DialogLignesCompte";
import {
  ExtractionProgress,
  type ProgressionExtraction,
} from "@/portails/Sof/components/recettes-douanieres/ExtractionProgress";
import { isoLocal, usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import {
  ORDRE_TYPES_COMPTE_DOUANE,
  teinteCompteDouane,
} from "@/portails/Sof/components/recettes-douanieres/teintes-compte-douane";
import {
  aplatirComptes,
  comparerComptes,
  syntheseVide,
  type CompteDouanePlat,
  type ExtractionCompteDouane,
  type GroupeCompteDouane,
  type GroupeLignesCompte,
  type LigneRecetteDouaniere,
} from "@/portails/Sof/types/recettes-douanieres.interface";

function formaterMontant(valeur: string | null): string {
  return formatMontant(valeur);
}

function sommeMontants(lignes: LigneRecetteDouaniere[], champ: "m_oper" | "m_regl"): number {
  return lignes.reduce((total, ligne) => {
    const brut = champ === "m_oper" ? ligne.m_oper : ligne.m_regl;
    const n = Number(brut ?? 0);
    return total + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

function mapperResultat(compte: CompteDouanePlat, resultat: ExtractionCompteDouane): LigneRecetteDouaniere[] {
  if (compte.type === "RUSID") {
    return resultat.rusid.map((ligne) => ({
      source: "rusid" as const,
      compte: ligne.c_it ?? compte.compte,
      libelle_compte: compte.libelle_compte,
      type: compte.type,
      type_libelle: compte.type_libelle,
      periode: ligne.mois,
      c_pca: ligne.c_pca,
      libelle: ligne.libelle ?? ligne.l_compte,
      n_op: null,
      n_regl: null,
      origine: ligne.operation,
      m_oper: ligne.m_oper,
      m_regl: null,
    }));
  }

  return resultat.operations.map((ligne) => ({
    source: "operation" as const,
    compte: ligne.c_it ?? compte.compte,
    libelle_compte: compte.libelle_compte,
    type: compte.type,
    type_libelle: compte.type_libelle,
    periode: ligne.d_cpta,
    c_pca: ligne.c_pca,
    libelle: ligne.l_tiers,
    n_op: ligne.n_op,
    n_regl: ligne.n_regl,
    origine: ligne.c_nop,
    m_oper: ligne.m_oper,
    m_regl: ligne.m_regl,
  }));
}

function montantReglementGroupe(groupe: GroupeLignesCompte): number {
  if (groupe.source === "rusid") {
    return sommeMontants(groupe.lignes, "m_oper");
  }
  return sommeMontants(groupe.lignes, "m_regl");
}

function trierLignes(lignes: LigneRecetteDouaniere[]): LigneRecetteDouaniere[] {
  return [...lignes].sort((a, b) => {
    const parCompte = comparerComptes(a.compte, b.compte);
    if (parCompte !== 0) return parCompte;
    const parPca = (a.c_pca ?? "").localeCompare(b.c_pca ?? "", "fr", { numeric: true });
    if (parPca !== 0) return parPca;
    return (a.periode ?? "").localeCompare(b.periode ?? "", "fr", { numeric: true });
  });
}

function grouperSyntheseParType(synthese: GroupeLignesCompte[]): {
  type: string;
  type_libelle: string;
  comptes: GroupeLignesCompte[];
}[] {
  const parType = new Map<string, GroupeLignesCompte[]>();
  for (const ligne of synthese) {
    const existant = parType.get(ligne.type) ?? [];
    existant.push(ligne);
    parType.set(ligne.type, existant);
  }

  return ORDRE_TYPES_COMPTE_DOUANE.flatMap((type) => {
    const comptes = parType.get(type);
    if (!comptes || comptes.length === 0) return [];
    return [
      {
        type,
        type_libelle: comptes[0].type_libelle,
        comptes: [...comptes].sort((a, b) => comparerComptes(a.compte, b.compte)),
      },
    ];
  });
}

export default function RecettesDouanieres() {
  const theme = getPortalMenu("sof").theme;
  const { periode, dateDebutIso, dateFinIso } = usePeriode();
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [groupes, setGroupes] = useState<GroupeCompteDouane[]>([]);
  const [chargementComptes, setChargementComptes] = useState(false);
  const [chargementExtraction, setChargementExtraction] = useState(false);
  const [progression, setProgression] = useState<ProgressionExtraction | null>(null);
  const [periodeExtraite, setPeriodeExtraite] = useState<string | null>(null);
  const [synthese, setSynthese] = useState<GroupeLignesCompte[]>([]);
  const [compteOuvert, setCompteOuvert] = useState<GroupeLignesCompte | null>(null);
  const generationExtraction = useRef(0);

  const periodeComplete = Boolean(periode?.from && periode?.to);
  const comptesAvecRecettes = useMemo(
    () => synthese.filter((groupe) => groupe.lignes.length > 0).length,
    [synthese],
  );
  const syntheseParType = useMemo(() => grouperSyntheseParType(synthese), [synthese]);

  useEffect(() => {
    if (!dateDebutIso || !dateFinIso) return;
    void extraire();
    return () => {
      generationExtraction.current += 1;
      setChargementExtraction(false);
      setProgression(null);
    };
    // Chargement automatique à l’ouverture et à chaque période complète choisie en topbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateDebutIso, dateFinIso]);

  async function chargerGroupes(): Promise<GroupeCompteDouane[]> {
    if (groupes.length > 0) {
      return groupes;
    }
    const reponse = await listerComptesDouane();
    const charges = reponse.comptes ?? [];
    setGroupes(charges);
    return charges;
  }

  async function afficherComptes() {
    setDialogOuvert(true);
    if (groupes.length > 0) {
      return;
    }
    setChargementComptes(true);
    try {
      await chargerGroupes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de charger les comptes douane.");
    } finally {
      setChargementComptes(false);
    }
  }

  async function extraire() {
    if (!periode?.from || !periode.to) {
      toast.error("Sélectionnez une période complète (début et fin).");
      return;
    }

    const dateDebut = isoLocal(periode.from);
    const dateFin = isoLocal(periode.to);
    const gen = generationExtraction.current + 1;
    generationExtraction.current = gen;

    setChargementExtraction(true);
    setSynthese([]);
    setPeriodeExtraite(null);
    setCompteOuvert(null);

    try {
      const referentiel = await chargerGroupes();
      if (generationExtraction.current !== gen) return;
      const comptes = aplatirComptes(referentiel).sort((a, b) => comparerComptes(a.compte, b.compte));
      if (comptes.length === 0) {
        toast.error("Aucun compte douane. Chargez le référentiel.");
        return;
      }

      const syntheseAcc = comptes.map(syntheseVide);
      setSynthese(syntheseAcc);
      setProgression({
        actuel: 0,
        total: comptes.length,
        compte: "lot",
        libelle: "Extraction groupée Oracle…",
      });

      const resultat = await extraireLotDouane(dateDebut, dateFin);
      if (generationExtraction.current !== gen) return;

      const parCompte = new Map(resultat.comptes.map((c) => [c.compte, c]));
      for (let i = 0; i < comptes.length; i += 1) {
        const compte = comptes[i];
        const extrait = parCompte.get(compte.compte);
        if (!extrait) {
          syntheseAcc[i] = {
            ...syntheseAcc[i],
            lignes: [],
            erreur: "Compte absent du résultat d’extraction.",
          };
          continue;
        }
        if (extrait.erreur) {
          syntheseAcc[i] = {
            ...syntheseAcc[i],
            lignes: [],
            erreur: extrait.erreur,
          };
          continue;
        }
        syntheseAcc[i] = {
          ...syntheseAcc[i],
          lignes: trierLignes(mapperResultat(compte, extrait)),
          erreur: null,
        };
      }

      setSynthese([...syntheseAcc]);
      setPeriodeExtraite(`${resultat.date_debut} → ${resultat.date_fin}`);
      if (resultat.echecs > 0) {
        toast.error(`${resultat.echecs} compte(s) n’ont pas pu être extraits.`);
      }
    } catch (e) {
      if (generationExtraction.current !== gen) return;
      toast.error(e instanceof Error ? e.message : "Impossible d’extraire les recettes douanières.");
    } finally {
      if (generationExtraction.current === gen) {
        setChargementExtraction(false);
        setProgression(null);
      }
    }
  }

  return (
    <ModulePagePlaceholder
      portal="sof"
      navId="sof-srot-recettes-douanieres"
      description="Extraction Oracle des recettes douanières (modèle automatisé) sur une période, à partir du référentiel des comptes douane."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void afficherComptes()}>
            {chargementComptes ? <Loader2 className="animate-spin" /> : <BookOpen />}
            Comptes douane
          </Button>
          <Button
            type="button"
            disabled={!periodeComplete || chargementExtraction}
            onClick={() => void extraire()}
            style={{ background: theme.topColor, color: "#fff" }}
          >
            {chargementExtraction ? <Loader2 className="animate-spin" /> : <Play />}
            Extraire
          </Button>
        </div>
      }
    >
      <DialogComptesDouane
        ouvert={dialogOuvert}
        onClose={() => setDialogOuvert(false)}
        groupes={groupes}
        chargement={chargementComptes}
      />
      <DialogLignesCompte groupe={compteOuvert} onClose={() => setCompteOuvert(null)} />

      <Card className="pt-0">
        <CardHeader
          className="border-b pt-(--card-spacing)"
          style={{
            background: `linear-gradient(180deg, ${theme.bgColor} 0%, #fff 100%)`,
            borderLeft: `4px solid ${theme.topColor}`,
          }}
        >
          <CardTitle className="text-[15px]">Recettes douanières</CardTitle>
          <CardDescription>
            {chargementExtraction && progression
              ? progression.libelle
              : periodeExtraite
                ? `${synthese.length} compte(s) · ${comptesAvecRecettes} avec recettes · ${periodeExtraite}`
                : "Les recettes se chargent à partir de la période affichée en haut."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {progression ? (
            <ExtractionProgress progression={progression} accent={theme.topColor} />
          ) : null}
          {synthese.length > 0 ? (
            <Table
              className="border-separate border-spacing-0"
              containerClassName="rounded-lg border"
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 w-12 border-b bg-[#14533f] px-0 text-center text-[11px] font-semibold text-white">
                    Type
                  </TableHead>
                  <TableHead className="h-9 w-[128px] border-b bg-[#14533f] px-3 text-[11px] font-semibold text-white">
                    Compte
                  </TableHead>
                  <TableHead className="h-9 border-b bg-[#14533f] px-3 text-[11px] font-semibold text-white">
                    Libellé
                  </TableHead>
                  <TableHead className="h-9 border-b bg-[#14533f] px-3 text-right text-[11px] font-semibold text-white">
                    Montant règl.
                  </TableHead>
                  <TableHead className="h-9 w-8 border-b bg-[#14533f]" aria-label="Ouvrir le détail" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {syntheseParType.map((famille) => {
                  const teinte = teinteCompteDouane(famille.type);
                  return famille.comptes.map((groupe, index) => {
                    const totalRegl = montantReglementGroupe(groupe);
                    const montantRusid = groupe.source === "rusid";
                    const vide = groupe.lignes.length === 0 && !groupe.erreur;
                    return (
                      <TableRow
                        key={groupe.compte}
                        tabIndex={0}
                        className="cursor-pointer border-0 hover:bg-transparent"
                        title={
                          groupe.erreur
                            ? groupe.erreur
                            : `Voir les ${groupe.lignes.length} ligne(s) de ${groupe.compte}`
                        }
                        onClick={() => setCompteOuvert(groupe)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setCompteOuvert(groupe);
                          }
                        }}
                      >
                        {index === 0 && (
                          <TableCell
                            rowSpan={famille.comptes.length}
                            className="w-12 max-w-12 border-b px-0 py-1.5 text-center align-middle"
                            style={{ background: teinte.bande }}
                          >
                            <span className="inline-block text-[10px] font-semibold tracking-wide text-white [writing-mode:vertical-rl] rotate-180">
                              {famille.type_libelle}
                            </span>
                          </TableCell>
                        )}
                        <TableCell
                          className="h-8 border-b px-3 py-1.5 font-mono text-[12.5px] font-semibold tabular-nums"
                          style={{
                            background: teinte.fond,
                            color: teinte.texte,
                            opacity: vide ? 0.78 : 1,
                          }}
                        >
                          {groupe.compte}
                        </TableCell>
                        <TableCell
                          className="h-8 border-b px-3 py-1.5 text-[13px] text-foreground/85"
                          style={{ background: teinte.fond, opacity: vide ? 0.78 : 1 }}
                        >
                          {groupe.libelle_compte}
                          <span className="ml-2 text-[11px] text-foreground/45">
                            {groupe.erreur
                              ? "extraction en échec"
                              : `${groupe.lignes.length} ligne(s)`}
                          </span>
                        </TableCell>
                        <TableCell
                          className="h-8 border-b px-3 py-1.5 text-right font-mono tabular-nums"
                          style={{ background: teinte.fond, color: teinte.texte, opacity: vide ? 0.78 : 1 }}
                        >
                          {groupe.erreur
                            ? "—"
                            : `${formaterMontant(String(totalRegl))}${montantRusid ? " M" : ""}`}
                        </TableCell>
                        <TableCell
                          className="h-8 w-8 border-b px-2 py-1.5 text-foreground/35"
                          style={{ background: teinte.fond }}
                        >
                          <ChevronRight className="size-4" />
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          ) : !progression ? (
            <p className="rounded-xl border border-dashed px-4 py-10 text-center text-[13px] text-foreground/50">
              {periodeExtraite
                ? "Aucune recette douanière sur cette période."
                : "Aucune extraction pour le moment — les données se chargent depuis la période de la barre supérieure."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </ModulePagePlaceholder>
  );
}
