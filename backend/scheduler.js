import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendNotificationEmail } from './email-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_RECIPIENT = process.env.NOTIFICATION_RECIPIENT || 'priyank.saxena.dev@gmail.com';


if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '[Scheduler] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

if (!DEFAULT_RECIPIENT) {
  throw new Error(
    '[Scheduler] Missing NOTIFICATION_RECIPIENT environment variable.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

/**
 * Get current date string formatted in YYYY-MM-DD for Asia/Kolkata
 */
export function getKolkataDate(offsetDays = 0, baseDate = new Date()) {
  const dateObj = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(dateObj); // Returns YYYY-MM-DD
}

/**
 * Calculate difference in days between two YYYY-MM-DD dates
 */
export function getDaysDifference(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00Z');
  const d2 = new Date(dateStr2 + 'T00:00:00Z');
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a notification was already sent
 */
async function hasNotificationBeenSent(itemId, notificationType, referenceDate) {
  const { data, error } = await supabase
    .from('email_notification_logs')
    .select('id')
    .eq('item_id', itemId)
    .eq('notification_type', notificationType)
    .eq('reference_date', referenceDate)
    .maybeSingle();

  if (error) {
    console.error(`[Scheduler] Error checking notification log for ${itemId}:`, error.message);
    return false;
  }
  return !!data;
}

/**
 * Log notification delivery into Supabase email_notification_logs table
 */
async function logNotificationDelivery({
  userId,
  itemId,
  itemType,
  itemName,
  notificationType,
  recipientEmail,
  referenceDate,
  status = 'sent'
}) {
  const { error } = await supabase
    .from('email_notification_logs')
    .insert({
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      item_name: itemName,
      notification_type: notificationType,
      recipient_email: recipientEmail,
      reference_date: referenceDate,
      status
    });

  if (error) {
    // If unique constraint violation, it was already logged
    if (error.code === '23505') {
      console.log(`[Scheduler] Notification log already exists for item ${itemId} (${notificationType})`);
      return;
    }
    console.error(`[Scheduler] Error logging notification for ${itemId}:`, error.message);
  }
}

/**
 * Main job to process deadline notifications
 */
export async function processAutomatedNotifications() {
  console.log(`\n======================================================`);
  console.log(`[Scheduler] Running automated email notifications job`);
  console.log(`[Scheduler] Timezone: Asia/Kolkata`);
  const todayKolkata = getKolkataDate(0);
  const targetDate2DaysBefore = getKolkataDate(2);
  console.log(`[Scheduler] Today (Asia/Kolkata): ${todayKolkata}`);
  console.log(`[Scheduler] 2-Day Deadline Target Date: ${targetDate2DaysBefore}`);
  console.log(`[Scheduler] Default Recipient: ${DEFAULT_RECIPIENT}`);
  console.log(`======================================================\n`);

  let totalProcessed = 0;
  let totalSent = 0;

  // --------------------------------------------------------------------------
  // 1. Process Projects
  // --------------------------------------------------------------------------
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, user_id, name, target_date, priority, status')
    .neq('status', 'completed')
    .neq('status', 'Completed');

  if (projectsError) {
    console.error('[Scheduler] Error fetching projects:', projectsError.message);
  } else if (projects) {
    for (const project of projects) {
      totalProcessed++;
      const deadline = project.target_date;
      if (!deadline) continue;

      // Rule 1: Exactly 2 days before deadline
      if (deadline === targetDate2DaysBefore) {
        const alreadySent = await hasNotificationBeenSent(project.id, 'two_days_before', deadline);
        if (!alreadySent) {
          console.log(`[Scheduler] Sending 2-day reminder for Project: "${project.name}" (Due: ${deadline})`);
          try {
            await sendNotificationEmail({
              itemName: project.name,
              itemType: 'project',
              deadlineDate: deadline,
              priority: project.priority,
              status: project.status,
              reminderType: 'two_days_before',
              recipient: DEFAULT_RECIPIENT
            });
            await logNotificationDelivery({
              userId: project.user_id,
              itemId: project.id,
              itemType: 'project',
              itemName: project.name,
              notificationType: 'two_days_before',
              recipientEmail: DEFAULT_RECIPIENT,
              referenceDate: deadline
            });
            totalSent++;
          } catch (err) {
            console.error(`[Scheduler] Failed sending email for project ${project.id}:`, err.message);
          }
        }
      }

      // Rule 4: Overdue reminders (target_date < today and not completed)
      if (deadline < todayKolkata) {
        const daysOverdue = getDaysDifference(todayKolkata, deadline);
        const alreadySentToday = await hasNotificationBeenSent(project.id, 'overdue', todayKolkata);
        if (!alreadySentToday) {
          console.log(`[Scheduler] Sending Overdue reminder for Project: "${project.name}" (Due: ${deadline}, ${daysOverdue}d overdue)`);
          try {
            await sendNotificationEmail({
              itemName: project.name,
              itemType: 'project',
              deadlineDate: deadline,
              priority: project.priority,
              status: project.status,
              reminderType: 'overdue',
              daysOverdue,
              recipient: DEFAULT_RECIPIENT
            });
            await logNotificationDelivery({
              userId: project.user_id,
              itemId: project.id,
              itemType: 'project',
              itemName: project.name,
              notificationType: 'overdue',
              recipientEmail: DEFAULT_RECIPIENT,
              referenceDate: todayKolkata
            });
            totalSent++;
          } catch (err) {
            console.error(`[Scheduler] Failed sending overdue email for project ${project.id}:`, err.message);
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Process Project Tasks
  // --------------------------------------------------------------------------
  const { data: tasks, error: tasksError } = await supabase
    .from('project_tasks')
    .select('id, user_id, project_id, name, target_date, priority, status, projects(name)')
    .neq('status', 'completed');

  if (tasksError) {
    console.error('[Scheduler] Error fetching tasks:', tasksError.message);
  } else if (tasks) {
    for (const task of tasks) {
      totalProcessed++;
      const deadline = task.target_date;
      if (!deadline) continue;
      const projectName = task.projects?.name || 'Project';

      // Rule 2: Exactly 2 days before deadline
      if (deadline === targetDate2DaysBefore) {
        const alreadySent = await hasNotificationBeenSent(task.id, 'two_days_before', deadline);
        if (!alreadySent) {
          console.log(`[Scheduler] Sending 2-day reminder for Task: "${task.name}" in "${projectName}" (Due: ${deadline})`);
          try {
            await sendNotificationEmail({
              itemName: task.name,
              itemType: 'task',
              projectName,
              deadlineDate: deadline,
              priority: task.priority,
              status: task.status,
              reminderType: 'two_days_before',
              recipient: DEFAULT_RECIPIENT
            });
            await logNotificationDelivery({
              userId: task.user_id,
              itemId: task.id,
              itemType: 'task',
              itemName: task.name,
              notificationType: 'two_days_before',
              recipientEmail: DEFAULT_RECIPIENT,
              referenceDate: deadline
            });
            totalSent++;
          } catch (err) {
            console.error(`[Scheduler] Failed sending email for task ${task.id}:`, err.message);
          }
        }
      }

      // Rule 4: Overdue reminders
      if (deadline < todayKolkata) {
        const daysOverdue = getDaysDifference(todayKolkata, deadline);
        const alreadySentToday = await hasNotificationBeenSent(task.id, 'overdue', todayKolkata);
        if (!alreadySentToday) {
          console.log(`[Scheduler] Sending Overdue reminder for Task: "${task.name}" (${daysOverdue}d overdue)`);
          try {
            await sendNotificationEmail({
              itemName: task.name,
              itemType: 'task',
              projectName,
              deadlineDate: deadline,
              priority: task.priority,
              status: task.status,
              reminderType: 'overdue',
              daysOverdue,
              recipient: DEFAULT_RECIPIENT
            });
            await logNotificationDelivery({
              userId: task.user_id,
              itemId: task.id,
              itemType: 'task',
              itemName: task.name,
              notificationType: 'overdue',
              recipientEmail: DEFAULT_RECIPIENT,
              referenceDate: todayKolkata
            });
            totalSent++;
          } catch (err) {
            console.error(`[Scheduler] Failed sending overdue email for task ${task.id}:`, err.message);
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Process To-Dos (Daily, Weekly, Monthly)
  // --------------------------------------------------------------------------
  const { data: todos, error: todosError } = await supabase
    .from('todos')
    .select('id, user_id, title, type, target_date, priority, status')
    .neq('status', 'completed');

  if (todosError) {
    console.error('[Scheduler] Error fetching todos:', todosError.message);
  } else if (todos) {
    for (const todo of todos) {
      totalProcessed++;
      const deadline = todo.target_date;
      if (!deadline) continue;
      const itemType = `${todo.type}_todo`;

      // Rule 3: Exactly 2 days before deadline
      if (deadline === targetDate2DaysBefore) {
        const alreadySent = await hasNotificationBeenSent(todo.id, 'two_days_before', deadline);
        if (!alreadySent) {
          console.log(`[Scheduler] Sending 2-day reminder for To-Do: "${todo.title}" (${todo.type}) (Due: ${deadline})`);
          try {
            await sendNotificationEmail({
              itemName: todo.title,
              itemType,
              deadlineDate: deadline,
              priority: todo.priority,
              status: todo.status,
              reminderType: 'two_days_before',
              recipient: DEFAULT_RECIPIENT
            });
            await logNotificationDelivery({
              userId: todo.user_id,
              itemId: todo.id,
              itemType,
              itemName: todo.title,
              notificationType: 'two_days_before',
              recipientEmail: DEFAULT_RECIPIENT,
              referenceDate: deadline
            });
            totalSent++;
          } catch (err) {
            console.error(`[Scheduler] Failed sending email for todo ${todo.id}:`, err.message);
          }
        }
      }

      // Rule 4: Overdue reminders
      if (deadline < todayKolkata) {
        const daysOverdue = getDaysDifference(todayKolkata, deadline);
        const alreadySentToday = await hasNotificationBeenSent(todo.id, 'overdue', todayKolkata);
        if (!alreadySentToday) {
          console.log(`[Scheduler] Sending Overdue reminder for To-Do: "${todo.title}" (${daysOverdue}d overdue)`);
          try {
            await sendNotificationEmail({
              itemName: todo.title,
              itemType,
              deadlineDate: deadline,
              priority: todo.priority,
              status: todo.status,
              reminderType: 'overdue',
              daysOverdue,
              recipient: DEFAULT_RECIPIENT
            });
            await logNotificationDelivery({
              userId: todo.user_id,
              itemId: todo.id,
              itemType,
              itemName: todo.title,
              notificationType: 'overdue',
              recipientEmail: DEFAULT_RECIPIENT,
              referenceDate: todayKolkata
            });
            totalSent++;
          } catch (err) {
            console.error(`[Scheduler] Failed sending overdue email for todo ${todo.id}:`, err.message);
          }
        }
      }
    }
  }

  console.log(`\n[Scheduler] Execution completed. Processed ${totalProcessed} active items, Sent ${totalSent} reminder emails.`);
  return { totalProcessed, totalSent };
}

// --------------------------------------------------------------------------
// CLI Invocation & Cron Setup
// --------------------------------------------------------------------------
const isMainScript = process.argv[1] && (process.argv[1].endsWith('scheduler.js') || process.argv[1].includes('scheduler'));
const isRunNow = process.argv.includes('--run-now');

if (isMainScript) {
  if (isRunNow) {
    processAutomatedNotifications()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('[Scheduler Fatal Error]:', err);
        process.exit(1);
      });
  } else {
    // Cron schedule: Run once daily at 09:00 AM IST (Asia/Kolkata)
    console.log('[Scheduler] Initializing cron job: Runs daily at 09:00:00 AM IST (Asia/Kolkata)');
    cron.schedule('0 9 * * *', async () => {
      console.log('[Scheduler] Cron trigger activated at:', new Date().toISOString());
      await processAutomatedNotifications();
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Also run an immediate check on startup so pending/overdue notifications are dispatched
    console.log('[Scheduler] Running initial startup check...');
    processAutomatedNotifications().catch(console.error);
  }
}

