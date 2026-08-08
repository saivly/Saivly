"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Passkey = { id: string; friendly_name?: string; created_at: string };

export default function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      setError(error.message);
      return;
    }
    setPasskeys(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addPasskey() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.registerPasskey();

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
  }

  async function removePasskey(id: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
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
            className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
          >
            <span>{pk.friendly_name || "Passkey"}</span>
            <button
              onClick={() => removePasskey(pk.id)}
              className="text-muted hover:text-danger"
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
