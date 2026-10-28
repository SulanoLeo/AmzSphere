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
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            "w-full max-w-2xl bg-white rounded-xl border border-line shadow-2xl flex flex-col",
            className,
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-white/90 sticky top-0 z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{title}</span>
            </div>
            <button
              className="p-1.5 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors"
              onClick={onClose}
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
      </div>
    </>
  );
}
