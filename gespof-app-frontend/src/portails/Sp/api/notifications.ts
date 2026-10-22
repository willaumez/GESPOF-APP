import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type { PageNotificationsSp } from "@/portails/Sp/types/notification.interface";

const BASE = SERVICE_PREVISION_ENDPOINTS.NOTIFICATIONS;

export function listerNotificationsSp(): Promise<PageNotificationsSp> {
  return requeteApi<PageNotificationsSp>(BASE);
}

export function marquerNotificationLue(id: number): Promise<PageNotificationsSp> {
  return requeteApi<PageNotificationsSp>(`${BASE}/${id}/lire`, { method: "PATCH" });
}

export function marquerToutesNotificationsLues(): Promise<PageNotificationsSp> {
  return requeteApi<PageNotificationsSp>(`${BASE}/lire-toutes`, { method: "PATCH" });
}
