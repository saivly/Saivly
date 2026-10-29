"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useT } from "@/app/i18n-provider";
import { Button, Field, Icon, buttonStyles, inputStyles } from "@/components/dashboard/ui";
import { createApiKey, revokeApiKey, type ApiKeyState } from "./actions";

export type ApiKeyItem = { id: string; name: string; masked: string; lastUsed: string };

export default function ApiKeys({ orgId, keys, disabled }: { orgId: string; keys: ApiKeyItem[]; disabled: boolean }) {
  const { t } = useT();
  const [creating, setCreating] = useState(false);
  const [state, action, pending] = useActionState<ApiKeyState, FormData>(createApiKey, {});
  const [revoking, startRevoke] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A freshly created key replaces the form with the copy-once banner.
  useEffect(() => {
    if (state.key) {
      setCopied(false);
      setCreating(false);
    }
  }, [state.key]);

  function revoke(id: string, name: string) {
    if (!window.confirm(t("Revoke “{name}”? Anything using this key stops working.", { name }))) return;
    startRevoke(async () => {
      const result = await revokeApiKey(orgId, id);
      setError(result.error ? t(result.error) : null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {state.key && (
        <div className="rounded-lg border border-db-success/30 bg-db-success-tint p-4">
          <p className="text-sm font-semibold text-db-success">{t("Copy your new key now — it won't be shown again.")}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-db-card px-3 py-2 font-mono text-xs text-db-ink">{state.key}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(state.key!);
                setCopied(true);
              }}
              className={buttonStyles.secondary}
            >
              <Icon name={copied ? "check" : "content_copy"} size={16} />
              {copied ? t("Copied") : t("Copy")}
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 && <p className="text-sm text-db-muted">{t("No API keys yet.")}</p>}
      {keys.map((key) => (
        <div key={key.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-db-subtle px-4 py-3">
          <Icon name="key" size={18} className="text-db-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-db-ink">{key.name}</p>
            <p className="truncate font-mono text-xs text-db-muted">{key.masked}</p>
          </div>
          <span className="text-xs text-db-muted">{key.lastUsed}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => revoke(key.id, key.name)}
              disabled={revoking}
              className="rounded-lg px-2 py-1 text-[13px] font-medium text-db-danger hover:bg-db-danger-tint disabled:opacity-50"
            >
              {t("Revoke")}
            </button>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-db-danger">{error}</p>}

      {creating ? (
        <form
          action={action}
          className="mt-1 grid gap-3 rounded-lg border border-db-border p-4 sm:grid-cols-[1fr_160px_auto] sm:items-end"
        >
          <input type="hidden" name="orgId" value={orgId} />
          <Field label={t("Key name")}>
            <input name="name" required maxLength={60} placeholder={t("e.g. Production")} className={inputStyles} />
          </Field>
          <Field label={t("Environment")}>
            <select name="environment" defaultValue="live" className={inputStyles}>
              <option value="live">{t("Live")}</option>
              <option value="test">{t("Test")}</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCreating(false)} className={`${buttonStyles.secondary} text-sm`}>
              {t("Cancel")}
            </button>
            <Button type="submit" disabled={pending}>
              {pending ? t("Creating…") : t("Create")}
            </Button>
          </div>
          {state.error && <p className="text-sm text-db-danger sm:col-span-3">{t(state.error)}</p>}
        </form>
      ) : (
        <Button
          variant="secondary"
          icon="add"
          onClick={() => setCreating(true)}
          disabled={disabled}
          className="mt-1 self-start text-sm"
        >
          {t("Generate key")}
        </Button>
      )}
    </div>
  );
}
