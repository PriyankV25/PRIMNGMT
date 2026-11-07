// ==============================================================================
// Completion Tracking History View (Feature 6)
// Historical reverse-chronological log of completed Projects, Tasks & To-Dos
// ==============================================================================

import { fetchCompletionHistory } from '../api.js';
import { formatDate, formatDateTime, getDaysDifference } from '../utils/date-utils.js';

let currentFilter = 'all'; // 'all' | 'project' | 'task' | 'daily_todo' | 'weekly_todo' | 'monthly_todo'
let searchQuery = '';

export async function renderHistory(container) {
  container.innerHTML = `
    <div class="view-loading">
      <div class="spinner"></div>
      <p>Retrieving your completion history from Supabase...</p>
    </div>
  `;

  await loadHistoryData(container);
}

async function loadHistoryData(container) {
  try {
    const historyItems = await fetchCompletionHistory(currentFilter);
    renderHistoryLayout(container, historyItems);
  } catch (err) {
    console.error('loadHistoryData error:', err);
    container.innerHTML = `
      <div class="error-banner">
        <h3>Could not load completion history</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary mt-2" id="btn-retry-hist">Retry</button>
      </div>
    `;
    container.querySelector('#btn-retry-hist')?.addEventListener('click', () => renderHistory(container));
  }
}

function renderHistoryLayout(container, historyItems) {
  // Apply local search filter if entered
  let filteredItems = historyItems;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredItems = historyItems.filter(item => 
      item.item_name.toLowerCase().includes(q) ||
      (item.project_name && item.project_name.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  }

  container.innerHTML = `
    <div class="history-view-container animate-fade-in">
      <!-- Header -->
      <div class="view-header">
        <div>
          <h2>Completion Tracking History</h2>
          <p class="text-secondary">Persistent chronological record of all finished projects, tasks, and to-do milestones.</p>
        </div>
        <div class="view-header-stats">
          <span class="history-total-pill">🏆 Total Finished: <strong>${historyItems.length}</strong></span>
        </div>
      </div>

      <!-- Filter Controls Bar -->
      <div class="history-controls-bar">
        <!-- Type Filter Tabs -->
        <div class="pill-tabs history-type-tabs">
          <button class="pill-tab ${currentFilter === 'all' ? 'active' : ''}" data-hist-filter="all">All (${historyItems.length})</button>
          <button class="pill-tab ${currentFilter === 'project' ? 'active' : ''}" data-hist-filter="project">Projects</button>
          <button class="pill-tab ${currentFilter === 'task' ? 'active' : ''}" data-hist-filter="task">Project Tasks</button>
          <button class="pill-tab ${currentFilter === 'daily_todo' ? 'active' : ''}" data-hist-filter="daily_todo">Daily To-Dos</button>
          <button class="pill-tab ${currentFilter === 'weekly_todo' ? 'active' : ''}" data-hist-filter="weekly_todo">Weekly To-Dos</button>
          <button class="pill-tab ${currentFilter === 'monthly_todo' ? 'active' : ''}" data-hist-filter="monthly_todo">Monthly To-Dos</button>
        </div>

        <!-- Search Input -->
        <div class="history-search-box">
          <input type="text" id="hist-search-input" class="form-input" placeholder="Search history..." value="${escapeHtml(searchQuery)}">
        </div>
      </div>

      <!-- History Items Feed -->
      <div class="history-timeline-feed">
        ${filteredItems.length === 0 ? `
          <div class="empty-state-card">
            <span class="empty-icon">📜</span>
            <h3>No Completed Activities Found</h3>
            <p>${historyItems.length === 0 ? 'When you check off tasks, projects, or sticky notes, they will permanently appear in this history.' : 'No records match your search query.'}</p>
          </div>
        ` : filteredItems.map(item => {
          const typeClass = `cal-badge-${item.item_type.replace('_', '-')}`;
          const typeLabel = formatHistoryType(item.item_type);

          // Timeliness calculation: compare completed_at with original_deadline
          let timelinessBadge = '';
          if (item.original_deadline) {
            const completedDateStr = item.completed_at.split('T')[0];
            const diff = getDaysDifference(completedDateStr, item.original_deadline);
            if (diff < 0) {
              timelinessBadge = `<span class="badge badge-success">${Math.abs(diff)}d Early</span>`;
            } else if (diff === 0) {
              timelinessBadge = `<span class="badge badge-completed">On Time</span>`;
            } else {
              timelinessBadge = `<span class="badge badge-warning">${diff}d After Deadline</span>`;
            }
          }

          return `
            <div class="history-entry-card">
              <div class="history-entry-marker">
                <span class="check-circle">✓</span>
              </div>

              <div class="history-entry-content">
                <div class="history-entry-top">
                  <div class="entry-title-group">
                    <h4 class="history-entry-title">${escapeHtml(item.item_name)}</h4>
                    <span class="type-pill ${typeClass}">${typeLabel}</span>
                    ${item.category ? `<span class="category-tag">${escapeHtml(item.category)}</span>` : ''}
                  </div>
                  <div class="history-entry-timeliness">
                    ${timelinessBadge}
                  </div>
                </div>

                ${item.project_name ? `
                  <div class="history-entry-project">
                    <span class="project-prefix">Part of Project:</span>
                    <span class="project-name-bold">${escapeHtml(item.project_name)}</span>
                  </div>
                ` : ''}

                <div class="history-entry-meta">
                  <div class="history-meta-item">
                    <span class="meta-label">Original Deadline:</span>
                    <span class="meta-value">${item.original_deadline ? formatDate(item.original_deadline) : 'None'}</span>
                  </div>
                  <div class="history-meta-divider">•</div>
                  <div class="history-meta-item">
                    <span class="meta-label">Actual Completion:</span>
                    <span class="meta-value font-bold text-success">
                      ${formatDateTime(item.completed_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  bindHistoryEvents(container);
}

function bindHistoryEvents(container) {
  // Filter tabs
  container.querySelectorAll('[data-hist-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.getAttribute('data-hist-filter');
      loadHistoryData(container);
    });
  });

  // Search input
  const searchInput = container.querySelector('#hist-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      loadHistoryData(container);
    });
  }
}

function formatHistoryType(type) {
  const map = {
    project: 'Project',
    task: 'Project Task',
    daily_todo: 'Daily To-Do',
    weekly_todo: 'Weekly To-Do',
    monthly_todo: 'Monthly To-Do'
  };
  return map[type] || type;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
