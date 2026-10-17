/**
 * Envío de correos (enlace mágico, recuperar contraseña, aviso de vencimiento).
 * Se activa con SMTP_URL; sin ella, en desarrollo el correo se imprime en la
 * consola y en producción las funciones que dependen del correo se ocultan.
 */
import { appUrl } from "./config";

export const emailEnabled = () => !!process.env.SMTP_URL?.trim();

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  const smtp = process.env.SMTP_URL?.trim();
  if (!smtp) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[correo de desarrollo] Para: ${mail.to}\nAsunto: ${mail.subject}\n\n${mail.text}\n`);
      return;
    }
    throw new Error("No hay SMTP_URL configurado: no se puede enviar correo.");
  }
  const { createTransport } = await import("nodemailer");
  const transport = createTransport(smtp);
  await transport.sendMail({
    from: process.env.EMAIL_FROM?.trim() || `Renglón <no-responder@${new URL(appUrl()).hostname}>`,
    ...mail,
  });
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Correo sencillo con un botón. */
export function actionMail(to: string, subject: string, intro: string, action: string, url: string, outro: string): Mail {
  return {
    to,
    subject,
    text: `${intro}\n\n${action}: ${url}\n\n${outro}\n\n— Renglón`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">
<p>${escape(intro)}</p>
<p><a href="${escape(url)}" style="display:inline-block;background:#c43d2a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${escape(action)}</a></p>
<p style="color:#555">${escape(outro)}</p>
<p style="color:#555">— Renglón</p></div>`,
  };
}
