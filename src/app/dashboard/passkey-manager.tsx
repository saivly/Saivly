"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Passkey = { id: string; friendly_name?: string; created_at: string };

export default function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.passkey.list();
      if (error) {
        setError(error.message);
        return;
      }
      setPasskeys(data);
    } catch (err) {
      // supabase.auth.passkey.list() can throw (network blip, the
      // experimental passkey API not enabled server-side, etc.), not just
      // return {error} — without this catch the list silently stays null
      // forever with no feedback.
      console.error("[passkey] list failed:", err);
      setError("Couldn't load your passkeys — try refreshing the page.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addPasskey() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.registerPasskey();

      if (error) {
        setError(error.message);
        return;
      }
      await refresh();
    } catch (err) {
      console.error("[passkey] register failed:", err);
      setError("Couldn't set up a passkey just now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
      if (error) {
        setError(error.message);
        return;
      }
      await refresh();
    } catch (err) {
      console.error("[passkey] delete failed:", err);
      setError("Couldn't remove that passkey — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-muted uppercase">
        Passkeys
      </h2>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="mb-4 flex flex-col gap-2">
        {(passkeys ?? []).map((pk) => (
          <li
            key={pk.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">
              {pk.friendly_name || "Passkey"}
            </span>
            <button
              onClick={() => removePasskey(pk.id)}
              disabled={busy}
              className="shrink-0 text-muted hover:text-danger disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
        {passkeys?.length === 0 && (
          <li className="text-sm text-muted">No passkeys yet.</li>
        )}
      </ul>

      <button
        onClick={addPasskey}
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Waiting for browser…" : "Add a passkey"}
      </button>
    </section>
  );
}
