import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, MailCheck } from "lucide-react";
import { AuthCard } from "@/shared/components/auth/AuthCard";
import { AuthBrandPanel } from "@/shared/components/auth/AuthBrandPanel";
import { BoutonSoumission } from "@/shared/components/auth/SubmitButton";

type Etape = "saisie" | "envoye";

export default function MotDePasseOublie() {
  const [etape, setEtape] = useState<Etape>("saisie");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setEtape("envoye");
    }, 900);
  };

  return (
    <AuthCard>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:min-h-[28rem] lg:gap-0 lg:divide-x lg:divide-[#e2e8f0]">
        <AuthBrandPanel />

        <div
          key={etape}
          className="flex flex-col justify-center [animation:stepIn_.45s_cubic-bezier(.16,1,.3,1)_both] lg:pl-10"
        >
          {etape === "saisie" ? (
            <>
              <div className="mb-[1.625rem] text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8eff9]">
                    <Mail size={24} strokeWidth={1.7} color="#1e4d8c" />
                  </div>
                </div>
                <h2
                  className="mb-2 text-[1.3125rem] font-bold text-[#0f172a]"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  Mot de passe oublié
                </h2>
                <p className="text-[0.8125rem] leading-[1.7] text-[#64748b]">
                  Indiquez votre adresse e-mail professionnelle. Nous vous
                  enverrons un lien pour réinitialiser votre mot de passe.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate autoComplete="off">
                <div className="mb-7">
                  <label
                    htmlFor="email-oublie"
                    className="mb-[0.4375rem] block text-[0.78125rem] font-semibold tracking-[.01em] text-[#334155]"
                  >
                    Adresse e-mail professionnelle
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[0.8125rem] top-1/2 flex -translate-y-1/2 text-[#64748b]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 6-10 7L2 6" />
                      </svg>
                    </span>
                    <input
                      id="email-oublie"
                      name="sigof-email-oublie"
                      type="email"
                      placeholder="prenom.nom@sigof.local"
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

                <BoutonSoumission loading={submitting} label="Envoyer le lien" />

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="mt-4 w-full cursor-pointer border-none bg-transparent p-0 text-center text-[0.8125rem] text-[#64748b] hover:text-[#1e4d8c] hover:underline"
                >
                  ← Retour à la connexion
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f7ee]">
                    <MailCheck size={24} strokeWidth={1.7} color="#2a7f62" />
                  </div>
                </div>
                <h2
                  className="mb-2 text-[1.3125rem] font-bold text-[#0f172a]"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  E-mail envoyé
                </h2>
                <p className="text-[0.8125rem] leading-[1.7] text-[#64748b]">
                  Si un compte est associé à{" "}
                  <span className="font-semibold text-[#334155]">
                    {email || "cette adresse"}
                  </span>
                  , un lien de réinitialisation vient de lui être envoyé.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="mt-7 w-full cursor-pointer rounded-[0.625rem] border-none py-[0.8125rem] text-[0.9375rem] font-semibold tracking-[.02em] text-white shadow-[0_6px_20px_rgba(15,23,42,.20)] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(15,23,42,.30)] active:translate-y-0"
                  style={{ background: "linear-gradient(180deg,#1e4d8c 0%,#0f172a 100%)" }}
                >
                  Retour à la connexion
                </button>

                <button
                  type="button"
                  onClick={() => setEtape("saisie")}
                  className="mt-4 w-full cursor-pointer border-none bg-transparent p-0 text-center text-[0.8125rem] text-[#64748b] hover:text-[#1e4d8c] hover:underline"
                >
                  Vous n'avez rien reçu&nbsp;? Réessayer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AuthCard>
  );
}
