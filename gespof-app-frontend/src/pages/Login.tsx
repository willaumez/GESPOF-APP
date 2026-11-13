import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Shield,
  User,
  ChevronRight,
  AlertCircle,
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
}

const COMPTE_ADMIN: CompteTest = {
  matricule: "999070G",
  email: "999070G@gespof.local",
  role: "ADMINISTRATEUR",
  motDePasse: "admin123",
  libelle: "Administrateur",
};

const COMPTES_SP: CompteTest[] = [
  {
    matricule: "999071",
    email: "999071@gespof.local",
    role: "AGENT_SP",
    motDePasse: "admin123",
    libelle: "Agent SP",
  },
  {
    matricule: "999071B",
    email: "999071B@gespof.local",
    role: "CHEF_SP",
    motDePasse: "admin123",
    libelle: "Chef SP",
  },
];

const COMPTES_SR: CompteTest[] = [
  {
    matricule: "999070",
    email: "999070@gespof.local",
    role: "AGENT_SR",
    motDePasse: "admin123",
    libelle: "Agent SR",
  },
  {
    matricule: "999070B",
    email: "999070B@gespof.local",
    role: "CHEF_SR",
    motDePasse: "admin123",
    libelle: "Chef SR",
  },
];

const COMPTES_SOF: CompteTest[] = [
  {
    matricule: "999072",
    email: "999072@gespof.local",
    role: "AGENT_SOF",
    motDePasse: "admin123",
    libelle: "Agent SOF",
  },
  {
    matricule: "999072B",
    email: "999072B@gespof.local",
    role: "CHEF_SOF",
    motDePasse: "admin123",
    libelle: "Chef SOF",
  },
];

function IconUser() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
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
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [groupeOuvert, setGroupeOuvert] = useState<GroupeComptes>(null);

  const { activerSession, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const animerEntree = useAuthEntranceAnimee();

  useEffect(() => {
    if (!authLoading && isAuthenticated)
      navigate("/portail", { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const executerConnexion = async (identifiant: string, motDePasse: string) => {
    if (!identifiant.trim()) {
      setLoginErr("Renseignez votre matricule ou votre adresse e-mail.");
      return;
    }
    setSubmitting(true);
    setLoginErr("");
    try {
      const { token } = await serviceAuthentification.connexion({
        email: identifiant,
        password: motDePasse,
      });
      const payload = decoderPayloadJwt(token);
      if (payload.requires_password_change) {
        setTempToken(token);
        setEtape("definir-mot-de-passe");
      } else {
        await activerSession(token, identifiant, remember);
        toast.success("Connexion réussie. Bienvenue !");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Identifiants incorrects.";
      setLoginErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const connecterCompteTest = (compte: CompteTest) => {
    setEmail(compte.matricule);
    setPassword(compte.motDePasse);
    setLoginErr("");
    setGroupeOuvert(null);
    void executerConnexion(compte.matricule, compte.motDePasse);
  };

  const handleConnexion = async (e: FormEvent) => {
    e.preventDefault();
    await executerConnexion(email, password);
  };

  const handleDefinirMotDePasse = async (e: FormEvent) => {
    e.preventDefault();
    if (!tempToken) {
      toast.error(
        "Connectez-vous d’abord avec votre mot de passe provisoire pour activer le compte.",
      );
      setEtape("connexion");
      return;
    }
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
        tempToken,
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

  const fermerDialogComptes = () => setGroupeOuvert(null);

  const hasMaj = /[A-Z]/.test(newPassword);
  const hasChiffre = /\d/.test(newPassword);
  const hasLongueur = newPassword.length >= 8;

  return (
    <AuthCard>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          alignItems: "center",
          gap: "32px 0",
          minHeight: 440,
        }}
      >
        <AuthBrandPanel />

        <div
          key={etape}
          className="am-form-col [animation:stepIn_.45s_cubic-bezier(.16,1,.3,1)_both]"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {etape === "connexion" ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 6,
                    marginBottom: 18,
                  }}
                >
                  <span
                    style={{
                      width: 64,
                      height: 3,
                      borderRadius: 2,
                      background: "#2a7f62",
                    }}
                  />
                  <span
                    style={{
                      width: 64,
                      height: 3,
                      borderRadius: 2,
                      background: "#c9960a",
                    }}
                  />
                  <span
                    style={{
                      width: 64,
                      height: 3,
                      borderRadius: 2,
                      background: "#1e4d8c",
                    }}
                  />
                </div>

                <h2 className="am-title-form">Connexion</h2>
                <p className="am-subtitle-form">
                  Renseignez vos identifiants professionnels pour continuer.
                </p>

                <form
                  onSubmit={(e) => {
                    void handleConnexion(e);
                  }}
                  noValidate
                  autoComplete="off"
                >
                  <label htmlFor="email" className="am-label">
                    Matricule ou adresse e-mail
                  </label>
                  <div
                    className={`am-field${loginErr ? " is-error" : ""}`}
                  >
                    <IconUser />
                    <input
                      id="email"
                      name="gespof-identifiant"
                      type="text"
                      inputMode="email"
                      placeholder="Matricule ou e-mail"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setLoginErr("");
                      }}
                      required
                      autoComplete="username"
                      className="am-input"
                    />
                  </div>
                  {loginErr ? (
                    <div className="am-err">
                      <AlertCircle size={14} strokeWidth={1.8} />
                      {loginErr}
                    </div>
                  ) : null}

                  <label
                    htmlFor="password"
                    className="am-label am-label-spaced"
                  >
                    Mot de passe
                  </label>
                  <div className="am-field am-field-pw">
                    <IconLock />
                    <input
                      id="password"
                      name="gespof-secret"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="am-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                      className="am-eye"
                    >
                      {showPassword ? (
                        <EyeOff size={17} strokeWidth={1.7} />
                      ) : (
                        <Eye size={17} strokeWidth={1.7} />
                      )}
                    </button>
                  </div>

                  <div className="am-row-meta">
                    <button
                      type="button"
                      onClick={() => setRemember((v) => !v)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        color: "#64748b",
                        cursor: "pointer",
                        userSelect: "none",
                        border: 0,
                        background: "transparent",
                        padding: 0,
                        font: "inherit",
                      }}
                    >
                      <span
                        style={{
                          width: 17,
                          height: 17,
                          borderRadius: 4,
                          border: remember ? "0" : "1.5px solid #e2e8f0",
                          background: remember ? "#1e4d8c" : "#fff",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {remember ? (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M2 6.5l3 3 5-5"
                              stroke="#fff"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                      Se souvenir de moi
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/mot-de-passe-oublie")}
                      className="am-link"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>

                  <BoutonSoumission loading={submitting} label="Se connecter" />

                  <div className="am-first">
                    Première connexion ?{" "}
                    <button
                      type="button"
                      onClick={() => setEtape("definir-mot-de-passe")}
                      className="am-link"
                    >
                      Activez votre compte
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "#e8eff9",
                      color: "#1e4d8c",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Shield size={24} strokeWidth={1.7} />
                  </span>
                </div>
                <h2
                  className="am-title-form"
                  style={{ fontSize: 21 }}
                >
                  Activez votre compte
                </h2>
                <p
                  className="am-subtitle-form"
                  style={{ fontSize: 13.5, lineHeight: 1.65, marginBottom: 24 }}
                >
                  Première connexion : définissez votre mot de passe personnel
                  pour accéder à GESPOF.
                </p>

                <form
                  onSubmit={(e) => {
                    void handleDefinirMotDePasse(e);
                  }}
                  noValidate
                >
                  <label htmlFor="newPassword" className="am-label">
                    Nouveau mot de passe
                  </label>
                  <div className="am-field">
                    <IconLock />
                    <input
                      id="newPassword"
                      type="password"
                      placeholder="Minimum 8 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="am-input"
                    />
                  </div>

                  <label
                    htmlFor="confirmPassword"
                    className="am-label"
                    style={{ marginTop: 16 }}
                  >
                    Confirmer le mot de passe
                  </label>
                  <div className="am-field">
                    <IconLock />
                    <input
                      id="confirmPassword"
                      type="password"
                      placeholder="Répétez le mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="am-input"
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px 16px",
                      margin: "14px 0 22px",
                      fontSize: 12.5,
                      color: "#64748b",
                    }}
                  >
                    {(
                      [
                        ["8 caractères minimum", hasLongueur],
                        ["Une majuscule", hasMaj],
                        ["Un chiffre", hasChiffre],
                      ] as const
                    ).map(([lib, ok]) => (
                      <span
                        key={lib}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: ok ? "#2a7f62" : "#cbd5e1",
                          }}
                        />
                        {lib}
                      </span>
                    ))}
                  </div>

                  <BoutonSoumission
                    loading={submitting}
                    label="Activer mon compte"
                    loadingLabel="Activation…"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setEtape("connexion");
                      if (!tempToken) setTempToken(null);
                    }}
                    style={{
                      marginTop: 16,
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      fontSize: 13,
                      color: "#64748b",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    ← Retour à la connexion
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {AFFICHER_COMPTES_TEST && etape === "connexion" && (
        <div
          className={`am-tests ${animerEntree ? "[animation:fadeUp_.5s_ease_.36s_both]" : ""}`}
        >
          <div className="am-tests-label">COMPTES DE TEST</div>
          <div className="am-tests-row">
            <button
              type="button"
              onClick={() => connecterCompteTest(COMPTE_ADMIN)}
              className="am-test-admin"
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: "#eef2ff",
                  color: "#1e4d8c",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <User size={14} strokeWidth={1.8} />
              </span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span className="am-test-admin-title">Administrateur</span>
                <span className="am-test-admin-mat">999070G</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGroupeOuvert("sof")}
              className="am-test-chip sof"
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#2a7f62",
                }}
              />
              Comptes SOF
              <span style={{ color: "#94a3b8", display: "flex" }}>
                <ChevronRight size={14} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGroupeOuvert("sp")}
              className="am-test-chip sp"
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#c9960a",
                }}
              />
              Comptes SP
              <span style={{ color: "#94a3b8", display: "flex" }}>
                <ChevronRight size={14} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGroupeOuvert("sr")}
              className="am-test-chip sr"
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#064A85",
                }}
              />
              Comptes SR
              <span style={{ color: "#94a3b8", display: "flex" }}>
                <ChevronRight size={14} />
              </span>
            </button>
          </div>
        </div>
      )}

      {AFFICHER_COMPTES_TEST && (
        <Dialog
          open={groupeOuvert !== null}
          onOpenChange={(ouvert) => {
            if (!ouvert) fermerDialogComptes();
          }}
        >
          <DialogContent className="gap-0 overflow-hidden rounded-xl bg-white p-0 shadow-[0_24px_48px_-12px_rgba(15,23,42,.35)] ring-0 sm:max-w-[520px]">
            <DialogHeader className="gap-1.5 px-6 pt-[22px] text-left">
              <DialogTitle
                className="text-[20px] font-semibold leading-[1.25] text-[#0f172a]"
                style={{ fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif' }}
              >
                {titreDialog}
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-[1.6] text-[#475569]">
                {descDialog}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-[18px]">
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                <div
                  className="grid gap-3 border-b border-[#e2e8f0] bg-[#f8fafc] px-[18px] py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
                  style={{
                    gridTemplateColumns: "minmax(140px,1fr) 120px 120px",
                  }}
                >
                  <span>Compte</span>
                  <span>Matricule</span>
                  <span>Rôle</span>
                </div>
                {comptesDialog.map((compte) => (
                  <button
                    key={compte.matricule}
                    type="button"
                    onClick={() => connecterCompteTest(compte)}
                    className="grid w-full min-h-[46px] items-center gap-3 border-b border-[#f1f5f9] bg-white px-[18px] py-2 text-left text-[13.5px] last:border-b-0 hover:bg-[#f8fafc]"
                    style={{
                      gridTemplateColumns: "minmax(140px,1fr) 120px 120px",
                    }}
                  >
                    <span className="font-semibold text-[#0f172a]">
                      {compte.libelle}
                    </span>
                    <span
                      className="text-[#0f172a]"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {compte.matricule}
                    </span>
                    <span
                      className="text-[#64748b]"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {compte.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AuthCard>
  );
}
