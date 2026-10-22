import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/shared/hooks/use-auth";
import { messageAccesRefuse, type Acces } from "@/shared/lib/acces";

interface BoutonAccesProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  /** Accès requis pour cette action (voir shared/lib/acces.ts). */
  acces: Acces;
  asChild?: boolean;
}

/**
 * Bouton d'action soumis à un accès fin (RoleAcces::accesRole() côté
 * backend). Contrairement au pattern `{peutXxx && <Button/>}` utilisé
 * ailleurs (qui masque totalement l'action), ce bouton reste visible et
 * cliquable : sans l'accès requis, son apparence est atténuée et le clic
 * affiche une alerte expliquant l'accès manquant au lieu d'exécuter
 * l'action. Le backend reste seul garant de l'autorisation réelle.
 */
export function BoutonAcces({ acces, className, onClick, ...props }: BoutonAccesProps) {
  const { hasAcces } = useAuth();
  const autorise = hasAcces(acces);

  return (
    <Button
      {...props}
      aria-disabled={!autorise}
      className={cn(!autorise && "opacity-40 grayscale-[35%] hover:opacity-40", className)}
      onClick={(e) => {
        if (!autorise) {
          e.preventDefault();
          e.stopPropagation();
          toast.error(messageAccesRefuse(acces));
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
