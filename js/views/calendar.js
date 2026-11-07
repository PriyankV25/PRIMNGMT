// ==============================================================================
// Monthly Calendar View (Feature 3)
// Consolidated view of Projects, Project Tasks, Daily, Weekly & Monthly To-Dos
// ==============================================================================

import { fetchAllActivities } from '../api.js';
import { getMonthMatrix, getTodayKolkata, formatDate, formatDateTime } from '../utils/date-utils.js';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0 - 11
let cachedActivities = { projects: [], tasks: [], todos: [] };

export async function renderCalendar(container) {
  container.innerHTML = `
    <div class="view-loading">
      <div class="spinner"></div>
      <p>Synchronizing your monthly schedule...</p>
    </div>
  `;

  await loadCalendarData(container);
}

async function loadCalendarData(container) {
  try {
    const data = await fetchAllActivities();
    cachedActivities = data;
    renderCalendarLayout(container);
  } catch (err) {
    console.error('loadCalendarData error:', err);
    container.innerHTML = `
      <div class="error-banner">
        <h3>Could not load calendar schedule</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary mt-2" id="btn-retry-cal">Retry</button>
      </div>
    `;
    container.querySelector('#btn-retry-cal')?.addEventListener('click', () => renderCalendar(container));
  }
}

function renderCalendarLayout(container) {
  const todayStr = getTodayKolkata();
  const matrix = getMonthMatrix(currentYear, currentMonth);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = monthNames[currentMonth];

  // Organize activities by date
  // A map of dateStr -> array of item objects
  const dateMap = new Map();

  function addItemToDate(dateStr, item) {
    if (!dateStr) return;
    if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
    dateMap.get(dateStr).push(item);
  }

  // 1. Projects (index on target_date and start_date)
  cachedActivities.projects.forEach(p => {
    if (p.target_date) {
      addItemToDate(p.target_date, {
        id: p.id,
        name: p.name,
        type: 'project',
        typeName: 'Project',
        category: p.category,
        priority: p.priority,
        status: p.status,
        date: p.target_date,
        isDeadline: true,
        startDate: p.start_date,
        targetDate: p.target_date,
        description: p.description
      });
    }
  });

  // 2. Project Tasks
  cachedActivities.tasks.forEach(t => {
    if (t.target_date) {
      addItemToDate(t.target_date, {
        id: t.id,
        name: t.name,
        type: 'task',
        typeName: 'Task',
        projectName: t.projects?.name,
        priority: t.priority,
        status: t.status,
        date: t.target_date,
        isDeadline: true,
        startDate: t.start_date,
        targetDate: t.target_date,
        description: t.description
      });
    }
  });

  // 3. To-Dos
  cachedActivities.todos.forEach(td => {
    if (td.target_date) {
      addItemToDate(td.target_date, {
        id: td.id,
        name: td.title,
        type: `${td.type}_todo`,
        typeName: `${td.type.charAt(0).toUpperCase() + td.type.slice(1)} To-Do`,
        priority: td.priority,
        status: td.status,
        date: td.target_date,
        color: td.color,
        isDeadline: true,
        targetDate: td.target_date,
        description: td.description
      });
    }
  });

  container.innerHTML = `
    <div class="calendar-view-container animate-fade-in">
      <!-- Calendar Controls & Navigation Bar -->
      <div class="calendar-top-bar">
        <div class="calendar-title-group">
          <h2>${currentMonthName} ${currentYear}</h2>
          <span class="timezone-badge">Timezone: Asia/Kolkata (IST)</span>
        </div>

        <!-- Legend Pills -->
        <div class="calendar-legend">
          <span class="legend-item"><span class="legend-dot dot-project"></span> Project</span>
          <span class="legend-item"><span class="legend-dot dot-task"></span> Task</span>
          <span class="legend-item"><span class="legend-dot dot-daily"></span> Daily To-Do</span>
          <span class="legend-item"><span class="legend-dot dot-weekly"></span> Weekly To-Do</span>
          <span class="legend-item"><span class="legend-dot dot-monthly"></span> Monthly To-Do</span>
        </div>

        <!-- Month Navigation Buttons -->
        <div class="calendar-nav-buttons">
          <button class="btn btn-secondary btn-sm" id="cal-prev-month" title="Previous Month">&larr; Prev</button>
          <button class="btn btn-outline btn-sm" id="cal-today-btn">Today</button>
          <button class="btn btn-secondary btn-sm" id="cal-next-month" title="Next Month">Next &rarr;</button>
        </div>
      </div>

      <!-- Month Grid Table -->
      <div class="calendar-month-grid">
        <!-- Weekday Headers -->
        <div class="calendar-weekdays-row">
          <div class="weekday-header">Mon</div>
          <div class="weekday-header">Tue</div>
          <div class="weekday-header">Wed</div>
          <div class="weekday-header">Thu</div>
          <div class="weekday-header">Fri</div>
          <div class="weekday-header">Sat</div>
          <div class="weekday-header">Sun</div>
        </div>

        <!-- Day Cells Matrix (6 rows x 7 cols) -->
        <div class="calendar-days-matrix">
          ${matrix.map(cell => {
            const isToday = cell.dateStr === todayStr;
            const dayItems = dateMap.get(cell.dateStr) || [];
            const displayLimit = 3;
            const visibleItems = dayItems.slice(0, displayLimit);
            const extraCount = dayItems.length - displayLimit;

            return `
              <div class="cal-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}" 
                   data-date="${cell.dateStr}">
                
                <div class="cal-day-header">
                  <span class="day-number ${isToday ? 'today-number-pill' : ''}">
                    ${cell.dayNumber}
                  </span>
                  ${isToday ? `<span class="today-tag">TODAY</span>` : ''}
                </div>

                <div class="cal-day-items">
                  ${visibleItems.map(item => {
                    const isDone = item.status === 'completed' || item.status === 'Completed';
                    const typeClass = `cal-badge-${item.type.replace('_', '-')}`;
                    return `
                      <div class="cal-item-pill ${typeClass} ${isDone ? 'is-completed' : ''}" 
                           title="${escapeHtml(item.name)} (${item.typeName})"
                           data-item-id="${item.id}"
                           data-item-type="${item.type}">
                        <span class="cal-pill-indicator">${isDone ? '✓' : '•'}</span>
                        <span class="cal-pill-text ${isDone ? 'strikethrough' : ''}">${escapeHtml(item.name)}</span>
                      </div>
                    `;
                  }).join('')}

                  ${extraCount > 0 ? `
                    <div class="cal-more-pill" data-date="${cell.dateStr}">
                      +${extraCount} more
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  bindCalendarEvents(container, dateMap);
}

function bindCalendarEvents(container, dateMap) {
  // Previous Month
  container.querySelector('#cal-prev-month')?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendarLayout(container);
  });

  // Next Month
  container.querySelector('#cal-next-month')?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendarLayout(container);
  });

  // Today button
  container.querySelector('#cal-today-btn')?.addEventListener('click', () => {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    renderCalendarLayout(container);
  });

  // Item pill click -> Show item detail modal
  container.querySelectorAll('.cal-item-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = pill.getAttribute('data-item-id');
      const itemType = pill.getAttribute('data-item-type');
      openActivityModal(itemId, itemType);
    });
  });

  // Day cell click or "+N more" pill -> Show Day Activities Drawer
  container.querySelectorAll('.cal-day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.getAttribute('data-date');
      const items = dateMap.get(dateStr) || [];
      openDayViewModal(dateStr, items);
    });
  });
}

// ==============================================================================
// Day View Modal: Shows all activities for a selected date
// ==============================================================================
function openDayViewModal(dateStr, items) {
  const modalHtml = `
    <div class="modal-overlay animate-fade-in" id="day-view-modal">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h3>Scheduled Activities</h3>
            <span class="text-secondary">📅 ${formatDate(dateStr)}</span>
          </div>
          <button class="modal-close" id="btn-day-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${items.length === 0 ? `
            <div class="empty-state-mini">
              <span class="empty-icon">☕</span>
              <p>No scheduled activities on this date.</p>
            </div>
          ` : `
            <ul class="day-activities-list">
              ${items.map(item => {
                const isDone = item.status === 'completed' || item.status === 'Completed';
                const typeClass = `cal-badge-${item.type.replace('_', '-')}`;
                return `
                  <li class="day-activity-item" data-item-id="${item.id}" data-item-type="${item.type}">
                    <div class="day-act-marker ${typeClass}"></div>
                    <div class="day-act-details">
                      <div class="day-act-title-row">
                        <span class="day-act-name ${isDone ? 'strikethrough text-muted' : ''}">${escapeHtml(item.name)}</span>
                        <span class="type-pill ${typeClass}">${item.typeName}</span>
                      </div>
                      ${item.projectName ? `<span class="day-act-sub">Project: ${escapeHtml(item.projectName)}</span>` : ''}
                      ${item.description ? `<p class="day-act-desc">${escapeHtml(item.description)}</p>` : ''}
                      <div class="day-act-footer">
                        <span class="priority-badge priority-${item.priority.toLowerCase()}">${item.priority}</span>
                        <span class="badge ${isDone ? 'badge-completed' : 'badge-pending'}">${isDone ? 'Completed' : 'Pending'}</span>
                      </div>
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-day-modal-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById('day-view-modal');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.getElementById('day-view-modal');
  const closeModal = () => modalEl.remove();

  modalEl.querySelector('#btn-day-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#btn-day-modal-close-btn').addEventListener('click', closeModal);

  // Clicking an item in the day list opens its detailed modal
  modalEl.querySelectorAll('.day-activity-item').forEach(itemEl => {
    itemEl.addEventListener('click', () => {
      const itemId = itemEl.getAttribute('data-item-id');
      const itemType = itemEl.getAttribute('data-item-type');
      closeModal();
      openActivityModal(itemId, itemType);
    });
  });
}

// ==============================================================================
// Activity Detail Modal
// ==============================================================================
export function openActivityModal(itemId, itemType) {
  let item = null;

  if (itemType === 'project') {
    item = cachedActivities.projects.find(p => p.id === itemId);
    if (item) item = { ...item, typeName: 'Project' };
  } else if (itemType === 'task') {
    item = cachedActivities.tasks.find(t => t.id === itemId);
    if (item) item = { ...item, typeName: 'Project Task', projectName: item.projects?.name };
  } else {
    item = cachedActivities.todos.find(td => td.id === itemId);
    if (item) item = { ...item, name: item.title, typeName: `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} To-Do` };
  }

  if (!item) return;

  const isDone = item.status === 'completed' || item.status === 'Completed';

  const modalHtml = `
    <div class="modal-overlay animate-fade-in" id="activity-detail-modal">
      <div class="modal-card">
        <div class="modal-header">
          <div class="project-tags">
            <span class="type-pill cal-badge-${itemType.replace('_', '-')}">${item.typeName}</span>
            <span class="priority-badge priority-${item.priority.toLowerCase()}">${item.priority} Priority</span>
          </div>
          <button class="modal-close" id="btn-act-close">&times;</button>
        </div>

        <div class="modal-body">
          <h2 class="activity-modal-title ${isDone ? 'strikethrough text-muted' : ''}">${escapeHtml(item.name)}</h2>
          ${item.projectName ? `
            <div class="meta-row mt-2">
              <span class="meta-label">Associated Project:</span>
              <span class="meta-value">${escapeHtml(item.projectName)}</span>
            </div>
          ` : ''}

          ${item.description ? `
            <div class="activity-modal-desc">
              ${escapeHtml(item.description)}
            </div>
          ` : ''}

          <div class="card mt-3">
            ${item.start_date ? `
              <div class="meta-row">
                <span class="meta-label">Start Date:</span>
                <span class="meta-value">${formatDate(item.start_date)}</span>
              </div>
            ` : ''}
            <div class="meta-row">
              <span class="meta-label">Target Deadline:</span>
              <span class="meta-value font-bold">${formatDate(item.target_date)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Current Status:</span>
              <span class="badge ${isDone ? 'badge-completed' : 'badge-pending'}">${isDone ? 'Completed' : 'Pending'}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-act-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById('activity-detail-modal');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.getElementById('activity-detail-modal');
  const closeModal = () => modalEl.remove();

  modalEl.querySelector('#btn-act-close').addEventListener('click', closeModal);
  modalEl.querySelector('#btn-act-close-btn').addEventListener('click', closeModal);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
