// Transactional e-mail via Brevo (https://developers.brevo.com/reference/sendtransacemail).
// Needs the secret BREVO_API_KEY and a sender address on a domain verified in Brevo (MAIL_FROM).
// Without a key, dev and tests print the mail to the console instead of sending it.
import { env, isProd } from "./env";

export interface Mail {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
}

/** True when mails actually go out, or are printed in dev. False in a production build without a key. */
export function isMailEnabled(): boolean {
  return !!env("BREVO_API_KEY") || !isProd;
}

export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = env("BREVO_API_KEY");
  if (!apiKey) {
    if (isProd) throw new Error("BREVO_API_KEY is not set, cannot send mail");
    console.info(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: env("MAIL_FROM_NAME") ?? "Kickstand", email: env("MAIL_FROM") ?? "hello@kickstand.top" },
      to: [{ email: mail.to, ...(mail.toName ? { name: mail.toName } : {}) }],
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: mail.html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A plain, single-button mail body. Paragraphs are text; `button` links to `url`. */
export function simpleHtml(paragraphs: string[], button: { label: string; url: string }, footer: string): string {
  const p = (s: string) => `<p style="margin:0 0 16px;font:16px/1.5 system-ui,sans-serif;color:#1f1d1a">${escape(s)}</p>`;
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f3ee">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<p style="margin:0 0 20px;font:700 20px system-ui,sans-serif;color:#1f1d1a">Kickstand</p>
${paragraphs.map(p).join("\n")}
<p style="margin:24px 0"><a href="${escape(button.url)}" style="display:inline-block;background:#1f1d1a;color:#fff;text-decoration:none;font:600 16px system-ui,sans-serif;padding:12px 20px;border-radius:8px">${escape(button.label)}</a></p>
<p style="margin:0;font:13px/1.5 system-ui,sans-serif;color:#6b665e">${escape(footer)}</p>
</div></body></html>`;
}
