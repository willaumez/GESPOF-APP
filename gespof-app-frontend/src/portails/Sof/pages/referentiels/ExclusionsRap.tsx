import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  SOF_VERT,
  tdCls,
  thCls,
} from "@/portails/Sof/components/SofCards";
import {
  creerExclusionRap,
  listerExclusionsRap,
  supprimerExclusionRap,
} from "@/portails/Sof/api/referentiel";
import type {
  ExclusionRapSof,
  RegleFixeRap,
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

type Tab = "ord" | "mdr" | "nat";

const champCls =
  "h-[38px] w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 text-sm text-[#0f172a] outline-none";

function formatDateFr(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function extraireCodesOrdos(texte: string): string[] {
  const lignes = texte.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length === 0) return [];

  const separateur = lignes[0].includes(";") ? ";" : ",";
  const entetes = lignes[0].split(separateur).map((h) => h.trim().replace(/^"|"$/g, ""));
  const idx =
    entetes.findIndex((h) => /^ordos?$/i.test(h)) >= 0
      ? entetes.findIndex((h) => /^ordos?$/i.test(h))
      : entetes.findIndex((h) => /ordonnance/i.test(h));

  const codes: string[] = [];
  const debut = idx >= 0 ? 1 : 0;
  for (let i = debut; i < lignes.length; i++) {
    const cols = lignes[i].split(separateur).map((c) => c.trim().replace(/^"|"$/g, ""));
    const brut = (idx >= 0 ? cols[idx] : cols[0])?.trim() ?? "";
    if (!brut || /^ordos?$/i.test(brut)) continue;
    codes.push(brut);
  }
  return [...new Set(codes)];
}

/**
 * Référentiel Exclusions RAP — ORDONNANCE + MDR (API).
 * Sans natures ; règles fixes affichées en lecture seule.
 */
export default function ExclusionsRap() {
  const { hasAnyRole, user } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const fichierRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("ord");
  const [exclusions, setExclusions] = useState<ExclusionRapSof[]>([]);
  const [reglesFixes, setReglesFixes] = useState<RegleFixeRap[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  const [dialogAjout, setDialogAjout] = useState(false);
  const [codeAjout, setCodeAjout] = useState("");
  const [libelleAjout, setLibelleAjout] = useState("");
  const [motifAjout, setMotifAjout] = useState("");

  const [aRetirer, setARetirer] = useState<ExclusionRapSof | null>(null);
  const [motifRetrait, setMotifRetrait] = useState("");

  const auteurCourant = useMemo(() => {
    if (!user) return "—";
    return `${user.prenom} ${user.nom}`.trim() || user.email;
  }, [user]);

  async function recharger() {
    const data = await listerExclusionsRap();
    setExclusions(data.exclusions ?? []);
    setReglesFixes(data.regles_fixes ?? []);
  }

  useEffect(() => {
    let actif = true;
    setChargement(true);
    recharger()
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les exclusions.",
        ),
      )
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  const ordos = useMemo(
    () => exclusions.filter((e) => e.type === "ORDONNANCE"),
    [exclusions],
  );
  const mdr = useMemo(
    () => exclusions.filter((e) => e.type === "MDR"),
    [exclusions],
  );
  const natures = useMemo(
    () => exclusions.filter((e) => e.type === "NATURE"),
    [exclusions],
  );

  const tabs = useMemo(
    () =>
      [
        { id: "ord" as const, label: `Ordonnances exclues · ${ordos.length}` },
        { id: "mdr" as const, label: `Modes de règlement exclus · ${mdr.length}` },
        { id: "nat" as const, label: `Natures exclues · ${natures.length}` },
      ] as const,
    [ordos.length, mdr.length, natures.length],
  );

  function ouvrirAjout() {
    if (!estChef) return;
    setCodeAjout("");
    setLibelleAjout("");
    setMotifAjout("");
    setDialogAjout(true);
  }

  async function confirmerAjout() {
    if (!estChef) return;
    const code = codeAjout.trim();
    if (!code) {
      toast.error(tab === "ord" ? "Le n° d’ordonnance est obligatoire." : "Le MDR est obligatoire.");
      return;
    }
    setEnCours(true);
    try {
      await creerExclusionRap({
        type: tab === "ord" ? "ORDONNANCE" : "MDR",
        code,
        libelle: tab === "mdr" ? libelleAjout.trim() || null : null,
        motif: motifAjout.trim() || null,
        auteur: auteurCourant,
      });
      toast.success("Exclusion ajoutée.");
      setDialogAjout(false);
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ajout impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerRetrait() {
    if (!estChef || !aRetirer) return;
    const motif = motifRetrait.trim();
    if (!motif) {
      toast.error("Indiquez le motif du retrait.");
      return;
    }
    setEnCours(true);
    try {
      await supprimerExclusionRap(aRetirer.id, motif);
      toast.success("Exclusion retirée.");
      setARetirer(null);
      setMotifRetrait("");
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retrait impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function importerCsv(fichier: File) {
    if (!estChef) return;
    const texte = await fichier.text();
    const codes = extraireCodesOrdos(texte);
    if (codes.length === 0) {
      toast.error("Aucune colonne ORDOS / ordonnance trouvée dans le fichier.");
      return;
    }

    const deja = new Set(ordos.map((o) => o.code));
    const aCreer = codes.filter((c) => !deja.has(c));
    if (aCreer.length === 0) {
      toast.message("Toutes les ordonnances du fichier sont déjà exclues.");
      return;
    }

    setEnCours(true);
    let ok = 0;
    let ko = 0;
    try {
      for (const code of aCreer) {
        try {
          await creerExclusionRap({
            type: "ORDONNANCE",
            code,
            motif: `Import ${fichier.name}`,
            auteur: auteurCourant,
          });
          ok += 1;
        } catch {
          ko += 1;
        }
      }
      await recharger();
      setTab("ord");
      if (ok > 0) toast.success(`${ok} ordonnance(s) importée(s).`);
      if (ko > 0) toast.error(`${ko} ligne(s) non importée(s).`);
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Exclusions RAP"
        description="Exclusions appliquées au calcul des RAP."
        remplace="OP hors RAP.csv + modes de règlement exclus"
        actions={
          estChef && tab !== "nat" ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={fichierRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importerCsv(f);
                }}
              />
              {tab === "ord" ? (
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => fichierRef.current?.click()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium disabled:opacity-50"
                >
                  <Upload className="size-4" /> Importer OP hors RAP
                </button>
              ) : null}
              <button
                type="button"
                disabled={enCours}
                onClick={ouvrirAjout}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
                }}
              >
                <Plus className="size-4" /> Ajouter
              </button>
            </div>
          ) : null
        }
      />

      <div className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] leading-relaxed text-[#9f1239]">
        Écart avec le manuel : le manuel exclut « MDR &gt; 699 ». La liste ci-dessous
        (710, 730, 750, 780, 800, 850, 900) est celle du classeur — décision : on suit le
        code.
      </div>

      <CardShell title="Règles fixes" sub="Lecture seule · Methods.donnees_rap">
        <ul className="space-y-2 px-4 py-3 text-[13px] text-[#334155]">
          {(reglesFixes.length > 0
            ? reglesFixes
            : [
                {
                  numero: 1,
                  libelle:
                    "Les crédits délégués dont le RAP est négatif ou nul sont exclus.",
                  source: "manuel SOF p. 10",
                },
                {
                  numero: 2,
                  libelle:
                    "Les lignes de catégorie autre que TPG, AGC ou ENT sont retirées.",
                  source: "Methods.donnees_rap",
                },
                {
                  numero: 3,
                  libelle: "RAP avant BOP : seule la catégorie ENT est gardée.",
                  source: "Methods.donnees_rap",
                },
                {
                  numero: 4,
                  libelle:
                    "RAP mode BOP, exercice 2015 : seule la catégorie ENT est gardée.",
                  source: "Methods.donnees_rap",
                },
              ]
          ).map((r) => (
            <li key={r.numero}>
              {r.numero}. {r.libelle} —{" "}
              <span className="text-[#64748b]">{r.source}</span>
            </li>
          ))}
        </ul>
      </CardShell>

      <div className="flex gap-1 border-b border-[#e2e8f0]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="px-3.5 py-2 text-[13.5px] font-medium"
            style={{
              color: tab === t.id ? "#1e6650" : "#64748b",
              borderBottom:
                tab === t.id ? "2px solid #2a7f62" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
          <Loader2 size={16} className="animate-spin" />
          Chargement…
        </div>
      ) : tab === "ord" ? (
        <CardShell title="Ordonnances exclues" sub={`${ordos.length} lignes`}>
          {ordos.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#64748b]">
              Aucune ordonnance exclue. Importer OP hors RAP.csv ou ajouter manuellement.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={thCls} style={{ textAlign: "left" }}>
                    N°
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Motif
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Date
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Auteur
                  </th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody>
                {ordos.map((o) => (
                  <tr key={o.id} className="border-b border-[#f1f5f9]">
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {o.code}
                    </td>
                    <td className={tdCls}>{o.motif || "—"}</td>
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {formatDateFr(o.date_exclusion)}
                    </td>
                    <td className={tdCls} style={{ color: "#475569" }}>
                      {o.auteur || "—"}
                    </td>
                    <td className={tdCls}>
                      {estChef ? (
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[#1e6650]"
                          onClick={() => {
                            setMotifRetrait("");
                            setARetirer(o);
                          }}
                        >
                          Retirer
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardShell>
      ) : tab === "mdr" ? (
        <CardShell title="Modes de règlement exclus" sub={`${mdr.length} lignes`}>
          {mdr.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#64748b]">
              Aucun MDR exclu.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={thCls} style={{ textAlign: "left" }}>
                    MDR
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Libellé
                  </th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody>
                {mdr.map((m) => (
                  <tr key={m.id} className="border-b border-[#f1f5f9]">
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {m.code}
                    </td>
                    <td className={tdCls}>{m.libelle || "—"}</td>
                    <td className={tdCls}>
                      {estChef ? (
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[#1e6650]"
                          onClick={() => {
                            setMotifRetrait("");
                            setARetirer(m);
                          }}
                        >
                          Retirer
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardShell>
      ) : (
        <CardShell
          title="Natures exclues"
          sub="Lecture seule · RAP avant BOP"
        >
          {natures.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#64748b]">
              Aucune nature exclue.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Nature (libellé)
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Portée
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Motif
                  </th>
                </tr>
              </thead>
              <tbody>
                {natures.map((n) => (
                  <tr key={n.id} className="border-b border-[#f1f5f9]">
                    <td className={tdCls}>{n.code}</td>
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {n.portee || "—"}
                    </td>
                    <td className={tdCls}>{n.motif || n.libelle || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardShell>
      )}

      <Dialog
        open={dialogAjout}
        onOpenChange={(open) => {
          if (!open && !enCours) setDialogAjout(false);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              {tab === "ord" ? "Ajouter une ordonnance" : "Ajouter un MDR"}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              {tab === "ord"
                ? "N° d’ordonnance hors RAP (colonne ORDOS)."
                : "Mode de règlement exclu du calcul RAP."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3.5 px-6 py-[18px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[#334155]">
                {tab === "ord" ? "N° ordonnance" : "MDR"}
              </label>
              <input
                value={codeAjout}
                onChange={(e) => setCodeAjout(e.target.value)}
                className={champCls}
                style={{ fontFamily: MONO }}
                placeholder={tab === "ord" ? "ex. 2024-…" : "ex. 710"}
              />
            </div>
            {tab === "mdr" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-[#334155]">
                  Libellé
                </label>
                <input
                  value={libelleAjout}
                  onChange={(e) => setLibelleAjout(e.target.value)}
                  className={champCls}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[#334155]">
                Motif
              </label>
              <input
                value={motifAjout}
                onChange={(e) => setMotifAjout(e.target.value)}
                className={champCls}
                placeholder="Optionnel"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              disabled={enCours}
              onClick={() => setDialogAjout(false)}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a]"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => void confirmerAjout()}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold text-white disabled:opacity-50",
              )}
              style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
            >
              {enCours ? <Loader2 size={14} className="animate-spin" /> : null}
              Ajouter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={aRetirer !== null}
        onOpenChange={(open) => {
          if (!open && !enCours) {
            setARetirer(null);
            setMotifRetrait("");
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retirer {aRetirer?.type === "MDR" ? "le MDR" : "l’ordonnance"}{" "}
              {aRetirer?.code} ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-[#475569]">
              Un motif de retrait est obligatoire pour l’audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <input
              value={motifRetrait}
              onChange={(e) => setMotifRetrait(e.target.value)}
              placeholder="Motif du retrait"
              className={champCls}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enCours}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={enCours}
              onClick={(e) => {
                e.preventDefault();
                void confirmerRetrait();
              }}
            >
              {enCours ? "Retrait…" : "Retirer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
