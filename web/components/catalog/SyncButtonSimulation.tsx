"use client";

import { useState } from "react";
import { Check, LoaderCircle, RefreshCw } from "lucide-react";

const STEPS = [
  "Prepare listing changes locally",
  "Simulate SP-API sandbox sync",
  "Simulate CDN cache eviction",
];

type SyncButtonSimulationProps = {
  onSync: () => Promise<void>;
};

export function SyncButtonSimulation({ onSync }: SyncButtonSimulationProps) {
  const [activeStep, setActiveStep] = useState(-1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function runSync(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) return;
    if (isSyncing) return;

    setIsSyncing(true);
    setActiveStep(-1);
    setMessage("");
    setError("");

    try {
      for (let index = 0; index < STEPS.length; index += 1) {
        setActiveStep(index);
        setMessage(`Step ${index + 1} of ${STEPS.length}: ${STEPS[index]}.`);
        await new Promise((resolve) => window.setTimeout(resolve, 450));
      }

      await onSync();
      setActiveStep(STEPS.length);
      setMessage("Mock channel sync complete. Listing changes were saved locally; no Amazon request was sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The simulated channel sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <button
        className="button button-primary w-full sm:w-auto"
        type="button"
        disabled={isSyncing}
        onClick={(event) => void runSync(event)}
      >
        {isSyncing ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <RefreshCw aria-hidden="true" size={15} />}
        {isSyncing ? "Syncing sample listing…" : "Simulate channel sync"}
      </button>

      <ol
        aria-label="Simulated channel sync steps"
        aria-busy={isSyncing}
        className="grid gap-2 text-xs sm:grid-cols-3"
      >
        {STEPS.map((step, index) => {
          const complete = activeStep > index;
          const current = activeStep === index;
          return (
            <li
              key={step}
              aria-current={current ? "step" : undefined}
              className={`flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 ${
                complete || current
                  ? "border-muted bg-canvas text-on-surface-variant"
                  : "border-line bg-white text-muted"
              }`}
            >
              {complete ? (
                <Check aria-hidden="true" className="shrink-0" size={14} />
              ) : (
                <span aria-hidden="true" className="shrink-0 font-mono">{index + 1}.</span>
              )}
              <span>{step}</span>
            </li>
          );
        })}
      </ol>

      <p className="text-[11px] text-on-surface-variant">
        Simulation only. No live SP-API request or CDN change is performed.
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-xs text-on-surface-variant">
        {message}
      </p>
      {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
