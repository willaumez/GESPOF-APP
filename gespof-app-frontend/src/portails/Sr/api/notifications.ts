import { requeteApi } from "@/shared/lib/api";
import { SERVICE_REGLEMENT_ENDPOINTS } from "./endpoints";
import type { PageNotificationsSr } from "@/portails/Sr/types/notification.interface";

const BASE = SERVICE_REGLEMENT_ENDPOINTS.NOTIFICATIONS;

export function listerNotificationsSr(): Promise<PageNotificationsSr> {
  return requeteApi<PageNotificationsSr>(BASE);
}

export function marquerNotificationLue(id: number): Promise<PageNotificationsSr> {
  return requeteApi<PageNotificationsSr>(`${BASE}/${id}/lire`, { method: "PATCH" });
}

export function marquerToutesNotificationsLues(): Promise<PageNotificationsSr> {
  return requeteApi<PageNotificationsSr>(`${BASE}/lire-toutes`, { method: "PATCH" });
}
