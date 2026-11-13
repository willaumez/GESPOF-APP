import { useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { Camera, Lock, Pencil, Trash2 } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import type { Portail } from "@/shared/hooks/auth-context";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface EnTeteProfilProps {
  portal: Portail;
  loading: boolean;
  initiales: string;
  nomAffichage: string;
  roleLibelle: string;
  estActif: boolean;
  matricule: string;
  badgeService?: ReactNode;
  photoUrl?: string | null;
  /** Cover : recadrage bandeau (sinon `photoUrl`). */
  bandeauUrl?: string | null;
  aPhoto?: boolean;
  photoEnCours?: boolean;
  inputPhotoRef?: RefObject<HTMLInputElement | null>;
  onChoisirFichier?: (e: ChangeEvent<HTMLInputElement>) => void;
  onRetirerPhoto?: () => void;
  onModification?: () => void;
  onModifierMotDePasse?: () => void;
}

/**
 * En-tête Profil façon Courrier : bandeau cover + avatar 168px chevauchant.
 */
export function EnTeteProfil({
  portal,
  loading,
  initiales,
  nomAffichage,
  roleLibelle,
  estActif,
  matricule,
  badgeService,
  photoUrl = null,
  bandeauUrl = null,
  aPhoto = false,
  photoEnCours = false,
  inputPhotoRef,
  onChoisirFichier,
  onRetirerPhoto,
  onModification,
  onModifierMotDePasse,
}: EnTeteProfilProps) {
  const theme = getPortalMenu(portal).theme;
  const [photoAgrandie, setPhotoAgrandie] = useState(false);
  const peutGererPhoto = !!onChoisirFichier;
  const btnSecondaire =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[14px] font-semibold text-[#0f172a] transition-colors hover:bg-[#f8fafc] disabled:opacity-50";
  const btnPrincipal =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

  return (
    <div className="relative -mx-2 mb-2 sm:-mx-1">
      {/* Bandeau cover */}
      <div
        className="relative h-[140px] overflow-hidden rounded-xl sm:h-[190px]"
        style={{ background: "#0f172a" }}
      >
        {aPhoto && (bandeauUrl || photoUrl) ? (
          <img
            src={bandeauUrl || photoUrl || ""}
            alt=""
            aria-hidden
            className="absolute -inset-[6px] h-[calc(100%+12px)] w-[calc(100%+12px)] object-cover"
            style={{ filter: "blur(1.5px)" }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, ${theme.topColor}cc 0%, #0f172a 55%, #0f172a 100%)`,
            }}
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,23,42,.12) 0%, rgba(15,23,42,.42) 100%)",
          }}
          aria-hidden
        />
      </div>

      {/* Rangée identité chevauchante */}
      <div className="relative z-[1] mt-[-60px] flex flex-wrap items-end gap-4 px-3 pb-1 sm:mt-[-84px] sm:gap-6">
        <div className="flex shrink-0 items-end gap-2">
          <div className="relative">
            {loading ? (
              <div className="size-[120px] animate-pulse rounded-full bg-[#e2e8f0] ring-[5px] ring-white sm:size-[168px]" />
            ) : photoUrl ? (
              <button
                type="button"
                onClick={() => setPhotoAgrandie(true)}
                className="block cursor-zoom-in rounded-full border-0 bg-transparent p-0 leading-none outline-none focus-visible:shadow-[0_0_0_3px_rgba(30,77,140,.35)]"
                aria-label="Agrandir la photo de profil"
              >
                <img
                  src={photoUrl}
                  alt=""
                  className="size-[120px] rounded-full object-cover sm:size-[168px]"
                  style={{
                    border: "5px solid #fff",
                    boxShadow: `0 0 0 2px ${theme.topColor}, 0 12px 28px rgba(15,23,42,.28)`,
                  }}
                />
              </button>
            ) : (
              <div
                className="grid size-[120px] place-items-center rounded-full text-[36px] font-semibold tracking-wide text-white sm:size-[168px] sm:text-[52px]"
                style={{
                  background: theme.topColor,
                  border: "5px solid #fff",
                  boxShadow: `0 0 0 2px ${theme.topColor}, 0 12px 28px rgba(15,23,42,.28)`,
                  fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                }}
              >
                {initiales}
              </div>
            )}

            {photoEnCours ? (
              <div
                className="absolute left-[5px] top-[5px] flex size-[110px] flex-col items-center justify-center rounded-full bg-[rgba(15,23,42,.7)] text-[11px] font-semibold text-white sm:size-[158px]"
                aria-busy
              >
                Enregistrement…
              </div>
            ) : null}
          </div>

          {peutGererPhoto && !loading ? (
            <div className="relative z-[2] mb-2.5 flex flex-col items-center gap-1.5">
              <input
                ref={inputPhotoRef}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                onChange={onChoisirFichier}
              />
              <button
                type="button"
                disabled={photoEnCours}
                onClick={() => inputPhotoRef?.current?.click()}
                title={aPhoto ? "Changer la photo" : "Ajouter une photo"}
                aria-label={aPhoto ? "Changer la photo" : "Ajouter une photo"}
                className="grid size-9 place-items-center rounded-full border-2 border-white text-white shadow-[0_3px_8px_rgba(16,24,40,.22)] disabled:opacity-55"
                style={{ background: theme.topColor }}
              >
                <Camera size={16} strokeWidth={1.8} aria-hidden />
              </button>
              {aPhoto && onRetirerPhoto ? (
                <button
                  type="button"
                  disabled={photoEnCours}
                  onClick={onRetirerPhoto}
                  title="Retirer la photo"
                  aria-label="Retirer la photo"
                  className="grid size-7 place-items-center rounded-full border-2 border-white bg-white text-[#b42318] shadow-[0_3px_8px_rgba(16,24,40,.22)] hover:bg-[#fef3f2] disabled:opacity-55"
                >
                  <Trash2 size={13} strokeWidth={1.8} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1.5">
          <div className="flex w-full flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p
                className="m-0 inline-flex w-fit max-w-full items-center gap-2.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] backdrop-blur-md"
                style={{
                  color: theme.textColor,
                  background: "rgba(255,255,255,.9)",
                }}
              >
                <span
                  className="inline-block h-px w-4 shrink-0"
                  style={{ background: theme.topColor }}
                  aria-hidden
                />
                Mon profil
              </p>

              {loading ? (
                <div className="h-10 w-64 animate-pulse rounded-lg bg-white/80" />
              ) : (
                <h1
                  className="m-0 w-fit max-w-full truncate rounded-lg px-3 py-1 text-[26px] leading-8 font-semibold text-[#0f172a] backdrop-blur-md sm:text-[32px] sm:leading-10"
                  style={{
                    fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                    letterSpacing: "-0.5px",
                    background: "rgba(255,255,255,.9)",
                  }}
                >
                  {nomAffichage}
                </h1>
              )}

              {loading ? (
                <div className="h-5 w-48 animate-pulse rounded bg-[#e2e8f0]" />
              ) : (
                <p className="m-0 text-[13.5px] text-[#475569]">{roleLibelle}</p>
              )}
            </div>

            {!loading ? (
              <p
                className="m-0 ml-auto inline-flex w-fit shrink-0 items-center gap-1.5 self-end rounded-lg px-3 py-1 text-[13.5px] text-[#475569] backdrop-blur-md"
                style={{ background: "rgba(255,255,255,.9)" }}
              >
                Matricule{" "}
                <span
                  className="font-semibold text-[#0f172a]"
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                >
                  {matricule}
                </span>
              </p>
            ) : (
              <div className="ml-auto h-8 w-36 animate-pulse rounded-lg bg-white/80" />
            )}
          </div>

          <div className="mt-1 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {loading ? (
                <div className="h-6 w-40 animate-pulse rounded-full bg-[#e2e8f0]" />
              ) : (
                <>
                  <span
                    className="rounded-full px-2.5 py-[4px] text-[11.5px] font-semibold"
                    style={{
                      background: theme.iconBg,
                      color: theme.textColor,
                    }}
                  >
                    {roleLibelle}
                  </span>
                  <span
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[11.5px] font-semibold"
                    style={
                      estActif
                        ? { background: "#ecfdf5", color: "#047857" }
                        : { background: "#fef2f2", color: "#b91c1c" }
                    }
                  >
                    <span
                      className="size-[6px] rounded-full"
                      style={{ background: estActif ? "#10b981" : "#dc2626" }}
                    />
                    {estActif ? "Actif" : "Inactif"}
                  </span>
                  {badgeService}
                </>
              )}
            </div>

            {!loading ? (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
                {peutGererPhoto ? (
                  <button
                    type="button"
                    disabled={photoEnCours}
                    onClick={() => inputPhotoRef?.current?.click()}
                    className={btnSecondaire}
                  >
                    <Camera size={16} strokeWidth={1.8} aria-hidden />
                    {aPhoto ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                ) : null}
                {onModification ? (
                  <button
                    type="button"
                    onClick={onModification}
                    className={btnSecondaire}
                  >
                    <Pencil size={16} strokeWidth={1.8} aria-hidden />
                    Modification
                  </button>
                ) : null}
                {onModifierMotDePasse ? (
                  <button
                    type="button"
                    onClick={onModifierMotDePasse}
                    className={btnPrincipal}
                    style={{
                      background: theme.ctaColor,
                      borderColor: theme.ctaColor,
                    }}
                  >
                    <Lock size={16} strokeWidth={1.8} aria-hidden />
                    Modifier le mot de passe
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {photoUrl ? (
        <Dialog open={photoAgrandie} onOpenChange={setPhotoAgrandie}>
          <DialogContent
            showCloseButton
            className="max-h-[calc(100dvh-1.5rem)] w-[min(96vw,1200px)] max-w-[min(96vw,1200px)] gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none ring-0 [&_[data-slot=dialog-close]]:top-0 [&_[data-slot=dialog-close]]:right-0 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-white/90 [&_[data-slot=dialog-close]]:text-[#0f172a] [&_[data-slot=dialog-close]]:shadow-md"
          >
            <DialogTitle className="sr-only">Photo de profil</DialogTitle>
            <img
              src={photoUrl}
              alt="Photo de profil"
              className="max-h-[min(90dvh,900px)] w-full rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
