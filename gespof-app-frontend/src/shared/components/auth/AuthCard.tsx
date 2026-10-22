import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import logoDGCPT from "@/shared/assets/logo_tresor_v3.webp";
import {
  AuthEntranceContext,
  useEstPremierChargementAuth,
} from "./AuthEntranceContext";

export function AuthCard({ children }: { children: ReactNode }) {
  const estPremierChargement = useEstPremierChargementAuth();

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden">
      {/* Fond */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={
            estPremierChargement
              ? "absolute -inset-4 [animation:fadeIn_1.4s_ease_both]"
              : "absolute -inset-4"
          }
          style={{
            backgroundImage: "url(/tresor-public.jpeg)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "cover",
            filter: "blur(6px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-slate-950/35" />
      </div>

      {/* En-tête DGCPT — compact sur mobile, hors de la carte */}
      <header className="relative z-20 flex shrink-0 items-center gap-2.5 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6 sm:pt-5">
        <img
          src={logoDGCPT}
          alt="Logo Trésor Public"
          className="h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11"
        />
        <div className="min-w-0 text-[0.625rem] font-bold leading-snug text-white drop-shadow-sm sm:text-[0.75rem]">
          <p className="truncate sm:whitespace-normal">
            Direction Générale de la Comptabilité
          </p>
          <p className="truncate sm:whitespace-normal">
            Publique et du Trésor
            <span className="font-semibold text-white/80"> (DGCPT)</span>
          </p>
        </div>
      </header>

      {/* Carte centrée */}
      <div
        className={
          estPremierChargement
            ? "relative z-10 mx-auto flex w-full min-w-0 max-w-[68rem] flex-1 items-center px-3 py-3 sm:px-5 sm:py-6 [animation:fadeUp_.6s_ease_both]"
            : "relative z-10 mx-auto flex w-full min-w-0 max-w-[68rem] flex-1 items-center px-3 py-3 sm:px-5 sm:py-6"
        }
      >
        <div className="w-full rounded-2xl border border-white/20 bg-white/97 shadow-[0_24px_64px_rgba(2,10,25,.42)] backdrop-blur-xl sm:rounded-[1.75rem] sm:shadow-[0_30px_80px_rgba(2,10,25,.45)]">
          <div className="px-4 py-5 sm:px-10 sm:py-8 lg:px-12">
            <AuthEntranceContext.Provider value={estPremierChargement}>
              {children}
            </AuthEntranceContext.Provider>
          </div>
        </div>
      </div>

      {/* Pied de page — dans le flux (pas de chevauchement sur petits écrans) */}
      <div
        className={
          estPremierChargement
            ? "relative z-10 flex shrink-0 items-center justify-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 text-center text-[0.6875rem] text-white/80 sm:pb-5 sm:text-[0.71875rem] [animation:fadeIn_1s_ease_.5s_both]"
            : "relative z-10 flex shrink-0 items-center justify-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 text-center text-[0.6875rem] text-white/80 sm:pb-5 sm:text-[0.71875rem]"
        }
      >
        <ShieldCheck
          size={13}
          strokeWidth={1.8}
          className="shrink-0 sm:size-3.5"
        />
        <span className="max-w-[20rem] leading-snug sm:max-w-none">
          Connexion sécurisée — réservée aux agents habilités
        </span>
      </div>
    </div>
  );
}
