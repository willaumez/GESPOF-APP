import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, UserCog, Users, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { serviceAuthentification } from "@/shared/lib/auth.service";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";
import { AuthCard } from "@/shared/components/auth/AuthCard";
import { AuthBrandPanel } from "@/shared/components/auth/AuthBrandPanel";
import { BoutonSoumission } from "@/shared/components/auth/SubmitButton";
import { useAuthEntranceAnimee } from "@/shared/components/auth/AuthEntranceContext";

type Etape = "connexion" | "definir-mot-de-passe";

function decoderPayloadJwt(jeton: string): Record<string, unknown> {
  const [, charge] = jeton.split(".");
  return JSON.parse(atob(charge.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
}

interface CompteTest {
  matricule: string;
  email: string;
  role: RoleUtilisateur;
  motDePasse: string;
  libelle: string;
  icone: typeof UserCog;
}

const COMPTES_TEST: CompteTest[] = [
  {
    matricule: "999070G",
    email: "999070G@sigof.local",
    role: "ADMINISTRATEUR",
    motDePasse: "admin123",
    libelle: "Administrateur",
    icone: UserCog,
  },
  {
    matricule: "999070",
    email: "999070@sigof.local",
    role: "AGENT_SR",
    motDePasse: "admin123",
    libelle: "Agent SR",
    icone: Users,
  },
  {
    matricule: "999070B",
    email: "999070B@sigof.local",
    role: "CHEF_SR",
    motDePasse: "admin123",
    libelle: "Chef SR",
    icone: ClipboardCheck,
  },
];

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
      const { token } = await serviceAuthentification.connexion({ email, password });
      const payload = decoderPayloadJwt(token);
      if (payload.requires_password_change) {
        setTempToken(token);
        setEtape("definir-mot-de-passe");
      } else {
        await activerSession(token, email, remember);
        toast.success("Connexion réussie. Bienvenue !");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Identifiants incorrects.");
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
        err instanceof Error ? err.message : "Erreur lors de la définition du mot de passe.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:min-h-[28rem] lg:gap-0 lg:divide-x lg:divide-[#e2e8f0]">
        <AuthBrandPanel />

        {}
        <div
          key={etape}
          className="flex flex-col justify-center [animation:stepIn_.45s_cubic-bezier(.16,1,.3,1)_both] lg:pl-10"
        >
          {etape === "connexion" ? (
            <>
              {}
              <div className="mb-[1.625rem] text-center">
                <div className="mb-3.5 flex items-center justify-center gap-1.5">
                  <div className="h-[0.1875rem] w-16 rounded-full bg-[#2a7f62]" />
                  <div className="h-[0.1875rem] w-16 rounded-full bg-[#c9960a]" />
                  <div className="h-[0.1875rem] w-16 rounded-full bg-[#1e4d8c]" />
                </div>
                <h2
                  className="mb-2 text-[1.4375rem] font-bold text-[#0f172a]"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  Connexion
                </h2>
                <p className="text-[0.84375rem] text-[#64748b]">
                  Renseignez vos identifiants professionnels pour continuer.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  void handleConnexion(e);
                }}
                noValidate
                autoComplete="off"
              >
                {}
                <div className="mb-5">
                  <label
                    htmlFor="email"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Matricule ou adresse e-mail
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="email"
                      name="sigof-identifiant"
                      type="text"
                      placeholder="Matricule ou e-mail professionnel"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                      className="h-[3.125rem] w-full rounded-[0.625rem] border-[1.5px] border-[#e2e8f0] bg-white pl-11 pr-3.5 text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#1e4d8c] focus:shadow-[0_0_0_3px_rgba(30,77,140,.12)]"
                    />
                  </div>
                </div>

                {}
                <div className="mb-4">
                  <label
                    htmlFor="password"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Mot de passe
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      id="password"
                      name="sigof-secret"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                      className="h-[3.125rem] w-full rounded-[0.625rem] border-[1.5px] border-[#e2e8f0] bg-white pl-11 pr-11 text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#1e4d8c] focus:shadow-[0_0_0_3px_rgba(30,77,140,.12)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Masquer" : "Afficher"}
                      className="absolute right-2 top-1/2 flex size-[2.125rem] -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#64748b] hover:text-[#334155]"
                    >
                      {showPassword ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
                    </button>
                  </div>
                </div>

                {}
                <div className="mb-7 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <label className="flex cursor-pointer select-none items-center gap-[0.5625rem] text-[0.8125rem] text-[#64748b]">
                    <span
                      onClick={() => setRemember((v) => !v)}
                      className={`flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] transition-[background,border] duration-200 ${
                        remember ? "bg-[#1e4d8c]" : "border-[1.5px] border-[#e2e8f0] bg-white"
                      }`}
                    >
                      {remember && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6.5l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    Se souvenir de moi
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/mot-de-passe-oublie")}
                    className="cursor-pointer border-none bg-transparent p-0 text-[0.8125rem] font-semibold text-[#1e4d8c] hover:underline"
                  >
                    Mot de passe oublié&nbsp;?
                  </button>
                </div>

                {}
                <BoutonSoumission loading={submitting} label="Se connecter" />
              </form>
            </>
          ) : (
            <>
              {}
              <div className="mb-[1.625rem] text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8eff9]">
                    <KeyRound size={24} strokeWidth={1.7} color="#1e4d8c" />
                  </div>
                </div>
                <h2
                  className="mb-2 text-[1.3125rem] font-bold text-[#0f172a]"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  Première connexion
                </h2>
                <p className="text-[0.8125rem] leading-[1.7] text-[#64748b]">
                  Définissez votre nouveau mot de passe pour activer votre compte.
                </p>
                <p className="mt-2 text-xs font-medium text-[#1e4d8c]">{email}</p>
              </div>

              <form
                onSubmit={(e) => {
                  void handleDefinirMotDePasse(e);
                }}
                noValidate
              >
                {}
                <div className="mb-5">
                  <label
                    htmlFor="newPassword"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
                      className="h-[3.125rem] w-full rounded-[0.625rem] border-[1.5px] border-[#e2e8f0] bg-white pl-11 pr-11 text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#1e4d8c] focus:shadow-[0_0_0_3px_rgba(30,77,140,.12)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? "Masquer" : "Afficher"}
                      className="absolute right-2 top-1/2 flex size-[2.125rem] -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#64748b] hover:text-[#334155]"
                    >
                      {showNewPassword ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
                    </button>
                  </div>
                </div>

                {}
                <div className="mb-7">
                  <label
                    htmlFor="confirmPassword"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
                      className="h-[3.125rem] w-full rounded-[0.625rem] border-[1.5px] border-[#e2e8f0] bg-white pl-11 pr-3.5 text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#1e4d8c] focus:shadow-[0_0_0_3px_rgba(30,77,140,.12)]"
                    />
                  </div>
                </div>

                {}
                <BoutonSoumission loading={submitting} label="Activer mon compte" />

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

      {}
      {etape === "connexion" && (
        <div className={`mt-8 ${animerEntree ? "[animation:fadeUp_.5s_ease_.36s_both]" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <span className="whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Comptes de test
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {COMPTES_TEST.map((compte) => {
              const Icone = compte.icone;
              return (
                <button
                  key={compte.matricule}
                  type="button"
                  onClick={() => remplirCompteTest(compte)}
                  className="group flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600 transition-colors duration-150 group-hover:bg-blue-100">
                    <Icone size={12} strokeWidth={1.8} />
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[0.6875rem] font-semibold text-slate-700">
                      {compte.libelle}
                    </span>
                    <span className="truncate text-[0.625rem] text-slate-400">{compte.matricule}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </AuthCard>
  );
}
