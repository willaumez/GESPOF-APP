import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/shared/components/ui/radio-group";
import { cn } from "@/shared/lib/utils";
import type { FormatExportSr } from "@/portails/Sr/lib/exporter-tableau";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titre?: string;
  description?: string;
  loading?: boolean;
  onConfirmer: (format: FormatExportSr) => void | Promise<void>;
};

export function ExporterFormatDialog({
  open,
  onOpenChange,
  titre = "Exporter",
  description = "Choisissez le format du fichier à télécharger.",
  loading = false,
  onConfirmer,
}: Props) {
  const [format, setFormat] = useState<FormatExportSr>("xlsx");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!loading) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={format}
          onValueChange={(v) => setFormat(v as FormatExportSr)}
          className="gap-3"
          disabled={loading}
        >
          <Label
            htmlFor="export-xlsx"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border border-[#e2e8f0] bg-white p-3.5 transition-colors",
              format === "xlsx" && "border-[#064A85] bg-[#EFF4FB]",
            )}
          >
            <RadioGroupItem value="xlsx" id="export-xlsx" className="mt-0.5" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium text-[#0f172a]">
                <FileSpreadsheet className="size-4 text-[#047857]" />
                Excel (.xlsx)
              </span>
              <span className="text-[12.5px] font-normal text-[#64748b]">
                Classeur compatible Microsoft Excel / LibreOffice.
              </span>
            </span>
          </Label>

          <Label
            htmlFor="export-pdf"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border border-[#e2e8f0] bg-white p-3.5 transition-colors",
              format === "pdf" && "border-[#064A85] bg-[#EFF4FB]",
            )}
          >
            <RadioGroupItem value="pdf" id="export-pdf" className="mt-0.5" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium text-[#0f172a]">
                <FileText className="size-4 text-[#b91c1c]" />
                PDF (.pdf)
              </span>
              <span className="text-[12.5px] font-normal text-[#64748b]">
                Document prêt à imprimer ou archiver.
              </span>
            </span>
          </Label>
        </RadioGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={loading}
            className="gap-2"
            style={{ background: "#064A85" }}
            onClick={() => void onConfirmer(format)}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Télécharger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
