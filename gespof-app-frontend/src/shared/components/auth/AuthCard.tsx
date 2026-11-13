import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import {
  AuthEntranceContext,
  useEstPremierChargementAuth,
} from "./AuthEntranceContext";
import "./auth-maquette.css";

/** Coque page auth — styles exacts maquette Prototype v2. */
export function AuthCard({ children }: { children: ReactNode }) {
  const estPremierChargement = useEstPremierChargementAuth();

  return (
    <div className="auth-maquette relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#0f172a]">
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
        <div className="absolute inset-0 bg-[rgba(2,6,23,0.4)]" />
      </div>

      <header
        className="relative z-20 flex shrink-0 items-center gap-3"
        style={{ padding: "20px 24px 8px" }}
      >
        <img
          src="/logo-tresor.webp"
          alt="Logo Trésor Public"
          style={{ width: 44, height: 44, objectFit: "contain", flex: "none" }}
        />
        <div className="am-header-dgcpt">
          Direction Générale de la Comptabilité
          <br />
          Publique et du Trésor <span className="muted">(DGCPT)</span>
        </div>
      </header>

      <div
        className={
          estPremierChargement
            ? "relative z-10 flex flex-1 items-center justify-center [animation:fadeUp_.6s_ease_both]"
            : "relative z-10 flex flex-1 items-center justify-center"
        }
        style={{ padding: "16px 20px" }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1088,
            background: "rgba(255,255,255,.97)",
            border: "1px solid rgba(255,255,255,.2)",
            borderRadius: 28,
            boxShadow: "0 30px 80px rgba(2,10,25,.45)",
            padding: "40px 48px 32px",
          }}
        >
          <AuthEntranceContext.Provider value={estPremierChargement}>
            {children}
          </AuthEntranceContext.Provider>
        </div>
      </div>

      <div
        className={
          estPremierChargement
            ? "am-footer relative z-10 flex shrink-0 items-center justify-center gap-2 [animation:fadeIn_1s_ease_.5s_both]"
            : "am-footer relative z-10 flex shrink-0 items-center justify-center gap-2"
        }
        style={{ padding: "4px 16px 20px" }}
      >
        <Shield size={14} strokeWidth={1.7} aria-hidden />
        Connexion sécurisée — réservée aux agents habilités
      </div>
    </div>
  );
}
