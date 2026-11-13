import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Play, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  couvertureReglesFlechage,
  creerRegleFlechage,
  enregistrerRegleFlechage,
  listerReglesFlechage,
  listerTablesDecisionFlechage,
  testerRegleFlechage,
} from "@/portails/Sof/api/referentiel";
import type {
  CouvertureFlechage,
  DomaineFlechage,
  OngletFlechage,
  RegleFlechageSaisie,
  RegleFlechageSof,
  TestFlechageResultat,
} from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

const ONGLET_LIBELLES: Record<OngletFlechage, string> = {
  corr: "Correspondants",
  av: "Avances au budget",
  ord: "Règlements sur ordonnances",
  cd: "Crédits délégués",
};

const CATEGORIES = ["CNSS", "CNAMGS", "TPG", "Collectivités"] as const;

const champCls =
  "h-[38px] w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 text-sm text-[#0f172a] outline-none disabled:bg-[#f8fafc]";

function Champ({
  label,
  children,
  largeur,
}: {
  label: string;
  children: ReactNode;
  largeur?: string;
}) {
  return (
    <div
      className="grid items-center gap-x-3 gap-y-1"
      style={{ gridTemplateColumns: largeur ? `${largeur} 1fr` : "140px 1fr" }}
    >
      <label className="text-[12.5px] font-semibold text-[#334155]">{label}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ChampDialog({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-semibold text-[#334155]">{label}</label>
      {children}
    </div>
  );
}

function afficher(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  return String(valeur);
}

function dateAffichee(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function grilleColonnes(onglet: OngletFlechage): string {
  switch (onglet) {
    case "corr":
      return "130px 110px 80px 70px 70px 100px 100px 96px";
    case "av":
      return "80px 110px 70px 60px 70px 100px 100px 96px";
    case "ord":
      return "90px 100px 60px 70px 60px 70px 70px 100px 100px 96px";
    case "cd":
      return "90px 70px 70px 100px 100px 96px";
  }
}

function enTetes(onglet: OngletFlechage): { l: string; jc: "flex-start" | "flex-end" }[] {
  const base =
    onglet === "corr"
      ? ["Catégorie", "Compte précis", "Sens", "Code"]
      : onglet === "av"
        ? ["Nature", "Exercice", "Code", "Titre"]
        : onglet === "ord"
          ? ["Catégorie", "Type", "Titre", "Nature", "MDR", "Code"]
          : ["Nature", "Code"];
  return [
    ...base.map((l) => ({ l, jc: "flex-start" as const })),
    { l: "Priorité", jc: "flex-end" },
    { l: "Valide du", jc: "flex-start" },
    { l: "Au", jc: "flex-start" },
    { l: "", jc: "flex-end" },
  ];
}

function cellules(onglet: OngletFlechage, r: RegleFlechageSof): { v: string; mono?: boolean; end?: boolean }[] {
  const prio = { v: String(r.priorite), mono: true, end: true };
  const du = { v: dateAffichee(r.valide_du), mono: true };
  const au = { v: dateAffichee(r.valide_au), mono: true };
  if (onglet === "corr") {
    return [
      { v: afficher(r.categorie) },
      { v: afficher(r.compte), mono: true },
      { v: afficher(r.sens) },
      { v: r.rubrique_code, mono: true },
      prio,
      du,
      au,
    ];
  }
  if (onglet === "av") {
    return [
      { v: afficher(r.nature), mono: true },
      { v: afficher(r.type_exercice) },
      { v: r.rubrique_code, mono: true },
      { v: afficher(r.titre_resultat), mono: true },
      prio,
      du,
      au,
    ];
  }
  if (onglet === "ord") {
    return [
      { v: afficher(r.categorie) },
      { v: afficher(r.type_exercice) },
      { v: afficher(r.titre), mono: true },
      { v: afficher(r.nature), mono: true },
      { v: afficher(r.mdr), mono: true },
      { v: r.rubrique_code, mono: true },
      prio,
      du,
      au,
    ];
  }
  return [
    { v: afficher(r.nature), mono: true },
    { v: r.rubrique_code, mono: true },
    prio,
    du,
    au,
  ];
}

type ModeDialog = "ajout" | "edition" | null;

type Formulaire = {
  domaine: DomaineFlechage;
  categorie: string;
  compte: string;
  nature: string;
  type_exercice: string;
  titre: string;
  mdr: string;
  rubrique_code: string;
  titre_resultat: string;
  priorite: string;
  valide_du: string;
  valide_au: string;
  sens: "Recette" | "Dépense";
};

function formulaireVide(onglet: OngletFlechage): Formulaire {
  const domaine: DomaineFlechage =
    onglet === "corr"
      ? "corresp_depense"
      : onglet === "av"
        ? "avance"
        : onglet === "ord"
          ? "reglement"
          : "credit_delegue";
  return {
    domaine,
    categorie: "",
    compte: "",
    nature: "",
    type_exercice: "",
    titre: "",
    mdr: "",
    rubrique_code: "",
    titre_resultat: "",
    priorite: "1",
    valide_du: "2026-01-01",
    valide_au: "",
    sens: "Dépense",
  };
}

function depuisRegle(r: RegleFlechageSof): Formulaire {
  return {
    domaine: r.domaine,
    categorie: r.categorie ?? "",
    compte: r.compte ?? "",
    nature: r.nature ?? "",
    type_exercice: r.type_exercice ?? "",
    titre: r.titre ?? "",
    mdr: r.mdr ?? "",
    rubrique_code: r.rubrique_code,
    titre_resultat: r.titre_resultat ?? "",
    priorite: String(r.priorite),
    valide_du: r.valide_du ?? "",
    valide_au: r.valide_au ?? "",
    sens: r.sens === "Recette" ? "Recette" : "Dépense",
  };
}

function payloadDepuisForm(f: Formulaire, onglet: OngletFlechage): RegleFlechageSaisie {
  const domaine: DomaineFlechage =
    onglet === "corr"
      ? f.sens === "Recette"
        ? "corresp_recette"
        : "corresp_depense"
      : onglet === "av"
        ? "avance"
        : onglet === "ord"
          ? "reglement"
          : "credit_delegue";

  const vide = (s: string) => {
    const t = s.trim();
    return t === "" ? null : t;
  };

  return {
    domaine,
    categorie: onglet === "corr" || onglet === "ord" ? vide(f.categorie) : null,
    compte: onglet === "corr" ? vide(f.compte) : null,
    nature: vide(f.nature),
    type_exercice: onglet === "av" || onglet === "ord" ? vide(f.type_exercice) : null,
    titre: onglet === "ord" ? vide(f.titre) : null,
    mdr: onglet === "ord" ? vide(f.mdr) : null,
    rubrique_code: f.rubrique_code.trim(),
    titre_resultat: onglet === "av" ? vide(f.titre_resultat) : null,
    priorite: Math.max(1, Number.parseInt(f.priorite, 10) || 1),
    valide_du: vide(f.valide_du),
    valide_au: vide(f.valide_au),
  };
}

export default function ReglesFlechage() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [onglet, setOnglet] = useState<OngletFlechage>("corr");
  const [regles, setRegles] = useState<RegleFlechageSof[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [mode, setMode] = useState<ModeDialog>(null);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [form, setForm] = useState<Formulaire>(() => formulaireVide("corr"));
  const [enCours, setEnCours] = useState(false);

  const [testCompte, setTestCompte] = useState("4711-12");
  const [testCategorie, setTestCategorie] = useState<string>("CNAMGS");
  const [testNature, setTestNature] = useState("611");
  const [testSens, setTestSens] = useState<"Recette" | "Dépense">("Dépense");
  const [testEnCours, setTestEnCours] = useState(false);
  const [resultat, setResultat] = useState<TestFlechageResultat | null>(null);
  const [couvertureOpen, setCouvertureOpen] = useState(false);
  const [couverture, setCouverture] = useState<CouvertureFlechage | null>(null);
  const [couvertureEnCours, setCouvertureEnCours] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [tables, setTables] = useState<Record<
    string,
    Array<Record<string, string>>
  > | null>(null);
  const [tablesEnCours, setTablesEnCours] = useState(false);

  async function recharger(o: OngletFlechage = onglet) {
    const data = await listerReglesFlechage(o);
    setRegles(data.regles ?? []);
  }

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setResultat(null);
    recharger(onglet)
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les règles.",
        ),
      )
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rechargement volontaire à chaque onglet
  }, [onglet]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return regles;
    return regles.filter((r) =>
      [
        r.categorie,
        r.compte,
        r.nature,
        r.type_exercice,
        r.titre,
        r.mdr,
        r.rubrique_code,
        r.titre_resultat,
        r.sens,
        String(r.priorite),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [regles, recherche]);

  function majForm<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) {
    setForm((prev) => ({ ...prev, [cle]: valeur }));
  }

  function ouvrirAjout() {
    setEditionId(null);
    setForm(formulaireVide(onglet));
    setMode("ajout");
  }

  function ouvrirEdition(r: RegleFlechageSof) {
    setEditionId(r.id);
    setForm(depuisRegle(r));
    setMode("edition");
  }

  function fermerDialog() {
    if (enCours) return;
    setMode(null);
    setEditionId(null);
  }

  async function confirmer() {
    if (!estChef) return;
    const payload = payloadDepuisForm(form, onglet);
    if (!payload.rubrique_code) {
      toast.error("Le code de fléchage est obligatoire.");
      return;
    }
    setEnCours(true);
    try {
      if (mode === "ajout") {
        await creerRegleFlechage(payload);
        toast.success("Entrée ajoutée.");
      } else if (mode === "edition" && editionId != null) {
        await enregistrerRegleFlechage(editionId, payload);
        toast.success("Modification enregistrée.");
      }
      setMode(null);
      setEditionId(null);
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrirCouverture() {
    setCouvertureOpen(true);
    setCouvertureEnCours(true);
    try {
      const { couverture: c } = await couvertureReglesFlechage();
      setCouverture(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couverture impossible.");
      setCouverture(null);
    } finally {
      setCouvertureEnCours(false);
    }
  }

  async function ouvrirTablesDecision() {
    setTablesOpen(true);
    setTablesEnCours(true);
    try {
      const { tables: t } = await listerTablesDecisionFlechage();
      setTables(t);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Tables de décision indisponibles.",
      );
      setTables(null);
    } finally {
      setTablesEnCours(false);
    }
  }

  async function lancerTest() {
    setTestEnCours(true);
    try {
      const { resultat: res } = await testerRegleFlechage({
        compte: testCompte,
        categorie: testCategorie,
        nature: testNature,
        sens: testSens,
      });
      setResultat(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test impossible.");
      setResultat(null);
    } finally {
      setTestEnCours(false);
    }
  }

  const titres = enTetes(onglet);
  const grille = grilleColonnes(onglet);
  const titreTableau = `Règles · ${ONGLET_LIBELLES[onglet]}`;

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Règles de fléchage"
        description="Moteur déterministe (Lot 2) — tables de décision en lecture seule ; le CRUD reste disponible pour documentation / overrides."
        remplace="VBA ABCD, CorrespondantsD/R, TitreAvances, Reglements"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void ouvrirTablesDecision()}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95"
            >
              Tables de décision
            </button>
            <button
              type="button"
              onClick={() => void ouvrirCouverture()}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95"
            >
              Couverture
            </button>
            <button
              type="button"
              onClick={ouvrirAjout}
              disabled={!estChef}
              title={estChef ? undefined : "Réservé au Chef SOF"}
              className={cn(
                "inline-flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-semibold",
                estChef
                  ? "cursor-pointer border-[#cbd5e1] bg-white text-[#0f172a] hover:brightness-95"
                  : "cursor-not-allowed border-[#cbd5e1] bg-white text-[#0f172a] opacity-50",
              )}
            >
              <Plus size={16} strokeWidth={2.2} />
              Ajouter une règle
            </button>
          </div>
        }
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Recherche
          <span className="flex h-[34px] w-full max-w-[420px] items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[#64748b]">
            <Search size={14} aria-hidden />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Libellé, n°…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-normal tracking-normal text-[#0f172a] normal-case outline-none placeholder:text-[#94a3b8]"
            />
          </span>
        </label>
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0] px-3"
        style={{ scrollbarWidth: "none" }}
      >
        {(Object.keys(ONGLET_LIBELLES) as OngletFlechage[]).map((k) => {
          const on = onglet === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setOnglet(k);
                setRecherche("");
              }}
              className="flex h-[46px] shrink-0 items-center gap-2 border-0 bg-transparent px-3 text-[14px] whitespace-nowrap"
              style={{
                fontWeight: on ? 600 : 500,
                color: on ? "#1e6650" : "#64748b",
                boxShadow: on ? "inset 0 -2px 0 #2a7f62" : "inset 0 -2px 0 transparent",
              }}
            >
              {ONGLET_LIBELLES[k]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <section className="min-w-0 flex-[1.6] overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <div
            className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
            style={{ padding: "12px 16px" }}
          >
            <span className="text-[15px] font-semibold text-[#0f172a]">
              {titreTableau}
            </span>
          </div>

          {chargement ? (
            <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
              <Loader2 size={16} className="animate-spin" />
              Chargement…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: onglet === "ord" ? 900 : 640 }}>
                <div
                  className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                  style={{ gridTemplateColumns: grille }}
                >
                  {titres.map((col, i) => (
                    <div
                      key={col.l || `col-${i}`}
                      className="px-2.5 py-[9px] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: col.jc,
                      }}
                    >
                      {col.l}
                    </div>
                  ))}
                </div>

                {filtrees.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                    {recherche.trim()
                      ? `Aucune ligne ne correspond à « ${recherche.trim()} ».`
                      : "Aucune règle."}
                  </div>
                ) : (
                  filtrees.map((r) => (
                    <div
                      key={r.id}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{ gridTemplateColumns: grille }}
                    >
                      {cellules(onglet, r).map((c, i) => (
                        <div
                          key={`${r.id}-${i}`}
                          className="flex items-center px-2.5 py-1.5"
                          style={{
                            justifyContent: c.end ? "flex-end" : "flex-start",
                            fontFamily: c.mono
                              ? '"IBM Plex Mono", ui-monospace, monospace'
                              : undefined,
                            fontWeight: c.mono && !c.end ? 600 : undefined,
                          }}
                        >
                          {c.v}
                        </div>
                      ))}
                      <div className="flex items-center justify-end px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => ouvrirEdition(r)}
                          className="h-7 rounded-[5px] border border-[#bfdccf] bg-[#f0f7f4] px-2.5 text-xs font-semibold whitespace-nowrap text-[#1e6650]"
                        >
                          Modifier
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex w-full flex-col gap-3 xl:w-[300px] xl:shrink-0">
          <section className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
            <div
              className="border-b border-[#e2e8f0]"
              style={{ padding: "12px 16px" }}
            >
              <span className="text-[15px] font-semibold text-[#0f172a]">
                Tester une opération
              </span>
            </div>
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <Champ label="Compte" largeur="90px">
                <input
                  value={testCompte}
                  onChange={(e) => setTestCompte(e.target.value)}
                  className={champCls}
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                />
              </Champ>
              <Champ label="Catégorie" largeur="90px">
                <select
                  value={testCategorie}
                  onChange={(e) => setTestCategorie(e.target.value)}
                  className={champCls}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ label="Nature" largeur="90px">
                <input
                  value={testNature}
                  onChange={(e) => setTestNature(e.target.value)}
                  className={champCls}
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                />
              </Champ>
              <Champ label="Sens" largeur="90px">
                <select
                  value={testSens}
                  onChange={(e) =>
                    setTestSens(e.target.value as "Recette" | "Dépense")
                  }
                  className={champCls}
                >
                  <option value="Recette">Recette</option>
                  <option value="Dépense">Dépense</option>
                </select>
              </Champ>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => void lancerTest()}
                  disabled={testEnCours}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
                >
                  {testEnCours ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} fill="currentColor" />
                  )}
                  Tester
                </button>
              </div>
            </div>
          </section>

          {resultat ? (
            <section
              className="rounded-lg border px-4 py-3.5"
              style={{
                background: "#f0f7f4",
                borderColor: "#bfdccf",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: "#2a7f62" }}
                />
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: "#1e6650" }}
                >
                  Résultat
                </span>
              </div>
              <p className="m-0 text-[13.5px] leading-relaxed text-[#1e6650]">
                {resultat.message}
              </p>
              {resultat.trouve && resultat.code ? (
                <p className="mt-1.5 mb-0 text-[13.5px] leading-relaxed text-[#1e6650]">
                  Rubrique SROT :{" "}
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      fontWeight: 600,
                    }}
                  >
                    {resultat.code}
                  </span>
                  .
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) fermerDialog();
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              {mode === "ajout"
                ? `Ajouter · ${ONGLET_LIBELLES[onglet]}`
                : `Modifier · règle #${editionId ?? ""}`}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Critère vide = toute valeur. Priorité basse = évaluée en premier.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-3.5 overflow-y-auto px-6 py-[18px]">
            {onglet === "corr" ? (
              <>
                <ChampDialog label="Catégorie">
                  <select
                    value={form.categorie}
                    onChange={(e) => majForm("categorie", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                  >
                    <option value="">— (toute)</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </ChampDialog>
                <ChampDialog label="Compte précis">
                  <input
                    value={form.compte}
                    onChange={(e) => majForm("compte", e.target.value)}
                    disabled={!estChef}
                    placeholder="ex. 4711-12"
                    className={champCls}
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  />
                </ChampDialog>
                <ChampDialog label="Sens">
                  <select
                    value={form.sens}
                    onChange={(e) =>
                      majForm("sens", e.target.value as "Recette" | "Dépense")
                    }
                    disabled={!estChef}
                    className={champCls}
                  >
                    <option value="Recette">Recette</option>
                    <option value="Dépense">Dépense</option>
                  </select>
                </ChampDialog>
              </>
            ) : null}

            {onglet === "av" ? (
              <>
                <ChampDialog label="Nature">
                  <input
                    value={form.nature}
                    onChange={(e) => majForm("nature", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  />
                </ChampDialog>
                <ChampDialog label="Exercice">
                  <select
                    value={form.type_exercice}
                    onChange={(e) => majForm("type_exercice", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                  >
                    <option value="">— (tout)</option>
                    <option value="Courant">Courant</option>
                    <option value="Antérieur">Antérieur</option>
                  </select>
                </ChampDialog>
                <ChampDialog label="Titre (résultat)">
                  <input
                    value={form.titre_resultat}
                    onChange={(e) => majForm("titre_resultat", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  />
                </ChampDialog>
              </>
            ) : null}

            {onglet === "ord" ? (
              <>
                <ChampDialog label="Catégorie">
                  <select
                    value={form.categorie}
                    onChange={(e) => majForm("categorie", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                  >
                    <option value="">— (toute)</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </ChampDialog>
                <ChampDialog label="Type">
                  <select
                    value={form.type_exercice}
                    onChange={(e) => majForm("type_exercice", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                  >
                    <option value="">— (tout)</option>
                    <option value="Exercice">Exercice</option>
                    <option value="Antérieur">Antérieur</option>
                  </select>
                </ChampDialog>
                <ChampDialog label="Titre">
                  <input
                    value={form.titre}
                    onChange={(e) => majForm("titre", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  />
                </ChampDialog>
                <ChampDialog label="Nature">
                  <input
                    value={form.nature}
                    onChange={(e) => majForm("nature", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  />
                </ChampDialog>
                <ChampDialog label="MDR">
                  <input
                    value={form.mdr}
                    onChange={(e) => majForm("mdr", e.target.value)}
                    disabled={!estChef}
                    className={champCls}
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  />
                </ChampDialog>
              </>
            ) : null}

            {onglet === "cd" ? (
              <ChampDialog label="Nature">
                <input
                  value={form.nature}
                  onChange={(e) => majForm("nature", e.target.value)}
                  disabled={!estChef}
                  className={champCls}
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                />
              </ChampDialog>
            ) : null}

            <ChampDialog label="Code">
              <input
                value={form.rubrique_code}
                onChange={(e) => majForm("rubrique_code", e.target.value)}
                disabled={!estChef}
                placeholder="ex. AAA"
                className={champCls}
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                }}
              />
            </ChampDialog>
            <ChampDialog label="Priorité">
              <input
                type="number"
                min={1}
                value={form.priorite}
                onChange={(e) => majForm("priorite", e.target.value)}
                disabled={!estChef}
                className={champCls}
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                }}
              />
            </ChampDialog>
            <div className="grid grid-cols-2 gap-3">
              <ChampDialog label="Valide du">
                <input
                  type="date"
                  value={form.valide_du}
                  onChange={(e) => majForm("valide_du", e.target.value)}
                  disabled={!estChef}
                  className={champCls}
                />
              </ChampDialog>
              <ChampDialog label="Au">
                <input
                  type="date"
                  value={form.valide_au}
                  onChange={(e) => majForm("valide_au", e.target.value)}
                  disabled={!estChef}
                  className={champCls}
                />
              </ChampDialog>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              onClick={fermerDialog}
              disabled={enCours}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a]"
            >
              Annuler
            </button>
            {estChef ? (
              <button
                type="button"
                onClick={() => void confirmer()}
                disabled={enCours}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
              >
                {enCours ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                {mode === "ajout" ? "Ajouter" : "Enregistrer"}
              </button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tablesOpen} onOpenChange={setTablesOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Tables de décision
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Moteur déterministe SPEC §5.5 / §6 — lecture seule.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto px-6 py-4 text-[13px] text-[#334155]">
            {tablesEnCours ? (
              <div className="flex items-center gap-2 text-[#64748b]">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            ) : !tables ? (
              <p className="text-[#64748b]">Aucune table.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {Object.entries(tables).map(([cle, rows]) => (
                  <div key={cle}>
                    <div className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
                      {cle.replace(/_/g, " ")}
                    </div>
                    <div className="overflow-hidden rounded-md border border-[#e2e8f0]">
                      {(rows ?? []).map((row, i) => (
                        <div
                          key={`${cle}-${i}`}
                          className="grid grid-cols-[1fr_88px] gap-2 border-b border-[#eef2f4] px-3 py-1.5 last:border-0"
                        >
                          <span>
                            {row.categorie ??
                              row.regle ??
                              row.libelle ??
                              row.valeur ??
                              "—"}
                          </span>
                          <span
                            className="text-right font-semibold"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                            }}
                          >
                            {row.code ?? row.valeur ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5">
            <button
              type="button"
              onClick={() => setTablesOpen(false)}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold"
            >
              Fermer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={couvertureOpen} onOpenChange={setCouvertureOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Couverture · Correspondants
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Catégories du dernier lot Correspondants (DSI) sans règle de fléchage.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4 text-[13px] text-[#334155]">
            {couvertureEnCours ? (
              <div className="flex items-center gap-2 text-[#64748b]">
                <Loader2 size={14} className="animate-spin" /> Analyse…
              </div>
            ) : couverture?.message ? (
              <p className="text-[#64748b]">{couverture.message}</p>
            ) : (
              <>
                <p className="mb-3 text-[12.5px] text-[#64748b]">
                  Lot #{couverture?.lot_id ?? "—"}
                  {couverture?.lot_importe_le
                    ? ` · ${couverture.lot_importe_le}`
                    : ""}
                </p>
                {(couverture?.sans_regle ?? []).length === 0 ? (
                  <p className="text-[#047857]">
                    Toutes les catégories du lot trouvent une règle.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {(couverture?.sans_regle ?? []).map((s) => (
                      <li key={`${s.sens}-${s.categorie}`}>
                        <span className="font-semibold">{s.sens}</span> ·{" "}
                        {s.categorie}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <DialogFooter className="border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5">
            <button
              type="button"
              onClick={() => setCouvertureOpen(false)}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold"
            >
              Fermer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
