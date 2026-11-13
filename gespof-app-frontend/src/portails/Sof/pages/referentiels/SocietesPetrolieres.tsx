import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  creerSocietePetroliere,
  enregistrerSocietePetroliere,
  listerSocietesPetrolieres,
} from "@/portails/Sof/api/referentiel";
import type { SocietePetroliereSof } from "@/portails/Sof/types/referentiel.interface";
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

const GRILLE = "100px minmax(200px, 1.6fr) 130px 120px 96px";
const NIF_ABSENT_PETROLE = "739969U";

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

function TagPerimetre({ petrole }: { petrole: boolean }) {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-semibold"
      style={
        petrole
          ? { background: "#ecfdf5", color: "#047857" }
          : { background: "#f1f5f9", color: "#475569" }
      }
    >
      {petrole ? "Pétrole" : "Hors pétrole"}
    </span>
  );
}

function normaliserMontantSaisie(valeur: string): string {
  return valeur
    .replace(/[\s\u00A0\u202F']/g, "")
    .replace(",", ".")
    .trim();
}

type ModeDialog = "ajout" | "edition" | null;

type Formulaire = {
  matricule: string;
  nom: string;
  champ_nif: string;
  redevance_sup_min: string;
  petrole: boolean;
};

function formulaireVide(): Formulaire {
  return {
    matricule: "",
    nom: "",
    champ_nif: "",
    redevance_sup_min: "",
    petrole: true,
  };
}

function depuisSociete(s: SocietePetroliereSof): Formulaire {
  return {
    matricule: s.matricule,
    nom: s.nom,
    champ_nif: s.champ_nif ?? "",
    redevance_sup_min: String(Number(s.redevance_sup_min) || s.redevance_sup_min),
    petrole: s.petrole,
  };
}

export default function SocietesPetrolieres() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [societes, setSocietes] = useState<SocietePetroliereSof[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [mode, setMode] = useState<ModeDialog>(null);
  const [editionMatricule, setEditionMatricule] = useState<string | null>(null);
  const [form, setForm] = useState<Formulaire>(formulaireVide);
  const [enCours, setEnCours] = useState(false);

  async function recharger() {
    const data = await listerSocietesPetrolieres();
    setSocietes(data.societes ?? []);
  }

  useEffect(() => {
    let actif = true;
    setChargement(true);
    recharger()
      .catch((e) =>
        toast.error(
          e instanceof Error
            ? e.message
            : "Impossible de charger les sociétés pétrolières.",
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
    if (!q) return societes;
    return societes.filter(
      (s) =>
        s.matricule.toLowerCase().includes(q) ||
        s.nom.toLowerCase().includes(q) ||
        (s.champ_nif ?? "").toLowerCase().includes(q) ||
        s.perimetre.toLowerCase().includes(q),
    );
  }, [societes, recherche]);

  function majForm<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) {
    setForm((prev) => ({ ...prev, [cle]: valeur }));
  }

  function ouvrirAjout() {
    setEditionMatricule(null);
    setForm(formulaireVide());
    setMode("ajout");
  }

  function ouvrirEdition(s: SocietePetroliereSof) {
    setEditionMatricule(s.matricule);
    setForm(depuisSociete(s));
    setMode("edition");
  }

  function fermerDialog() {
    if (enCours) return;
    setMode(null);
    setEditionMatricule(null);
  }

  async function confirmer() {
    if (!estChef) return;
    const nom = form.nom.trim();
    const redevanceBrut = normaliserMontantSaisie(form.redevance_sup_min);
    const redevance =
      redevanceBrut === ""
        ? null
        : Number.isNaN(Number(redevanceBrut))
          ? undefined
          : redevanceBrut;
    if (!nom) {
      toast.error("Le nom de la société est obligatoire.");
      return;
    }
    if (redevance === undefined) {
      toast.error("La redevance superficiaire minimale est invalide.");
      return;
    }

    setEnCours(true);
    try {
      if (mode === "ajout") {
        const matricule = form.matricule.trim();
        if (!matricule) {
          toast.error("Le matricule est obligatoire.");
          return;
        }
        await creerSocietePetroliere({
          matricule,
          nom,
          champ_nif: form.champ_nif.trim() || null,
          redevance_sup_min: redevance,
          petrole: form.petrole,
        });
        toast.success("Entrée ajoutée.");
      } else if (mode === "edition" && editionMatricule) {
        await enregistrerSocietePetroliere(editionMatricule, {
          nom,
          champ_nif: form.champ_nif.trim() || null,
          redevance_sup_min: redevance,
          petrole: form.petrole,
        });
        toast.success("Modification enregistrée.");
      }
      setMode(null);
      setEditionMatricule(null);
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
        title="Sociétés pétrolières"
        description="Sociétés pétrolières et paramètres de qualification."
        remplace="Feuille « SOCIETES » d'Analyse TVA ; feuille « Pétrole » du RD Model"
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

      {societes.some((s) => (s.champ_nif ?? "").toUpperCase() === NIF_ABSENT_PETROLE) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Avertissement : le NIF {NIF_ABSENT_PETROLE} est absent de la feuille Pétrole du RD
          Model (24/25 NIF retrouvés) — non bloquant.
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Recherche
          <span className="flex h-[34px] w-[220px] items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[#64748b]">
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
            Sociétés pétrolières
          </span>
        </div>

        {chargement ? (
          <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 720 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                {(
                  [
                    ["Matricule", "flex-start"],
                    ["Société", "flex-start"],
                    ["NIF", "flex-start"],
                    ["Périmètre", "flex-start"],
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
                filtrees.map((s) => (
                  <div
                    key={s.matricule}
                    className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                    style={{ gridTemplateColumns: GRILLE }}
                  >
                    <div
                      className="flex items-center px-2.5 py-1.5"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {s.matricule}
                    </div>
                    <div className="flex min-w-0 items-center px-2.5 py-1.5 font-medium">
                      <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>
                        {s.nom}
                      </span>
                    </div>
                    <div
                      className="flex items-center px-2.5 py-1.5"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {s.champ_nif ?? "—"}
                      {(s.champ_nif ?? "").toUpperCase() === NIF_ABSENT_PETROLE ? (
                        <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          hors Pétrole
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center px-2.5 py-1.5">
                      <TagPerimetre petrole={s.petrole} />
                    </div>
                    <div className="flex items-center justify-end px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => ouvrirEdition(s)}
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
                ? "Ajouter · Sociétés pétrolières"
                : `Modifier · ${editionMatricule ?? ""}`}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Paramètres de qualification (périmètre pétrole / hors pétrole).
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-3.5 overflow-y-auto px-6 py-[18px]">
            <Champ label="Matricule">
              <input
                value={form.matricule}
                onChange={(e) => majForm("matricule", e.target.value)}
                disabled={mode === "edition" || !estChef}
                placeholder="ex. 400100"
                className={champCls}
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  background: mode === "edition" ? "#f8fafc" : undefined,
                }}
              />
            </Champ>
            <Champ label="Société">
              <input
                value={form.nom}
                onChange={(e) => majForm("nom", e.target.value)}
                disabled={!estChef}
                className={champCls}
              />
            </Champ>
            <Champ label="NIF">
              <input
                value={form.champ_nif}
                onChange={(e) => majForm("champ_nif", e.target.value)}
                disabled={!estChef}
                className={champCls}
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                }}
              />
            </Champ>
            <Champ label="Redevance superficiaire minimale">
              <div className="flex flex-col gap-1.5">
                <span className="inline-flex w-fit rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  source à confirmer
                </span>
                <input
                  value={form.redevance_sup_min}
                  onChange={(e) => majForm("redevance_sup_min", e.target.value)}
                  disabled={!estChef}
                  placeholder="Optionnel"
                  className={champCls}
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                />
              </div>
            </Champ>
            <Champ label="Périmètre">
              <select
                value={form.petrole ? "petrole" : "hors"}
                onChange={(e) => majForm("petrole", e.target.value === "petrole")}
                disabled={!estChef}
                className={champCls}
              >
                <option value="petrole">Pétrole</option>
                <option value="hors">Hors pétrole</option>
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
