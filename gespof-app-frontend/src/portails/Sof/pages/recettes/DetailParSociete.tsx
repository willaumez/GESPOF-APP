import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  obtenirDetailParSociete,
  type DetailParSocietePage,
  type DetailSocieteGroupe,
} from "@/portails/Sof/api/recettes-petrolieres-pages";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import {
  formaterSelonUnite,
  libelleUniteCourt,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { cn } from "@/shared/lib/utils";

const champCls =
  "h-[34px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] text-[#0f172a] outline-none";

/** Libellé | NIF/champ | Code | 12 mois | Total */
function grille(moisCount: number): string {
  return `250px 110px 70px ${Array.from({ length: moisCount }, () => "112px").join(" ")} 136px`;
}

function sommeSerie(vals: string[]): string {
  return vals.reduce((s, x) => {
    const n = Number(String(x).replace(/[\s\u00A0\u202F']/g, "").replace(",", "."));
    return (Number.isFinite(n) ? s + n : s).toString();
  }, "0");
}

function cumulSerie(vals: string[]): string[] {
  let s = 0;
  return vals.map((x) => {
    const n = Number(String(x).replace(/[\s\u00A0\u202F']/g, "").replace(",", "."));
    if (!Number.isFinite(n)) return "0.00";
    s += n;
    return s.toFixed(2);
  });
}

function totalSelonMode(vals: string[], cumul: boolean): string {
  if (!cumul) return sommeSerie(vals);
  for (let i = vals.length - 1; i >= 0; i--) {
    const n = Number(String(vals[i]).replace(/[\s\u00A0\u202F']/g, "").replace(",", "."));
    if (Number.isFinite(n) && n !== 0) return vals[i];
  }
  return vals[vals.length - 1] ?? "0";
}

export default function DetailParSociete() {
  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [affichage, setAffichage] = useState<"mois" | "cumul">("mois");
  const [societe, setSociete] = useState("Toutes");
  const [data, setData] = useState<DetailParSocietePage | null>(null);
  const [chargement, setChargement] = useState(true);
  const [replie, setReplie] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (periodeId === "") return;
    setChargement(true);
    obtenirDetailParSociete({
      periodeId,
      societe: societe === "Toutes" ? undefined : societe,
    })
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeId, societe]);

  const moisLib = data?.mois_libelles ?? [
    "Janv.",
    "Févr.",
    "Mars",
    "Avr.",
    "Mai",
    "Juin",
    "Juil.",
    "Août",
    "Sept.",
    "Oct.",
    "Nov.",
    "Déc.",
  ];
  const moisCourant = data?.mois_courant ?? 12;
  const cumul = affichage === "cumul";
  const uL = libelleUniteCourt(unite);
  const gtc = grille(12);

  const societesOpts = useMemo(() => {
    const liste = data?.societes ?? [];
    return ["Toutes", ...liste.map((s) => s.matricule)];
  }, [data]);

  const libelleSociete = (mat: string) => {
    if (mat === "Toutes") return "Toutes";
    return data?.societes.find((s) => s.matricule === mat)?.nom ?? mat;
  };

  function montantsAffiches(m: string[]): string[] {
    if (!cumul) return m;
    return cumulSerie(m);
  }

  function CellMontant({
    valeur,
    moisIndex,
    gras,
  }: {
    valeur: string | null;
    moisIndex: number;
    gras?: boolean;
  }) {
    const grey = moisIndex + 1 >= moisCourant;
    const vide = valeur == null || Number(valeur) === 0;
    return (
      <div
        className="flex items-center justify-end"
        style={{
          padding: "6px 10px",
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontVariantNumeric: "tabular-nums",
          fontWeight: gras ? 600 : 400,
          color: grey ? "#64748b" : vide ? "#94a3b8" : "#0f172a",
          background: grey ? "#f4f6f7" : undefined,
        }}
      >
        {valeur == null ? "—" : formaterSelonUnite(valeur, unite)}
      </div>
    );
  }

  function basculer(type: string) {
    setReplie((p) => ({ ...p, [type]: !p[type] }));
  }

  function LigneType({ g }: { g: DetailSocieteGroupe }) {
    const ferme = !!replie[g.type];
    const aEnfants = g.societes.length > 0;
    const vals = montantsAffiches(g.montants);
    const tot = totalSelonMode(
      g.montants.map((v, i) => (i + 1 > moisCourant ? "0" : v)),
      cumul,
    );

    return (
      <>
        <div
          className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
          style={{
            gridTemplateColumns: gtc,
            background: "#f8fafc",
            fontWeight: 600,
          }}
        >
          <div
            role={aEnfants ? "button" : undefined}
            tabIndex={aEnfants ? 0 : undefined}
            onClick={aEnfants ? () => basculer(g.type) : undefined}
            onKeyDown={
              aEnfants
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      basculer(g.type);
                    }
                  }
                : undefined
            }
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              aEnfants && "cursor-pointer select-none",
            )}
            style={{ padding: "6px 10px" }}
            aria-expanded={aEnfants ? !ferme : undefined}
          >
            {aEnfants ? (
              <span
                className="grid size-5 flex-none place-items-center text-[#64748b]"
                aria-hidden
              >
                {ferme ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </span>
            ) : (
              <span className="size-5 flex-none" />
            )}
            <span className="truncate font-medium">{g.type_libelle}</span>
          </div>
          <div style={{ padding: "6px 10px" }} />
          <div
            className="flex items-center"
            style={{
              padding: "6px 10px",
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            }}
          >
            {g.rubrique_code ?? ""}
          </div>
          {vals.map((v, i) => (
            <CellMontant
              key={i}
              valeur={i + 1 > moisCourant ? null : v}
              moisIndex={i}
              gras
            />
          ))}
          <CellMontant valeur={tot} moisIndex={moisCourant - 1} gras />
        </div>
        {!ferme
          ? g.societes.map((s) => {
              const sv = montantsAffiches(s.montants);
              const st = totalSelonMode(
                s.montants.map((v, i) => (i + 1 > moisCourant ? "0" : v)),
                cumul,
              );
              return (
                <div
                  key={`${g.type}-${s.matricule ?? s.nom}`}
                  className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                  style={{ gridTemplateColumns: gtc }}
                >
                  <div
                    className="flex min-w-0 items-center truncate"
                    style={{ padding: "6px 10px 6px 28px" }}
                  >
                    {s.nom}
                  </div>
                  <div
                    className="flex items-center text-[#475569]"
                    style={{
                      padding: "6px 10px",
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  >
                    {s.champ_nif ?? s.matricule ?? "—"}
                  </div>
                  <div
                    className="flex items-center"
                    style={{
                      padding: "6px 10px",
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  >
                    {g.rubrique_code ?? ""}
                  </div>
                  {sv.map((v, i) => (
                    <CellMontant
                      key={i}
                      valeur={i + 1 > moisCourant ? null : v}
                      moisIndex={i}
                    />
                  ))}
                  <CellMontant valeur={st} moisIndex={moisCourant - 1} gras />
                </div>
              );
            })
          : null}
      </>
    );
  }

  const totauxAff = data
    ? montantsAffiches(data.totaux)
    : Array.from({ length: 12 }, () => "0.00");
  const totalGeneral = data
    ? totalSelonMode(
        data.totaux.map((v, i) => (i + 1 > moisCourant ? "0" : v)),
        cumul,
      )
    : "0";

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Détail par société"
        description="Recettes pétrolières par société, groupées par type."
        remplace='Feuille « Pétrole »'
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Société
          <select
            value={societe}
            onChange={(e) => setSociete(e.target.value)}
            className={cn(champCls, "min-w-[180px]")}
          >
            {societesOpts.map((m) => (
              <option key={m} value={m}>
                {libelleSociete(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Période (exercice)
          <select
            value={periodeId === "" ? "" : String(periodeId)}
            onChange={(e) =>
              setPeriodeId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={cn(champCls, "min-w-[180px]")}
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
        <SofSeg
          label="Affichage"
          options={[
            { cle: "mois", libelle: "Mois" },
            { cle: "cumul", libelle: "Cumul" },
          ]}
          value={affichage}
          onChange={(v) => setAffichage(v as "mois" | "cumul")}
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Détail par société
          </span>
          <p className="text-[12.5px] text-[#64748b]">
            Montants en {uL} · mois non clos grisés
            {cumul ? " · cumul" : ""}
            {data?.exercice_annee ? ` · exercice ${data.exercice_annee}` : ""}
          </p>
        </div>

        {chargement ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1680 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: gtc }}
              >
                {(
                  [
                    ["Libellé", "flex-start", false],
                    ["NIF / champ", "flex-start", false],
                    ["Code", "flex-start", false],
                    ...moisLib.map((m, i) => [
                      m,
                      "flex-end",
                      i + 1 >= moisCourant,
                    ]),
                    [cumul ? "Cumul" : "Total", "flex-end", false],
                  ] as [string, string, boolean][]
                ).map(([l, jc, grey], i) => (
                  <div
                    key={`${l}-${i}`}
                    className="text-[11px] font-semibold tracking-[0.05em] uppercase"
                    style={{
                      padding: "9px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: jc,
                      color: grey ? "#94a3b8" : "#64748b",
                      background: grey ? "#eef1f2" : undefined,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>

              {(data?.groupes ?? []).length === 0 ? (
                <div
                  className="text-center text-[13.5px] text-[#64748b]"
                  style={{ padding: "24px 16px" }}
                >
                  {data?.message ?? "Aucune donnée."}
                </div>
              ) : (
                (data?.groupes ?? []).map((g) => (
                  <LigneType key={g.type} g={g} />
                ))
              )}

              {(data?.groupes ?? []).length > 0 ? (
                <div
                  className="grid min-h-[42px] text-[13px] font-bold"
                  style={{
                    gridTemplateColumns: gtc,
                    background: "#e3f1ea",
                    borderTop: "1px solid #bfdccf",
                    color: "#14533f",
                  }}
                >
                  <div
                    className="flex items-center"
                    style={{ padding: "6px 10px" }}
                  >
                    Total
                  </div>
                  <div />
                  <div />
                  {totauxAff.map((v, i) => (
                    <CellMontant
                      key={i}
                      valeur={i + 1 > moisCourant ? null : v}
                      moisIndex={i}
                      gras
                    />
                  ))}
                  <CellMontant
                    valeur={totalGeneral}
                    moisIndex={moisCourant - 1}
                    gras
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
