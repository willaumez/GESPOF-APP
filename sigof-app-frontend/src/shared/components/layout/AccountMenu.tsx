import { useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { getPortalMenu } from "@/shared/config/menu";
import { hexToHsl, withLightness } from "@/shared/lib/color";
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
}

export function AccountMenu({ portal }: AccountMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const menu = portal ? getPortalMenu(portal) : null;
  const accent = menu?.theme.topColor ?? "hsl(var(--primary))";
  const profilePath = menu
    ? (menu.accountMenu[0]?.path ?? `${menu.path}/profile`)
    : null;

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
    logout();
    navigate("/");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors duration-150 hover:bg-muted active:scale-[0.98]">
            <div
              className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white transition-colors duration-300"
              style={{ background: accent }}
            >
              {initiales}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-none text-foreground">
                {nomComplet}
              </p>
              <p className="mt-[3px] text-xs leading-none text-muted-foreground">
                {user?.roles?.join(", ") ?? ""}
              </p>
            </div>
            <ChevronDown size={14} className="hidden text-muted-foreground sm:block" />
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
          {profilePath && (
            <DropdownMenuItem onSelect={() => navigate(profilePath)}>
              <User />
              Profil
            </DropdownMenuItem>
          )}
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
