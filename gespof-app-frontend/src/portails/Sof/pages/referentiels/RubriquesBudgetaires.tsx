import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Move,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  creerRubriqueDepense,
  creerRubriqueRecette,
  enregistrerRubriqueDepense,
  enregistrerRubriqueRecette,
  listerRubriquesDepenses,
  listerRubriquesRecettes,
  reordonnerRubriquesDepenses,
  reordonnerRubriquesRecettes,
} from "@/portails/Sof/api/referentiel";
import type {
  NatureDepense,
  RubriqueDepenseNoeud,
  RubriqueRecetteNoeud,
  SectionRecette,
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

type Feuille = "Recettes" | "Dépenses";

interface LigneRubrique {
  code: string;
  libelle: string;
  niveau: number;
  ordre: number;
  code_tofe: string | null;
  actif: boolean;
  parent_code: string | null;
  parent_libelle: string | null;
  section?: SectionRecette;
  nature?: NatureDepense;
  repliable: boolean;
  racine_code: string | null;
}

/** Code assez large pour l’indentation arbre + codes type REC-G0x sans retour à la ligne. */
const GRILLE = "minmax(220px, max-content) minmax(280px, 2fr) 70px minmax(100px, max-content) 88px";
const TAG_OK = { bg: "#e3f1ea", fg: "#1e6650" };
const TAG_NEU = { bg: "#f1f5f9", fg: "#475569" };

const SECTIONS: { valeur: SectionRecette; libelle: string }[] = [
  { valeur: "petrole", libelle: "Pétrole" },
  { valeur: "recettes_fiscales", libelle: "Recettes fiscales" },
  { valeur: "recettes_non_fiscales", libelle: "Recettes non fiscales" },
  { valeur: "recettes_affectees", libelle: "Recettes affectées" },
  { valeur: "emprunt", libelle: "Emprunt" },
  { valeur: "non_budgetaire", libelle: "Non budgétaire" },
];

const NATURES: { valeur: NatureDepense; libelle: string }[] = [
  { valeur: "exercice_courant", libelle: "Exercice courant" },
  { valeur: "ex_anterieur", libelle: "Exercice antérieur" },
  { valeur: "sans_ordonnancement", libelle: "Sans ordonnancement" },
];

const champCls =
  "h-[38px] w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 text-sm text-[#0f172a] outline-none disabled:bg-[#f8fafc] disabled:text-[#64748b]";
const champRoCls =
  "flex min-h-[38px] items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-sm text-[#0f172a]";

function aplatir(
  noeuds: Array<RubriqueRecetteNoeud | RubriqueDepenseNoeud>,
  racineCode: string | null = null,
): LigneRubrique[] {
  const lignes: LigneRubrique[] = [];
  for (const n of noeuds) {
    const estRacine = n.niveau <= 1 || n.parent_code == null;
    const racine = estRacine ? n.code : racineCode;
    const enfants = n.enfants ?? [];
    const ligne: LigneRubrique = {
      code: n.code,
      libelle: n.libelle,
      niveau: n.niveau,
      ordre: n.ordre,
      code_tofe: n.code_tofe,
      actif: n.actif,
      parent_code: n.parent_code,
      parent_libelle: n.parent_libelle ?? null,
      repliable: estRacine && enfants.length > 0,
      racine_code: estRacine ? null : racine,
    };
    if ("section" in n) ligne.section = n.section;
    if ("nature" in n) ligne.nature = n.nature;
    lignes.push(ligne);
    if (enfants.length) lignes.push(...aplatir(enfants, racine ?? n.code));
  }
  return lignes;
}

function BoutonHeader({
  label,
  icon: Icon,
  onClick,
  disabled,
  title,
  actif,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  actif?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-semibold",
        disabled
          ? "cursor-not-allowed border-[#cbd5e1] bg-white text-[#0f172a] opacity-50"
          : actif
            ? "cursor-pointer border-[#2a7f62] bg-[#f0f7f4] text-[#1e6650]"
            : "cursor-pointer border-[#cbd5e1] bg-white text-[#0f172a] hover:brightness-95",
      )}
    >
      <Icon size={16} strokeWidth={2.2} />
      {label}
    </button>
  );
}

function BoutonCarte({
  label,
  icon: Icon,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  icon: typeof Check;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
      style={{
        background: primary ? "#2a7f62" : "#fff",
        color: primary ? "#fff" : "#0f172a",
        borderColor: primary ? "#2a7f62" : "#cbd5e1",
      }}
    >
      <Icon size={14} strokeWidth={2.2} />
      {label}
    </button>
  );
}

function Champ({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1.5"
      style={{ gridColumn: wide ? "1 / -1" : "auto" }}
    >
      <label className="text-[12.5px] font-semibold text-[#334155]">{label}</label>
      {children}
    </div>
  );
}

export default function RubriquesBudgetaires() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [feuille, setFeuille] = useState<Feuille>("Recettes");
  const [recettes, setRecettes] = useState<LigneRubrique[]>([]);
  const [depenses, setDepenses] = useState<LigneRubrique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [selection, setSelection] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, boolean>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [modeDeplacement, setModeDeplacement] = useState(false);
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [survolCode, setSurvolCode] = useState<string | null>(null);
  const [dialogAjout, setDialogAjout] = useState(false);
  const [dialogEdition, setDialogEdition] = useState(false);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  const [libelle, setLibelle] = useState("");
  const [ordre, setOrdre] = useState("");
  const [codeTofe, setCodeTofe] = useState("");
  const [actif, setActif] = useState(true);

  const [nouvCode, setNouvCode] = useState("");
  const [nouvLibelle, setNouvLibelle] = useState("");
  const [nouvParent, setNouvParent] = useState("");
  const [nouvTofe, setNouvTofe] = useState("");
  const [nouvActif, setNouvActif] = useState(true);
  const [nouvSection, setNouvSection] = useState<SectionRecette>("petrole");
  const [nouvNature, setNouvNature] = useState<NatureDepense>("exercice_courant");

  async function recharger(garderCode?: string | null) {
    const [r, d] = await Promise.all([
      listerRubriquesRecettes(),
      listerRubriquesDepenses(),
    ]);
    const lr = aplatir(r.rubriques ?? []);
    const ld = aplatir(d.rubriques ?? []);
    setRecettes(lr);
    setDepenses(ld);
    const src = feuille === "Recettes" ? lr : ld;
    if (garderCode && src.some((x) => x.code === garderCode)) {
      setSelection(garderCode);
    }
    return { lr, ld };
  }

  useEffect(() => {
    let actifReq = true;
    setChargement(true);
    recharger()
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger la nomenclature.",
        ),
      )
      .finally(() => {
        if (actifReq) setChargement(false);
      });
    return () => {
      actifReq = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDialogEdition(false);
    setSelection(null);
  }, [feuille]);

  const source = feuille === "Recettes" ? recettes : depenses;

  const lignesVisibles = useMemo(() => {
    return source.filter((l) => {
      if (!l.racine_code) return true;
      return !replies[l.racine_code];
    });
  }, [source, replies]);

  const courante = useMemo(
    () => source.find((l) => l.code === selection) ?? null,
    [source, selection],
  );

  useEffect(() => {
    if (!courante) {
      setLibelle("");
      setOrdre("");
      setCodeTofe("");
      setActif(true);
      return;
    }
    setLibelle(courante.libelle);
    setOrdre(String(courante.ordre));
    setCodeTofe(courante.code_tofe ?? "");
    setActif(courante.actif);
  }, [courante]);

  function ouvrirEdition(code: string) {
    setSelection(code);
    setDialogEdition(true);
  }

  function ouvrirAjout() {
    setNouvCode("");
    setNouvLibelle("");
    setNouvParent(selection ?? "");
    setNouvTofe("");
    setNouvActif(true);
    const ref = source.find((l) => l.code === selection);
    setNouvSection(ref?.section ?? "petrole");
    setNouvNature(ref?.nature ?? "exercice_courant");
    setDialogAjout(true);
  }

  async function confirmerAjout() {
    if (!estChef) return;
    const code = nouvCode.trim().toUpperCase();
    const lib = nouvLibelle.trim();
    if (!code || !lib) {
      toast.error("Code et libellé sont obligatoires.");
      return;
    }
    setAjoutEnCours(true);
    try {
      const parent = nouvParent || null;
      if (feuille === "Recettes") {
        await creerRubriqueRecette({
          code,
          libelle: lib,
          parent_code: parent,
          section: parent ? undefined : nouvSection,
          code_tofe: nouvTofe.trim() || null,
          actif: nouvActif,
        });
      } else {
        await creerRubriqueDepense({
          code,
          libelle: lib,
          parent_code: parent,
          nature: parent ? undefined : nouvNature,
          code_tofe: nouvTofe.trim() || null,
          actif: nouvActif,
        });
      }
      setDialogAjout(false);
      await recharger(code);
      toast.success("Rubrique ajoutée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ajout impossible.");
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function onEnregistrer() {
    if (!estChef || !courante) return;
    const lib = libelle.trim();
    if (!lib) {
      toast.error("Le libellé est obligatoire.");
      return;
    }
    setEnregistrement(true);
    try {
      const payload = {
        libelle: lib,
        ordre: Number(ordre) || 0,
        code_tofe: codeTofe.trim() || null,
        actif,
      };
      if (feuille === "Recettes") {
        await enregistrerRubriqueRecette(courante.code, payload);
      } else {
        await enregistrerRubriqueDepense(courante.code, payload);
      }
      await recharger(courante.code);
      toast.success("Rubrique enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function onBasculerActif() {
    if (!estChef || !courante) return;
    const suivant = !courante.actif;
    setEnregistrement(true);
    try {
      const payload = {
        libelle: courante.libelle,
        ordre: courante.ordre,
        code_tofe: courante.code_tofe,
        actif: suivant,
      };
      if (feuille === "Recettes") {
        await enregistrerRubriqueRecette(courante.code, payload);
      } else {
        await enregistrerRubriqueDepense(courante.code, payload);
      }
      setActif(suivant);
      await recharger(courante.code);
      toast.success(suivant ? "Rubrique réactivée." : "Rubrique désactivée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function deposerSur(cible: LigneRubrique) {
    if (!estChef || !dragCode || dragCode === cible.code) {
      setDragCode(null);
      setSurvolCode(null);
      return;
    }
    const sourceLigne = source.find((l) => l.code === dragCode);
    if (!sourceLigne) {
      setDragCode(null);
      setSurvolCode(null);
      return;
    }
    if ((sourceLigne.parent_code ?? null) !== (cible.parent_code ?? null)) {
      toast.error("Déplacez uniquement entre rubriques du même parent.");
      setDragCode(null);
      setSurvolCode(null);
      return;
    }

    const parent = sourceLigne.parent_code;
    const freres = source.filter((l) => (l.parent_code ?? null) === (parent ?? null));
    const codes = freres.map((f) => f.code);
    const from = codes.indexOf(dragCode);
    const to = codes.indexOf(cible.code);
    if (from < 0 || to < 0 || from === to) {
      setDragCode(null);
      setSurvolCode(null);
      return;
    }
    const suivant = [...codes];
    suivant.splice(from, 1);
    suivant.splice(to, 0, dragCode);

    setEnregistrement(true);
    try {
      if (feuille === "Recettes") {
        await reordonnerRubriquesRecettes(parent, suivant);
      } else {
        await reordonnerRubriquesDepenses(parent, suivant);
      }
      await recharger(dragCode);
      toast.success("Ordre mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Déplacement impossible.");
    } finally {
      setEnregistrement(false);
      setDragCode(null);
      setSurvolCode(null);
    }
  }

  const titreTableau = `Nomenclature ${feuille.toLowerCase()}`;
  const parentAffiche = courante?.parent_code
    ? `${courante.parent_code} · ${courante.parent_libelle ?? ""}`.trim()
    : "—";
  const lectureSeule = !estChef;
  const parentRacine = !nouvParent;

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Nomenclature SROT"
        description="Arbre de la nomenclature SROT. Cliquez une rubrique pour l'éditer."
        actions={
          <>
            <BoutonHeader
              label="Ajouter"
              icon={Plus}
              disabled={!estChef}
              title={estChef ? undefined : "Réservé au Chef SOF"}
              onClick={ouvrirAjout}
            />
            <BoutonHeader
              label="Déplacer"
              icon={Move}
              disabled={!estChef}
              actif={modeDeplacement}
              title={
                estChef
                  ? modeDeplacement
                    ? "Quitter le mode déplacement"
                    : "Glisser-déposer les rubriques du même niveau"
                  : "Réservé au Chef SOF"
              }
              onClick={() => {
                setModeDeplacement((v) => !v);
                setDragCode(null);
                setSurvolCode(null);
                if (!modeDeplacement) {
                  toast.info("Glissez une rubrique sur une autre du même parent.");
                }
              }}
            />
          </>
        }
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        {modeDeplacement ? (
          <span className="text-[12.5px] text-[#1e6650]">
            Mode déplacement · glissez une ligne sur une autre du même niveau
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <span className="flex-1" />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
            Nomenclature
          </span>
          <div className="flex rounded-md border border-[#cbd5e1] bg-[#f8fafc] p-0.5">
            {(["Recettes", "Dépenses"] as const).map((opt) => {
              const on = feuille === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFeuille(opt)}
                  className="h-7 rounded px-2.5 text-[12.5px] font-semibold"
                  style={{
                    background: on ? "#fff" : "transparent",
                    color: on ? "#1e6650" : "#475569",
                    boxShadow: on ? "0 1px 2px rgba(15,23,42,.15)" : "none",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
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
              <div style={{ minWidth: 780 }}>
                <div
                  className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                  style={{ gridTemplateColumns: GRILLE }}
                >
                  {(
                    [
                      ["Code", "flex-start"],
                      ["Libellé", "flex-start"],
                      ["Niveau", "center"],
                      ["Code TOFE", "flex-start"],
                      ["Actif", "flex-start"],
                    ] as const
                  ).map(([l, jc]) => (
                    <div
                      key={l}
                      className="whitespace-nowrap px-2.5 py-[9px] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: jc,
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {lignesVisibles.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                    Aucune ligne.
                  </div>
                ) : (
                  lignesVisibles.map((ligne) => {
                    const sel = ligne.code === selection;
                    const profondeur = Math.max(0, ligne.niveau - 1);
                    const pad = 10 + profondeur * 18;
                    const fw = profondeur === 0 ? 600 : 400;
                    const deposable =
                      modeDeplacement &&
                      dragCode !== null &&
                      dragCode !== ligne.code;
                    const survol = deposable && survolCode === ligne.code;
                    return (
                      <div
                        key={ligne.code}
                        role="button"
                        tabIndex={0}
                        draggable={modeDeplacement && estChef}
                        onDragStart={(e) => {
                          if (!modeDeplacement || !estChef) return;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", ligne.code);
                          setDragCode(ligne.code);
                        }}
                        onDragEnd={() => {
                          setDragCode(null);
                          setSurvolCode(null);
                        }}
                        onDragOver={(e) => {
                          if (!deposable) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setSurvolCode(ligne.code);
                        }}
                        onDragLeave={() => {
                          if (survolCode === ligne.code) setSurvolCode(null);
                        }}
                        onDrop={(e) => {
                          if (!deposable) return;
                          e.preventDefault();
                          void deposerSur(ligne);
                        }}
                        onClick={() => {
                          if (!modeDeplacement) ouvrirEdition(ligne.code);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (!modeDeplacement) ouvrirEdition(ligne.code);
                          }
                        }}
                        className={cn(
                          "grid min-h-[42px] border-b border-[#eef2f4] text-[13px]",
                          modeDeplacement
                            ? "cursor-grab active:cursor-grabbing"
                            : "cursor-pointer hover:bg-[#f4f8f6]",
                          dragCode === ligne.code && "opacity-50",
                          survol && "ring-2 ring-inset ring-[#2a7f62]/40",
                        )}
                        style={{
                          gridTemplateColumns: GRILLE,
                          background: survol
                            ? "#e3f1ea"
                            : sel
                              ? "#e3f1ea"
                              : "#fff",
                          fontWeight: fw,
                        }}
                      >
                        <div
                          className="flex min-w-0 items-center gap-1.5 py-1.5 pr-2.5"
                          style={{
                            paddingLeft: pad,
                            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                            fontWeight: fw,
                          }}
                        >
                          {modeDeplacement ? (
                            <span
                              className="shrink-0 text-[#94a3b8]"
                              aria-hidden
                            >
                              <GripVertical size={14} />
                            </span>
                          ) : ligne.repliable ? (
                            <button
                              type="button"
                              className="flex shrink-0 text-[#64748b]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplies((s) => ({
                                  ...s,
                                  [ligne.code]: !s[ligne.code],
                                }));
                              }}
                              aria-label={
                                replies[ligne.code] ? "Déplier" : "Replier"
                              }
                            >
                              {replies[ligne.code] ? (
                                <ChevronRight size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block w-[14px] shrink-0" aria-hidden />
                          )}
                          <span className="whitespace-nowrap">
                            {ligne.code}
                          </span>
                        </div>
                        <div
                          className="flex min-w-0 items-center px-2.5 py-1.5"
                          style={{ fontWeight: fw }}
                        >
                          <span
                            className="min-w-0 truncate"
                            title={ligne.libelle}
                          >
                            {ligne.libelle}
                          </span>
                        </div>
                        <div className="flex items-center justify-center px-2.5 py-1.5 tabular-nums">
                          {ligne.niveau}
                        </div>
                        <div
                          className="flex items-center whitespace-nowrap px-2.5 py-1.5 text-[#475569]"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {ligne.code_tofe || "—"}
                        </div>
                        <div className="flex items-center px-2.5 py-1.5">
                          <span
                            className="whitespace-nowrap rounded px-2 py-0.5 text-[11.5px] font-semibold"
                            style={{
                              background: ligne.actif ? TAG_OK.bg : TAG_NEU.bg,
                              color: ligne.actif ? TAG_OK.fg : TAG_NEU.fg,
                              fontFamily: '"IBM Plex Sans", sans-serif',
                            }}
                          >
                            {ligne.actif ? "Actif" : "Inactif"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
      </section>

      <Dialog
        open={dialogEdition && !!courante}
        onOpenChange={(open) => {
          setDialogEdition(open);
          if (!open) setSelection(null);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Rubrique {courante?.code ?? "—"}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Modifier le libellé, l&apos;ordre, le code TOFE ou l&apos;état
              d&apos;activité.
            </DialogDescription>
          </DialogHeader>

          {courante ? (
            <div
              className="grid gap-x-4 gap-y-3.5 px-6 py-[18px]"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
              }}
            >
              <Champ label="Code">
                <span
                  className={champRoCls}
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                >
                  {courante.code}
                </span>
              </Champ>
              <Champ label="Libellé" wide>
                <input
                  value={libelle}
                  onChange={(e) => setLibelle(e.target.value)}
                  disabled={lectureSeule}
                  className={champCls}
                />
              </Champ>
              <Champ label="Niveau">
                <span className={champRoCls}>{courante.niveau}</span>
              </Champ>
              <Champ label="Parent">
                <span className={champRoCls}>{parentAffiche}</span>
              </Champ>
              <Champ label="Ordre d'affichage">
                <input
                  value={ordre}
                  onChange={(e) =>
                    setOrdre(e.target.value.replace(/[^\d]/g, ""))
                  }
                  disabled={lectureSeule}
                  inputMode="numeric"
                  className={champCls}
                />
              </Champ>
              <Champ label="Code TOFE">
                <input
                  value={codeTofe}
                  onChange={(e) => setCodeTofe(e.target.value)}
                  disabled={lectureSeule}
                  className={champCls}
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                />
              </Champ>
              <Champ label="Actif">
                <select
                  value={actif ? "Oui" : "Non"}
                  onChange={(e) => setActif(e.target.value === "Oui")}
                  disabled={lectureSeule}
                  className={champCls}
                >
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </Champ>
            </div>
          ) : null}

          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setDialogEdition(false);
                setSelection(null);
              }}
              disabled={enregistrement}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a]"
            >
              Fermer
            </button>
            {estChef && courante ? (
              <>
                <BoutonCarte
                  label={courante.actif ? "Désactiver" : "Réactiver"}
                  icon={X}
                  onClick={() => void onBasculerActif()}
                  disabled={enregistrement}
                />
                <BoutonCarte
                  label={enregistrement ? "…" : "Enregistrer"}
                  icon={Check}
                  primary
                  onClick={() => void onEnregistrer()}
                  disabled={enregistrement}
                />
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAjout} onOpenChange={setDialogAjout}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Ajouter une rubrique
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Nouvelle entrée dans la nomenclature {feuille.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 px-6 py-[18px]">
            <Champ label="Code">
              <input
                value={nouvCode}
                onChange={(e) =>
                  setNouvCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                }
                maxLength={10}
                placeholder="ex. R15"
                className={champCls}
                style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
              />
            </Champ>
            <Champ label="Libellé">
              <input
                value={nouvLibelle}
                onChange={(e) => setNouvLibelle(e.target.value)}
                placeholder="Libellé de la rubrique"
                className={champCls}
              />
            </Champ>
            <Champ label="Parent">
              <select
                value={nouvParent}
                onChange={(e) => setNouvParent(e.target.value)}
                className={champCls}
              >
                <option value="">— Racine —</option>
                {source.map((l) => (
                  <option key={l.code} value={l.code}>
                    {"\u00A0".repeat(Math.max(0, l.niveau - 1) * 2)}
                    {l.code} · {l.libelle}
                  </option>
                ))}
              </select>
            </Champ>
            {parentRacine && feuille === "Recettes" ? (
              <Champ label="Section">
                <select
                  value={nouvSection}
                  onChange={(e) =>
                    setNouvSection(e.target.value as SectionRecette)
                  }
                  className={champCls}
                >
                  {SECTIONS.map((s) => (
                    <option key={s.valeur} value={s.valeur}>
                      {s.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
            ) : null}
            {parentRacine && feuille === "Dépenses" ? (
              <Champ label="Nature">
                <select
                  value={nouvNature}
                  onChange={(e) =>
                    setNouvNature(e.target.value as NatureDepense)
                  }
                  className={champCls}
                >
                  {NATURES.map((n) => (
                    <option key={n.valeur} value={n.valeur}>
                      {n.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
            ) : null}
            <Champ label="Code TOFE">
              <input
                value={nouvTofe}
                onChange={(e) => setNouvTofe(e.target.value)}
                placeholder="Facultatif"
                className={champCls}
                style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
              />
            </Champ>
            <Champ label="Actif">
              <select
                value={nouvActif ? "Oui" : "Non"}
                onChange={(e) => setNouvActif(e.target.value === "Oui")}
                className={champCls}
              >
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </Champ>
          </div>

          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              onClick={() => setDialogAjout(false)}
              disabled={ajoutEnCours}
              className="h-[38px] rounded-md border border-[#cbd5e1] bg-white px-4 text-[13.5px] font-semibold text-[#334155]"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void confirmerAjout()}
              disabled={ajoutEnCours}
              className="inline-flex h-[38px] items-center gap-2 rounded-md px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
              style={{ background: "#2a7f62" }}
            >
              {ajoutEnCours ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Ajouter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
