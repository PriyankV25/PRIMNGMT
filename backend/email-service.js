import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

let transporter = null;

/**
 * Initialize or get Nodemailer SMTP transporter
 */
export async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    console.log(`[Email] Configuring SMTP with host: ${host}:${port} (secure: ${secure})`);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.SMTP_ALLOW_INVALID_CERTS !== 'true'
      }
    });
  } else {
    // Development fallback using Ethereal test account or local mock
    console.log('[Email] No SMTP credentials in .env. Creating test Ethereal SMTP transporter...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('[Email] Ethereal test account created:', testAccount.user);
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      transporter.__isEthereal = true;
    } catch (err) {
      console.warn('[Email] Could not create Ethereal account, falling back to direct JSON transport:', err.message);
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      transporter.__isJson = true;
    }
  }

  return transporter;
}

/**
 * Generate a modern, responsive HTML email template for notifications
 */
export function buildNotificationEmailHtml({
  itemName,
  itemType,
  deadlineDate,
  priority,
  status,
  projectName = null,
  reminderType, // 'two_days_before' | 'overdue'
  daysOverdue = 0,
  dashboardUrl = process.env.APP_URL || 'http://localhost:3000'
}) {
  const isOverdue = reminderType === 'overdue';
  const headerBg = isOverdue
    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
    : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
  const badgeColor = isOverdue ? '#fef2f2' : '#eef2ff';
  const badgeTextColor = isOverdue ? '#b91c1c' : '#4338ca';
  const statusHeadline = isOverdue
    ? `⚠️ Action Required: Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`
    : `⏰ Upcoming Deadline in 2 Days`;

  const priorityColors = {
    Critical: '#dc2626',
    High: '#ea580c',
    Medium: '#ca8a04',
    Low: '#16a34a'
  };
  const priorityColor = priorityColors[priority] || '#4f46e5';

  const typeLabels = {
    project: 'Project',
    task: 'Project Task',
    daily_todo: 'Daily To-Do',
    weekly_todo: 'Weekly To-Do',
    monthly_todo: 'Monthly To-Do'
  };
  const formattedType = typeLabels[itemType] || itemType;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusHeadline}: ${itemName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); }
    .header { background: ${headerBg}; padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .body { padding: 32px 28px; }
    .alert-banner { background-color: ${badgeColor}; color: ${badgeTextColor}; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 24px; text-align: center; }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .item-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px; }
    .meta-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-value { font-weight: 600; color: #1e293b; }
    .pill { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .reminder-message { font-size: 14px; color: #475569; margin: 20px 0; background: #ffffff; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 0 8px 8px 0; }
    .cta-container { text-align: center; margin: 28px 0 12px 0; }
    .cta-btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3); }
    .footer { text-align: center; padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Personal Project Flow</h1>
      <p>Automated Deadline & Productivity Reminder</p>
    </div>
    <div class="body">
      <div class="alert-banner">
        ${statusHeadline}
      </div>

      <div class="card">
        <div class="item-title">${escapeHtml(itemName)}</div>

        <div class="meta-row">
          <span class="meta-label">Item Type:</span>
          <span class="meta-value">${formattedType}</span>
        </div>

        ${projectName ? `
        <div class="meta-row">
          <span class="meta-label">Associated Project:</span>
          <span class="meta-value">${escapeHtml(projectName)}</span>
        </div>
        ` : ''}

        <div class="meta-row">
          <span class="meta-label">Priority:</span>
          <span class="meta-value" style="color: ${priorityColor}; font-weight: 700;">${priority || 'Medium'}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Deadline Date:</span>
          <span class="meta-value" style="color: ${isOverdue ? '#dc2626' : '#1e293b'}; font-weight: 700;">${deadlineDate} (Asia/Kolkata)</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Current Status:</span>
          <span class="meta-value">${status || 'Pending'}</span>
        </div>
      </div>

      <div class="reminder-message">
        ${isOverdue 
          ? `<strong>Notice:</strong> This item is past its scheduled deadline and is marked as incomplete. Reminders will continue daily until this item is marked as completed in your dashboard.`
          : `<strong>Notice:</strong> This item is due in exactly 2 days. Please review your task progress and update your dashboard accordingly.`
        }
      </div>

      <div class="cta-container">
        <a href="${dashboardUrl}" class="cta-btn" target="_blank">Open Personal Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>Automated notification sent to <strong>priyank.saxena.dev@gmail.com</strong></p>
      <p>Recipient: ${process.env.NOTIFICATION_RECIPIENT || 'priyank.saxena.dev@gmail.com'} • Timezone: Asia/Kolkata (IST)</p>
      <p>© ${new Date().getFullYear()} Personal Project Management Platform. Exclusively for individual use.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send an automated reminder email using SMTP
 */
export async function sendNotificationEmail(options) {
  const mailTransporter = await getTransporter();
  const recipient = options.recipient || process.env.NOTIFICATION_RECIPIENT || 'priyank.saxena.dev@gmail.com';
  const from = process.env.SMTP_FROM || '"Personal Project Flow" <notifications@projectflow.local>';

  const isOverdue = options.reminderType === 'overdue';
  const subjectPrefix = isOverdue ? '⚠️ [OVERDUE]' : '⏰ [REMINDER 2-DAYS]';
  const subject = `${subjectPrefix} ${options.itemName} (Due: ${options.deadlineDate})`;

  const html = buildNotificationEmailHtml(options);

  const mailOptions = {
    from,
    to: recipient,
    subject,
    html,
    text: `${isOverdue ? 'OVERDUE' : 'REMINDER'}: ${options.itemName}\nType: ${options.itemType}\nDeadline: ${options.deadlineDate}\nPriority: ${options.priority}\nPlease complete this item on your dashboard.`
  };

  const info = await mailTransporter.sendMail(mailOptions);
  console.log(`[Email Sent] MessageId: ${info.messageId} to ${recipient}`);

  if (mailTransporter.__isEthereal && nodemailer.getTestMessageUrl(info)) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[Email Preview URL] -> ${previewUrl}`);
    return { ...info, previewUrl };
  }

  return info;
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
