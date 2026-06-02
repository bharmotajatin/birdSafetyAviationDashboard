import nodemailer from "nodemailer";

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: "SMTP not configured" as const };
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "safety@birdflightservices.com",
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  return { sent: true as const };
}
