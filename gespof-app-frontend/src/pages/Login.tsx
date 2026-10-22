import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  KeyRound,
  UserCog,
  Users,
  ClipboardCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { serviceAuthentification } from "@/shared/lib/auth.service";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";
import { AuthCard } from "@/shared/components/auth/AuthCard";
import { AuthBrandPanel } from "@/shared/components/auth/AuthBrandPanel";
import { BoutonSoumission } from "@/shared/components/auth/SubmitButton";
import { useAuthEntranceAnimee } from "@/shared/components/auth/AuthEntranceContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";

type Etape = "connexion" | "definir-mot-de-passe";
type GroupeComptes = "sp" | "sr" | "sof" | null;

/** Passer à `true` pour réafficher les boutons de comptes de test sous le formulaire. */
const AFFICHER_COMPTES_TEST = true;

function decoderPayloadJwt(jeton: string): Record<string, unknown> {
  const [, charge] = jeton.split(".");
  return JSON.parse(
    atob(charge.replace(/-/g, "+").replace(/_/g, "/")),
  ) as Record<string, unknown>;
}

interface CompteTest {
  matricule: string;
  email: string;
  role: RoleUtilisateur;
  motDePasse: string;
  libelle: string;
  icone: typeof UserCog;
}

const COMPTE_ADMIN: CompteTest = {
  matricule: "999070G",
  email: "999070G@gespof.local",
  role: "ADMINISTRATEUR",
  motDePasse: "admin123",
  libelle: "Administrateur",
  icone: UserCog,
};

const COMPTES_SP: CompteTest[] = [
  {
    matricule: "999071",
    email: "999071@gespof.local",
    role: "AGENT_SP",
    motDePasse: "admin123",
    libelle: "Agent SP",
    icone: Users,
  },
  {
    matricule: "999071B",
    email: "999071B@gespof.local",
    role: "CHEF_SP",
    motDePasse: "admin123",
    libelle: "Chef SP",
    icone: TrendingUp,
  },
];

const COMPTES_SR: CompteTest[] = [
  {
    matricule: "999070",
    email: "999070@gespof.local",
    role: "AGENT_SR",
    motDePasse: "admin123",
    libelle: "Agent SR",
    icone: Users,
  },
  {
    matricule: "999070B",
    email: "999070B@gespof.local",
    role: "CHEF_SR",
    motDePasse: "admin123",
    libelle: "Chef SR",
    icone: ClipboardCheck,
  },
];

const COMPTES_SOF: CompteTest[] = [
  {
    matricule: "999072",
    email: "999072@gespof.local",
    role: "AGENT_SOF",
    motDePasse: "admin123",
    libelle: "Agent SOF",
    icone: Users,
  },
  {
    matricule: "999072B",
    email: "999072B@gespof.local",
    role: "CHEF_SOF",
    motDePasse: "admin123",
    libelle: "Chef SOF",
    icone: TrendingUp,
  },
];

/** Carte cliquable d'un compte de test : remplit le formulaire de connexion. */
function BoutonCompteTest({
  compte,
  onClick,
  className = "",
}: {
  compte: CompteTest;
  onClick: () => void;
  className?: string;
}) {
  const Icone = compte.icone;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/50 ${className}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600 transition-colors duration-150 group-hover:bg-blue-100">
        <Icone size={12} strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[0.6875rem] font-semibold text-slate-700">
          {compte.libelle}
        </span>
        <span className="truncate text-[0.625rem] text-slate-400">
          {compte.matricule}
        </span>
      </span>
    </button>
  );
}

export default function Login() {
  const [etape, setEtape] = useState<Etape>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [groupeOuvert, setGroupeOuvert] = useState<GroupeComptes>(null);

  const { activerSession, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const animerEntree = useAuthEntranceAnimee();

  const remplirCompteTest = (compte: CompteTest) => {
    setEmail(compte.matricule);
    setPassword(compte.motDePasse);
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated)
      navigate("/portail", { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const handleConnexion = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { token } = await serviceAuthentification.connexion({
        email,
        password,
      });
      const payload = decoderPayloadJwt(token);
      if (payload.requires_password_change) {
        setTempToken(token);
        setEtape("definir-mot-de-passe");
      } else {
        await activerSession(token, email, remember);
        toast.success("Connexion réussie. Bienvenue !");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Identifiants incorrects.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDefinirMotDePasse = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      const { token } = await serviceAuthentification.definirMotDePasse(
        { newPassword },
        tempToken!,
      );
      toast.success("Mot de passe défini avec succès. Connexion en cours…");
      await activerSession(token, email, remember);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erreur lors de la définition du mot de passe.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const comptesDialog =
    groupeOuvert === "sp"
      ? COMPTES_SP
      : groupeOuvert === "sr"
        ? COMPTES_SR
        : COMPTES_SOF;

  const titreDialog =
    groupeOuvert === "sp"
      ? "Comptes SP"
      : groupeOuvert === "sr"
        ? "Comptes SR"
        : "Comptes SOF";

  const descDialog =
    groupeOuvert === "sp"
      ? "Comptes de test du Service de Prévision."
      : groupeOuvert === "sr"
        ? "Comptes de test du Service Règlement."
        : "Comptes de test du Service des Opérations Financières.";

  const champCls =
    "h-12 w-full rounded-[0.625rem] border-[1.5px] border-[#e2e8f0] bg-white pl-11 pr-3.5 text-base text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#94a3b8] focus:border-[#1e4d8c] focus:shadow-[0_0_0_3px_rgba(30,77,140,.12)] sm:h-[3.125rem] sm:text-sm";

  return (
    <AuthCard>
      <div className="grid w-full grid-cols-1 items-center gap-5 sm:gap-7 lg:min-h-[28rem] lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#e2e8f0]">
        <AuthBrandPanel />

        <div
          key={etape}
          className="mx-auto flex w-full max-w-md flex-col justify-center [animation:stepIn_.45s_cubic-bezier(.16,1,.3,1)_both] lg:mx-0 lg:max-w-none lg:pl-10"
        >
          {etape === "connexion" ? (
            <>
              <div className="mb-5 text-center sm:mb-[1.625rem]">
                <div className="mb-3 hidden items-center justify-center gap-1.5 sm:flex">
                  <div className="h-[0.1875rem] w-12 rounded-full bg-[#2a7f62] sm:w-16" />
                  <div className="h-[0.1875rem] w-12 rounded-full bg-[#c9960a] sm:w-16" />
                  <div className="h-[0.1875rem] w-12 rounded-full bg-[#1e4d8c] sm:w-16" />
                </div>
                <h2 className="mb-1.5 text-[1.25rem] font-bold text-[#0f172a] sm:mb-2 sm:text-[1.4375rem]">
                  Connexion
                </h2>
                <p className="text-[0.8125rem] leading-relaxed text-[#64748b] sm:text-[0.84375rem]">
                  Renseignez vos identifiants professionnels pour continuer.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  void handleConnexion(e);
                }}
                noValidate
                autoComplete="off"
                className="w-full"
              >
                <div className="mb-4 sm:mb-5">
                  <label
                    htmlFor="email"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Matricule ou adresse e-mail
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="email"
                      name="gespof-identifiant"
                      type="text"
                      inputMode="email"
                      placeholder="Matricule ou e-mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) =>
                        e.currentTarget.removeAttribute("readonly")
                      }
                      className={champCls}
                    />
                  </div>
                </div>

                <div className="mb-3.5 sm:mb-4">
                  <label
                    htmlFor="password"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Mot de passe
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      id="password"
                      name="gespof-secret"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) =>
                        e.currentTarget.removeAttribute("readonly")
                      }
                      className={`${champCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Masquer" : "Afficher"}
                      className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#64748b] hover:text-[#334155] sm:right-2 sm:size-[2.125rem]"
                    >
                      {showPassword ? (
                        <EyeOff size={18} strokeWidth={1.7} />
                      ) : (
                        <Eye size={18} strokeWidth={1.7} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mb-5 flex flex-col gap-2.5 sm:mb-7 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
                  <label className="flex cursor-pointer select-none items-center gap-[0.5625rem] text-[0.8125rem] text-[#64748b]">
                    <span
                      onClick={() => setRemember((v) => !v)}
                      className={`flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] transition-[background,border] duration-200 ${
                        remember
                          ? "bg-[#1e4d8c]"
                          : "border-[1.5px] border-[#e2e8f0] bg-white"
                      }`}
                    >
                      {remember && (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6.5l3 3 5-5"
                            stroke="#fff"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    Se souvenir de moi
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/mot-de-passe-oublie")}
                    className="cursor-pointer self-start border-none bg-transparent p-0 text-[0.8125rem] font-semibold text-[#1e4d8c] hover:underline sm:self-auto"
                  >
                    Mot de passe oublié&nbsp;?
                  </button>
                </div>

                <BoutonSoumission loading={submitting} label="Se connecter" />
              </form>
            </>
          ) : (
            <>
              <div className="mb-5 text-center sm:mb-[1.625rem]">
                <div className="mb-3 flex justify-center sm:mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8eff9] sm:h-14 sm:w-14">
                    <KeyRound size={22} strokeWidth={1.7} color="#1e4d8c" />
                  </div>
                </div>
                <h2 className="mb-1.5 text-[1.1875rem] font-bold text-[#0f172a] sm:mb-2 sm:text-[1.3125rem]">
                  Première connexion
                </h2>
                <p className="text-[0.8125rem] leading-[1.6] text-[#64748b]">
                  Définissez votre nouveau mot de passe pour activer votre
                  compte.
                </p>
                <p className="mt-2 break-all text-xs font-medium text-[#1e4d8c]">
                  {email}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  void handleDefinirMotDePasse(e);
                }}
                noValidate
                className="w-full"
              >
                <div className="mb-4 sm:mb-5">
                  <label
                    htmlFor="newPassword"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimum 8 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={`${champCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? "Masquer" : "Afficher"}
                      className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#64748b] hover:text-[#334155] sm:right-2 sm:size-[2.125rem]"
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} strokeWidth={1.7} />
                      ) : (
                        <Eye size={18} strokeWidth={1.7} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mb-5 sm:mb-7">
                  <label
                    htmlFor="confirmPassword"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      id="confirmPassword"
                      type="password"
                      placeholder="Répétez le mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={champCls}
                    />
                  </div>
                </div>

                <BoutonSoumission
                  loading={submitting}
                  label="Activer mon compte"
                />

                <button
                  type="button"
                  onClick={() => {
                    setEtape("connexion");
                    setTempToken(null);
                  }}
                  className="mt-4 w-full cursor-pointer border-none bg-transparent p-0 text-center text-[0.8125rem] text-[#64748b] hover:text-[#1e4d8c] hover:underline"
                >
                  ← Retour à la connexion
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {AFFICHER_COMPTES_TEST && etape === "connexion" && (
        <div
          className={`mt-8 ${animerEntree ? "[animation:fadeUp_.5s_ease_.36s_both]" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <span className="whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Comptes de test
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <BoutonCompteTest
              compte={COMPTE_ADMIN}
              onClick={() => remplirCompteTest(COMPTE_ADMIN)}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => setGroupeOuvert("sof")}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-[0.5625rem] text-[0.6875rem] font-semibold text-slate-600 transition-colors duration-150 hover:border-green-300 hover:bg-green-50/50 hover:text-green-800"
            >
              Comptes SOF
              <ChevronRight size={12} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setGroupeOuvert("sp")}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-[0.5625rem] text-[0.6875rem] font-semibold text-slate-600 transition-colors duration-150 hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-800"
            >
              Comptes SP
              <ChevronRight size={12} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setGroupeOuvert("sr")}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-[0.5625rem] text-[0.6875rem] font-semibold text-slate-600 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
            >
              Comptes SR
              <ChevronRight size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {AFFICHER_COMPTES_TEST && (
        <Dialog
          open={groupeOuvert !== null}
          onOpenChange={(ouvert) => {
            if (!ouvert) setGroupeOuvert(null);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">{titreDialog}</DialogTitle>
              <DialogDescription>
                {descDialog} Sélectionnez un compte : ses identifiants
                remplissent le formulaire.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {comptesDialog.map((compte) => (
                <BoutonCompteTest
                  key={compte.matricule}
                  compte={compte}
                  onClick={() => {
                    remplirCompteTest(compte);
                    setGroupeOuvert(null);
                  }}
                  className="w-full"
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AuthCard>
  );
}
