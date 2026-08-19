import { Resend } from "resend";
import { SITE_NAME } from "@/lib/site";

/**
 * Transactional email, via Resend.
 *
 * Deliberately degrades rather than throwing when `RESEND_API_KEY` is absent:
 * local development has no key and no verified sending domain, and blocking
 * sign-up on a missing key would make the whole auth flow untestable offline.
 * Instead the message is logged, including the verification link, so the flow
 * can be completed by copying it out of the terminal.
 *
 * In production a missing key is a real fault, so it is logged as an error.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Resend verifies a *domain*, not individual addresses, so any mailbox at a
 * verified domain can be used as the sender.
 *
 * A human address rather than `noreply@`: for a founder-led product it reads
 * better, and `noreply@` addresses are more likely to be filtered. It does
 * carry an obligation though — a personal From invites replies, so
 * `angie@scamp.club` needs to actually receive mail. See api-docs/deployment.md.
 */
const FROM = process.env.EMAIL_FROM ?? "Angie from Scamp <angie@scamp.club>";

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[email] RESEND_API_KEY is not set — "${message.subject}" to ${message.to} was NOT sent`,
      );
    } else {
      console.log(
        `\n[email] no RESEND_API_KEY, not sending. Message follows:\n` +
          `  to:      ${message.to}\n` +
          `  subject: ${message.subject}\n` +
          `${message.text.replace(/^/gm, "  ")}\n`,
      );
    }
    return;
  }

  const { error } = await new Resend(apiKey).emails.send({
    from: FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    // Surfaced rather than swallowed: a silent failure here means a user waits
    // forever for an email that was never sent.
    console.error(`[email] send failed: ${error.name}: ${error.message}`);
    throw new Error(`Could not send email: ${error.message}`);
  }
}

/**
 * A deliberately plain template. Email clients support a small, inconsistent
 * subset of CSS — no external stylesheets, no web fonts, and Outlook ignores
 * much of what remains — so this uses inline styles, a table-free layout, and
 * system fonts. The link is also written out as text, because some clients
 * strip or rewrite anchors.
 */
export function verificationEmail(url: string): Pick<
  EmailMessage,
  "subject" | "html" | "text"
> {
  const subject = `Verify your email for ${SITE_NAME}`;

  const text = [
    `Confirm your email address to finish setting up your ${SITE_NAME} account.`,
    "",
    url,
    "",
    "This link expires in 1 hour.",
    "If you did not create an account, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111111;">
        Verify your email
      </h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444444;">
        Confirm your email address to finish setting up your ${SITE_NAME} account.
      </p>
      <a href="${url}"
         style="display:inline-block;padding:12px 24px;background:#111111;color:#ffffff;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">
        Verify email
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#777777;">
        Or paste this into your browser:<br />
        <span style="word-break:break-all;color:#555555;">${url}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#777777;">
        This link expires in 1 hour. If you did not create an account, you can
        ignore this email.
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
