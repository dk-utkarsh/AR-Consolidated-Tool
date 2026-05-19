import fs from "node:fs";
import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../../lib/config";

export interface SendOneArgs {
  vendorName: string;
  intendedEmail: string;
  attachmentPath: string;
  attachmentFilename: string;
  recipient: string;
  periodMonthLabel: string;
}

function bodyText(args: SendOneArgs): string {
  const intended = args.intendedEmail || "[no email on file in Zoho Books]";
  return (
    `[TEST DISPATCH]\n` +
    `This email was for - ${intended}\n\n` +
    `Dear Sir/Madam,\n\n` +
    `This is to inform you that TDS has been deducted against the invoices ` +
    `entered in our books during the month of ${args.periodMonthLabel}.\n\n` +
    `The deducted TDS amount will be deposited with the Income Tax Department ` +
    `within the prescribed timeline, and the same will be reflected in your ` +
    `Form 26AS accordingly.\n\n` +
    `Kindly consider the above for your records. In case of any clarification, ` +
    `please feel free to contact us.\n\n` +
    `Regards,\n` +
    `Accounts Team\n` +
    `VASA DENTICITY LIMITED`
  );
}

export function openTransport(): { transport: Transporter; sender: string } {
  const { host, port, user, password, from } = config.mail;
  if (!host || !user || !password) {
    throw new Error("SMTP creds missing (ZOHO_MAIL_HOST/USER/PASSWORD)");
  }
  const secure = port === 465;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
  });
  return { transport, sender: from || user };
}

export async function sendOne(
  transport: Transporter,
  sender: string,
  args: SendOneArgs,
): Promise<void> {
  await transport.sendMail({
    from: sender,
    to: args.recipient,
    subject: "Information Regarding TDS Deduction Against Invoices",
    text: bodyText(args),
    attachments: [
      {
        filename: args.attachmentFilename,
        content: fs.readFileSync(args.attachmentPath),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });
}

export function periodMonthLabel(periodLabel: string): string {
  const m = periodLabel.match(/(\d{1,2})-([A-Za-z]{3,})-(\d{4})/);
  if (!m) return periodLabel;
  const monAbbr = m[2].slice(0, 3).toLowerCase();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const idx = months.indexOf(monAbbr);
  const fullNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (idx < 0) return `${m[2]} ${m[3]}`;
  return `${fullNames[idx]} ${m[3]}`;
}
