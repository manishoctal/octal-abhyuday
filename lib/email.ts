import nodemailer from 'nodemailer';

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

export async function sendOtpEmail(email: string, code: string, eventName: string): Promise<void> {
  if (!isSmtpConfigured()) {
    // Dev fallback: log to console instead of sending
    console.log(`[OTP] ${email} → ${code} (SMTP not configured; set SMTP_HOST/USER/PASS to send real emails)`);
    return;
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  const transport = createTransport();
  await transport.sendMail({
    from: `"${eventName}" <${from}>`,
    to: email,
    subject: `Your ${eventName} login code: ${code}`,
    text: `Your one-time login code for ${eventName} is: ${code}\n\nThis code expires in 5 minutes.\n\nDo not share this code with anyone.`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F6F8FC;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#0F1035,#1E1B4B);padding:32px 36px;text-align:center;">
          <div style="display:inline-block;width:56px;height:56px;background:linear-gradient(135deg,#FF7A00,#FF4F87);border-radius:16px;line-height:56px;text-align:center;font-size:28px;font-weight:900;color:white;margin-bottom:12px;">A</div>
          <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Octal IT Solutions presents</p>
          <h1 style="margin:4px 0 0;color:#FF7A00;font-size:28px;font-weight:900;letter-spacing:-1px;">${eventName}</h1>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="margin:0 0 8px;color:#64748B;font-size:14px;">Your one-time login code is:</p>
          <div style="background:#FFF4E8;border:2px solid #FF7A00;border-radius:16px;text-align:center;padding:20px;margin:16px 0;">
            <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#0F172A;">${code}</span>
          </div>
          <p style="margin:12px 0 0;color:#94A3B8;font-size:13px;text-align:center;">Valid for 5 minutes · Do not share this code</p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:16px 36px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#CBD5E1;font-size:11px;">Octal IT Solutions LLP · Internal Event Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
