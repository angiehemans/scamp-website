import { Resend } from "resend";
import { SITE_NAME, SITE_URL } from "@/lib/site";

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
  /** One address, or several for a single message with multiple recipients. */
  to: string | string[];
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

/**
 * The "someone signed up" note to the operator.
 *
 * Sent to whoever is in ADMIN_EMAILS, not to the new user, so it can be blunt:
 * no branding, no call to action, just the four facts worth knowing and a link
 * to the numbers. `Reply-To` is not set — the new user's address is in the body
 * to be copied deliberately, rather than one stray reply away.
 */
export function signupNotificationEmail(user: {
  name: string;
  email: string;
  role: string | null;
}): Pick<EmailMessage, "subject" | "html" | "text"> {
  const url = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const metrics = `${url.replace(/\/$/, "")}/admin`;
  const role = user.role ?? "not given";

  const subject = `New ${SITE_NAME} sign-up: ${user.email}`;

  const text = [
    `${user.name} just created a ${SITE_NAME} account.`,
    "",
    `Name:  ${user.name}`,
    `Email: ${user.email}`,
    `Role:  ${role}`,
    "",
    `All the numbers: ${metrics}`,
  ].join("\n");

  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:4px 16px 4px 0;font-size:14px;color:#777777;">${label}</td>
       <td style="padding:4px 0;font-size:14px;color:#111111;">${escapeHtml(value)}</td>
     </tr>`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111111;">
        New sign-up
      </h1>
      <table style="border-collapse:collapse;margin:0 0 24px;">
        ${row("Name", user.name)}
        ${row("Email", user.email)}
        ${row("Role", role)}
      </table>
      <a href="${metrics}" style="font-size:14px;color:#111111;">View all metrics</a>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * The "someone downloaded" note to the operator.
 *
 * One email per download, which is right at current volume and will not be
 * forever. If this starts arriving more often than it is useful, the fix is a
 * daily digest rather than silently dropping some — an operator who stops
 * trusting the notifications is worse off than one who gets none.
 *
 * `runningTotal` turns each message into a running count, so the volume itself
 * carries information rather than just being noise.
 */
export function downloadNotificationEmail(info: {
  email: string;
  platform: string;
  hasAccount: boolean;
  runningTotal: number;
}): Pick<EmailMessage, "subject" | "html" | "text"> {
  const url = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const metrics = `${url.replace(/\/$/, "")}/admin`;
  const who = info.hasAccount ? "an account holder" : "no account";

  const subject = `${SITE_NAME} download #${info.runningTotal}: ${info.platform}`;

  const text = [
    `${info.email} downloaded ${SITE_NAME} for ${info.platform}.`,
    "",
    `Email:    ${info.email}`,
    `Platform: ${info.platform}`,
    `Account:  ${who}`,
    `Total:    ${info.runningTotal} downloads so far`,
    "",
    `All the numbers: ${metrics}`,
  ].join("\n");

  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:4px 16px 4px 0;font-size:14px;color:#777777;">${label}</td>
       <td style="padding:4px 0;font-size:14px;color:#111111;">${escapeHtml(value)}</td>
     </tr>`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111111;">
        New download
      </h1>
      <table style="border-collapse:collapse;margin:0 0 24px;">
        ${row("Email", info.email)}
        ${row("Platform", info.platform)}
        ${row("Account", who)}
        ${row("Total", `${info.runningTotal} downloads`)}
      </table>
      <a href="${metrics}" style="font-size:14px;color:#111111;">View all metrics</a>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * The thank-you sent to the person who downloaded.
 *
 * Unlike the admin notifications this one is read by a customer, so it is
 * written as a note from a person rather than a receipt. The From address is
 * already `angie@scamp.club`, so a reply lands in a real inbox with no
 * Reply-To needed — and the body says so, because "do not reply" is the default
 * assumption with anything automated.
 *
 * The account paragraph is omitted for people who already have one. Being asked
 * to sign up for something you are already signed up for is the fastest way to
 * make an email feel machine-generated.
 */
export function downloadThankYouEmail(info: {
  platform: string;
  hasAccount: boolean;
}): Pick<EmailMessage, "subject" | "html" | "text"> {
  const url = (process.env.BETTER_AUTH_URL ?? SITE_URL).replace(/\/$/, "");
  const docs = `${url}/docs`;
  const signUp = `${url}/sign-up`;

  const subject = `Thanks for downloading ${SITE_NAME}`;

  const text = [
    `Thanks for downloading ${SITE_NAME} for ${info.platform}.`,
    "",
    `It is free, with no feature limits, and your projects stay on your`,
    `machine as real TSX and CSS files.`,
    "",
    `If you are not sure where to start, the docs are here:`,
    docs,
    ...(info.hasAccount
      ? []
      : [
          "",
          `You do not need an account to use ${SITE_NAME}, but creating one keeps`,
          `your downloads in one place and gets you Scamp Cloud when it launches:`,
          signUp,
        ]),
    "",
    `If anything is confusing, broken, or missing, I would genuinely like to`,
    `hear about it. Just reply to this email — it comes to me — or write to`,
    `angie@scamp.club.`,
    "",
    "Angie",
  ].join("\n");

  const para =
    "margin:0 0 16px;font-size:15px;line-height:1.6;color:#444444;";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111111;">
        Thanks for downloading ${SITE_NAME}
      </h1>

      <p style="${para}">
        You have ${SITE_NAME} for ${escapeHtml(info.platform)}. It is free with no
        feature limits, and your projects stay on your machine as real TSX and
        CSS files.
      </p>

      <p style="${para}">
        Not sure where to start?
        <a href="${docs}" style="color:#111111;">Read the docs</a>.
      </p>

      ${
        info.hasAccount
          ? ""
          : `<p style="${para}">
        You do not need an account to use it, but
        <a href="${signUp}" style="color:#111111;">creating one</a> keeps your
        downloads in one place and gets you Scamp Cloud when it launches.
      </p>`
      }

      <p style="${para}">
        If anything is confusing, broken, or missing, I would genuinely like to
        hear about it. Just reply to this email — it comes to me — or write to
        <a href="mailto:angie@scamp.club" style="color:#111111;">angie@scamp.club</a>.
      </p>

      <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#444444;">
        Angie
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * User-supplied values land in the notification's HTML, so they are escaped.
 * The name and role come from sign-up input; nothing stops someone signing up
 * as `<script>…`, and the one place that markup would run is the operator's own
 * mail client.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
