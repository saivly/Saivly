/**
 * Transactional email (anything that isn't a Supabase auth email — those
 * only cover sign-up, magic links, password resets and the like).
 * Sent through Resend's HTTP API: https://resend.com/docs/api-reference/emails/send-email
 *
 * Needs RESEND_API_KEY and EMAIL_FROM (e.g. "Saivly <hello@saivly.com>",
 * on a domain verified in Resend). Without them, emails are skipped and
 * logged — nothing else breaks.
 */
export async function sendEmail(input: { to: string[]; subject: string; html: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error(`[email] RESEND_API_KEY / EMAIL_FROM not set — skipping "${input.subject}".`);
    return false;
  }
  if (input.to.length === 0) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
    });
    if (!res.ok) {
      console.error(`[email] "${input.subject}" failed (${res.status}):`, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] "${input.subject}" failed:`, err);
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Saivly's email layout — the same design as the Supabase auth templates
 * (Supabase Dashboard -> Auth -> Email Templates), so every email looks
 * alike: logo, white card with a dark accent bar, blue button with a
 * copy-the-link fallback, an optional note block and the support footer.
 * `paragraphs` are HTML — escape anything user-supplied before passing it.
 */
function layout(input: {
  title: string;
  preview: string;
  headline: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  note?: string;
}): string {
  const p = (html: string, margin = "0 0 16px 0") =>
    `<p style="margin:${margin}; font-size:16px; line-height:26px;">${html}</p>`;
  const paragraphs = input.paragraphs
    .map((html, i) => p(html, i === input.paragraphs.length - 1 && input.button ? "0 0 28px 0" : undefined))
    .join("\n");

  const button = input.button
    ? (() => {
        const url = escapeHtml(input.button.url);
        const label = escapeHtml(input.button.label);
        return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn">
                      <tr>
                        <td align="center" bgcolor="#2f6fdb" style="border-radius:8px; background-color:#2f6fdb;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:50px; v-text-anchor:middle; width:240px;" arcsize="16%" stroke="f" fillcolor="#2f6fdb">
                            <center style="color:#FFFFFF; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">${label}</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${url}" target="_blank" style="display:inline-block; padding:15px 32px; font-family:${FONT}; font-size:16px; font-weight:600; line-height:20px; color:#FFFFFF; text-decoration:none; border-radius:8px; text-align:center;">
                            ${label}
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>

                    <p style="margin:28px 0 8px 0; font-size:14px; line-height:22px; color:#5A6678;">
                      Button not working? Copy this link into your browser:
                    </p>
                    <p style="margin:0 0 32px 0; font-size:13px; line-height:20px; word-break:break-all;">
                      <a href="${url}" style="color:#2f6fdb; text-decoration:underline;">${url}</a>
                    </p>`;
      })()
    : "";

  const note = input.note
    ? `
                <tr>
                  <td class="px" style="padding:0 40px 40px 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:16px 18px; background-color:#F3F6FB; border-left:3px solid #2f6fdb; border-radius:4px; font-family:${FONT}; font-size:14px; line-height:22px; color:#3E4A5C;">
                          ${input.note}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(input.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; display: block; }
    a { color: #2f6fdb; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .headline { font-size: 26px !important; line-height: 32px !important; }
      .btn a { display: block !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#EEF1F6;">

  <!-- Preview text shown in the inbox list -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EEF1F6;">
    ${escapeHtml(input.preview)}
    &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF1F6;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

          <!-- Logo -->
          <tr>
            <td class="px" style="padding:0 40px 24px 40px;">
              <a href="https://www.saivly.com" style="text-decoration:none;">
                <img src="https://www.saivly.com/brand/saivly-logo.png" width="142" height="40" alt="Saivly" style="width:142px; height:40px; font-family:Arial, sans-serif; font-size:22px; font-weight:bold; color:#16202e;">
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#FFFFFF; border-radius:12px; border:1px solid #DCE2EC;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Accent bar -->
                <tr>
                  <td style="height:6px; line-height:6px; font-size:0; background-color:#16202e; border-radius:12px 12px 0 0;">&nbsp;</td>
                </tr>

                <tr>
                  <td class="px" style="padding:40px 40px 8px 40px; font-family:${FONT}; color:#16202e;">

                    <h1 class="headline" style="margin:0 0 20px 0; font-family:${FONT}; font-size:28px; line-height:34px; font-weight:700; letter-spacing:-0.02em; color:#16202e;">
                      ${escapeHtml(input.headline)}
                    </h1>

${paragraphs}
${button}
                  </td>
                </tr>
${note}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="px" style="padding:28px 40px 0 40px; font-family:${FONT}; font-size:13px; line-height:20px; color:#6B7689;">
              <p style="margin:0 0 6px 0;">Questions? Write an email to <a href="mailto:support@saivly.com" style="color:#2f6fdb;">support@saivly.com</a>.</p>
              <p style="margin:0;">&copy; ${new Date().getFullYear()} Saivly &middot; Banking made simple</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** "Your account is ready" — sent once, when Adyen has verified the organisation. */
export function onboardingCompleteEmail(input: { firstName: string | null; orgName: string; dashboardUrl: string }) {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi there,";
  return {
    subject: `${input.orgName} is verified — your Saivly account is ready`,
    text: [
      greeting,
      "",
      `Good news: our partner Adyen has verified ${input.orgName}.`,
      "",
      "Your onboarding is complete and every feature is now available, including your bank account, payments and payouts.",
      "",
      `Go to your dashboard: ${input.dashboardUrl}`,
      "",
      "Questions? Write an email to support@saivly.com.",
    ].join("\n"),
    html: layout({
      title: "Your Saivly account is ready",
      preview: `Adyen has verified ${input.orgName}. Every feature is now available.`,
      headline: "Your account is ready",
      paragraphs: [
        escapeHtml(greeting),
        `Good news: our partner Adyen has verified <strong style="color:#16202e;">${escapeHtml(input.orgName)}</strong>.`,
        "Your onboarding is complete and every feature is now available, including your bank account, payments and payouts.",
      ],
      button: { label: "Go to your dashboard", url: input.dashboardUrl },
      note: "You&rsquo;re receiving this because you&rsquo;re an owner of this organisation on Saivly. If you didn&rsquo;t expect this email, contact us at <a href=\"mailto:support@saivly.com\" style=\"color:#2f6fdb;\">support@saivly.com</a>.",
    }),
  };
}
