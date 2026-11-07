import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendNotificationEmail } from './email-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

async function main() {
  console.log('--- Testing SMTP Automated Email Notification ---');
  console.log('Recipient: priyank.saxena.dev@gmail.com');
  console.log('Timezone: Asia/Kolkata');

  try {
    const result = await sendNotificationEmail({
      itemName: 'Client Project Alpha Milestone',
      itemType: 'task',
      projectName: 'Personal Portfolio & SaaS Launch',
      deadlineDate: '2026-11-09',
      priority: 'Critical',
      status: 'pending',
      reminderType: 'two_days_before',
      recipient: process.env.NOTIFICATION_RECIPIENT || 'priyank.saxena.dev@gmail.com'
    });

    console.log('Test notification sent successfully!');
    if (result.previewUrl) {
      console.log('Preview Email at:', result.previewUrl);
    }
  } catch (err) {
    console.error('Failed to send test email:', err.message);
  }
}

main();
