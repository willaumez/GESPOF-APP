import { useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { getPortalMenu } from "@/shared/config/menu";
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
  /** Dans la TopBar : le nom ne s'affiche que si la barre (conteneur `topbar`) est assez large. */
  dansTopBar?: boolean;
}

export function AccountMenu({ portal, dansTopBar = false }: AccountMenuProps) {
  const { user, logout, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const menu = portal ? getPortalMenu(portal) : null;
  const accent = menu?.theme.topColor ?? "hsl(var(--primary))";
  const accountItems = (menu?.accountMenu ?? []).filter(
    (item) => !item.roles || hasAnyRole(item.roles),
  );

  const dropdownThemeVars = menu
    ? (() => {
        const primaryHsl = hexToHsl(menu.theme.topColor);
        return {
          "--primary": primaryHsl,
          "--accent": withLightness(primaryHsl, 16),
        } as CSSProperties;
      })()
    : undefined;

  const nomComplet = user ? `${user.nom ?? ""} ${user.prenom ?? ""}`.trim() : "—";
  const initiales = user
    ? `${user.nom?.[0] ?? ""}${user.prenom?.[0] ?? ""}`.toUpperCase() || "??"
    : "??";

  const handleLogout = () => {
    toast.success("Vous avez été déconnecté.");
    void logout().then(() => navigate("/"));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1 pr-1.5 pl-1 transition-colors duration-150 hover:bg-muted active:scale-[0.98]">
            <div
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white transition-colors duration-300"
              style={{ background: accent }}
            >
              {initiales}
            </div>
            <div className={cn("hidden max-w-44 min-w-0 text-left", dansTopBar ? "@6xl/topbar:block" : "sm:block")}>
              <p className="truncate text-sm font-medium leading-none text-foreground">
                {nomComplet}
              </p>
              <p className="mt-[3px] truncate text-xs leading-none text-muted-foreground">
                {user?.roles?.join(", ") ?? ""}
              </p>
            </div>
            <ChevronDown
              size={14}
              className={cn("hidden text-muted-foreground", dansTopBar ? "@6xl/topbar:block" : "sm:block")}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-60"
          style={dropdownThemeVars}
        >
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="text-sm font-medium text-foreground">{nomComplet}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user?.email ?? ""}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accountItems.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.id} onSelect={() => navigate(item.path)}>
                <Icon />
                {item.label}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <LogOut />
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
