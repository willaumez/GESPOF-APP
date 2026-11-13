import { useEffect, useState } from "react";
import { Check, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  enregistrerLigneRapprochement,
  obtenirRapprochementDrphp,
  validerRapprochementDrphp,
  type LigneRapprochement,
  type RapprochementPage,
} from "@/portails/Sof/api/recettes-petrolieres-pages";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";

const SOF_VERT = "#2a7f62";
const GRILLE = "100px minmax(220px, 2fr) 160px 160px 150px";
const CELL = { padding: "6px 10px" } as const;

const champCls =
  "h-[34px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] text-[#0f172a] outline-none";

function parseMontant(v: string): number {
  const n = Number(
    String(v)
      .replace(/[\s\u00A0\u202F']/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

/** Convertit une saisie affichée (selon unité) vers FCFA stockés. */
function versFcfa(affiche: string, unite: UniteMontant): string {
  const n = parseMontant(affiche);
  if (unite === "M") return (n * 1e6).toFixed(2);
  if (unite === "Md") return (n * 1e9).toFixed(2);
  return n.toFixed(2);
}

export default function RapprochementDrphp() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [data, setData] = useState<RapprochementPage | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [brouillonsExt, setBrouillonsExt] = useState<Record<string, string>>(
    {},
  );
  const [commentaireCle, setCommentaireCle] = useState<string | null>(null);
  const [commentaireTexte, setCommentaireTexte] = useState("");

  useEffect(() => {
    listerPeriodes()
      .then((res) => {
        const liste = [...(res.periodes ?? [])].sort(
          (a, b) => b.exercice_annee - a.exercice_annee || b.mois - a.mois,
        );
        setPeriodes(liste);
        if (liste[0]) setPeriodeId(liste[0].id);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Périodes indisponibles."),
      );
  }, []);

  async function recharger(pid: number) {
    setChargement(true);
    try {
      const res = await obtenirRapprochementDrphp(pid);
      setData(res);
      setBrouillonsExt({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void recharger(periodeId);
  }, [periodeId]);

  const lignes = data?.lignes ?? [];
  const ecartsCommentes = data?.ecarts_commentes ?? false;

  function externeFcfa(l: LigneRapprochement): string {
    if (brouillonsExt[l.cle] !== undefined) {
      return versFcfa(brouillonsExt[l.cle], unite);
    }
    return l.montant_externe;
  }

  function ecartAffiche(l: LigneRapprochement): number {
    return parseMontant(l.montant_domf) - parseMontant(externeFcfa(l));
  }

  async function sauverExterne(l: LigneRapprochement) {
    if (!estChef || periodeId === "") return;
    const brut = brouillonsExt[l.cle];
    if (brut === undefined) return;
    try {
      await enregistrerLigneRapprochement({
        periode_id: periodeId,
        cle: l.cle,
        montant_externe: versFcfa(brut, unite),
      });
      setBrouillonsExt((b) => {
        const n = { ...b };
        delete n[l.cle];
        return n;
      });
      await recharger(periodeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }

  function ouvrirCommentaire(l: LigneRapprochement) {
    setCommentaireCle(l.cle);
    setCommentaireTexte(l.commentaire ?? "");
  }

  async function enregistrerCommentaire() {
    if (!estChef || periodeId === "" || !commentaireCle) return;
    setEnCours(true);
    try {
      await enregistrerLigneRapprochement({
        periode_id: periodeId,
        cle: commentaireCle,
        commentaire: commentaireTexte,
      });
      setCommentaireCle(null);
      toast.success("Commentaire enregistré.");
      await recharger(periodeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function valider() {
    if (!estChef || periodeId === "") return;
    if (!ecartsCommentes) {
      toast.error("Commentez d'abord les écarts.");
      return;
    }
    setEnCours(true);
    try {
      const res = await validerRapprochementDrphp(periodeId);
      setData(res);
      toast.success("Rapprochement validé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const ecartTotal = lignes.reduce((s, l) => s + ecartAffiche(l), 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Rapprochement DRPHP"
        description="Montants DOMF et DRPHP par type. Tout écart non nul doit être commenté avant validation."
        actions={
          estChef ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const avecEcart = lignes.find(
                    (l) => Math.abs(ecartAffiche(l)) > 0.005 && !l.commentaire,
                  );
                  if (avecEcart) ouvrirCommentaire(avecEcart);
                  else if (lignes[0]) ouvrirCommentaire(lignes[0]);
                }}
                className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95"
              >
                <MessageSquare size={16} />
                {ecartsCommentes ? "Écart commenté" : "Commenter un écart"}
              </button>
              <button
                type="button"
                onClick={() => void valider()}
                disabled={enCours || !ecartsCommentes}
                title={
                  ecartsCommentes
                    ? undefined
                    : "Commentez d'abord les écarts"
                }
                className="inline-flex h-[38px] items-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: SOF_VERT,
                  border: `1px solid ${SOF_VERT}`,
                }}
              >
                {enCours ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={2.4} />
                )}
                Valider
              </button>
            </div>
          ) : null
        }
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Période
          <select
            value={periodeId === "" ? "" : String(periodeId)}
            onChange={(e) =>
              setPeriodeId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={cn(champCls, "min-w-[200px]")}
          >
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.mois_libelle
                  ? p.mois_libelle.charAt(0).toUpperCase() +
                    p.mois_libelle.slice(1)
                  : p.mois) +
                  " " +
                  p.exercice_annee}
              </option>
            ))}
          </select>
        </label>
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Rapprochement par type
          </span>
          <p className="text-[12.5px] text-[#64748b]">
            {ecartsCommentes
              ? "Écarts commentés"
              : "Écart non nul surligné · DRPHP saisissable"}
            {data?.valide ? " · Validé" : ""}
          </p>
        </div>

        {chargement ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
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
                    ["Compte", "flex-start"],
                    ["Type", "flex-start"],
                    ["DOMF", "flex-end"],
                    ["DRPHP", "flex-end"],
                    ["Écart", "flex-end"],
                  ] as const
                ).map(([l, jc]) => (
                  <div
                    key={l}
                    className="text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
                    style={{
                      ...CELL,
                      paddingTop: 9,
                      paddingBottom: 9,
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
                <div
                  className="text-center text-[13.5px] text-[#64748b]"
                  style={{ padding: "24px 16px" }}
                >
                  {data?.message ?? "Aucune ligne."}
                </div>
              ) : (
                lignes.map((l) => {
                  const ecart = ecartAffiche(l);
                  const ecH = Math.abs(ecart) > 0.005;
                  return (
                    <div
                      key={l.cle}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{ gridTemplateColumns: GRILLE }}
                    >
                      <div
                        className="flex items-center"
                        style={{
                          ...CELL,
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {/* Colonne Compte vide côté pétrole (maquette) */}
                      </div>
                      <div
                        className="flex min-w-0 items-center font-medium"
                        style={CELL}
                      >
                        <button
                          type="button"
                          className="truncate text-left hover:underline"
                          style={{ textUnderlineOffset: 3 }}
                          onClick={() => estChef && ouvrirCommentaire(l)}
                          title={
                            l.commentaire
                              ? l.commentaire
                              : "Commenter l'écart"
                          }
                        >
                          {l.libelle}
                        </button>
                      </div>
                      <div
                        className="flex items-center justify-end"
                        style={{
                          ...CELL,
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formaterSelonUnite(l.montant_domf, unite)}
                      </div>
                      <div className="flex items-center" style={CELL}>
                        {estChef ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={enCours}
                            value={
                              brouillonsExt[l.cle] !== undefined
                                ? brouillonsExt[l.cle]
                                : formaterSelonUnite(
                                    l.montant_externe,
                                    unite,
                                  )
                            }
                            onChange={(e) =>
                              setBrouillonsExt((b) => ({
                                ...b,
                                [l.cle]: e.target.value,
                              }))
                            }
                            onBlur={() => void sauverExterne(l)}
                            className="h-[30px] w-full rounded border border-[#cbd5e1] bg-white px-1.5 text-right text-[12.5px] outline-none"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                              fontVariantNumeric: "tabular-nums",
                            }}
                          />
                        ) : (
                          <span
                            className="w-full text-right"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                            }}
                          >
                            {formaterSelonUnite(l.montant_externe, unite)}
                          </span>
                        )}
                      </div>
                      <div
                        className="flex items-center justify-end"
                        style={{
                          ...CELL,
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: ecH ? 600 : 400,
                          color: ecH ? "#92400e" : "#0f172a",
                          background: ecH ? "#fef3c7" : undefined,
                        }}
                      >
                        {formaterSelonUnite(ecart.toFixed(2), unite)}
                      </div>
                    </div>
                  );
                })
              )}

              {lignes.length > 0 ? (
                <div
                  className="grid min-h-[42px] text-[13px] font-semibold"
                  style={{
                    gridTemplateColumns: GRILLE,
                    background: "#e3f1ea",
                    borderTop: "1px solid #bfdccf",
                  }}
                >
                  <div />
                  <div className="flex items-center" style={CELL}>
                    Total
                  </div>
                  <div />
                  <div />
                  <div
                    className="flex items-center justify-end"
                    style={{
                      ...CELL,
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: Math.abs(ecartTotal) > 0.005 ? "#92400e" : "#14533f",
                      background:
                        Math.abs(ecartTotal) > 0.005 ? "#fef3c7" : undefined,
                    }}
                  >
                    {formaterSelonUnite(ecartTotal.toFixed(2), unite)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {commentaireCle ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-5"
          style={{ background: "rgba(15,23,42,.45)" }}
          role="dialog"
          aria-modal
          onClick={() => setCommentaireCle(null)}
        >
          <div
            className="flex w-full max-w-[520px] flex-col bg-white"
            style={{
              borderRadius: 10,
              boxShadow: "0 24px 48px -12px rgba(15,23,42,.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="border-b border-[#e2e8f0]"
              style={{ padding: "20px 24px" }}
            >
              <h2
                className="m-0 text-[19px] font-semibold"
                style={{ fontFamily: '"IBM Plex Serif", serif' }}
              >
                Commenter l&apos;écart DOMF / DRPHP
              </h2>
              <p className="mt-1 text-[13.5px] text-[#64748b]">
                {lignes.find((x) => x.cle === commentaireCle)?.libelle}
              </p>
            </div>
            <div style={{ padding: "18px 24px" }}>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-[#334155]">
                  Commentaire
                </span>
                <textarea
                  value={commentaireTexte}
                  onChange={(e) => setCommentaireTexte(e.target.value)}
                  rows={3}
                  className="rounded-md border border-[#cbd5e1] px-2.5 py-2 text-[13.5px] leading-normal outline-none"
                />
              </label>
            </div>
            <div
              className="flex justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc]"
              style={{ padding: "14px 24px" }}
            >
              <button
                type="button"
                onClick={() => setCommentaireCle(null)}
                className="h-[38px] rounded-md border border-[#cbd5e1] bg-white px-4 text-[13.5px] font-semibold text-[#334155]"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={() => void enregistrerCommentaire()}
                className="h-[38px] rounded-md px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
                style={{ background: SOF_VERT }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
