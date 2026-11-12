"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>(
        "[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      open={open}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-white/90 sticky top-0 z-10">
            <div>
              <h2 id={titleId} className="text-[10px] font-bold uppercase tracking-wide text-muted">{title}</h2>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close modal"
            >
              <span className="sr-only">Close</span>
              <span className="block w-5 h-5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </dialog>
  );
}
