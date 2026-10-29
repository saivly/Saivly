import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle, PageHeader } from "@/components/dashboard/ui";
import { getT } from "@/lib/i18n-server";
import UploadInvoiceForm from "./upload-invoice-form";
import { deleteInvoice } from "./actions";

// Signed URLs are only ever handed to the browser rendering this page
// request, so a fairly short lifetime is fine — the page is re-fetched
// (and a fresh URL minted) any time the list changes anyway.
const SIGNED_URL_TTL_SECONDS = 60 * 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const [supabase, t] = await Promise.all([createClient(), getT()]);

  // RLS (invoices_select_member) already scopes this to the current
  // user's org, but we filter explicitly anyway — this route only ever
  // wants orgId's invoices, not every org this user happens to belong to.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  const paths = (invoices ?? []).map((invoice) => invoice.file_path);
  const { data: signedUrls } =
    paths.length > 0
      ? await supabase.storage
          .from("invoices")
          .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      : { data: [] as { path: string | null; signedUrl: string }[] };

  const urlByPath = new Map(
    (signedUrls ?? [])
      .filter((entry) => entry.path)
      .map((entry) => [entry.path as string, entry.signedUrl])
  );

  return (
    <>
      <PageHeader title={t("Invoices")} subtitle={t("Upload and keep track of your invoices.")} />

      <div className="flex max-w-[720px] flex-col gap-6">
      <UploadInvoiceForm orgId={orgId} />

      <Card>
        <CardTitle>{t("All invoices")}</CardTitle>

        <ul className="flex flex-col gap-2">
          {(invoices ?? []).map((invoice) => {
            const url = urlByPath.get(invoice.file_path);
            const isImage = invoice.mime_type.startsWith("image/");
            return (
              <li
                key={invoice.id}
                className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm"
              >
                {url && isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset next/image can cache
                  <img
                    src={url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-accent-soft text-[10px] font-medium text-muted">
                    {isImage ? "IMG" : "PDF"}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-medium hover:underline"
                    >
                      {invoice.file_name}
                    </a>
                  ) : (
                    <span className="block truncate font-medium">
                      {invoice.file_name}
                    </span>
                  )}
                  <span className="block text-xs text-muted">
                    {formatDate(invoice.created_at)} ·{" "}
                    {formatBytes(invoice.size_bytes)}
                  </span>
                </div>

                <form action={deleteInvoice} className="shrink-0">
                  <input type="hidden" name="orgId" value={orgId} />
                  <input type="hidden" name="id" value={invoice.id} />
                  <input
                    type="hidden"
                    name="filePath"
                    value={invoice.file_path}
                  />
                  <button
                    aria-label="Delete invoice"
                    className="text-muted hover:text-danger"
                  >
                    ✕
                  </button>
                </form>
              </li>
            );
          })}
          {(invoices ?? []).length === 0 && (
            <li className="text-sm text-muted">
              {t("No invoices yet. Upload one above.")}
            </li>
          )}
        </ul>
      </Card>
      </div>
    </>
  );
}
