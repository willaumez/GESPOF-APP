import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { Button } from "@/components/ui/button";
import { getPortalMenu, getAccessiblePortails } from "@/config/menu";
import { useAuth } from "@/hooks/use-auth";
import type { Portail } from "@/contexts/auth-context";

interface AppTopBarProps {
  portal: Portail;
}

export function AppTopBar({ portal }: AppTopBarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = getPortalMenu(portal).theme;
  const plusieursPortails = getAccessiblePortails(user?.roles ?? []).length > 1;

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-border bg-background px-4 sm:px-6">
      <div className="flex-1" />

      {plusieursPortails && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/portail")}
          className="hidden gap-1 sm:flex"
          style={{ color: theme.topColor }}
        >
          <ChevronLeft className="size-3.5" />
          Portails
        </Button>
      )}

      <AccountMenu portal={portal} />
    </header>
  );
}
