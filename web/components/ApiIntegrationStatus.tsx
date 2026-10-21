"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ApiIntegrationStatusProps {
  onTokenChange: (token: string) => void;
  token: string;
  mode: "free" | "paid";
}

export function ApiIntegrationStatus({ onTokenChange, token, mode }: ApiIntegrationStatusProps) {
  const [inputValue, setInputValue] = useState(token);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(token);
  }, [token]);

  const checkStatus = useCallback(async () => {
    setStatus("checking");
    try {
      const response = await fetch("/api/catalog/helium10/status", { cache: "no-store" });
      const payload = await response.json();
      setStatus(payload.connected ? "connected" : "disconnected");
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const response = await fetch("/api/catalog/helium10/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helium10_api_key: trimmed }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to save token");
      onTokenChange(trimmed);
      void checkStatus();
    } catch {
      // token stored locally regardless; backend persistence is optional
      onTokenChange(trimmed);
    } finally {
      setSaving(false);
    }
  };

  const statusIcon = status === "connected" ? <ShieldCheck size={14} className="text-emerald-600" /> : <ShieldAlert size={14} className="text-amber-600" />;
  const statusText = status === "connected" ? "Helium 10 connected" : "Helium 10 not configured";

  return (
    <Card className="border-line">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted">API Integration Status</span>
          </div>
          <Button onClick={() => void checkStatus()} disabled={saving} className="h-7 px-2">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          {statusIcon}
          <span className={`font-semibold ${status === "connected" ? "text-emerald-700" : "text-amber-700"}`}>
            {statusText}
          </span>
          {lastChecked && <span className="text-[9px] text-muted ml-1">· checked {lastChecked}</span>}
        </div>
        <form onSubmit={handleSave} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-ink">Helium 10 API Token</span>
            <input
              className="h-9 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700 text-[11px]"
              type="password"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="h10_live_…"
              disabled={saving}
            />
            <p className="text-[9px] text-muted">Required for paid (Helium 10 Advanced) optimization mode.</p>
          </label>
          <Button type="submit" disabled={saving || !inputValue.trim()} className="h-9">
            {saving ? "Saving…" : "Save token"}
          </Button>
        </form>
        <p className="text-[9px] text-muted">
          {mode === "paid" && !token ? "Switch to Free mode or add a Helium 10 token to enable paid optimization." : ""}
        </p>
      </CardContent>
    </Card>
  );
}
