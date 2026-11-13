import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  enregistrerQualification,
  listerQualifications,
  type LigneQualification,
  type QualificationPage,
} from "@/portails/Sof/api/recettes-petrolieres-pages";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import {
  formaterSelonUnite,
  libelleUniteCourt,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { useAuth } from "@/shared/hooks/use-auth";

/** Colonnes maquette pet-transferts. */
const GRILLE =
  "100px 130px 100px minmax(180px, 1.5fr) 150px 90px 190px 60px 110px";

const SOF_VERT = "#2a7f62";
const CELL = { padding: "6px 10px" } as const;

type Brouillon = {
  type_recette?: string;
  verifie_bgfi?: boolean;
};

function dateFr(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function KpiCard({
  label,
  valeur,
  sous,
  accent = SOF_VERT,
  fg = "#0f172a",
}: {
  label: string;
  valeur: string;
  sous: string;
  accent?: string;
  fg?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-[#e2e8f0] bg-white"
      style={{ padding: "14px 16px", borderTop: `3px solid ${accent}` }}
    >
      <span className="text-[11.5px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
        {label}
      </span>
      <span
        className="text-[21px] font-semibold"
        style={{ fontVariantNumeric: "tabular-nums", color: fg }}
      >
        {valeur}
      </span>
      <span className="text-[12.5px] text-[#64748b]">{sous}</span>
    </div>
  );
}

function CaseBgfi({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="grid size-[18px] flex-none place-items-center rounded disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        border: `1.5px solid ${on ? SOF_VERT : "#94a3b8"}`,
        background: on ? SOF_VERT : "#fff",
        color: "#fff",
      }}
      title="Vérifié sur relevé BGFI"
      aria-pressed={on}
    >
      {on ? <Check size={12} strokeWidth={3} /> : null}
    </button>
  );
}

function ModalDetailBeac({
  ligne,
  unite,
  onClose,
}: {
  ligne: LigneQualification;
  unite: UniteMontant;
  onClose: () => void;
}) {
  const titre = `Transfert ${ligne.n_regl ?? ligne.ig_operation_id}`;
  const montantAff = formaterSelonUnite(ligne.montant, unite);
  const uL = libelleUniteCourt(unite);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: "rgba(15,23,42,.45)" }}
      role="dialog"
      aria-modal
      aria-labelledby="detail-beac-titre"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-40px)] w-full max-w-[720px] flex-col overflow-auto bg-white"
        style={{
          borderRadius: 10,
          boxShadow: "0 24px 48px -12px rgba(15,23,42,.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start gap-3 border-b border-[#e2e8f0]"
          style={{ padding: "20px 24px" }}
        >
          <span
            className="grid size-[38px] flex-none place-items-center rounded-lg"
            style={{ background: "#e3f1ea", color: "#1e6650" }}
          >
            <Search size={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <h2
              id="detail-beac-titre"
              className="m-0 text-[19px] font-semibold leading-[1.3] text-[#0f172a]"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              {titre}
            </h2>
            <p className="m-0 text-[13.5px] leading-[1.5] text-[#64748b]">
              Opérations sources du montant agrégé ({uL}).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 flex-none place-items-center rounded-md text-[#64748b] hover:bg-[#f1f5f9]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="flex flex-1 flex-col gap-3.5"
          style={{ padding: "18px 24px" }}
        >
          <div className="overflow-hidden rounded-md border border-[#e2e8f0] text-[13px]">
            <div
              className="grid gap-2.5 bg-[#f8fafc] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
              style={{
                gridTemplateColumns: "110px 96px minmax(0,1fr) 90px 130px",
                padding: "8px 12px",
              }}
            >
              <span>N° règlement</span>
              <span>Date</span>
              <span>Bénéficiaire</span>
              <span>Compte</span>
              <span className="text-right">Montant</span>
            </div>
            <div
              className="grid gap-2.5 border-t border-[#f1f5f9]"
              style={{
                gridTemplateColumns: "110px 96px minmax(0,1fr) 90px 130px",
                padding: "8px 12px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                }}
              >
                {ligne.n_regl ?? "—"}
              </span>
              <span>{dateFr(ligne.d_cpta)}</span>
              <span className="min-w-0 truncate">
                {ligne.societe_nom ?? "—"}
              </span>
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                }}
              >
                {ligne.c_nop ?? "1812-201"}
              </span>
              <span className="text-right font-medium">{montantAff}</span>
            </div>
            <div
              className="grid gap-2.5 font-bold"
              style={{
                gridTemplateColumns: "minmax(0,1fr) 130px",
                padding: "8px 12px",
                background: "#e3f1ea",
                color: "#14533f",
              }}
            >
              <span>Total</span>
              <span className="text-right">{montantAff}</span>
            </div>
          </div>
        </div>

        <div
          className="flex justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc]"
          style={{ padding: "14px 24px" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-[38px] rounded-md border border-[#cbd5e1] bg-white px-4 text-[13.5px] font-semibold text-[#334155] hover:brightness-95"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QualificationTransferts() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [afficherNa, setAfficherNa] = useState(false);
  const [data, setData] = useState<QualificationPage | null>(null);
  const [chargement, setChargement] = useState(true);
  const [brouillons, setBrouillons] = useState<Record<number, Brouillon>>({});
  const [enCours, setEnCours] = useState(false);
  const [detail, setDetail] = useState<LigneQualification | null>(null);

  useEffect(() => {
    listerPeriodes()
      .then((res) => {
        const liste = [...(res.periodes ?? [])].sort(
          (a, b) => b.exercice_annee - a.exercice_annee || b.mois - a.mois,
        );
        if (liste[0]) setPeriodeId(liste[0].id);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Périodes indisponibles."),
      );
  }, []);

  async function recharger(pid: number, na = afficherNa) {
    setChargement(true);
    try {
      setData(await listerQualifications(pid, na));
      setBrouillons({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void recharger(periodeId, afficherNa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeId, afficherNa]);

  const lignes = data?.lignes ?? [];
  const types = data?.types ?? [];

  function typeDe(l: LigneQualification): string {
    return brouillons[l.ig_operation_id]?.type_recette ?? l.type_recette;
  }

  function bgfiDe(l: LigneQualification): boolean {
    return brouillons[l.ig_operation_id]?.verifie_bgfi ?? l.verifie_bgfi;
  }

  function patcher(id: number, patch: Brouillon) {
    if (!estChef) return;
    setBrouillons((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  const nq = useMemo(
    () => lignes.filter((l) => typeDe(l) === "NON_QUALIFIE").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lignes, brouillons],
  );

  const nBgfi = useMemo(
    () => lignes.filter((l) => bgfiDe(l)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lignes, brouillons],
  );

  const aDesModifs = Object.keys(brouillons).length > 0;

  async function qualifier() {
    if (!estChef || periodeId === "") return;
    const dirty = Object.entries(brouillons);
    if (dirty.length === 0) {
      toast.success("Qualification enregistrée.");
      return;
    }
    setEnCours(true);
    try {
      for (const [id, patch] of dirty) {
        await enregistrerQualification(Number(id), patch);
      }
      await recharger(periodeId);
      toast.success("Qualification enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Qualification des transferts (1812-201)"
        description="Opérations du compte 1812-201 à affecter à un type de recette pétrolière avant consolidation."
        actions={
          estChef ? (
            <button
              type="button"
              onClick={() => void qualifier()}
              disabled={enCours}
              className="inline-flex h-[38px] items-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
              style={{
                background: SOF_VERT,
                border: `1px solid ${SOF_VERT}`,
              }}
              title={
                aDesModifs
                  ? "Enregistrer les qualifications"
                  : undefined
              }
            >
              {enCours ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} strokeWidth={2.4} />
              )}
              Qualifier
            </button>
          ) : null
        }
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
        <SofSeg
          label="Lignes N/A"
          options={[
            { cle: "Masquées", libelle: "Masquées" },
            { cle: "Affichées", libelle: "Affichées" },
          ]}
          value={afficherNa ? "Affichées" : "Masquées"}
          onChange={(v) => setAfficherNa(v === "Affichées")}
        />
      </div>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
        }}
      >
        <KpiCard
          label="Opérations"
          valeur={String(lignes.length)}
          sous="Compte 1812-201"
        />
        <KpiCard
          label="Non qualifiées"
          valeur={String(nq)}
          sous={nq ? "À traiter avant consolidation" : "Toutes qualifiées"}
          accent="#b45309"
          fg={nq ? "#b91c1c" : "#0f172a"}
        />
        <KpiCard
          label="Vérifiées sur relevé BGFI"
          valeur={`${nBgfi} / ${lignes.length}`}
          sous="Contrôle manuel"
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#0f172a]">
              Opérations du compte 1812-201
            </span>
            <span className="text-[12.5px] text-[#64748b]">
              Type proposé automatiquement, modifiable
            </span>
          </span>
        </div>

        {chargement ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : lignes.length === 0 ? (
          <div
            className="text-center text-[13.5px] text-[#64748b]"
            style={{ padding: "24px 16px" }}
          >
            {data?.message ?? "Aucune opération."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1040 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                {(
                  [
                    ["Date", "flex-start"],
                    ["N° règlement", "flex-start"],
                    ["Matricule", "flex-start"],
                    ["Société", "flex-start"],
                    ["Montant", "flex-end"],
                    ["Mode", "flex-start"],
                    ["Type", "flex-start"],
                    ["BGFI", "center"],
                    ["", "flex-end"],
                  ] as const
                ).map(([l, jc], i) => (
                  <div
                    key={l || `col-${i}`}
                    className="text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
                    style={{
                      ...CELL,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: jc,
                      paddingTop: 9,
                      paddingBottom: 9,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              {lignes.map((l) => {
                const type = typeDe(l);
                const nonQual = type === "NON_QUALIFIE";
                const bgfi = bgfiDe(l);
                return (
                  <div
                    key={l.ig_operation_id}
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
                      {dateFr(l.d_cpta)}
                    </div>
                    <div
                      className="flex items-center"
                      style={{
                        ...CELL,
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {l.n_regl ?? "—"}
                    </div>
                    <div
                      className="flex items-center text-[#475569]"
                      style={{
                        ...CELL,
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {l.n_mattir ?? "—"}
                    </div>
                    <div
                      className="flex min-w-0 items-center font-medium"
                      style={CELL}
                    >
                      <span className="truncate">{l.societe_nom ?? "—"}</span>
                    </div>
                    <div
                      className="flex cursor-pointer items-center justify-end hover:underline"
                      style={{
                        ...CELL,
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        fontVariantNumeric: "tabular-nums",
                        textUnderlineOffset: 3,
                      }}
                      title="Voir les opérations sources"
                      onClick={() => setDetail(l)}
                    >
                      {formaterSelonUnite(l.montant, unite)}
                    </div>
                    <div
                      className="flex items-center text-[#475569]"
                      style={CELL}
                    >
                      {l.mode}
                    </div>
                    <div className="flex items-center" style={CELL}>
                      <select
                        value={type}
                        disabled={!estChef || enCours}
                        onChange={(e) =>
                          patcher(l.ig_operation_id, {
                            type_recette: e.target.value,
                          })
                        }
                        className="h-[30px] w-full rounded border bg-white px-1.5 text-[12.5px] text-[#0f172a] outline-none disabled:opacity-60"
                        style={{
                          borderColor: nonQual ? "#b45309" : "#cbd5e1",
                          borderRadius: 4,
                        }}
                      >
                        {types.map((t) => (
                          <option key={t.valeur} value={t.valeur}>
                            {t.libelle}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      className="flex items-center justify-center"
                      style={CELL}
                    >
                      <CaseBgfi
                        on={bgfi}
                        disabled={!estChef || enCours}
                        onToggle={() =>
                          patcher(l.ig_operation_id, {
                            verifie_bgfi: !bgfi,
                          })
                        }
                      />
                    </div>
                    <div
                      className="flex items-center justify-end"
                      style={CELL}
                    >
                      <button
                        type="button"
                        onClick={() => setDetail(l)}
                        className="h-7 whitespace-nowrap rounded-[5px] border border-[#bfdccf] bg-[#f0f7f4] px-2.5 text-[12px] font-semibold text-[#1e6650] hover:brightness-95"
                      >
                        Détail BEAC
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {detail ? (
        <ModalDetailBeac
          ligne={detail}
          unite={unite}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
