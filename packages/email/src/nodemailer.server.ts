import nodemailer from "nodemailer";
import { env } from "../../env/src/env.server";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT ? parseInt(env.SMTP_PORT) : 587,
  secure: env.SMTP_PORT === "465",
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  logger: env.NODE_ENV !== "production",
  debug: env.NODE_ENV !== "production",
});

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}) => {
  const fromAddress =
    from ?? `${env.SMTP_FROM || "Starter"} <${env.SMTP_USER}>`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
