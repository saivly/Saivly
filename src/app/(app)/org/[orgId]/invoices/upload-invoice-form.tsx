"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadInvoice, type UploadInvoiceState } from "./actions";

const initialState: UploadInvoiceState = { error: null };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadInvoiceForm({ orgId }: { orgId: string }) {
  const [state, formAction, isPending] = useActionState(
    uploadInvoice,
    initialState
  );
  const [selected, setSelected] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether the pending upload we're watching for completion was
  // actually submitted from here, so an unrelated initial render doesn't
  // get misread as "just succeeded".
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!selected || !selected.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selected]);

  // Clear the picked file once its upload finishes successfully; leave it
  // in place on error so the user can just hit "Upload" again.
  useEffect(() => {
    if (!submittedRef.current || isPending) return;
    submittedRef.current = false;
    if (state.error === null) {
      setSelected(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }, [state, isPending]);

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSelected(file);
  }

  function submit() {
    if (!selected || isPending) return;
    const formData = new FormData();
    formData.set("orgId", orgId);
    formData.set("file", selected);
    submittedRef.current = true;
    formAction(formData);
  }

  function clearSelection() {
    setSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-muted uppercase">
        Upload an invoice
      </h2>

      {/* Hidden native inputs — the visible buttons below just proxy to
          these via .click() so we can style them consistently. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={handlePicked}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePicked}
        className="hidden"
      />

      {!selected ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
          >
            Upload a file
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-accent-soft"
          >
            Take a picture
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- transient local blob: preview, not worth next/image config for
            <img
              src={previewUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-accent-soft text-xs font-medium text-muted">
              PDF
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="text-xs text-muted">{formatBytes(selected.size)}</p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Uploading…" : "Upload"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={isPending}
            aria-label="Remove selected file"
            className="shrink-0 text-muted hover:text-danger disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}

      {state.error && (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </section>
  );
}
