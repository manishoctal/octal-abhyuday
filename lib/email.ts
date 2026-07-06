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

export function isSmtpReady(): boolean {
  return isSmtpConfigured();
}

function buildOtpHtml(code: string, eventName: string): string {
  // letter-spacing adds space *after* each character (including the last),
  // so padding-left of the same value re-centers the block visually.
  const OTP_LETTER_SPACING = '12px';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if !mso]><!-->
  <meta name="x-apple-disable-message-reformatting" />
  <!--<![endif]-->
  <title>Your Login Code</title>

  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->

  <style type="text/css">
    /* ── Resets ────────────────────────────────────────────── */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; display: block; height: auto; line-height: 100%; outline: none;
          text-decoration: none; -ms-interpolation-mode: bicubic; }

    /* Prevent Apple/Android from auto-linking phone numbers, dates, addresses */
    a[x-apple-data-detectors],
    .unstyle-auto-detected-links a,
    .aBn { border-bottom: 0 !important; cursor: default !important;
           color: inherit !important; text-decoration: none !important; }

    /* ── Mobile overrides (620px breakpoint) ───────────────── */
    @media only screen and (max-width: 620px) {
      .email-wrapper { padding: 20px 12px !important; }
      .card          { border-radius: 14px !important; }
      .header-cell   { padding: 28px 24px !important; }
      .content-cell  { padding: 28px 24px !important; }
      .footer-cell   { padding: 14px 24px !important; }
      .logo-cell     { width: 48px !important; height: 48px !important;
                       font-size: 22px !important; line-height: 48px !important; border-radius: 12px !important; }
      .otp-span      { font-size: 36px !important; letter-spacing: 8px !important; padding-left: 8px !important; }
      .event-name    { font-size: 22px !important; }
    }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#F1F5F9;word-spacing:normal;">

  <!-- ═══════════════════════════════════════════════════════════
       OUTER WRAPPER — centers email body in all clients
  ════════════════════════════════════════════════════════════ -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    bgcolor="#F1F5F9" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" class="email-wrapper" style="padding:40px 16px;">

        <!-- Ghost table hack: forces Outlook to honor max-width:600px -->
        <!--[if mso]>
        <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="600">
        <tr><td>
        <![endif]-->

        <!-- ═══════════════════════════════════════════════════
             CARD — max 600px, white background
        ════════════════════════════════════════════════════ -->
        <table role="presentation" class="card" align="center" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;
                 overflow:hidden;border-collapse:collapse;">

          <!-- ─── HEADER ──────────────────────────────────────
               background-color is the Outlook fallback (no gradients in Outlook).
               background-image gradient is for all other clients.
          ─────────────────────────────────────────────────── -->
          <tr>
            <td class="header-cell" align="center" valign="top"
              style="padding:36px 40px;background-color:#0F1035;
                     background-image:linear-gradient(135deg,#0F1035 0%,#1E1B4B 100%);
                     text-align:center;">

              <!-- Logo badge ("A") -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
                style="margin:0 auto 16px auto;">
                <tr>
                  <!-- background-color #FF7A00 is Outlook fallback; gradient for others -->
                  <td class="logo-cell" align="center" valign="middle"
                    style="width:56px;height:56px;background-color:#FF7A00;
                           border-radius:14px;font-size:26px;font-weight:900;
                           color:#ffffff;font-family:Arial,Helvetica,sans-serif;
                           line-height:56px;text-align:center;">
                    A
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;
                         font-weight:400;color:rgba(255,255,255,0.55);letter-spacing:2.5px;
                         text-transform:uppercase;mso-line-height-rule:exactly;">
                Octal IT Solution LLP presents
              </p>
              <p class="event-name"
                style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;
                       font-weight:900;color:#FF7A00;letter-spacing:-0.5px;
                       mso-line-height-rule:exactly;">
                ${eventName}
              </p>
            </td>
          </tr>

          <!-- ─── BODY ─────────────────────────────────────── -->
          <tr>
            <td class="content-cell" style="padding:36px 40px;background-color:#ffffff;">

              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;
                         color:#475569;mso-line-height-rule:exactly;">
                Hi there,
              </p>
              <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;
                         color:#475569;line-height:1.55;mso-line-height-rule:exactly;">
                Here is your one-time login code for
                <strong style="color:#0F172A;font-weight:700;">${eventName}</strong>:
              </p>

              <!-- OTP box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center"
                    style="padding:22px 20px;background-color:#FFF4E8;
                           border-radius:14px;border:2px solid #FF7A00;">
                    <!--
                      white-space:nowrap   → prevents OTP digits wrapping on narrow views
                      padding-left         → compensates letter-spacing trailing gap on last digit
                      Courier New          → monospace keeps digit widths uniform
                    -->
                    <span class="otp-span"
                      style="display:inline-block;
                             font-family:'Courier New',Courier,'Lucida Console',monospace;
                             font-size:44px;font-weight:900;color:#0F172A;
                             letter-spacing:${OTP_LETTER_SPACING};white-space:nowrap;
                             padding-left:${OTP_LETTER_SPACING};mso-line-height-rule:exactly;">
                      ${code}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Validity note -->
              <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;
                         color:#94A3B8;text-align:center;mso-line-height-rule:exactly;">
                Valid for <strong style="color:#FF7A00;font-weight:700;">5 minutes</strong>
                &nbsp;&middot;&nbsp;
                Do not share this code with anyone
              </p>

              <!-- Security disclaimer (separated by a hairline) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top:20px;border-top:1px solid #F1F5F9;margin-top:20px;">
                    <!-- mso margin-top workaround: use padding on a table cell instead -->
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
                               color:#94A3B8;text-align:center;line-height:1.5;
                               mso-line-height-rule:exactly;">
                      If you didn&rsquo;t request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ─── FOOTER ────────────────────────────────────── -->
          <tr>
            <td class="footer-cell" align="center"
              style="padding:16px 40px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
                         color:#64748B;line-height:1.5;mso-line-height-rule:exactly;">
                Octal IT Solution LLP &nbsp;&middot;&nbsp; Internal Event Platform
              </p>
            </td>
          </tr>

        </table>
        <!-- /card -->

        <!--[if mso]></td></tr></table><![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Returns true if email was sent, false if SMTP is not configured. */
export async function sendOtpEmail(email: string, code: string, eventName: string): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.log(`[OTP] ${email} → ${code} (SMTP not configured; set SMTP_HOST/USER/PASS to send real emails)`);
    return false;
  }
  const from      = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  const transport = createTransport();
  await transport.sendMail({
    from,
    to:      email,
    // OTP intentionally excluded from subject — do not add it back.
    subject: `Your ${eventName} Login Code`,
    text:    `Your one-time login code for ${eventName} is: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone.\n\nIf you didn't request this code, you can safely ignore this email.`,
    html:    buildOtpHtml(code, eventName),
  });
  return true;
}
