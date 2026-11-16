import { Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { DownloadIcon } from "../../components/icons";
import type { OverviewExport } from "../../services/overviewExport";

type ExportButtonProps = {
  /** Builds the data when exporting, so it matches the table as shown. */
  getData: () => OverviewExport;
  /** How the rows are sorted, named in the anonymous export. */
  order: string;
  /** Reports the outcome. */
  onMessage: (message: string) => void;
};

/** Button with the menu exporting the overview as PDF, CSV or anonymous CSV. */
export function ExportButton({ getData, order, onMessage }: ExportButtonProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const runExport = async (fileType: "csv" | "anonymousCsv" | "pdf") => {
    setAnchor(null);
    const data = getData();
    try {
      // Loaded on demand, as jsPDF is large
      const { exportAnonymousCsv, exportCsv, exportPdf } =
        await import("../../services/overviewExport");
      if (fileType == "csv") exportCsv(data);
      else if (fileType == "anonymousCsv") exportAnonymousCsv(data, order);
      else await exportPdf(data);
      onMessage("Der Export wurde heruntergeladen.");
    } catch (error) {
      console.error(error);
      const { name, message } = error as Error;
      onMessage(`Der Export ist fehlgeschlagen (${name}: ${message}).`);
    }
  };

  return (
    <>
      <Button
        size="small"
        data-help="Exportiert die Tabelle als PDF oder CSV, auch anonymisiert mit Kommentaren."
        data-help-place="above"
        startIcon={<DownloadIcon size={16} />}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        Export
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => runExport("pdf")}>Als PDF</MenuItem>
        <MenuItem onClick={() => runExport("csv")}>Als CSV</MenuItem>
        <MenuItem onClick={() => runExport("anonymousCsv")}>
          Als CSV, anonymisiert
        </MenuItem>
      </Menu>
    </>
  );
}
