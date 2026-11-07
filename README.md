# FlowCraft: Personal Project Management & Productivity Dashboard

A modern, responsive, web-based **Personal Project Management Application** designed exclusively for individual use. Built with a pure Vanilla JavaScript frontend, Supabase PostgreSQL database with Row Level Security (RLS), and an automated SMTP email reminder engine.

---

## 1. Technology Stack (Strict Requirements)

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+ Modules). No React, Next.js, Vue, Angular, TypeScript, or other frontend frameworks.
- **Backend & Database:** 
  - Supabase PostgreSQL database
  - Supabase Authentication (Email/Password, persistent sessions)
  - Supabase Row Level Security (RLS) on all user-owned tables
- **Email Notifications:** 
  - SMTP-based email notification system via Nodemailer
  - Securely configured SMTP credentials via protected environment variables
  - Automated scheduled execution mechanism running daily anchored to the `Asia/Kolkata` timezone
  - Default notification recipient: `priyank.saxena.dev@gmail.com`

---

## 2. Implemented Core Features

### Feature 1: Project & Task Management
- **Projects:** Create and manage personal projects with Name, Description, Category (Development, Design, Personal, Research, Writing, Finance, General, Other), Priority (Low, Medium, High, Critical), Start Date, and Target/Deadline Date.
- **Project Tasks:** Support multiple tasks per project with Task Name, Task Description, Start Date, Target/Deadline Date, Priority, and Completion Status.
- **Interactive Checklists:** Users can mark tasks as completed with instant progress tracking, timeline calculations, and completion timestamps.
- **Status Synchronization:** Completed projects and tasks automatically record historical entries into Supabase `completion_history`.

### Feature 2: To-Do List Management (Digital Sticky Notes Workspace)
- **Three To-Do Cadences:** Daily To-Dos, Weekly To-Dos, and Monthly To-Dos.
- **Sticky Notes Interface:**
  - Modern card-based sticky note layout with subtle tilt angles (`-1.5deg` to `+1.6deg`) and adhesive tape graphics.
  - Six delicate pastel color swatches: Warm Amber, Sunset Peach, Mint Herbal, Sky Azure, Soft Lavender, Rose Blush.
  - Smooth hover elevation and orientation straightening (`0deg` tilt with elevated drop shadow).
  - Stamped "COMPLETED" watermark badge with strikethrough typography upon completion.
  - Responsive digital pinboard grid layout.

### Feature 3: Monthly Calendar
- **Consolidated Monthly View:** Defaults to current month with `< Prev`, `Next >`, and `Today` quick navigation.
- **Unified Scheduled Activities:** Concurrently displays Projects, Project Tasks, Daily To-Dos, Weekly To-Dos, and Monthly To-Dos.
- **Color-Coded Identifiers:** Distinct badges for Projects (Purple), Tasks (Blue), Daily To-Dos (Green), Weekly To-Dos (Amber), and Monthly To-Dos (Rose).
- **Anti-Overlap Handling:** Displays up to 3 activity pills per date cell plus a `+N more` expander badge.
- **Interactive Modals:** Clicking any day opens the **Day View Drawer** listing all activities on that date; clicking an activity badge displays its full **Activity Detail Modal**.
- **Highlighted Today Marker:** Today's date is accentuated with a primary badge and ring.

### Feature 4: Project Gantt Charts
- **Dedicated Project Visualizations:** Switch between any personal project via the dropdown selector.
- **Master Project Bar & Task Timeline Bars:** Visualizes the full project duration and all subordinate task spans.
- **Three Timeline Zoom Scales:** Daily, Weekly, and Monthly views.
- **Fixed Left Column & Horizontally Scrollable Timeline:** Task names, dates, and priorities remain visible while scrolling through date intervals.
- **Vertical "TODAY" Line:** Red vertical indicator dynamically placed at today's coordinate in the `Asia/Kolkata` timezone.
- **Status & Progress Coloring:** Completed (Emerald Green with checkmark), In Progress (Indigo), and Overdue (Red).

### Feature 5: Automated SMTP Email Notifications
- **Target Recipient:** `priyank.saxena.dev@gmail.com`
- **Notification Rules:**
  1. Exactly **2 days before the deadline** of any personal project.
  2. Exactly **2 days before the deadline** of any project task.
  3. Exactly **2 days before the deadline** of any daily, weekly, or monthly to-do.
  4. If an item remains incomplete after its deadline, sends a daily overdue reminder email every day until marked completed.
  5. Reminders stop immediately once the item is marked as completed in the dashboard.
- **Deduplication & Idempotency:** Tracks deliveries in the Supabase `email_notification_logs` table (`UNIQUE(item_id, notification_type, reference_date)`), preventing duplicate notifications during repeated executions.
- **Professional HTML Email Templates:** Responsive, branded layout with countdown or overdue banners, item metadata, project affiliation, and a direct link to the dashboard.

### Feature 6: Completion Tracking History
- **Persistent Historical Record:** Tracks all completed Projects, Tasks, Daily To-Dos, Weekly To-Dos, and Monthly To-Dos in Supabase `completion_history`.
- **Reverse Chronological Ordering:** Most recently finished activities appear first.
- **Detailed Metrics:** Displays item name, category/type, associated project name, original deadline, actual completion date/timestamp (IST), and timeliness performance badges ("On Time", "X Days Early", "X Days After Deadline").
- **Type Filtering & Search:** Filter by activity type or search by title.

---

## 3. Directory Structure

```
PersonalProjectManagement/
├── index.html                  # Single-Page Application HTML shell
├── server.js                   # Lightweight Node.js local web server
├── package.json                # Project dependencies & automation scripts
├── .env.example                # Template for environment variables
├── .env                        # Active environment configuration
├── README.md                   # Complete documentation & setup instructions
├── css/
│   ├── main.css                # Base layout, typography, sidebar, topbar, theme variables
│   ├── components.css          # Buttons, forms, modals, toasts, badges, tabs
│   ├── auth.css                # Sign In / Sign Up styling
│   ├── dashboard.css           # Metric cards, split overview, quick launch shortcuts
│   ├── projects.css            # Master-detail split, project cards, task checklists
│   ├── todos.css               # Digital sticky notes pinboard, tilt angles, tape graphics
│   ├── calendar.css            # Monthly calendar grid, weekday headers, activity pills
│   ├── gantt.css               # Fixed task column, scrollable timeline, daily/weekly/monthly scales
│   └── history.css             # Reverse chronological activity feed, timeliness badges
├── js/
│   ├── app.js                  # SPA router, view lifecycle & shell state
│   ├── config.js               # Supabase client initialization
│   ├── auth.js                 # Supabase Authentication handler
│   ├── api.js                  # Database CRUD queries with Row Level Security
│   ├── views/
│   │   ├── dashboard.js        # Dashboard metrics & upcoming deadlines
│   │   ├── projects.js         # Projects & tasks manager
│   │   ├── todos.js            # Sticky notes workspace
│   │   ├── calendar.js         # Monthly calendar engine
│   │   ├── gantt.js            # Gantt chart timeline engine
│   │   └── history.js          # Completion tracking history
│   └── utils/
│       ├── date-utils.js       # Asia/Kolkata date calculations & matrix generators
│       └── notifications.js    # In-app toast alerts
├── backend/
│   ├── email-service.js        # Nodemailer SMTP transporter & HTML email builder
│   ├── scheduler.js            # Automated daily notification runner (cron & CLI)
│   ├── test-email.js           # CLI script to test SMTP email delivery
│   └── verify-db.js            # Comprehensive end-to-end integration test
└── supabase/
    └── schema.sql              # Supabase PostgreSQL relational schema & RLS policies
```

---

## 4. Supabase Database Setup & Schema

The database schema is fully defined in [`supabase/schema.sql`](file:///C:/Users/pc/Documents/PersonalProjectManagement/supabase/schema.sql).

### Tables Created:
1. `public.projects`: Core project records with `start_date`, `target_date`, `priority`, and `status`.
2. `public.project_tasks`: Child tasks referencing `projects(id)` with `ON DELETE CASCADE`.
3. `public.todos`: Sticky notes with `type` (`daily`, `weekly`, `monthly`), `color`, `priority`, and `target_date`.
4. `public.completion_history`: Historical log of all completed items with completion timestamps and timeliness.
5. `public.email_notification_logs`: Idempotency tracking table with unique constraints on `(item_id, notification_type, reference_date)`.

### Row Level Security (RLS):
Row Level Security is enabled on every table. Users only have access to records where `auth.uid() = user_id`. The background notification scheduler uses the `SUPABASE_SERVICE_ROLE_KEY` to execute cross-record scheduled checks.

To apply or re-run the schema via Supabase CLI:
```bash
supabase db query --linked -f supabase/schema.sql
```

---

## 5. Environment Configuration

Create a `.env` file in the project root (copied from `.env.example`):

```ini
# Supabase Configuration
SUPABASE_URL="https://nypswixefpidztdvcmbc.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Notification Recipient
NOTIFICATION_RECIPIENT="priyank.saxena.dev@gmail.com"

# SMTP Email Configuration (Gmail, Resend, Sendgrid, Mailgun, AWS SES, or any SMTP provider)
# If left blank, automatically generates an Ethereal test account with an instant preview URL
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="priyank.saxena.dev@gmail.com"
SMTP_PASS="your-16-character-google-app-password"
SMTP_FROM="Personal Project Flow <priyank.saxena.dev@gmail.com>"

# Application URL (used in email buttons)
APP_URL="http://localhost:3000"
```

---

## 6. How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Frontend Application
```bash
npm start
```
The dashboard will be available at: **http://localhost:3000**

You can sign in with:
- **Email:** `priyank.saxena.dev@gmail.com` (or create a new personal account on the login page)
- **Password:** `TestPassword123!` (or your chosen password)

### 3. Run Automated Email Notifications
- **Execute On-Demand (Single Run):**
  ```bash
  npm run notify
  ```
- **Run as a Daily Scheduled Daemon (09:00 AM IST daily):**
  ```bash
  npm run notify:cron
  ```
- **Send a Test Email:**
  ```bash
  npm run test:email
  ```
- **Run End-to-End Database Verification Test:**
  ```bash
  npm run db:verify
  ```

---

## 7. Automated Email Scheduling Options for Production

To run the automated notification job on a scheduled basis in production:

1. **Option A: GitHub Actions (Free Tier Cron)**
   Create `.github/workflows/daily-reminders.yml`:
   ```yaml
   name: Daily Deadline Notifications
   on:
     schedule:
       - cron: '30 3 * * *' # 09:00 AM IST (03:30 UTC)
     workflow_dispatch:
   jobs:
     notify:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm ci
         - run: npm run notify
           env:
             SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
             SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
             SMTP_HOST: ${{ secrets.SMTP_HOST }}
             SMTP_PORT: ${{ secrets.SMTP_PORT }}
             SMTP_USER: ${{ secrets.SMTP_USER }}
             SMTP_PASS: ${{ secrets.SMTP_PASS }}
             NOTIFICATION_RECIPIENT: priyank.saxena.dev@gmail.com
   ```

2. **Option B: Cron on VPS / Render / Railway / Fly.io**
   Run `npm run notify:cron` as a background background worker or container.
