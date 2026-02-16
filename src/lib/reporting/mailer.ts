import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

type SendParentEmailInput = {
  to: string;
  subject: string;
  bodyText: string;
};

type SendParentEmailResult = {
  messageId: string;
  transport: "smtp" | "outbox";
};

const OUTBOX_ROOT = path.join(process.cwd(), "storage", "outbox");

function sanitizeFileName(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized || "email";
}

function shouldSimulateFailure(recipient: string) {
  const pattern = process.env.EMAIL_SIMULATE_FAILURE_PATTERN?.trim();

  if (!pattern) {
    return false;
  }

  return recipient.toLocaleLowerCase("en-US").includes(pattern.toLocaleLowerCase("en-US"));
}

function isPlaceholderConfig(value: string) {
  const normalized = value.toLocaleLowerCase("en-US").trim();
  return (
    normalized.includes("example.com") ||
    normalized.includes("replace-with") ||
    normalized.includes("changeme")
  );
}

async function writeToOutbox(input: SendParentEmailInput): Promise<SendParentEmailResult> {
  await fs.mkdir(OUTBOX_ROOT, { recursive: true });

  const fileName = `${Date.now()}-${sanitizeFileName(input.to)}-${randomUUID()}.txt`;
  const fullPath = path.join(OUTBOX_ROOT, fileName);

  await fs.writeFile(
    fullPath,
    [
      `to: ${input.to}`,
      `subject: ${input.subject}`,
      "",
      input.bodyText
    ].join("\n"),
    "utf-8"
  );

  return {
    messageId: `outbox:${fileName}`,
    transport: "outbox"
  };
}

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim();
  const portValue = process.env.SMTP_PORT?.trim();
  const port = portValue ? Number(portValue) : 0;

  if (!host || !user || !pass || !from || !Number.isInteger(port) || port <= 0) {
    return null;
  }

  if (
    isPlaceholderConfig(host) ||
    isPlaceholderConfig(user) ||
    isPlaceholderConfig(pass) ||
    isPlaceholderConfig(from)
  ) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from
  };
}

async function sendViaSmtp(config: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}, input: SendParentEmailInput): Promise<SendParentEmailResult> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  const result = await transport.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.bodyText
  });

  return {
    messageId: result.messageId,
    transport: "smtp"
  };
}

export async function sendParentSummaryEmail(
  input: SendParentEmailInput
): Promise<SendParentEmailResult> {
  if (shouldSimulateFailure(input.to)) {
    throw new Error(`Simulated email dispatch failure for recipient: ${input.to}`);
  }

  const config = smtpConfig();

  if (!config) {
    return writeToOutbox(input);
  }

  return sendViaSmtp(config, input);
}
