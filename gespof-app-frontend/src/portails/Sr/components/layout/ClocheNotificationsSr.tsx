import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays, CheckCheck, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import {
  dateIsoNotification,
  notificationEstDuJour,
} from "@/shared/lib/notifications";
import {
  listerNotificationsSr,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
} from "@/portails/Sr/api/notifications";
import type {
  NotificationSr,
  PageNotificationsSr,
} from "@/portails/Sr/types/notification.interface";

const INTERVALLE_MS = 30_000;

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

function appliquerPage(
  setPage: (page: PageNotificationsSr) => void,
  page: PageNotificationsSr,
) {
  setPage(page);
}

function relativeFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2_592_000) return rtf.format(Math.round(diffSec / 86_400), "day");
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function libelleDateGroupe(iso: string): string {
  const [y, m, d] = iso.split("-");
  const mois = MOIS_FR[Number(m) - 1];
  if (!y || !m || !d || !mois) return iso;
  return `${Number(d)} ${mois} ${y}`;
}

/**
 * Cloche du portail SR : fiches transmises par le Service Prévision,
 * regroupées par date de la fiche reçue.
 */
export function ClocheNotificationsSr() {
  const navigate = useNavigate();
  const theme = getPortalMenu("sr").theme;
  const [ouvert, setOuvert] = useState(false);
  const [afficherToutes, setAfficherToutes] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [page, setPage] = useState<PageNotificationsSr>({
    non_lues: 0,
    notifications: [],
  });

  const charger = useCallback(async () => {
    try {
      appliquerPage(setPage, await listerNotificationsSr());
    } catch {
      /* silencieux : la cloche ne doit pas spammer */
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
    const id = window.setInterval(() => void charger(), INTERVALLE_MS);
    return () => window.clearInterval(id);
  }, [charger]);

  const notificationsVisibles = useMemo(() => {
    if (afficherToutes) return page.notifications;
    return page.notifications.filter((n) => notificationEstDuJour(n));
  }, [afficherToutes, page.notifications]);

  const groupes = useMemo(() => {
    const map = new Map<string, NotificationSr[]>();
    for (const n of notificationsVisibles) {
      const date = dateIsoNotification(n);
      const liste = map.get(date) ?? [];
      liste.push(n);
      map.set(date, liste);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [notificationsVisibles]);

  async function onOuvrir(ouverte: boolean) {
    setOuvert(ouverte);
    if (ouverte) {
      void charger();
    } else {
      setAfficherToutes(false);
    }
  }

  async function onClickNotification(n: NotificationSr) {
    try {
      if (!n.lue) {
        appliquerPage(setPage, await marquerNotificationLue(n.id));
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de marquer la notification comme lue.",
      );
    }
    setOuvert(false);
    if (n.lien) {
      void navigate(n.lien);
    }
  }

  async function onToutLire() {
    try {
      appliquerPage(setPage, await marquerToutesNotificationsLues());
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de marquer les notifications comme lues.",
      );
    }
  }

  const nonLues = page.non_lues;
  const badge = nonLues > 9 ? "9+" : String(nonLues);

  return (
    <Popover open={ouvert} onOpenChange={(v) => void onOuvrir(v)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          style={{ color: theme.topColor }}
          title="Notifications"
          aria-label={
            nonLues > 0
              ? `Notifications, ${nonLues} non lue${nonLues > 1 ? "s" : ""}`
              : "Notifications"
          }
        >
          <Bell className="size-5" strokeWidth={2} />
          {nonLues > 0 ? (
            <span
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: theme.ctaColor }}
            >
              {badge}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <PopoverHeader className="flex flex-row items-center justify-between gap-2 border-b px-3 py-2.5">
          <PopoverTitle className="min-w-0 shrink text-[13.5px] font-semibold">
            Notifications
          </PopoverTitle>
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            {nonLues > 0 ? (
              <button
                type="button"
                className="inline-flex min-h-8 items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => void onToutLire()}
              >
                <CheckCheck className="size-3.5" />
                Tout marquer lu
              </button>
            ) : null}
            <button
              type="button"
              aria-pressed={afficherToutes}
              aria-label={
                afficherToutes
                  ? "Afficher les notifications du jour"
                  : "Afficher toutes les notifications"
              }
              className="inline-flex min-h-8 items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setAfficherToutes((v) => !v)}
            >
              {afficherToutes ? (
                <CalendarDays className="size-3.5" />
              ) : (
                <History className="size-3.5" />
              )}
              {afficherToutes ? "Aujourd'hui" : "Toutes"}
            </button>
          </div>
        </PopoverHeader>

        {chargement && page.notifications.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : notificationsVisibles.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
            {afficherToutes || page.notifications.length === 0
              ? "Aucune notification pour le moment."
              : "Aucune notification aujourd'hui."}
          </p>
        ) : (
          <ScrollArea className="h-80">
            <ul className="flex flex-col p-1.5">
              {groupes.map(([date, notifs]) => (
                <li key={date} className="mb-1">
                  <p className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {libelleDateGroupe(date)}
                  </p>
                  <ul className="flex flex-col">
                    {notifs.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void onClickNotification(n)}
                          className={cn(
                            "flex w-full gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/80",
                            !n.lue && "bg-muted/40",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-1.5 size-2 shrink-0 rounded-full",
                              n.lue ? "bg-transparent" : "bg-current",
                            )}
                            style={n.lue ? undefined : { color: theme.ctaColor }}
                          />
                          <span className="min-w-0 flex-1 space-y-0.5">
                            <span className="block text-[13px] font-semibold text-foreground">
                              {n.titre}
                            </span>
                            <span className="block text-[12.5px] leading-snug text-muted-foreground">
                              {n.message}
                            </span>
                            <span className="block text-[11px] text-muted-foreground/80">
                              {relativeFr(n.date_creation)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
