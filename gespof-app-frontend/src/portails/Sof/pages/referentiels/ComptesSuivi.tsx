import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GripVertical, Loader2, Move, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  creerCompteSuivi,
  enregistrerCompteSuivi,
  listerComptesSuivi,
  supprimerCompteSuivi,
} from "@/portails/Sof/api/referentiel";
import type {
  CompteSuiviSof,
  FamilleCompteSuivi,
} from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

const GRILLE =
  "100px minmax(200px, 2fr) minmax(180px, 1.1fr) 70px 150px 70px 168px";

type CleCompte = { compte: string; nature: string };

function memeCle(a: CleCompte, b: CleCompte): boolean {
  return a.compte === b.compte && a.nature === b.nature;
}

type OngletComptes = FamilleCompteSuivi;

const ONGLET_LIBELLES: Record<OngletComptes, string> = {
  DOUANE: "Douanes",
  PETROLE: "Pétrole",
};

const TYPES_PAR_FAMILLE: Record<OngletComptes, readonly string[]> = {
  DOUANE: [
    "DOUANE A CRÉDIT",
    "DOUANE AU COMPTANT",
    "DOUANE MANUELLE",
    "RUSID",
    "COMPTE DE TRANSFERT",
  ],
  PETROLE: [
    "IS",
    "Dividendes",
    "RMP",
    "Redevance Superficiaire",
    "Profit Oil",
    "Discount et Boni",
    "PIPES",
    "Transferts",
  ],
};

const champCls =
  "h-[38px] w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 text-sm text-[#0f172a] outline-none disabled:bg-[#f8fafc]";

function Champ({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-semibold text-[#334155]">{label}</label>
      {children}
    </div>
  );
}

function TagOuiNon({ oui }: { oui: boolean }) {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-semibold"
      style={
        oui
          ? { background: "#ecfdf5", color: "#047857" }
          : { background: "#f1f5f9", color: "#475569" }
      }
    >
      {oui ? "Oui" : "Non"}
    </span>
  );
}

type ModeDialog = "ajout" | "edition" | null;

type Formulaire = {
  compte: string;
  nature: string;
  libelle: string;
  famille: FamilleCompteSuivi;
  type: string;
  bancaire_seulement: boolean;
  ordre: string;
};

type LigneAffichee =
  | { kind: "groupe"; type: string }
  | { kind: "compte"; compte: CompteSuiviSof };

function formulaireVide(
  ordreDefaut: number,
  famille: OngletComptes = "DOUANE",
): Formulaire {
  const types = TYPES_PAR_FAMILLE[famille];
  return {
    compte: "",
    nature: famille === "DOUANE" ? "-" : "",
    libelle: "",
    famille,
    type: types[0] ?? "",
    bancaire_seulement: famille === "DOUANE" && types[0] === "DOUANE A CRÉDIT",
    ordre: String(ordreDefaut),
  };
}

function depuisCompte(c: CompteSuiviSof): Formulaire {
  return {
    compte: c.compte,
    nature: c.nature,
    libelle: c.libelle,
    famille: c.famille,
    type: c.type,
    bancaire_seulement: c.bancaire_seulement,
    ordre: String(c.ordre),
  };
}

export default function ComptesSuivi() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [comptes, setComptes] = useState<CompteSuiviSof[]>([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<OngletComptes>("DOUANE");
  const [recherche, setRecherche] = useState("");
  const [mode, setMode] = useState<ModeDialog>(null);
  const [editionCle, setEditionCle] = useState<CleCompte | null>(null);
  const [form, setForm] = useState<Formulaire>(() => formulaireVide(1));
  const [enCours, setEnCours] = useState(false);
  const [aSupprimer, setASupprimer] = useState<CompteSuiviSof | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [modeDeplacement, setModeDeplacement] = useState(false);
  const [dragCle, setDragCle] = useState<CleCompte | null>(null);
  const [survolCle, setSurvolCle] = useState<CleCompte | null>(null);

  async function recharger() {
    const data = await listerComptesSuivi();
    setComptes(data.comptes ?? []);
  }

  useEffect(() => {
    let actif = true;
    setChargement(true);
    recharger()
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les comptes.",
        ),
      )
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  const comptesOnglet = useMemo(
    () => comptes.filter((c) => c.famille === onglet),
    [comptes, onglet],
  );

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return comptesOnglet;
    return comptesOnglet.filter(
      (c) =>
        c.compte.toLowerCase().includes(q) ||
        c.libelle.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.nature.toLowerCase().includes(q),
    );
  }, [comptesOnglet, recherche]);

  const lignes = useMemo((): LigneAffichee[] => {
    const out: LigneAffichee[] = [];
    let typeCourant: string | null = null;
    for (const c of filtrees) {
      if (c.type !== typeCourant) {
        typeCourant = c.type;
        out.push({ kind: "groupe", type: c.type });
      }
      out.push({ kind: "compte", compte: c });
    }
    return out;
  }, [filtrees]);

  function majForm<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) {
    setForm((prev) => {
      if (cle === "famille") {
        const fam = valeur as OngletComptes;
        const types = TYPES_PAR_FAMILLE[fam];
        return {
          ...prev,
          famille: fam,
          type: types[0] ?? "",
          nature: fam === "DOUANE" ? prev.nature || "-" : prev.nature === "-" ? "" : prev.nature,
          bancaire_seulement:
            fam === "DOUANE" && types[0] === "DOUANE A CRÉDIT",
        };
      }
      return { ...prev, [cle]: valeur };
    });
  }

  function ouvrirAjout() {
    const maxOrdre = comptesOnglet.reduce((m, c) => Math.max(m, c.ordre), 0);
    setEditionCle(null);
    setForm(formulaireVide(maxOrdre + 1, onglet));
    setMode("ajout");
  }

  function ouvrirEdition(c: CompteSuiviSof) {
    setEditionCle({ compte: c.compte, nature: c.nature });
    setForm(depuisCompte(c));
    setMode("edition");
  }

  function fermerDialog() {
    if (enCours) return;
    setMode(null);
    setEditionCle(null);
  }

  async function confirmer() {
    if (!estChef) return;
    const libelle = form.libelle.trim();
    const type = form.type.trim();
    const ordre = Math.max(1, Number.parseInt(form.ordre, 10) || 1);
    if (!libelle) {
      toast.error("Le libellé est obligatoire.");
      return;
    }
    if (!type) {
      toast.error("Le type est obligatoire.");
      return;
    }

    setEnCours(true);
    try {
      if (mode === "ajout") {
        const compte = form.compte.trim();
        const nature = form.nature.trim();
        if (!compte) {
          toast.error("Le numéro de compte est obligatoire.");
          return;
        }
        if (!nature) {
          toast.error("La nature est obligatoire.");
          return;
        }
        await creerCompteSuivi({
          compte,
          nature,
          libelle,
          famille: form.famille,
          type,
          bancaire_seulement: form.bancaire_seulement,
          ordre,
        });
        toast.success("Compte ajouté.");
      } else if (mode === "edition" && editionCle) {
        await enregistrerCompteSuivi(editionCle.compte, editionCle.nature, {
          libelle,
          famille: form.famille,
          type,
          bancaire_seulement: form.bancaire_seulement,
          ordre,
        });
        toast.success("Modification enregistrée.");
      }
      setMode(null);
      setEditionCle(null);
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerSuppression() {
    if (!estChef || !aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await supprimerCompteSuivi(aSupprimer.compte, aSupprimer.nature);
      toast.success("Compte supprimé.");
      setASupprimer(null);
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setSuppressionEnCours(false);
    }
  }

  async function deposerSur(cible: CompteSuiviSof) {
    if (!estChef || !dragCle) {
      setDragCle(null);
      setSurvolCle(null);
      return;
    }
    if (memeCle(dragCle, { compte: cible.compte, nature: cible.nature })) {
      setDragCle(null);
      setSurvolCle(null);
      return;
    }
    const source = comptesOnglet.find((c) =>
      memeCle({ compte: c.compte, nature: c.nature }, dragCle),
    );
    if (!source) {
      setDragCle(null);
      setSurvolCle(null);
      return;
    }
    if (source.type !== cible.type || source.famille !== cible.famille) {
      toast.error("Déplacez uniquement entre comptes du même type.");
      setDragCle(null);
      setSurvolCle(null);
      return;
    }

    const freres = comptesOnglet.filter((c) => c.type === source.type);
    const from = freres.findIndex((c) =>
      memeCle({ compte: c.compte, nature: c.nature }, dragCle),
    );
    const to = freres.findIndex(
      (c) => c.compte === cible.compte && c.nature === cible.nature,
    );
    if (from < 0 || to < 0 || from === to) {
      setDragCle(null);
      setSurvolCle(null);
      return;
    }

    const reordonnes = [...freres];
    const [deplace] = reordonnes.splice(from, 1);
    reordonnes.splice(to, 0, deplace);
    const base = Math.min(...freres.map((c) => c.ordre));

    setEnCours(true);
    try {
      for (let i = 0; i < reordonnes.length; i++) {
        const c = reordonnes[i];
        const nouvelOrdre = base + i;
        if (c.ordre !== nouvelOrdre) {
          await enregistrerCompteSuivi(c.compte, c.nature, {
            ordre: nouvelOrdre,
          });
        }
      }
      await recharger();
      toast.success("Ordre mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Déplacement impossible.");
    } finally {
      setEnCours(false);
      setDragCle(null);
      setSurvolCle(null);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Comptes douanes et pétrole"
        description={
          onglet === "DOUANE"
            ? "Comptes douaniers, groupés par type (manuel SROT p. 24 + Bitam / Oyem)."
            : "Comptes pétroliers, groupés par type (manuel SROT p. 27)."
        }
        remplace="Manuel SROT p. 24 (douanes) et p. 27 (pétrole)"
        actions={
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
            Ajouter {ONGLET_LIBELLES[onglet]}
          </button>
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
        role="tablist"
        aria-label="Famille de comptes"
      >
        {(Object.keys(ONGLET_LIBELLES) as OngletComptes[]).map((k) => {
          const on = onglet === k;
          const n = comptes.filter((c) => c.famille === k).length;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setOnglet(k);
                setRecherche("");
                setModeDeplacement(false);
                setDragCle(null);
                setSurvolCle(null);
              }}
              className="flex h-[46px] shrink-0 items-center gap-2 border-0 bg-transparent px-3 text-[14px] whitespace-nowrap"
              style={{
                fontWeight: on ? 600 : 500,
                color: on ? "#1e6650" : "#64748b",
                boxShadow: on
                  ? "inset 0 -2px 0 #2a7f62"
                  : "inset 0 -2px 0 transparent",
              }}
            >
              {ONGLET_LIBELLES[k]}
              <span
                className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                style={{
                  background: on ? "#e8f5ef" : "#f1f5f9",
                  color: on ? "#1e6650" : "#64748b",
                }}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#0f172a]">
              Comptes · {ONGLET_LIBELLES[onglet]}
            </span>
            {modeDeplacement ? (
              <span className="text-[12.5px] text-[#1e6650]">
                Mode déplacement · glissez une ligne sur une autre du même type
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setModeDeplacement((v) => !v);
              setDragCle(null);
              setSurvolCle(null);
              if (!modeDeplacement) {
                toast.info(
                  "Glissez un compte sur un autre du même type pour changer l’ordre.",
                );
              }
            }}
            disabled={!estChef}
            title={
              estChef
                ? modeDeplacement
                  ? "Quitter le mode déplacement"
                  : "Glisser-déposer les comptes du même type"
                : "Réservé au Chef SOF"
            }
            className={cn(
              "inline-flex h-[34px] items-center gap-2 rounded-md border px-3 text-[13px] font-semibold",
              !estChef
                ? "cursor-not-allowed border-[#cbd5e1] bg-white text-[#0f172a] opacity-50"
                : modeDeplacement
                  ? "cursor-pointer border-[#2a7f62] bg-[#f0f7f4] text-[#1e6650]"
                  : "cursor-pointer border-[#cbd5e1] bg-white text-[#0f172a] hover:brightness-95",
            )}
          >
            <Move size={15} strokeWidth={2.2} />
            Déplacer
          </button>
        </div>

        {chargement ? (
          <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 860 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                {(
                  [
                    ["Compte", "flex-start"],
                    ["Libellé", "flex-start"],
                    ["Type", "flex-start"],
                    ["Nature", "flex-start"],
                    ["Opér. bancaires seult", "flex-start"],
                    ["Ordre", "flex-end"],
                    ["", "flex-end"],
                  ] as const
                ).map(([l, jc], i) => (
                  <div
                    key={l || `col-${i}`}
                    className="px-2.5 py-[9px] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
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

              {lignes.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                  {recherche.trim()
                    ? `Aucune ligne ne correspond à « ${recherche.trim()} ».`
                    : `Aucun compte ${ONGLET_LIBELLES[onglet].toLowerCase()}.`}
                </div>
              ) : (
                lignes.map((ligne) =>
                  ligne.kind === "groupe" ? (
                    <div
                      key={`g-${ligne.type}`}
                      className="grid min-h-[36px] border-b border-[#eef2f4] bg-[#f8fafc] text-[13px]"
                      style={{ gridTemplateColumns: GRILLE }}
                    >
                      <div className="px-2.5 py-1.5" />
                      <div className="flex items-center whitespace-nowrap px-2.5 py-1.5 font-semibold text-[#0f172a]">
                        {ligne.type}
                      </div>
                      <div />
                      <div />
                      <div />
                      <div />
                      <div />
                    </div>
                  ) : (
                    (() => {
                      const c = ligne.compte;
                      const cle: CleCompte = {
                        compte: c.compte,
                        nature: c.nature,
                      };
                      const enDrag =
                        dragCle !== null && memeCle(dragCle, cle);
                      const deposable =
                        modeDeplacement &&
                        dragCle !== null &&
                        !memeCle(dragCle, cle);
                      const survol =
                        deposable &&
                        survolCle !== null &&
                        memeCle(survolCle, cle);
                      return (
                        <div
                          key={`${c.compte}-${c.nature}`}
                          draggable={modeDeplacement && estChef}
                          onDragStart={(e) => {
                            if (!modeDeplacement || !estChef) return;
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData(
                              "text/plain",
                              `${c.compte}/${c.nature}`,
                            );
                            setDragCle(cle);
                          }}
                          onDragEnd={() => {
                            setDragCle(null);
                            setSurvolCle(null);
                          }}
                          onDragOver={(e) => {
                            if (!deposable) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setSurvolCle(cle);
                          }}
                          onDragLeave={() => {
                            if (
                              survolCle &&
                              memeCle(survolCle, cle)
                            ) {
                              setSurvolCle(null);
                            }
                          }}
                          onDrop={(e) => {
                            if (!deposable) return;
                            e.preventDefault();
                            void deposerSur(c);
                          }}
                          className={cn(
                            "grid min-h-[42px] border-b border-[#eef2f4] text-[13px]",
                            modeDeplacement
                              ? "cursor-grab active:cursor-grabbing"
                              : null,
                            enDrag && "opacity-50",
                            survol && "ring-2 ring-inset ring-[#2a7f62]/40",
                          )}
                          style={{
                            gridTemplateColumns: GRILLE,
                            background: survol ? "#e3f1ea" : "#fff",
                          }}
                        >
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1.5"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                            }}
                          >
                            {modeDeplacement ? (
                              <span
                                className="shrink-0 text-[#94a3b8]"
                                aria-hidden
                              >
                                <GripVertical size={14} />
                              </span>
                            ) : null}
                            {c.compte}
                          </div>
                          <div className="flex min-w-0 items-center px-2.5 py-1.5 pl-6">
                            <span
                              className="min-w-0"
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {c.libelle}
                            </span>
                          </div>
                          <div className="flex items-center whitespace-nowrap px-2.5 py-1.5 text-[#475569]">
                            {c.type}
                          </div>
                          <div
                            className="flex items-center px-2.5 py-1.5"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                            }}
                          >
                            {c.nature}
                          </div>
                          <div className="flex items-center px-2.5 py-1.5">
                            <TagOuiNon oui={c.bancaire_seulement} />
                          </div>
                          <div
                            className="flex items-center justify-end px-2.5 py-1.5"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                            }}
                          >
                            {c.ordre}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 px-2.5 py-1.5">
                            {modeDeplacement ? null : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => ouvrirEdition(c)}
                                  className="h-7 rounded-[5px] border border-[#bfdccf] bg-[#f0f7f4] px-2.5 text-xs font-semibold whitespace-nowrap text-[#1e6650]"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!estChef) {
                                      toast.error("Réservé au Chef SOF");
                                      return;
                                    }
                                    setASupprimer(c);
                                  }}
                                  disabled={!estChef}
                                  title={
                                    estChef
                                      ? "Supprimer ce compte"
                                      : "Réservé au Chef SOF"
                                  }
                                  className={cn(
                                    "h-7 rounded-[5px] border px-2.5 text-xs font-semibold whitespace-nowrap",
                                    estChef
                                      ? "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] hover:brightness-95"
                                      : "cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]",
                                  )}
                                >
                                  Supprimer
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ),
                )
              )}
            </div>
          </div>
        )}
      </section>

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
                ? `Ajouter · ${ONGLET_LIBELLES[form.famille]}`
                : `Modifier · ${editionCle?.compte ?? ""}`}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Clé métier : compte + nature
              {form.famille === "DOUANE"
                ? ". Les 4784-1* sont en opérations bancaires seulement."
                : " (fichier = compte-nature)."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-3.5 overflow-y-auto px-6 py-[18px]">
            <Champ label="Compte">
              <input
                value={form.compte}
                onChange={(e) => majForm("compte", e.target.value)}
                disabled={mode === "edition" || !estChef}
                placeholder={
                  form.famille === "DOUANE" ? "ex. 4784-101" : "ex. 4783-1"
                }
                className={champCls}
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  background: mode === "edition" ? "#f8fafc" : undefined,
                }}
              />
            </Champ>
            <Champ label="Nature">
              <input
                value={form.nature}
                onChange={(e) => majForm("nature", e.target.value)}
                disabled={mode === "edition" || !estChef}
                placeholder={form.famille === "DOUANE" ? "-" : "ex. 1"}
                className={champCls}
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  background: mode === "edition" ? "#f8fafc" : undefined,
                }}
              />
            </Champ>
            <Champ label="Libellé">
              <input
                value={form.libelle}
                onChange={(e) => majForm("libelle", e.target.value)}
                disabled={!estChef}
                className={champCls}
              />
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Famille">
                <select
                  value={form.famille}
                  onChange={(e) =>
                    majForm("famille", e.target.value as FamilleCompteSuivi)
                  }
                  disabled={!estChef || mode === "ajout"}
                  className={champCls}
                  style={{
                    background: mode === "ajout" ? "#f8fafc" : undefined,
                  }}
                >
                  <option value="DOUANE">Douane</option>
                  <option value="PETROLE">Pétrole</option>
                </select>
              </Champ>
              <Champ label="Type">
                <select
                  value={form.type}
                  onChange={(e) => majForm("type", e.target.value)}
                  disabled={!estChef}
                  className={champCls}
                >
                  {!TYPES_PAR_FAMILLE[form.famille].includes(form.type) &&
                  form.type ? (
                    <option value={form.type}>{form.type}</option>
                  ) : null}
                  {TYPES_PAR_FAMILLE[form.famille].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Champ>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Opér. bancaires seulement">
                <select
                  value={form.bancaire_seulement ? "oui" : "non"}
                  onChange={(e) =>
                    majForm("bancaire_seulement", e.target.value === "oui")
                  }
                  disabled={!estChef}
                  className={champCls}
                >
                  <option value="oui">Oui</option>
                  <option value="non">Non</option>
                </select>
              </Champ>
              <Champ label="Ordre">
                <input
                  type="number"
                  min={1}
                  value={form.ordre}
                  onChange={(e) => majForm("ordre", e.target.value)}
                  disabled={!estChef}
                  className={champCls}
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                />
              </Champ>
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

      <AlertDialog
        open={aSupprimer !== null}
        onOpenChange={(open) => {
          if (!open && !suppressionEnCours) setASupprimer(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer le compte {aSupprimer?.compte} ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-[#475569]">
              Vous allez retirer « {aSupprimer?.libelle} » (nature{" "}
              {aSupprimer?.nature}) de la famille{" "}
              {aSupprimer
                ? ONGLET_LIBELLES[aSupprimer.famille]
                : ""}
              . Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suppressionEnCours}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={suppressionEnCours}
              onClick={(e) => {
                e.preventDefault();
                void confirmerSuppression();
              }}
            >
              {suppressionEnCours ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
