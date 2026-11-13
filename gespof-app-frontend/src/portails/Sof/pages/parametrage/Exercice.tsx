import { useEffect, useState, type ReactNode } from "react";
import { Check, Loader2, Lock, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  cloturerExercice,
  enregistrerExercice,
  obtenirExerciceCourant,
  ouvrirNouvelExercice,
} from "@/portails/Sof/api/referentiel";
import type {
  ExerciceSof,
  LoiEnVigueur,
} from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";
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

const SOF = { c: "#2a7f62" };
const DANGER = { bg: "#dc2626", bd: "#b91c1c" };
const OUVRIR = { bg: "#fff", fg: "#1e6650", bd: "#2a7f62" };

/** Partie entière seulement (évite que « .00 » ou « ,00 » grossisse le montant). */
function formaterBalanceSaisie(valeur: string): string {
  const entier = valeur.split(/[.,]/)[0] ?? "";
  const digits = entier.replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function balanceChiffres(affichee: string): string {
  return (affichee.split(/[.,]/)[0] ?? "").replace(/[^\d]/g, "");
}

function balanceVersApi(affichee: string): string {
  return balanceChiffres(affichee) || "0";
}

function balanceRenseignee(affichee: string): boolean {
  return balanceChiffres(affichee) !== "";
}

type VarianteBouton = "primary" | "danger" | "ouvrir" | "neutral";

function BoutonAction({
  label,
  icon: Icon,
  onClick,
  variante = "neutral",
  disabled,
  title,
}: {
  label: string;
  icon: typeof Check;
  onClick: () => void;
  variante?: VarianteBouton;
  disabled?: boolean;
  title?: string;
}) {
  const styles: Record<VarianteBouton, { background: string; color: string; borderColor: string }> = {
    primary: { background: SOF.c, color: "#fff", borderColor: SOF.c },
    danger: { background: DANGER.bg, color: "#fff", borderColor: DANGER.bd },
    ouvrir: { background: OUVRIR.bg, color: OUVRIR.fg, borderColor: OUVRIR.bd },
    neutral: { background: "#fff", color: "#0f172a", borderColor: "#cbd5e1" },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-semibold transition-[filter,opacity]",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:brightness-95",
      )}
      style={styles[variante]}
    >
      <Icon size={16} strokeWidth={2.2} />
      {label}
    </button>
  );
}

export default function ExercicePage() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [exercice, setExercice] = useState<ExerciceSof | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [balanceTouchee, setBalanceTouchee] = useState(false);
  const [dialogCloture, setDialogCloture] = useState(false);
  const [dialogOuverture, setDialogOuverture] = useState(false);

  const [balance, setBalance] = useState("");
  const [loi, setLoi] = useState<LoiEnVigueur>("LFI");
  const [prefixe, setPrefixe] = useState("");
  const [delai, setDelai] = useState("90");

  const lectureSeule = !estChef || !exercice?.ouvert;
  const balanceValide = balanceRenseignee(balance);
  const balanceErreur = !lectureSeule && balanceTouchee && !balanceValide;
  const anneeSuivante = (exercice?.annee ?? new Date().getFullYear()) + 1;

  function appliquerExercice(e: ExerciceSof) {
    setExercice(e);
    setBalance(formaterBalanceSaisie(e.balance_initiale));
    setLoi(e.loi_en_vigueur ?? "LFI");
    setPrefixe(String(e.prefixe_ad ?? e.annee % 100).replace(/\D/g, "").slice(-2));
    setDelai(String(e.delai_arriere_jours));
    setBalanceTouchee(false);
  }

  useEffect(() => {
    obtenirExerciceCourant()
      .then(({ exercice: e }) => {
        if (e) appliquerExercice(e);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Impossible de charger l'exercice."),
      )
      .finally(() => setChargement(false));
  }, []);

  async function onEnregistrer() {
    if (!exercice || lectureSeule) return;
    setBalanceTouchee(true);
    if (!balanceValide) {
      toast.error("La balance initiale est obligatoire.");
      return;
    }
    setEnregistrement(true);
    try {
      const { exercice: maj } = await enregistrerExercice(exercice.annee, {
        balance_initiale: balanceVersApi(balance),
        loi_en_vigueur: loi,
        prefixe_ad: Number(prefixe.replace(/\D/g, "").slice(-2) || exercice.annee % 100),
        delai_arriere_jours: Number(delai) || 0,
      });
      appliquerExercice(maj);
      toast.success("Paramètres enregistrés.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function confirmerOuverture() {
    if (!estChef || !exercice) return;
    setActionEnCours(true);
    try {
      const { exercice: nouveau } = await ouvrirNouvelExercice(exercice.annee);
      appliquerExercice(nouveau);
      setDialogOuverture(false);
      toast.success(`Exercice ${nouveau.annee} ouvert.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ouverture impossible.");
    } finally {
      setActionEnCours(false);
    }
  }

  async function confirmerCloture() {
    if (!estChef || !exercice?.ouvert) return;
    setActionEnCours(true);
    try {
      const { exercice: maj } = await cloturerExercice(exercice.annee);
      appliquerExercice(maj);
      setDialogCloture(false);
      toast.success(`Exercice ${maj.annee} clôturé.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clôture impossible.");
    } finally {
      setActionEnCours(false);
    }
  }

  const optionsLoi: LoiEnVigueur[] = ["LFI", "LFR"];

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        eyebrow="Configuration · Paramétrage de l'exercice"
        title="Exercice"
        description="Paramètres de l'exercice, réservés au Chef SOF."
        actions={
          estChef && exercice ? (
            <>
              {exercice.ouvert ? (
                <BoutonAction
                  label="Clôturer l'exercice"
                  icon={Lock}
                  onClick={() => setDialogCloture(true)}
                  variante="danger"
                  title={`Clôturer l'exercice ${exercice.annee}`}
                />
              ) : (
                <BoutonAction
                  label="Ouvrir un nouvel exercice"
                  icon={Plus}
                  onClick={() => setDialogOuverture(true)}
                  variante="ouvrir"
                  title={`Ouvrir l'exercice ${anneeSuivante}`}
                />
              )}
              <BoutonAction
                label={enregistrement ? "Enregistrement…" : "Enregistrer"}
                icon={Check}
                onClick={onEnregistrer}
                variante="primary"
                disabled={lectureSeule || enregistrement || !balanceValide}
                title={
                  !balanceValide
                    ? "Renseignez la balance initiale"
                    : "Enregistrer les paramètres"
                }
              />
            </>
          ) : undefined
        }
      />

      {chargement ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white py-16 text-[13px] text-[#64748b]">
          <Loader2 size={16} className="animate-spin" />
          Chargement de l'exercice…
        </div>
      ) : !exercice ? (
        <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-white px-6 py-12 text-center text-[13.5px] text-[#64748b]">
          Aucun exercice. Chargez le référentiel (`sof:referentiel:charger`) ou ouvrez
          une année.
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-[#0f172a]">
                Exercice {exercice.annee}
              </span>
              <span className="text-[12.5px] text-[#64748b]">
                {exercice.statut_libelle}
                {exercice.loi_en_vigueur_libelle
                  ? ` · ${exercice.loi_en_vigueur_libelle}`
                  : ""}
              </span>
            </div>
          </div>

          <div
            className="grid gap-x-4 gap-y-3.5 p-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
            }}
          >
            <Champ label="Année">
              <span className="flex min-h-[38px] items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-sm tabular-nums text-[#0f172a]">
                {exercice.annee}
              </span>
            </Champ>

            <Champ
              label="Balance initiale (FCFA)"
              obligatoire
              erreur={balanceErreur ? "Ce champ est obligatoire." : undefined}
              aide={'En FCFA. Le classeur RD Synthèse l\'intitule à tort « en millions ».'}
            >
              <input
                value={balance}
                onChange={(e) => {
                  setBalanceTouchee(true);
                  setBalance(formaterBalanceSaisie(e.target.value));
                }}
                onBlur={() => setBalanceTouchee(true)}
                disabled={lectureSeule}
                required
                aria-required
                aria-invalid={balanceErreur || undefined}
                inputMode="numeric"
                className={cn(
                  "h-[38px] w-full rounded-md border bg-white px-2.5 text-right text-sm tabular-nums outline-none disabled:bg-[#f8fafc] disabled:text-[#64748b]",
                  balanceErreur
                    ? "border-[#f87171] focus:border-[#dc2626]"
                    : "border-[#cbd5e1]",
                )}
              />
            </Champ>

            <Champ label="Loi en vigueur">
              <select
                value={loi}
                onChange={(e) => setLoi(e.target.value as LoiEnVigueur)}
                disabled={lectureSeule}
                className="h-[38px] w-full rounded-md border border-[#cbd5e1] bg-white px-2 text-sm text-[#0f172a] outline-none disabled:bg-[#f8fafc]"
              >
                {optionsLoi.map((o) => (
                  <option key={o} value={o}>
                    {o} {exercice.annee}
                  </option>
                ))}
              </select>
            </Champ>

            <Champ
              label="Préfixe des n° d'AD"
              aide="2 premiers chiffres du n° d'AD (C_REF1)."
            >
              <input
                value={prefixe}
                onChange={(e) =>
                  setPrefixe(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                disabled={lectureSeule}
                maxLength={2}
                inputMode="numeric"
                placeholder={String((exercice.annee ?? 2026) % 100).padStart(2, "0")}
                className="h-[38px] w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 font-mono text-sm outline-none disabled:bg-[#f8fafc]"
                style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
              />
            </Champ>

            <Champ
              label="Délai avant arriéré (jours)"
              aide="Règle reprise du code PROCÉDURES SOF, absente des manuels."
            >
              <input
                value={delai}
                onChange={(e) => setDelai(e.target.value.replace(/[^\d]/g, ""))}
                disabled={lectureSeule}
                inputMode="numeric"
                className="h-[38px] w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 text-right text-sm tabular-nums outline-none disabled:bg-[#f8fafc]"
              />
            </Champ>

            <Champ label="Statut">
              <span className="flex min-h-[38px] items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-sm text-[#0f172a]">
                {exercice.statut_libelle}
              </span>
            </Champ>

            <Champ
              label="Date de situation"
              aide="Portée par la période en cours (lecture seule)."
            >
              <span className="flex min-h-[38px] items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 font-mono text-sm text-[#0f172a]">
                {exercice.date_situation
                  ? (() => {
                      const [y, m, d] = exercice.date_situation.split("-");
                      return y && m && d ? `${d}/${m}/${y}` : exercice.date_situation;
                    })()
                  : "—"}
              </span>
            </Champ>

            <Champ label="Dernier mois validé">
              <span className="flex min-h-[38px] items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-sm text-[#0f172a]">
                {exercice.dernier_mois_valide?.libelle ?? "Aucun"}
                <Link
                  to="/sof"
                  className="text-[12.5px] font-semibold text-[#1e6650] underline-offset-2 hover:underline"
                >
                  Cycle mensuel › Période en cours
                </Link>
              </span>
            </Champ>
          </div>

          <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-4 py-2.5 text-[12.5px] text-[#64748b]">
            Balance affichée :{" "}
            <span className="font-mono text-[#334155]">
              {balanceValide
                ? `${formatMontant(balanceVersApi(balance) + ".00")} FCFA`
                : "—"}
            </span>
            <span className="ml-2 rounded bg-slate-200/80 px-1.5 py-0.5 text-[11px] text-slate-700">
              calcul cible : Fiche de dépôts
            </span>
          </div>
        </section>
      )}

      <AlertDialog open={dialogCloture} onOpenChange={setDialogCloture}>
        <AlertDialogContent className="sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer l'exercice {exercice?.annee} ?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-[#475569]">
              La clôture rend l'exercice en lecture seule. Vous pourrez ensuite ouvrir
              l'exercice {anneeSuivante}. Cette action est réservée au Chef SOF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionEnCours}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={actionEnCours}
              onClick={(e) => {
                e.preventDefault();
                void confirmerCloture();
              }}
            >
              {actionEnCours ? "Clôture…" : "Confirmer la clôture"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogOuverture} onOpenChange={setDialogOuverture}>
        <AlertDialogContent className="sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Ouvrir l'exercice {anneeSuivante} ?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-[#475569]">
              Un nouvel exercice {anneeSuivante} sera créé à partir des paramètres de{" "}
              {exercice?.annee}. Les référentiels de l'année précédente pourront être
              repris ultérieurement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionEnCours}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionEnCours}
              onClick={(e) => {
                e.preventDefault();
                void confirmerOuverture();
              }}
            >
              {actionEnCours ? "Ouverture…" : "Confirmer l'ouverture"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Champ({
  label,
  children,
  obligatoire,
  erreur,
  aide,
}: {
  label: string;
  children: ReactNode;
  obligatoire?: boolean;
  erreur?: string;
  aide?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-[#334155]">
        {label}
        {obligatoire ? (
          <span className="ml-0.5 text-[#dc2626]" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {children}
      {aide ? (
        <span className="text-[11.5px] leading-snug text-[#64748b]">{aide}</span>
      ) : null}
      {erreur ? (
        <span className="text-[12px] font-medium text-[#dc2626]">{erreur}</span>
      ) : null}
    </label>
  );
}
