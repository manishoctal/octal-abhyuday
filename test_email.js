/**
 * SMTP connection test — run with: node test_email.js
 *
 * Edit the CONFIG block below to match your .env settings,
 * or set the environment variables before running:
 *   SMTP_HOST=... SMTP_USER=... SMTP_PASS=... node test_email.js
 */

const nodemailer = require('nodemailer');

const CONFIG = {
  host:   process.env.SMTP_HOST   || 'smtpout.secureserver.net',
  port:   Number(process.env.SMTP_PORT   || 465),
  secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : true,
  user:   process.env.SMTP_USER   || 'newsletter@octaldev.com',
  pass:   process.env.SMTP_PASS   || 'octal#321',
  from:   process.env.SMTP_FROM   || 'newsletter@octaldev.com',
  to:     process.env.SMTP_TO     || 'manish.prajapati@octalsoftware.com',
};

console.log('\n=== SMTP Test ===');
console.log(`Host   : ${CONFIG.host}`);
console.log(`Port   : ${CONFIG.port}`);
console.log(`Secure : ${CONFIG.secure}`);
console.log(`User   : ${CONFIG.user}`);
console.log(`Pass   : ${'*'.repeat(CONFIG.pass.length)} (${CONFIG.pass.length} chars)`);
console.log(`From   : ${CONFIG.from}`);
console.log(`To     : ${CONFIG.to}`);
console.log('');

const transporter = nodemailer.createTransport({
  host:   CONFIG.host,
  port:   CONFIG.port,
  secure: CONFIG.secure,
  auth: {
    user: CONFIG.user,
    pass: CONFIG.pass,
  },
});

(async () => {
  // Step 1: verify connection
  console.log('Step 1 — verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ Connection OK — credentials accepted\n');
  } catch (err) {
    console.error('❌ Connection FAILED:', err.message);
    console.error('\nCommon causes:');
    console.error('  535 Authentication Failed → wrong password (reset in GoDaddy email panel)');
    console.error('  ECONNREFUSED / timeout    → wrong host or port');
    console.error('  ESOCKET                   → port 465 blocked; try port 587 with secure:false');
    process.exit(1);
  }

  // Step 2: send a test email
  console.log(`Step 2 — sending test email to ${CONFIG.to}...`);
  try {
    const info = await transporter.sendMail({
      from:    CONFIG.from,
      to:      CONFIG.to,
      subject: 'SMTP Test — Abhyuday',
      text:    'This is a test email sent from test_email.js to verify the SMTP configuration.',
      html:    '<p>This is a test email sent from <code>test_email.js</code> to verify the SMTP configuration.</p>',
    });
    console.log('✅ Email sent!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response  :', info.response);
  } catch (err) {
    console.error('❌ Send FAILED:', err.message);
    process.exit(1);
  }
})();
