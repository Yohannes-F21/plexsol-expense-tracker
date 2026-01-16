import nodemailer from "nodemailer";

export type SendInviteEmailParams = {
  to: string;
  inviteUrl: string;
  organizationName: string;
  role: "ORG_ADMIN" | "STAFF";
  expiresAt?: Date | null;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getSmtpConfig() {
  const host = getRequiredEnv("EMAIL_HOST");
  const portRaw = process.env.EMAIL_PORT ?? "587";
  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    throw new Error(`Invalid EMAIL_PORT: ${portRaw}`);
  }

  const secure = (process.env.EMAIL_SECURE ?? "false").toLowerCase() === "true";
  const user = getRequiredEnv("EMAIL_USER");
  const pass = getRequiredEnv("EMAIL_PASS");
  const fromEmail = process.env.EMAIL_FROM ?? user;

  return { host, port, secure, user, pass, fromEmail };
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const { host, port, secure, user, pass } = getSmtpConfig();

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransport;
}

function formatExpiry(expiresAt?: Date | null) {
  if (!expiresAt) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(expiresAt);
  } catch {
    return expiresAt.toISOString();
  }
}

export async function sendInviteEmail({
  to,
  inviteUrl,
  organizationName,
  role,
  expiresAt,
}: SendInviteEmailParams) {
  const { fromEmail } = getSmtpConfig();
  const transport = getTransport();

  const subject = `You\u2019ve been invited to join ${organizationName}`;
  const expiryText = formatExpiry(expiresAt);

  const textLines = [
    "Hello,",
    "",
    `You have been invited to join ${organizationName} as ${role.replace(
      "_",
      " "
    )}.`,
    "",
    "To accept the invitation, use the link below:",
    inviteUrl,
    "",
  ];

  if (expiryText) {
    textLines.push(`This link expires on ${expiryText}.`, "");
  }

  textLines.push(
    "If you were not expecting this invitation, you can safely ignore this email.",
    "",
    "Regards,",
    "Plexsol Technologies"
  );

  const text = textLines.join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
      <p>Hello,</p>
      <p>
        You have been invited to join <strong>${escapeHtml(
          organizationName
        )}</strong> as <strong>${escapeHtml(role.replace("_", " "))}</strong>.
      </p>
      <p>To accept the invitation, click the link below:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      ${
        expiryText
          ? `<p style="color: #6b7280;">This link expires on ${escapeHtml(
              expiryText
            )}.</p>`
          : ""
      }
      <p style="color: #6b7280;">If you were not expecting this invitation, you can safely ignore this email.</p>
      <p>Regards,<br/>Plexsol Technologies</p>
    </div>
  `.trim();

  await transport.sendMail({
    from: {
      name: "Plexsol Technologies",
      address: fromEmail,
    },
    to,
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
