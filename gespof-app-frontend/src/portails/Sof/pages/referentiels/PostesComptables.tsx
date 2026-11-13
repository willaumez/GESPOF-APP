import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  creerPosteComptable,
  enregistrerPosteComptable,
  listerPostesComptables,
} from "@/portails/Sof/api/referentiel";
import type {
  CategoriePosteComptable,
  PosteComptableSof,
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

const GRILLE = "90px minmax(200px, 2fr) 140px minmax(140px, 1fr) 96px";

const CATEGORIES: CategoriePosteComptable[] = ["TPG", "AGC", "ENT"];

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

type ModeDialog = "ajout" | "edition" | null;

export default function PostesComptables() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [postes, setPostes] = useState<PosteComptableSof[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [mode, setMode] = useState<ModeDialog>(null);
  const [editionCode, setEditionCode] = useState<string | null>(null);
  const [saisieCode, setSaisieCode] = useState("");
  const [saisieLibelle, setSaisieLibelle] = useState("");
  const [saisieCategorie, setSaisieCategorie] =
    useState<CategoriePosteComptable>("TPG");
  const [enCours, setEnCours] = useState(false);

  async function recharger() {
    const data = await listerPostesComptables();
    setPostes(data.postes ?? []);
  }

  useEffect(() => {
    let actif = true;
    setChargement(true);
    recharger()
      .catch((e) =>
        toast.error(
          e instanceof Error
            ? e.message
            : "Impossible de charger les postes comptables.",
        ),
      )
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return postes;
    return postes.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.libelle.toLowerCase().includes(q) ||
        p.categorie.toLowerCase().includes(q),
    );
  }, [postes, recherche]);

  function ouvrirAjout() {
    setSaisieCode("");
    setSaisieLibelle("");
    setSaisieCategorie("TPG");
    setEditionCode(null);
    setMode("ajout");
  }

  function ouvrirEdition(p: PosteComptableSof) {
    setEditionCode(p.code);
    setSaisieCode(p.code);
    setSaisieLibelle(p.libelle);
    setSaisieCategorie(p.categorie);
    setMode("edition");
  }

  function fermerDialog() {
    if (enCours) return;
    setMode(null);
    setEditionCode(null);
  }

  async function confirmer() {
    if (!estChef) return;
    const libelle = saisieLibelle.trim();
    if (!libelle) {
      toast.error("Le libellé est obligatoire.");
      return;
    }

    setEnCours(true);
    try {
      if (mode === "ajout") {
        const code = saisieCode.trim();
        if (!code) {
          toast.error("Le code du poste est obligatoire.");
          return;
        }
        await creerPosteComptable({
          code,
          libelle,
          categorie: saisieCategorie,
        });
        toast.success("Entrée ajoutée.");
      } else if (mode === "edition" && editionCode) {
        await enregistrerPosteComptable(editionCode, {
          libelle,
          categorie: saisieCategorie,
        });
        toast.success("Modification enregistrée.");
      }
      setMode(null);
      setEditionCode(null);
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Postes comptables"
        description="Postes comptables du réseau du Trésor."
        remplace="Colonnes PC et LIB_PC des extractions DC"
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
            Ajouter
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

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Postes comptables
          </span>
        </div>

        {chargement ? (
          <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 520 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                {(
                  [
                    ["Code", "flex-start"],
                    ["Libellé", "flex-start"],
                    ["Catégorie par défaut", "flex-start"],
                    ["Catégories observées", "flex-start"],
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

              {filtrees.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                  {recherche.trim()
                    ? `Aucune ligne ne correspond à « ${recherche.trim()} ».`
                    : "Aucune ligne."}
                </div>
              ) : (
                filtrees.map((p) => (
                  <div
                    key={p.code}
                    className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                    style={{ gridTemplateColumns: GRILLE }}
                  >
                    <div
                      className="flex items-center px-2.5 py-1.5"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {p.code}
                    </div>
                    <div className="flex min-w-0 items-center px-2.5 py-1.5 font-medium">
                      <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>
                        {p.libelle}
                      </span>
                    </div>
                    <div
                      className="flex items-center px-2.5 py-1.5"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {p.categorie_defaut ?? p.categorie}
                    </div>
                    <div
                      className="flex items-center px-2.5 py-1.5 text-[12px] text-[#64748b]"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {p.categories_observees ?? "—"}
                    </div>
                    <div className="flex items-center justify-end px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => ouvrirEdition(p)}
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
                ? "Ajouter · Postes comptables"
                : `Modifier · ${editionCode ?? ""}`}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Catégorie par défaut (fallback si C_CATEG ligne vide) : TPG, AGC, ENT.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 px-6 py-[18px]">
            <Champ label="Code">
              <input
                value={saisieCode}
                onChange={(e) => setSaisieCode(e.target.value)}
                disabled={mode === "edition" || !estChef}
                placeholder="ex. TPG"
                className={champCls}
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  background: mode === "edition" ? "#f8fafc" : undefined,
                }}
              />
            </Champ>
            <Champ label="Libellé">
              <input
                value={saisieLibelle}
                onChange={(e) => setSaisieLibelle(e.target.value)}
                disabled={!estChef}
                className={champCls}
              />
            </Champ>
            <Champ label="Catégorie par défaut">
              <select
                value={saisieCategorie}
                onChange={(e) =>
                  setSaisieCategorie(e.target.value as CategoriePosteComptable)
                }
                disabled={!estChef}
                className={champCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Champ>
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
    </div>
  );
}
