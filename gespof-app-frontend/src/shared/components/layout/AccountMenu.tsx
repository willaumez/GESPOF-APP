import { useState } from "react";
import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutGrid, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { usePhotoProfil } from "@/shared/hooks/PhotoProfilContext";
import {
  getAccessiblePortails,
  getPortalMenu,
} from "@/shared/config/menu";
import { hexToHsl, withLightness } from "@/shared/lib/color";
import { cn } from "@/shared/lib/utils";
import type { Portail } from "@/shared/hooks/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

interface AccountMenuProps {
  portal?: Portail;
  /** Dans la TopBar : trigger compact maquette (avatar + chevron). */
  dansTopBar?: boolean;
}

export function AccountMenu({ portal, dansTopBar = false }: AccountMenuProps) {
  const { user, logout, hasAnyRole } = useAuth();
  const { photoUrl } = usePhotoProfil();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  const menu = portal ? getPortalMenu(portal) : null;
  const accent = menu?.theme.topColor ?? "hsl(var(--primary))";
  const accountItems = (menu?.accountMenu ?? []).filter(
    (item) => !item.roles || hasAnyRole(item.roles),
  );
  const plusieursPortails =
    getAccessiblePortails(user?.roles ?? []).length > 1;
  const pageCompteActive = accountItems.some(
    (item) =>
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`),
  );
  const triggerActif = menuOuvert || pageCompteActive;

  const dropdownThemeVars = menu
    ? (() => {
        const primaryHsl = hexToHsl(menu.theme.topColor);
        return {
          "--primary": primaryHsl,
          "--accent": withLightness(primaryHsl, 16),
        } as CSSProperties;
      })()
    : undefined;

  const nomComplet = user
    ? `${user.nom ?? ""} ${user.prenom ?? ""}`.trim()
    : "—";
  const initiales = user
    ? `${user.nom?.[0] ?? ""}${user.prenom?.[0] ?? ""}`.toUpperCase() || "??"
    : "??";
  const roleLabel = (user?.roles ?? []).join(" · ") || "—";

  const handleLogout = () => {
    toast.success("Vous avez été déconnecté.");
    void logout().then(() => navigate("/"));
  };

  return (
    <>
      <DropdownMenu open={menuOuvert} onOpenChange={setMenuOuvert}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={nomComplet}
            aria-current={pageCompteActive ? "page" : undefined}
            className={cn(
              "flex cursor-pointer items-center rounded-md transition-colors duration-150 active:scale-[0.98]",
              dansTopBar ? "gap-1.5 px-1.5 py-1" : "gap-2.5 py-1 pr-1.5 pl-1",
              !triggerActif && "hover:bg-[#f1f5f9]",
            )}
            style={
              triggerActif
                ? {
                    background: `${menu?.theme.topColor ?? "#1e4d8c"}14`,
                    boxShadow: `inset 0 0 0 1px ${menu?.theme.topColor ?? "#1e4d8c"}33`,
                  }
                : undefined
            }
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className={cn(
                  "flex-shrink-0 object-cover",
                  dansTopBar
                    ? "size-[34px] rounded-md"
                    : "size-9 rounded-lg",
                )}
                style={
                  triggerActif
                    ? {
                        boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${menu?.theme.topColor ?? "#1e4d8c"}`,
                      }
                    : undefined
                }
              />
            ) : (
              <div
                className={cn(
                  "flex flex-shrink-0 items-center justify-center font-semibold text-white",
                  dansTopBar
                    ? "size-[34px] rounded-md text-[12.5px]"
                    : "size-9 rounded-lg text-xs font-bold",
                )}
                style={{
                  background: accent,
                  ...(triggerActif
                    ? {
                        boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${menu?.theme.topColor ?? "#1e4d8c"}`,
                      }
                    : {}),
                }}
              >
                {initiales}
              </div>
            )}
            {!dansTopBar ? (
              <div className="hidden max-w-44 min-w-0 text-left sm:block">
                <p className="truncate text-sm font-medium leading-none text-foreground">
                  {nomComplet}
                </p>
                <p className="mt-[3px] truncate text-xs leading-none text-muted-foreground">
                  {roleLabel}
                </p>
              </div>
            ) : null}
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 transition-transform duration-150",
                !dansTopBar && "hidden sm:block",
                menuOuvert && "rotate-180",
                triggerActif ? "text-[inherit]" : "text-[#94a3b8]",
              )}
              style={
                triggerActif
                  ? { color: menu?.theme.textColor ?? accent }
                  : undefined
              }
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[250px] rounded-lg border border-[#e2e8f0] p-1.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,.18)]"
          style={dropdownThemeVars}
        >
          <DropdownMenuLabel className="mb-1 flex flex-col gap-0.5 border-b border-[#e2e8f0] px-2.5 pb-2.5 pt-2">
            <span className="text-sm font-semibold text-[#0f172a]">
              {nomComplet}
            </span>
            <span className="text-[11px] font-normal tracking-[0.06em] text-[#64748b]">
              {roleLabel}
              {user?.email ? ` · ${user.email}` : ""}
            </span>
          </DropdownMenuLabel>
          {accountItems.map((item) => {
            const Icon = item.icon;
            const actif =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);
            return (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => navigate(item.path)}
                className={cn(
                  "gap-2.5 rounded-[5px] px-2.5 py-2 text-[13.5px]",
                  actif && "font-semibold",
                )}
                style={
                  actif
                    ? {
                        background: `${menu?.theme.topColor ?? "#1e4d8c"}14`,
                        color: menu?.theme.textColor ?? accent,
                      }
                    : undefined
                }
              >
                <Icon className="size-4" />
                {item.label}
              </DropdownMenuItem>
            );
          })}
          {plusieursPortails ? (
            <DropdownMenuItem
              onSelect={() => navigate("/portail")}
              className="gap-2.5 rounded-[5px] px-2.5 py-2 text-[13.5px]"
            >
              <LayoutGrid className="size-4" />
              Changer de portail
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator className="my-1 bg-[#e2e8f0]" />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
            className="gap-2.5 rounded-[5px] px-2.5 py-2 text-[13.5px] text-[#b91c1c] focus:bg-[#fef2f2] focus:text-[#b91c1c]"
          >
            <LogOut className="size-4" />
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la déconnexion</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment quitter votre session ? Vous devrez vous
              reconnecter pour revenir dans la plateforme.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleLogout}>
              Déconnexion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
