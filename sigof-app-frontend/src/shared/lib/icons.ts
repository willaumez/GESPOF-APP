import {
  LayoutDashboard,
  FileText,
  CreditCard,
  ArrowLeftRight,
  BookOpen,
  Users,
  User,
  TrendingUp,
  BarChart3,
  Landmark,
  Upload,
  Zap,
  FilePlus,
  Clock,
  History,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  CreditCard,
  ArrowLeftRight,
  BookOpen,
  Users,
  User,
  TrendingUp,
  BarChart3,
  Landmark,
  Upload,
  Zap,
  FilePlus,
  Clock,
  History,
  Settings,
  LogOut,
};

export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? FileText;
}
