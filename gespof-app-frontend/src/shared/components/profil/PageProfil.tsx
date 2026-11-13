import {
  useState,
  useEffect,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Activity,
  Lock,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { usePhotoProfil } from "@/shared/hooks/PhotoProfilContext";
import type { Portail } from "@/shared/hooks/auth-context";
import { envoyerFichier, requeteApi } from "@/shared/lib/api";
import { API_ENDPOINTS } from "@/shared/config/app";
import { getAccessiblePortails, getPortalMenu } from "@/shared/config/menu";
import type { UtilisateurProfil } from "@/shared/types/profil.interface";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { EnTeteProfil } from "@/shared/components/profil/EnTeteProfil";
import {
  RecadragePhoto,
  type RecadragesPhoto,
} from "@/shared/components/profil/RecadragePhoto";
import {
  MESSAGE_TAILLE_PHOTO,
  TAILLE_MAX_PHOTO,
} from "@/shared/components/profil/outilsRecadrage";

export type ConfigActiviteProfil = {
  kpiPrincipal: string;
  kpiPrincipalSous: string;
  kpiSecondaire: string;
  kpiSecondaireSous: string;
};

type Props = {
  portal: Portail;
  badgeService?: ReactNode;
  activite: ConfigActiviteProfil;
};

function libelleGenre(genre: UtilisateurProfil["genre"]): string {
  if (genre === "homme") return "Homme";
  if (genre === "femme") return "Femme";
  return "—";
}

/**
 * Page Profil partagée (SOF / SP / SR / Admin) : infos, genre, photo, MDP.
 */
export function PageProfil({ portal, badgeService, activite }: Props) {
  const { user, token, activerSession } = useAuth();
  const { photoUrl, bandeauUrl, aPhoto, rafraichirPhoto } = usePhotoProfil();
  const theme = getPortalMenu(portal).theme;
  const [profil, setProfil] = useState<UtilisateurProfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [ouvertDialogMdp, setOuvertDialogMdp] = useState(false);
  const [ouvertDialogInfos, setOuvertDialogInfos] = useState(false);
  const [saisiePrenom, setSaisiePrenom] = useState("");
  const [saisieNom, setSaisieNom] = useState("");
  const [saisieEmail, setSaisieEmail] = useState("");
  const [erreurInfos, setErreurInfos] = useState("");
  const [chargInfos, setChargInfos] = useState(false);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [fichierARecadrer, setFichierARecadrer] = useState<File | null>(null);
  const inputPhotoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let annule = false;
    requeteApi<UtilisateurProfil>(API_ENDPOINTS.AUTH.ME, { jeton: token })
      .then((data) => {
        if (!annule) {
          setProfil(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!annule) {
          toast.error(
            e instanceof Error ? e.message : "Erreur lors du chargement du profil.",
          );
          setLoading(false);
        }
      });
    return () => {
      annule = true;
    };
  }, [token]);

  const nom = profil?.nom ?? user?.nom ?? "—";
  const prenom = profil?.prenom ?? user?.prenom ?? "—";
  const nomAffichage = profil ? `${nom.toUpperCase()} ${prenom}` : "—";
  const initiales = profil
    ? `${nom[0] ?? ""}${prenom[0] ?? ""}`.toUpperCase()
    : user
      ? `${user.nom?.[0] ?? ""}${user.prenom?.[0] ?? ""}`.toUpperCase()
      : "??";

  const roleLibelle = profil?.roles?.map((r) => r.libelle).join(", ") || "—";
  const roleValeur = profil?.roles?.map((r) => r.valeur).join(", ") || "—";
  const portailLabel =
    getAccessiblePortails(user?.roles ?? []).map((p) => p.title).join(", ") ||
    "—";
  const estActif = profil?.actif ?? true;
  const matricule = profil?.matricule ?? "—";
  const dateCreation = profil?.date_creation ?? "—";
  const dernConn = profil?.derniere_connexion ?? "—";

  const [mdpActuel, setMdpActuel] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmerMdp, setConfirmerMdp] = useState("");
  const [mdpActuelValide, setMdpActuelValide] = useState(false);
  const [chargVerif, setChargVerif] = useState(false);
  const [chargSoumis, setChargSoumis] = useState(false);
  const [erreurActuel, setErreurActuel] = useState("");
  const [erreurNouveau, setErreurNouveau] = useState("");
  const [voirActuel, setVoirActuel] = useState(false);
  const [voirNouveau, setVoirNouveau] = useState(false);
  const [voirConfirmer, setVoirConfirmer] = useState(false);

  function ouvrirDialogMdp() {
    setMdpActuel("");
    setNouveauMdp("");
    setConfirmerMdp("");
    setMdpActuelValide(false);
    setChargVerif(false);
    setChargSoumis(false);
    setErreurActuel("");
    setErreurNouveau("");
    setVoirActuel(false);
    setVoirNouveau(false);
    setVoirConfirmer(false);
    setOuvertDialogMdp(true);
  }

  function ouvrirDialogInfos() {
    setSaisiePrenom(profil?.prenom ?? user?.prenom ?? "");
    setSaisieNom(profil?.nom ?? user?.nom ?? "");
    setSaisieEmail(profil?.email ?? user?.email ?? "");
    setErreurInfos("");
    setOuvertDialogInfos(true);
  }

  async function soumettreInfos() {
    if (!saisiePrenom.trim() || !saisieNom.trim() || !saisieEmail.trim()) {
      setErreurInfos("Le prénom, le nom et l'e-mail sont requis.");
      return;
    }
    setChargInfos(true);
    setErreurInfos("");
    try {
      const misAJour = await requeteApi<UtilisateurProfil>(API_ENDPOINTS.AUTH.ME, {
        jeton: token,
        method: "PUT",
        body: JSON.stringify({
          prenom: saisiePrenom.trim(),
          nom: saisieNom.trim(),
          email: saisieEmail.trim(),
        }),
      });
      setProfil(misAJour);
      if (misAJour.token) {
        await activerSession(misAJour.token, misAJour.email);
      }
      toast.success("Informations personnelles mises à jour.");
      setOuvertDialogInfos(false);
    } catch (e: unknown) {
      setErreurInfos(
        e instanceof Error
          ? e.message
          : "Impossible d'enregistrer les informations.",
      );
    } finally {
      setChargInfos(false);
    }
  }

  function changerMdpActuel(val: string) {
    setMdpActuel(val);
    setErreurActuel("");
    if (mdpActuelValide) {
      setMdpActuelValide(false);
      setNouveauMdp("");
      setConfirmerMdp("");
      setErreurNouveau("");
    }
  }

  async function verifierMdpActuel() {
    if (!mdpActuel.trim()) {
      setErreurActuel("Veuillez saisir votre mot de passe actuel.");
      return;
    }
    setChargVerif(true);
    setErreurActuel("");
    try {
      await requeteApi<{ valid: boolean }>(API_ENDPOINTS.AUTH.VERIFIER_MOT_DE_PASSE, {
        jeton: token,
        method: "POST",
        body: JSON.stringify({ currentPassword: mdpActuel }),
      });
      setMdpActuelValide(true);
    } catch (e: unknown) {
      setErreurActuel(e instanceof Error ? e.message : "Mot de passe incorrect.");
    } finally {
      setChargVerif(false);
    }
  }

  async function soumettreMdp() {
    if (!nouveauMdp.trim()) {
      setErreurNouveau("Veuillez saisir le nouveau mot de passe.");
      return;
    }
    if (nouveauMdp !== confirmerMdp) {
      setErreurNouveau("Les mots de passe ne correspondent pas.");
      return;
    }
    setChargSoumis(true);
    setErreurNouveau("");
    try {
      const res = await requeteApi<{ ok: boolean; token: string }>(
        API_ENDPOINTS.AUTH.CHANGER_MOT_DE_PASSE,
        {
          jeton: token,
          method: "POST",
          body: JSON.stringify({
            currentPassword: mdpActuel,
            newPassword: nouveauMdp,
          }),
        },
      );
      await activerSession(res.token);
      toast.success("Mot de passe modifié avec succès.");
      setOuvertDialogMdp(false);
    } catch (e: unknown) {
      setErreurNouveau(
        e instanceof Error
          ? e.message
          : "Erreur lors du changement de mot de passe.",
      );
    } finally {
      setChargSoumis(false);
    }
  }

  function onChoisirFichier(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    if (
      !["image/jpeg", "image/png"].includes(fichier.type) ||
      fichier.size > TAILLE_MAX_PHOTO
    ) {
      toast.error(MESSAGE_TAILLE_PHOTO);
      return;
    }
    setFichierARecadrer(fichier);
  }

  async function confirmerPhoto({ avatar, bandeau }: RecadragesPhoto) {
    setPhotoEnCours(true);
    try {
      const misAJour = await envoyerFichier<UtilisateurProfil>(
        API_ENDPOINTS.AUTH.ME_PHOTO,
        avatar,
        { jeton: token, annexes: { bandeau } },
      );
      setProfil(misAJour);
      rafraichirPhoto();
      setFichierARecadrer(null);
      toast.success("Avatar et bandeau enregistrés.");
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Impossible d'enregistrer la photo.",
      );
    } finally {
      setPhotoEnCours(false);
    }
  }

  async function retirerPhoto() {
    setPhotoEnCours(true);
    try {
      const misAJour = await requeteApi<UtilisateurProfil>(
        API_ENDPOINTS.AUTH.ME_PHOTO_RETRAIT,
        { jeton: token, method: "POST" },
      );
      setProfil(misAJour);
      rafraichirPhoto();
      toast.success("Photo de profil retirée.");
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de retirer la photo.",
      );
    } finally {
      setPhotoEnCours(false);
    }
  }

  const inputMdpCls = (disabled: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 pr-9 text-[13px] font-medium outline-none transition ${
      disabled
        ? "cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#e2e8f0]"
        : "border-[#e2e8f0] bg-white text-[#0f172a] focus:border-[#2a7f62] focus:ring-1 focus:ring-[#2a7f62]/20"
    }`;

  return (
    <div className="space-y-6 pb-8">
      <EnTeteProfil
        portal={portal}
        loading={loading}
        initiales={initiales}
        nomAffichage={nomAffichage}
        roleLibelle={roleLibelle}
        estActif={estActif}
        matricule={matricule}
        badgeService={badgeService}
        photoUrl={photoUrl}
        bandeauUrl={bandeauUrl}
        aPhoto={aPhoto || !!profil?.a_photo}
        photoEnCours={photoEnCours}
        inputPhotoRef={inputPhotoRef}
        onChoisirFichier={onChoisirFichier}
        onRetirerPhoto={() => void retirerPhoto()}
        onModification={ouvrirDialogInfos}
        onModifierMotDePasse={ouvrirDialogMdp}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <div
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderBottom: "1px solid #f8fafc" }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: theme.iconBg }}
            >
              <User size={14} color={theme.iconColor} />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]">
              Informations personnelles
            </p>
          </div>
          <div className="divide-y divide-[#f8fafc] px-6">
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Prénom</p>
              {loading ? (
                <div className="h-4 w-28 animate-pulse rounded bg-[#f8fafc]" />
              ) : (
                <p className="text-[13px] font-medium text-[#0f172a]">{prenom}</p>
              )}
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Nom</p>
              {loading ? (
                <div className="h-4 w-24 animate-pulse rounded bg-[#f8fafc]" />
              ) : (
                <p className="text-[13px] font-medium text-[#0f172a]">{nom}</p>
              )}
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Genre</p>
              {loading ? (
                <div className="h-4 w-20 animate-pulse rounded bg-[#f8fafc]" />
              ) : (
                <p className="text-[13px] font-medium text-[#0f172a]">
                  {libelleGenre(profil?.genre ?? null)}
                  {profil?.civilite ? (
                    <span className="ml-1.5 text-[12px] text-[#64748b]">
                      ({profil.civilite})
                    </span>
                  ) : null}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Email</p>
              {loading ? (
                <div className="h-4 w-40 animate-pulse rounded bg-[#f8fafc]" />
              ) : (
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#0f172a]">
                  <Mail size={12} className="shrink-0 text-[#64748b]" />
                  {profil?.email ?? user?.email ?? "—"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderBottom: "1px solid #f8fafc" }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: theme.iconBg }}
            >
              <Shield size={14} color={theme.iconColor} />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]">Rôle & accès</p>
          </div>
          <div className="divide-y divide-[#f8fafc] px-6">
            <div className="flex items-center justify-between gap-3 py-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[12px] font-semibold text-[#64748b]">Rôle</p>
                {loading ? (
                  <div className="h-4 w-28 animate-pulse rounded bg-[#f8fafc]" />
                ) : (
                  <span
                    className="rounded-full px-2.5 py-[4px] text-[11px] font-semibold"
                    style={{
                      background: `${theme.topColor}1c`,
                      color: theme.hoverColor,
                    }}
                  >
                    {roleValeur}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="text-[12px] font-semibold text-[#64748b]">Statut</p>
                {loading ? (
                  <div className="h-4 w-24 animate-pulse rounded bg-[#f8fafc]" />
                ) : (
                  <span
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[11px] font-semibold"
                    style={
                      estActif
                        ? {
                            background: "rgba(5,150,105,0.10)",
                            color: "#059669",
                          }
                        : {
                            background: "rgba(220,38,38,0.08)",
                            color: "#b91c1c",
                          }
                    }
                  >
                    <span
                      className="h-[6px] w-[6px] rounded-full"
                      style={{ background: estActif ? "#059669" : "#dc2626" }}
                    />
                    {estActif ? "Compte actif" : "Compte inactif"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">
                Portail(s)
              </p>
              <p className="text-[13px] font-medium text-[#0f172a]">
                {portailLabel}
              </p>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">
                Membre depuis
              </p>
              {loading ? (
                <div className="h-4 w-36 animate-pulse rounded bg-[#f8fafc]" />
              ) : (
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#0f172a]">
                  <Calendar size={12} className="shrink-0 text-[#64748b]" />
                  {dateCreation}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderBottom: "1px solid #f8fafc" }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${theme.topColor}18` }}
            >
              <Activity size={14} color={theme.iconColor} />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]">Activité</p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: theme.bgColor,
                  border: `1px solid ${theme.topColor}22`,
                }}
              >
                <p
                  className="text-[28px] font-bold leading-none"
                  style={{ color: theme.hoverColor }}
                >
                  —
                </p>
                <p className="mt-1.5 text-[10.5px] font-semibold text-[#64748b]">
                  {activite.kpiPrincipal}
                </p>
                <p className="text-[10px] text-[#cbd5e1]">
                  {activite.kpiPrincipalSous}
                </p>
              </div>
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: "rgba(5,150,105,0.05)",
                  border: "1px solid rgba(5,150,105,0.16)",
                }}
              >
                <p
                  className="text-[28px] font-bold leading-none"
                  style={{ color: "#059669" }}
                >
                  —
                </p>
                <p className="mt-1.5 text-[10.5px] font-semibold text-[#64748b]">
                  {activite.kpiSecondaire}
                </p>
                <p className="text-[10px] text-[#cbd5e1]">
                  {activite.kpiSecondaireSous}
                </p>
              </div>
            </div>
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "#f8fafc", border: "1px solid #f8fafc" }}
            >
              <p className="text-[12px] font-semibold text-[#64748b]">
                Dernière connexion
              </p>
              {loading ? (
                <div className="h-4 w-32 animate-pulse rounded bg-[#f8fafc]" />
              ) : (
                <p className="text-[12.5px] font-medium text-[#0f172a]">
                  {dernConn}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderBottom: "1px solid #f8fafc" }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${theme.topColor}1a` }}
            >
              <Lock size={14} color={theme.iconColor} />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]">Sécurité</p>
          </div>
          <div className="divide-y divide-[#f8fafc] px-6">
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-[12px] font-semibold text-[#64748b]">
                  Mot de passe
                </p>
                <p
                  className="mt-[3px] text-[15px] text-[#e2e8f0]"
                  style={{ letterSpacing: "0.18em" }}
                >
                  ••••••••••
                </p>
              </div>
              <button
                type="button"
                onClick={ouvrirDialogMdp}
                className="rounded-lg border border-[#e2e8f0] px-3 py-[6px] text-[11.5px] font-semibold text-[#0f172a] transition-colors hover:bg-[#f8fafc] active:scale-[0.97]"
              >
                Modifier
              </button>
            </div>
            <div
              className="flex items-center justify-between py-4 opacity-60"
              title="Fonctionnalité non encore disponible"
              aria-disabled="true"
            >
              <div>
                <p className="text-[12px] font-semibold text-[#64748b]">
                  Authentification
                </p>
                <p className="mt-[3px] text-[12px] text-[#94a3b8]">
                  Double facteur (2FA)
                </p>
              </div>
              <span className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-[4px] text-[11px] font-semibold text-[#64748b]">
                Bientôt disponible
              </span>
            </div>
          </div>
        </div>
      </div>

      {fichierARecadrer ? (
        <RecadragePhoto
          fichier={fichierARecadrer}
          envoiEnCours={photoEnCours}
          onAnnuler={() => setFichierARecadrer(null)}
          onConfirmer={(f) => void confirmerPhoto(f)}
        />
      ) : null}

      <Dialog
        open={ouvertDialogInfos}
        onOpenChange={(v) => {
          if (!v) setOuvertDialogInfos(false);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug text-[#0f172a]"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Modifier les informations
            </DialogTitle>
            <p className="text-[13.5px] leading-relaxed text-[#64748b]">
              Compte{" "}
              <strong className="font-semibold text-[#0f172a]">
                {matricule}
              </strong>
              . Le matricule, le rôle et le genre ne se changent pas ici.
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3.5 px-6 py-[18px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">
                Matricule
              </label>
              <input
                value={matricule}
                disabled
                className="h-[40px] rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 text-[14px] text-[#64748b]"
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">
                Prénom
              </label>
              <input
                value={saisiePrenom}
                onChange={(e) => setSaisiePrenom(e.target.value)}
                disabled={chargInfos}
                className="h-[40px] rounded-md border border-[#cbd5e1] bg-white px-3 text-[14px] text-[#0f172a] outline-none focus:border-[#94a3b8]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">
                Nom
              </label>
              <input
                value={saisieNom}
                onChange={(e) => setSaisieNom(e.target.value)}
                disabled={chargInfos}
                className="h-[40px] rounded-md border border-[#cbd5e1] bg-white px-3 text-[14px] text-[#0f172a] outline-none focus:border-[#94a3b8]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">
                E-mail
              </label>
              <input
                type="email"
                value={saisieEmail}
                onChange={(e) => setSaisieEmail(e.target.value)}
                disabled={chargInfos}
                className="h-[40px] rounded-md border border-[#cbd5e1] bg-white px-3 text-[14px] text-[#0f172a] outline-none focus:border-[#94a3b8]"
              />
            </div>
            {erreurInfos ? (
              <p className="text-[13px] text-[#b91c1c]" role="alert">
                {erreurInfos}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              onClick={() => setOuvertDialogInfos(false)}
              disabled={chargInfos}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a] disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void soumettreInfos()}
              disabled={chargInfos}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{
                background: theme.ctaColor,
                borderColor: theme.ctaColor,
              }}
            >
              {chargInfos ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ouvertDialogMdp}
        onOpenChange={(v) => {
          if (!v) setOuvertDialogMdp(false);
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `${theme.topColor}1a`,
                  border: `1px solid ${theme.topColor}38`,
                }}
              >
                <KeyRound size={16} color={theme.iconColor} />
              </span>
              <div>
                <DialogTitle className="text-[15px] font-bold text-[#0f172a]">
                  Modifier le mot de passe
                </DialogTitle>
                <p className="mt-0.5 text-[11.5px] text-[#64748b]">
                  {mdpActuelValide
                    ? "Définissez votre nouveau mot de passe."
                    : "Vérifiez votre identité avant de continuer."}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-[#64748b]">
                  Mot de passe actuel
                </label>
                {mdpActuelValide && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#059669]">
                    <CheckCircle2 size={12} /> Vérifié
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={voirActuel ? "text" : "password"}
                    value={mdpActuel}
                    onChange={(e) => changerMdpActuel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !mdpActuelValide)
                        void verifierMdpActuel();
                    }}
                    disabled={mdpActuelValide || chargVerif}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={inputMdpCls(mdpActuelValide || chargVerif)}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setVoirActuel((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] transition-colors hover:text-[#0f172a]"
                  >
                    {voirActuel ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {!mdpActuelValide && (
                  <button
                    type="button"
                    onClick={() => void verifierMdpActuel()}
                    disabled={chargVerif || !mdpActuel.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: theme.ctaColor }}
                  >
                    {chargVerif && <Loader2 size={12} className="animate-spin" />}
                    {chargVerif ? "Vérification…" : "Vérifier"}
                  </button>
                )}
              </div>
              {erreurActuel && (
                <p className="text-[11.5px] text-red-500">⚠ {erreurActuel}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={voirNouveau ? "text" : "password"}
                  value={nouveauMdp}
                  onChange={(e) => {
                    setNouveauMdp(e.target.value);
                    setErreurNouveau("");
                  }}
                  disabled={!mdpActuelValide || chargSoumis}
                  placeholder={
                    mdpActuelValide
                      ? "Au moins 8 caractères"
                      : "Vérifiez d'abord le mot de passe actuel"
                  }
                  autoComplete="new-password"
                  className={inputMdpCls(!mdpActuelValide || chargSoumis)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setVoirNouveau((v) => !v)}
                  disabled={!mdpActuelValide}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] transition-colors hover:text-[#0f172a] disabled:pointer-events-none"
                >
                  {voirNouveau ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={voirConfirmer ? "text" : "password"}
                  value={confirmerMdp}
                  onChange={(e) => {
                    setConfirmerMdp(e.target.value);
                    setErreurNouveau("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && mdpActuelValide) void soumettreMdp();
                  }}
                  disabled={!mdpActuelValide || chargSoumis}
                  placeholder={
                    mdpActuelValide
                      ? "Répétez le nouveau mot de passe"
                      : "Vérifiez d'abord le mot de passe actuel"
                  }
                  autoComplete="new-password"
                  className={inputMdpCls(!mdpActuelValide || chargSoumis)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setVoirConfirmer((v) => !v)}
                  disabled={!mdpActuelValide}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] transition-colors hover:text-[#0f172a] disabled:pointer-events-none"
                >
                  {voirConfirmer ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {erreurNouveau && (
                <p className="text-[11.5px] text-red-500">⚠ {erreurNouveau}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOuvertDialogMdp(false)}
              className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#f8fafc]"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void soumettreMdp()}
              disabled={!mdpActuelValide || chargSoumis}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: theme.ctaColor }}
            >
              {chargSoumis && <Loader2 size={13} className="animate-spin" />}
              {chargSoumis ? "Enregistrement…" : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
