// ==============================================================================
// Date Utilities (Asia/Kolkata Timezone & Formatting)
// ==============================================================================

export const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's date in YYYY-MM-DD string for Asia/Kolkata timezone
 */
export function getTodayKolkata() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

/**
 * Format YYYY-MM-DD or ISO string into readable format (e.g. "07 Nov 2026")
 */
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—';
  // If YYYY-MM-DD only, parse parts to avoid UTC shifting
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: options.month || 'short',
      year: options.hideYear ? undefined : 'numeric'
    });
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: options.month || 'short',
    year: options.hideYear ? undefined : 'numeric'
  });
}

/**
 * Format timestamp into readable date & time (e.g. "Nov 7, 2026, 01:25 PM")
 */
export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Difference in days between two YYYY-MM-DD strings (dateStr1 - dateStr2)
 */
export function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get status badge info based on target_date and completion status
 */
export function getDeadlineInfo(targetDate, status) {
  if (status === 'completed' || status === 'Completed') {
    return {
      label: 'Completed',
      badgeClass: 'badge-completed',
      isOverdue: false,
      daysRemaining: 0
    };
  }

  const today = getTodayKolkata();
  const diff = getDaysDifference(targetDate, today);

  if (diff < 0) {
    const overdueDays = Math.abs(diff);
    return {
      label: `${overdueDays}d Overdue`,
      badgeClass: 'badge-overdue',
      isOverdue: true,
      daysRemaining: diff
    };
  } else if (diff === 0) {
    return {
      label: 'Due Today',
      badgeClass: 'badge-due-today',
      isOverdue: false,
      daysRemaining: 0
    };
  } else if (diff === 2) {
    return {
      label: 'Due in 2 days',
      badgeClass: 'badge-warning',
      isOverdue: false,
      daysRemaining: 2
    };
  } else {
    return {
      label: `${diff}d left`,
      badgeClass: 'badge-pending',
      isOverdue: false,
      daysRemaining: diff
    };
  }
}

/**
 * Generate 6-week (42 cells) calendar matrix for a given year and month (0-indexed month)
 */
export function getMonthMatrix(year, month) {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week for first day (0 = Sunday, 1 = Monday, etc.)
  // Let's use Monday as first day of week (0 = Monday, 6 = Sunday)
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();
  const matrix = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const prevDay = prevMonthLastDay - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
    matrix.push({
      dateStr,
      dayNumber: prevDay,
      isCurrentMonth: false,
      year: prevYear,
      month: prevMonth
    });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    matrix.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      year,
      month
    });
  }

  // Next month leading days to complete 35 or 42 cells
  const remainingCells = (matrix.length > 35 ? 42 : 35) - matrix.length;
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    matrix.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: false,
      year: nextYear,
      month: nextMonth
    });
  }

  return matrix;
}

/**
 * Add days to a YYYY-MM-DD date string
 */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
