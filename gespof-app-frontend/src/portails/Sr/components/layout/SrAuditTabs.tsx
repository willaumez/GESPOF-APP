import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { getPortalMenu } from "@/shared/config/menu";

const theme = getPortalMenu("sr").theme;

const TABS = [
  { id: "connexions" as const, label: "Connexions", path: "/sr/audit-connexions" },
  { id: "actions" as const, label: "Actions", path: "/sr/audit-actions" },
];

export function SrAuditTabs({ active }: { active: "connexions" | "actions" }) {
  const navigate = useNavigate();

  return (
    <div className="flex gap-1 border-b border-[#e2e8f0]">
      {TABS.map((tab) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.path)}
            className={cn(
              "h-[42px] px-3.5 text-[14.5px] transition-colors",
              on ? "font-semibold" : "font-medium text-[#475569]",
            )}
            style={
              on
                ? {
                    color: theme.textColor,
                    boxShadow: `inset 0 -2px 0 ${theme.topColor}`,
                  }
                : undefined
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
