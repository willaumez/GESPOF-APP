import { useState, useEffect } from "react";
import { useAuth } from "@/shared/hooks/use-auth";
import { requeteApi } from "@/shared/lib/api";
import { API_ENDPOINTS } from "@/shared/config/app";
import { getAccessiblePortails } from "@/shared/config/menu";
import type { UtilisateurProfil } from "@/portails/Sr/types/profil.interface";
import { User, Mail, Shield, Calendar, Activity, Lock, CheckCircle2, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/components/ui/dialog";

export default function Profile() {
  const { user, token, activerSession } = useAuth();
  const [profil,  setProfil]  = useState<UtilisateurProfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [ouvertDialogMdp, setOuvertDialogMdp] = useState(false);

  useEffect(() => {
    let annule = false;
    requeteApi<UtilisateurProfil>(API_ENDPOINTS.AUTH.ME, { jeton: token })
      .then((data) => { if (!annule) { setProfil(data); setLoading(false); } })
      .catch((e: unknown) => {
        if (!annule) {
          toast.error(e instanceof Error ? e.message : "Erreur lors du chargement du profil.");
          setLoading(false);
        }
      });
    return () => { annule = true; };
  }, [token]);

  const nom    = profil?.nom    ?? user?.nom    ?? "—";
  const prenom = profil?.prenom ?? user?.prenom ?? "—";
  const nomAffichage = profil ? `${nom.toUpperCase()} ${prenom}` : "—";
  const initiales    = profil
    ? `${nom[0] ?? ""}${prenom[0] ?? ""}`.toUpperCase()
    : user ? `${user.nom?.[0] ?? ""}${user.prenom?.[0] ?? ""}`.toUpperCase() : "??";

  const roleLibelle  = profil?.roles?.map((r) => r.libelle).join(", ") || "—";
  const roleValeur   = profil?.roles?.map((r) => r.valeur).join(", ") || "—";
  const portailLabel = getAccessiblePortails(user?.roles ?? []).map((p) => p.title).join(", ") || "—";
  const estActif     = profil?.actif ?? true;
  const matricule    = profil?.matricule ?? "—";
  const dateCreation = profil?.date_creation ?? "—";
  const dernConn     = profil?.derniere_connexion ?? "—";

  const [mdpActuel,    setMdpActuel]    = useState("");
  const [nouveauMdp,   setNouveauMdp]   = useState("");
  const [confirmerMdp, setConfirmerMdp] = useState("");
  const [mdpActuelValide, setMdpActuelValide] = useState(false);
  const [chargVerif,   setChargVerif]   = useState(false);
  const [chargSoumis,  setChargSoumis]  = useState(false);
  const [erreurActuel, setErreurActuel] = useState("");
  const [erreurNouveau, setErreurNouveau] = useState("");
  const [voirActuel,   setVoirActuel]   = useState(false);
  const [voirNouveau,  setVoirNouveau]  = useState(false);
  const [voirConfirmer, setVoirConfirmer] = useState(false);

  useEffect(() => {
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
  }, [ouvertDialogMdp]);

  function changerMdpActuel(val: string) {
    setMdpActuel(val);
    setErreurActuel("");
    if (mdpActuelValide) {
      setMdpActuelValide(false);
      setNouveauMdp(""); setConfirmerMdp(""); setErreurNouveau("");
    }
  }

  async function verifierMdpActuel() {
    if (!mdpActuel.trim()) { setErreurActuel("Veuillez saisir votre mot de passe actuel."); return; }
    setChargVerif(true); setErreurActuel("");
    try {
      await requeteApi<{ valid: boolean }>(API_ENDPOINTS.AUTH.VERIFIER_MOT_DE_PASSE, {
        jeton: token, method: "POST", body: JSON.stringify({ currentPassword: mdpActuel }),
      });
      setMdpActuelValide(true);
    } catch (e: unknown) {
      setErreurActuel(e instanceof Error ? e.message : "Mot de passe incorrect.");
    } finally {
      setChargVerif(false);
    }
  }

  async function soumettreMdp() {
    if (!nouveauMdp.trim()) { setErreurNouveau("Veuillez saisir le nouveau mot de passe."); return; }
    if (nouveauMdp !== confirmerMdp) { setErreurNouveau("Les mots de passe ne correspondent pas."); return; }
    setChargSoumis(true); setErreurNouveau("");
    try {
      const res = await requeteApi<{ ok: boolean; token: string }>(API_ENDPOINTS.AUTH.CHANGER_MOT_DE_PASSE, {
        jeton: token, method: "POST",
        body: JSON.stringify({ currentPassword: mdpActuel, newPassword: nouveauMdp }),
      });
      await activerSession(res.token);
      toast.success("Mot de passe modifié avec succès.");
      setOuvertDialogMdp(false);
    } catch (e: unknown) {
      setErreurNouveau(e instanceof Error ? e.message : "Erreur lors du changement de mot de passe.");
    } finally {
      setChargSoumis(false);
    }
  }

  const inputMdpCls = (disabled: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 pr-9 text-[13px] font-medium outline-none transition ${
      disabled
        ? "cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#e2e8f0]"
        : "border-[#e2e8f0] bg-white text-[#0f172a] focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/20"
    }`;

  return (
    <div className="space-y-6 pb-8">
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes popIn{0%{opacity:0;transform:scale(.78)}65%{transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
        @keyframes slideInLeft{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulseRing{0%,100%{box-shadow:0 0 0 0 rgba(5,150,105,.45)}50%{box-shadow:0 0 0 7px rgba(5,150,105,0)}}
        .p-fade-up{animation:fadeUp .52s ease both}.p-fade-in{animation:fadeIn .42s ease both}
        .p-pop-in{animation:popIn .52s cubic-bezier(.34,1.56,.64,1) both}.p-slide-left{animation:slideInLeft .48s ease both}
        .p-pulse{animation:pulseRing 2.2s infinite}
      `}</style>

      {}
      <div className="p-fade-up relative overflow-hidden rounded-2xl px-8 py-8 text-white"
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)", boxShadow: "0 6px 28px rgba(15,23,42,0.28)" }}>
        <div className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.035) 1px,transparent 1px)", backgroundSize: "38px 38px" }} />

        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {loading
            ? <div className="h-[86px] w-[86px] shrink-0 animate-pulse rounded-full bg-white/10" />
            : <div className="p-pop-in p-pulse flex h-[86px] w-[86px] shrink-0 items-center justify-center rounded-full text-[30px] font-bold"
                style={{ background: "linear-gradient(135deg,#1e4d8c,#0f172a)", border: "3px solid rgba(255,255,255,0.18)", fontFamily: "'Geist Variable', sans-serif", animationDelay: "0.12s" }}>
                {initiales}
              </div>
          }

          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="space-y-2">
                <div className="h-7 w-48 animate-pulse rounded-lg bg-white/10" />
                <div className="h-5 w-32 animate-pulse rounded-full bg-white/10" />
              </div>
            ) : (
              <>
                <h2 className="p-slide-left truncate text-[26px] font-bold leading-tight"
                  style={{ fontFamily: "'Geist Variable', sans-serif", animationDelay: "0.18s" }}>
                  {nomAffichage}
                </h2>
                <div className="p-fade-in mt-2.5 flex flex-wrap items-center gap-2" style={{ animationDelay: "0.28s" }}>
                  <span className="rounded-full px-3 py-[5px] text-[11.5px] font-semibold"
                    style={{ background: "rgba(217,119,6,0.16)", color: "#f59e0b", border: "1px solid rgba(217,119,6,0.28)" }}>
                    {roleLibelle}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[11.5px] font-semibold"
                    style={{ background: "rgba(5,150,105,0.16)", color: "#34d399", border: "1px solid rgba(5,150,105,0.28)" }}>
                    <span className="h-[7px] w-[7px] rounded-full"
                      style={{ background: estActif ? "#10b981" : "#dc2626", animation: estActif ? "pulseRing 2.2s infinite" : "none" }} />
                    {estActif ? "Actif" : "Inactif"}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="p-fade-in shrink-0 self-start text-right" style={{ animationDelay: "0.32s" }}>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/45">Matricule</p>
            {loading
              ? <div className="mt-1 h-6 w-20 animate-pulse rounded bg-white/10" />
              : <p className="mt-1 font-mono text-[19px] font-bold tracking-wide text-white/90">{matricule}</p>
            }
          </div>
        </div>
      </div>

      {}
      <div className="grid gap-5 md:grid-cols-2">

        {}
        <div className="p-fade-up overflow-hidden rounded-2xl bg-white"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", animationDelay: "0.10s" }}>
          <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid #f8fafc" }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(15,23,42,0.07)" }}>
              <User size={14} color="#0f172a" />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]" style={{ fontFamily: "'Geist Variable', sans-serif" }}>Informations personnelles</p>
          </div>
          <div className="divide-y divide-[#f8fafc] px-6">
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Prénom</p>
              {loading
                ? <div className="h-4 w-28 animate-pulse rounded bg-[#f8fafc]" />
                : <p className="text-[13px] font-medium text-[#0f172a]">{prenom}</p>
              }
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Nom</p>
              {loading
                ? <div className="h-4 w-24 animate-pulse rounded bg-[#f8fafc]" />
                : <p className="text-[13px] font-medium text-[#0f172a]">{nom}</p>
              }
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Email</p>
              {loading
                ? <div className="h-4 w-40 animate-pulse rounded bg-[#f8fafc]" />
                : <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#0f172a]">
                    <Mail size={12} className="shrink-0 text-[#64748b]" />
                    {profil?.email ?? user?.email ?? "—"}
                  </span>
              }
            </div>
          </div>
        </div>

        {}
        <div className="p-fade-up overflow-hidden rounded-2xl bg-white"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", animationDelay: "0.20s" }}>
          <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid #f8fafc" }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(15,23,42,0.07)" }}>
              <Shield size={14} color="#0f172a" />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]" style={{ fontFamily: "'Geist Variable', sans-serif" }}>Rôle & accès</p>
          </div>
          <div className="divide-y divide-[#f8fafc] px-6">
            <div className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-semibold text-[#64748b]">Rôle</p>
                {loading
                  ? <div className="h-4 w-28 animate-pulse rounded bg-[#f8fafc]" />
                  : <span className="rounded-full px-2.5 py-[4px] text-[11px] font-semibold"
                      style={{ background: "rgba(217,119,6,0.11)", color: "#d97706" }}>
                      {roleValeur}
                    </span>
                }
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-semibold text-[#64748b]">Statut</p>
                {loading
                  ? <div className="h-4 w-24 animate-pulse rounded bg-[#f8fafc]" />
                  : <span className="flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[11px] font-semibold"
                      style={{ background: "rgba(5,150,105,0.10)", color: "#059669" }}>
                      <span className="h-[6px] w-[6px] rounded-full bg-[#059669]" />
                      {estActif ? "Compte actif" : "Compte inactif"}
                    </span>
                }
              </div>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Portail(s)</p>
              <p className="text-[13px] font-medium text-[#0f172a]">{portailLabel}</p>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <p className="text-[12px] font-semibold text-[#64748b]">Membre depuis</p>
              {loading
                ? <div className="h-4 w-36 animate-pulse rounded bg-[#f8fafc]" />
                : <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#0f172a]">
                    <Calendar size={12} className="shrink-0 text-[#64748b]" />
                    {dateCreation}
                  </span>
              }
            </div>
          </div>
        </div>

        {}
        <div className="p-fade-up overflow-hidden rounded-2xl bg-white"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", animationDelay: "0.30s" }}>
          <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid #f8fafc" }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(5,150,105,0.09)" }}>
              <Activity size={14} color="#059669" />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]" style={{ fontFamily: "'Geist Variable', sans-serif" }}>Activité</p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(15,23,42,0.04)", border: "1px solid #f8fafc" }}>
                <p className="text-[28px] font-bold leading-none" style={{ fontFamily: "'Geist Variable', sans-serif", color: "#0f172a" }}>—</p>
                <p className="mt-1.5 text-[10.5px] font-semibold text-[#64748b]">Fiches générées</p>
                <p className="text-[10px] text-[#e2e8f0]">au total</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.16)" }}>
                <p className="text-[28px] font-bold leading-none" style={{ fontFamily: "'Geist Variable', sans-serif", color: "#059669" }}>—</p>
                <p className="mt-1.5 text-[10.5px] font-semibold text-[#64748b]">Ce mois-ci</p>
                <p className="text-[10px] text-[#e2e8f0]">fiches</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "#f8fafc", border: "1px solid #f8fafc" }}>
              <p className="text-[12px] font-semibold text-[#64748b]">Dernière connexion</p>
              {loading
                ? <div className="h-4 w-32 animate-pulse rounded bg-[#f8fafc]" />
                : <p className="text-[12.5px] font-medium text-[#0f172a]">{dernConn}</p>
              }
            </div>
          </div>
        </div>

        {}
        <div className="p-fade-up overflow-hidden rounded-2xl bg-white"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", animationDelay: "0.40s" }}>
          <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid #f8fafc" }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(217,119,6,0.10)" }}>
              <Lock size={14} color="#d97706" />
            </span>
            <p className="text-[15px] font-bold text-[#0f172a]" style={{ fontFamily: "'Geist Variable', sans-serif" }}>Sécurité</p>
          </div>
          <div className="divide-y divide-[#f8fafc] px-6">
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-[12px] font-semibold text-[#64748b]">Mot de passe</p>
                <p className="mt-[3px] text-[15px] text-[#e2e8f0]" style={{ letterSpacing: "0.18em" }}>••••••••••</p>
              </div>
              <button
                onClick={() => setOuvertDialogMdp(true)}
                className="rounded-lg border border-[#e2e8f0] px-3 py-[6px] text-[11.5px] font-semibold text-[#0f172a] transition-colors hover:bg-[#f8fafc] active:scale-[0.97]">
                Modifier
              </button>
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-[12px] font-semibold text-[#64748b]">Authentification</p>
                <p className="mt-[3px] text-[12px] text-[#e2e8f0]">Double facteur (2FA)</p>
              </div>
              <span className="flex items-center gap-1 rounded-full px-2.5 py-[4px] text-[11px] font-semibold"
                style={{ background: "rgba(5,150,105,0.10)", color: "#059669" }}>
                <CheckCircle2 size={11} />
                Activée
              </span>
            </div>
          </div>
        </div>

      </div>

      {}
      <Dialog open={ouvertDialogMdp} onOpenChange={(v) => { if (!v) setOuvertDialogMdp(false); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(217,119,6,0.10)", border: "1px solid rgba(217,119,6,0.22)" }}>
                <KeyRound size={16} color="#d97706" />
              </span>
              <div>
                <DialogTitle className="text-[15px] font-bold text-[#0f172a]"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}>
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

            {}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-[#64748b]">Mot de passe actuel</label>
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
                    onKeyDown={(e) => { if (e.key === "Enter" && !mdpActuelValide) verifierMdpActuel(); }}
                    disabled={mdpActuelValide || chargVerif}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={inputMdpCls(mdpActuelValide || chargVerif)}
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setVoirActuel((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] transition-colors hover:text-[#0f172a]">
                    {voirActuel ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {!mdpActuelValide && (
                  <button type="button"
                    onClick={verifierMdpActuel}
                    disabled={chargVerif || !mdpActuel.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0f172a] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                    {chargVerif && <Loader2 size={12} className="animate-spin" />}
                    {chargVerif ? "Vérification…" : "Vérifier"}
                  </button>
                )}
              </div>
              {erreurActuel && (
                <p className="text-[11.5px] text-red-500">⚠ {erreurActuel}</p>
              )}
            </div>

            {}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={voirNouveau ? "text" : "password"}
                  value={nouveauMdp}
                  onChange={(e) => { setNouveauMdp(e.target.value); setErreurNouveau(""); }}
                  disabled={!mdpActuelValide || chargSoumis}
                  placeholder={mdpActuelValide ? "Au moins 8 caractères" : "Vérifiez d'abord le mot de passe actuel"}
                  autoComplete="new-password"
                  className={inputMdpCls(!mdpActuelValide || chargSoumis)}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setVoirNouveau((v) => !v)}
                  disabled={!mdpActuelValide}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] transition-colors hover:text-[#0f172a] disabled:pointer-events-none">
                  {voirNouveau ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#64748b]">Confirmer le nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={voirConfirmer ? "text" : "password"}
                  value={confirmerMdp}
                  onChange={(e) => { setConfirmerMdp(e.target.value); setErreurNouveau(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && mdpActuelValide) soumettreMdp(); }}
                  disabled={!mdpActuelValide || chargSoumis}
                  placeholder={mdpActuelValide ? "Répétez le nouveau mot de passe" : "Vérifiez d'abord le mot de passe actuel"}
                  autoComplete="new-password"
                  className={inputMdpCls(!mdpActuelValide || chargSoumis)}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setVoirConfirmer((v) => !v)}
                  disabled={!mdpActuelValide}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] transition-colors hover:text-[#0f172a] disabled:pointer-events-none">
                  {voirConfirmer ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {erreurNouveau && (
                <p className="text-[11.5px] text-red-500">⚠ {erreurNouveau}</p>
              )}
            </div>

          </div>

          <DialogFooter>
            <button type="button" onClick={() => setOuvertDialogMdp(false)}
              className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#f8fafc]">
              Annuler
            </button>
            <button type="button" onClick={soumettreMdp}
              disabled={!mdpActuelValide || chargSoumis}
              className="flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {chargSoumis && <Loader2 size={13} className="animate-spin" />}
              {chargSoumis ? "Enregistrement…" : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
