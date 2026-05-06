"use client";

import { exportUserDataAction } from "@/actions/account";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { useCallback, useState } from "react";

export function SettingsDataExportCard() {
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const downloadExport = useCallback(async () => {
    setExporting(true);
    setMsg(null);
    const r = await exportUserDataAction();
    setExporting(false);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    const blob = new Blob([r.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Card className="p-6">
      <SectionHeader compact title="Your data" />
      <p className="mt-2 font-sans text-sm text-tt-royal/75">
        Download a portable JSON copy of your trips and account metadata (GDPR
        data portability).
      </p>
      <Button
        type="button"
        disabled={exporting}
        variant="secondary"
        className="mt-4"
        onClick={() => void downloadExport()}
      >
        {exporting ? "Preparing…" : "Download all your data (JSON)"}
      </Button>
      {msg ? <p className="mt-2 font-sans text-sm text-red-700">{msg}</p> : null}
    </Card>
  );
}
