import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import logoDGCPT from "@/shared/assets/logo_tresor_v3.webp";
import { AuthEntranceContext, useEstPremierChargementAuth } from "./AuthEntranceContext";

export function AuthCard({ children }: { children: ReactNode }) {
  const estPremierChargement = useEstPremierChargementAuth();

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-y-auto">
      {}
      <div className="absolute left-4 top-4 z-20 flex max-w-[10rem] items-center gap-2.5 sm:left-6 sm:top-6 sm:max-w-none">
        <img
          src={logoDGCPT}
          alt="Logo Trésor Public"
          className="h-13 w-13 shrink-0 object-contain sm:h-11 sm:w-11"
        />
        <span className="text-[0.55rem] font-bold leading-tight text-white/95 sm:text-[0.75rem]">
        <p>Direction Générale de la Comptabilité </p>
        <p>Publique et du Trésor</p>(DGCPT)
          
        </span>
      </div>

      {}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={estPremierChargement ? "absolute -inset-4 [animation:fadeIn_1.4s_ease_both]" : "absolute -inset-4"}
          style={{
            backgroundImage: "url(/tresor-public.jpeg)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "cover",
            filter: "blur(6px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.08),transparent_55%)]" />
      </div>

      {}
      <div
        className={
          estPremierChargement
            ? "relative z-10 w-full min-w-0 max-w-[68rem] [animation:fadeUp_.6s_ease_both]"
            : "relative z-10 w-full min-w-0 max-w-[68rem]"
        }
      >
        <div className="rounded-[1.75rem] border border-white/15 bg-white/97 shadow-[0_30px_80px_rgba(2,10,25,.45)] backdrop-blur-xl px-7 py-6 sm:px-12 sm:py-8">
          <AuthEntranceContext.Provider value={estPremierChargement}>
            {children}
          </AuthEntranceContext.Provider>
        </div>

        <div
          className={
            estPremierChargement
              ? "mt-6 flex items-center justify-center gap-2 text-[0.71875rem] text-white/75 [animation:fadeIn_1s_ease_.5s_both]"
              : "mt-6 flex items-center justify-center gap-2 text-[0.71875rem] text-white/75"
          }
        >
          <ShieldCheck size={14} strokeWidth={1.8} />
          Connexion sécurisée — réservée aux agents habilités
        </div>
      </div>
    </div>
  );
}