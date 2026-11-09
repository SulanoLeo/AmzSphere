"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { useAmzStore, type AddProductPayload } from "@/lib/useAmzStore";

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onProductAdded?: (title: string) => void;
}

export function AddProductModal({
  open,
  onClose,
  onProductAdded,
}: AddProductModalProps) {
  const addProduct = useAmzStore((state) => state.addProduct);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const asinInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const stockInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const titleId = `${formId}-title`;
  const errorId = `${formId}-error`;
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setError("");
      setErrorField("");
      formRef.current?.reset();
      dialog.showModal();
      titleInputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function clearFieldError(field: string) {
    if (errorField === field) {
      setError("");
      setErrorField("");
    }
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setErrorField("");
    const formData = new FormData(event.currentTarget);
    const payload: AddProductPayload = {
      title: String(formData.get("title") ?? ""),
      sku: String(formData.get("sku") ?? ""),
      asin: String(formData.get("asin") ?? ""),
      price: Number(formData.get("price")),
      stockLevel: Number(formData.get("stockLevel")),
      bullets: String(formData.get("bullets") ?? "")
        .split(/\r?\n/)
        .map((bullet) => bullet.trim())
        .filter(Boolean),
      imagesUploaded: formData.get("imagesUploaded") === "on",
    };

    try {
      const product = addProduct(payload);
      formRef.current?.reset();
      onProductAdded?.(product.title);
      dialogRef.current?.close();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not add this product.";
      const field = message.includes("SKU")
        ? "sku"
        : message.includes("ASIN")
          ? "asin"
          : message.includes("Price")
            ? "price"
            : message.includes("stock")
              ? "stockLevel"
              : "";
      setError(message);
      setErrorField(field);
      if (field === "sku") skuInputRef.current?.focus();
      if (field === "asin") asinInputRef.current?.focus();
      if (field === "price") priceInputRef.current?.focus();
      if (field === "stockLevel") stockInputRef.current?.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="fixed m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[92vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-white">
              Add Product
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Create a product in the local mock catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close Add Product dialog"
            className="rounded-md p-2 text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form
          ref={formRef}
          onSubmit={submitProduct}
          className="overflow-y-auto p-5 sm:p-6"
        >
          <p className="mb-4 text-xs text-slate-300">
            Fields marked required must be filled in. Enter one bullet point per line.
          </p>
          {error && (
            <p id={errorId} role="alert" className="mb-4 rounded-md border border-rose-400 bg-rose-950/60 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-product-title`} className="mb-1 block text-sm font-medium text-slate-200">
                Title <span className="text-rose-300">(required)</span>
              </label>
              <input
                ref={titleInputRef}
                id={`${formId}-product-title`}
                name="title"
                type="text"
                required
                maxLength={200}
                autoComplete="off"
                className="min-h-11 w-full rounded-md border border-slate-500 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-sku`} className="mb-1 block text-sm font-medium text-slate-200">
                SKU <span className="text-rose-300">(required)</span>
              </label>
              <input
                ref={skuInputRef}
                id={`${formId}-sku`}
                name="sku"
                type="text"
                required
                autoComplete="off"
                aria-invalid={errorField === "sku"}
                aria-describedby={errorField === "sku" ? errorId : undefined}
                onChange={() => clearFieldError("sku")}
                className="min-h-11 w-full rounded-md border border-slate-500 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-asin`} className="mb-1 block text-sm font-medium text-slate-200">
                ASIN <span className="text-rose-300">(required)</span>
              </label>
              <input
                ref={asinInputRef}
                id={`${formId}-asin`}
                name="asin"
                type="text"
                required
                autoComplete="off"
                aria-invalid={errorField === "asin"}
                aria-describedby={errorField === "asin" ? errorId : undefined}
                onChange={() => clearFieldError("asin")}
                className="min-h-11 w-full rounded-md border border-slate-500 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-price`} className="mb-1 block text-sm font-medium text-slate-200">
                Price <span className="text-rose-300">(required)</span>
              </label>
              <div className="flex min-h-11 items-center rounded-md border border-slate-500 bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-300">
                <span aria-hidden="true" className="pl-3 text-slate-300">$</span>
                <input
                  ref={priceInputRef}
                  id={`${formId}-price`}
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  onChange={() => clearFieldError("price")}
                  className="w-full bg-transparent px-2 py-2 text-sm text-white focus-visible:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${formId}-stock`} className="mb-1 block text-sm font-medium text-slate-200">
                Initial Stock Level <span className="text-rose-300">(required)</span>
              </label>
              <input
                ref={stockInputRef}
                id={`${formId}-stock`}
                name="stockLevel"
                type="number"
                min="0"
                step="1"
                required
                onChange={() => clearFieldError("stockLevel")}
                className="min-h-11 w-full rounded-md border border-slate-500 bg-slate-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-bullets`} className="mb-1 block text-sm font-medium text-slate-200">
                Bullet Points
              </label>
              <textarea
                id={`${formId}-bullets`}
                name="bullets"
                rows={5}
                aria-describedby={`${formId}-bullets-help`}
                className="w-full rounded-md border border-slate-500 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              />
              <p id={`${formId}-bullets-help`} className="mt-1 text-xs text-slate-300">
                Add at least five lines to meet the sample listing bullet threshold.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-images`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                <input
                  id={`${formId}-images`}
                  name="imagesUploaded"
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                />
                <span>
                  Include image assets
                  <span className="mt-0.5 block text-xs text-slate-300">
                    Adds seven sample image references; no files are uploaded.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <p className="mt-5 rounded-md border border-slate-700 bg-slate-900/70 p-3 text-xs leading-5 text-slate-300">
            Mock-only: this product stays in client state, is not sent to Amazon, and resets when the page is refreshed.
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="min-h-11 rounded-md border border-slate-500 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              Add Product
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
