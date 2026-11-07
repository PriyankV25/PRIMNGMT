// ==============================================================================
// Dashboard View: Dynamic Statistics, Metrics & Consolidated Overview
// ==============================================================================

import { fetchAllActivities } from '../api.js';
import { formatDate, getTodayKolkata, getDaysDifference } from '../utils/date-utils.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="view-loading">
      <div class="spinner"></div>
      <p>Loading your personal productivity dashboard...</p>
    </div>
  `;

  try {
    const { projects, tasks, todos, history } = await fetchAllActivities();
    const today = getTodayKolkata();

    // Calculate metrics
    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'completed' || p.status === 'Completed').length;
    const pendingProjects = totalProjects - completedProjects;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = totalTasks - completedTasks;

    const totalTodos = todos.length;
    const completedTodos = todos.filter(td => td.status === 'completed').length;
    const pendingTodos = totalTodos - completedTodos;

    // Upcoming deadlines (within next 7 days, pending)
    const upcomingItems = [];
    let overdueCount = 0;

    // Collect all pending items with dates
    projects.forEach(p => {
      if (p.status !== 'completed' && p.status !== 'Completed' && p.target_date) {
        const diff = getDaysDifference(p.target_date, today);
        if (diff < 0) overdueCount++;
        else if (diff <= 7) upcomingItems.push({ ...p, itemType: 'Project', title: p.name });
      }
    });

    tasks.forEach(t => {
      if (t.status !== 'completed' && t.target_date) {
        const diff = getDaysDifference(t.target_date, today);
        if (diff < 0) overdueCount++;
        else if (diff <= 7) upcomingItems.push({ ...t, itemType: 'Task', title: t.name, projectTitle: t.projects?.name });
      }
    });

    todos.forEach(td => {
      if (td.status !== 'completed' && td.target_date) {
        const diff = getDaysDifference(td.target_date, today);
        if (diff < 0) overdueCount++;
        else if (diff <= 7) upcomingItems.push({ ...td, itemType: `${td.type.charAt(0).toUpperCase() + td.type.slice(1)} To-Do`, title: td.title });
      }
    });

    // Sort upcoming items by deadline date ascending
    upcomingItems.sort((a, b) => a.target_date.localeCompare(b.target_date));

    // Calculate overall completion percentage
    const allTotal = totalProjects + totalTasks + totalTodos;
    const allCompleted = completedProjects + completedTasks + completedTodos;
    const completionRate = allTotal > 0 ? Math.round((allCompleted / allTotal) * 100) : 0;

    container.innerHTML = `
      <div class="dashboard-wrapper animate-fade-in">
        <!-- Top Welcome & Status Banner -->
        <div class="dashboard-hero">
          <div class="hero-text">
            <h2>Welcome back! Here's your workspace overview.</h2>
            <p>Today is <strong>${formatDate(today)}</strong>. You have <strong>${pendingTasks + pendingTodos}</strong> pending activities across <strong>${pendingProjects}</strong> active projects.</p>
          </div>
          <div class="hero-actions">
            <button class="btn btn-primary" id="btn-quick-new-project">
              <span class="icon">+</span> New Project
            </button>
            <button class="btn btn-secondary" id="btn-quick-new-todo">
              <span class="icon">📝</span> New Sticky Note
            </button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="stats-grid">
          <div class="stat-card" data-route="projects">
            <div class="stat-icon stat-icon-purple">📁</div>
            <div class="stat-details">
              <span class="stat-label">Total Projects</span>
              <div class="stat-number">${totalProjects}</div>
              <div class="stat-meta">
                <span class="badge badge-pending">${pendingProjects} Pending</span>
                <span class="badge badge-completed">${completedProjects} Done</span>
              </div>
            </div>
          </div>

          <div class="stat-card" data-route="projects">
            <div class="stat-icon stat-icon-blue">✓</div>
            <div class="stat-details">
              <span class="stat-label">Project Tasks</span>
              <div class="stat-number">${totalTasks}</div>
              <div class="stat-meta">
                <span class="badge badge-pending">${pendingTasks} Pending</span>
                <span class="badge badge-completed">${completedTasks} Done</span>
              </div>
            </div>
          </div>

          <div class="stat-card" data-route="todos">
            <div class="stat-icon stat-icon-yellow">📌</div>
            <div class="stat-details">
              <span class="stat-label">Sticky To-Dos</span>
              <div class="stat-number">${totalTodos}</div>
              <div class="stat-meta">
                <span class="badge badge-pending">${pendingTodos} Active</span>
                <span class="badge badge-completed">${completedTodos} Done</span>
              </div>
            </div>
          </div>

          <div class="stat-card ${overdueCount > 0 ? 'stat-card-alert' : ''}">
            <div class="stat-icon ${overdueCount > 0 ? 'stat-icon-red' : 'stat-icon-green'}">
              ${overdueCount > 0 ? '⚠️' : '🎯'}
            </div>
            <div class="stat-details">
              <span class="stat-label">${overdueCount > 0 ? 'Overdue Items' : 'Completion Rate'}</span>
              <div class="stat-number">${overdueCount > 0 ? overdueCount : `${completionRate}%`}</div>
              <div class="stat-meta">
                ${overdueCount > 0 
                  ? `<span class="badge badge-overdue">Daily SMTP reminders active</span>`
                  : `<span class="badge badge-completed">${allCompleted} of ${allTotal} completed</span>`
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Two Column Overview: Upcoming Deadlines & Recent Completions -->
        <div class="dashboard-split-grid">
          <!-- Left Column: Upcoming Deadlines (Next 7 Days) -->
          <div class="content-card">
            <div class="card-header">
              <div class="card-title">
                <span class="card-header-icon">⏰</span>
                <h3>Upcoming Deadlines (Next 7 Days)</h3>
              </div>
              <button class="btn-text" id="btn-view-calendar">View Calendar &rarr;</button>
            </div>
            <div class="card-body">
              ${upcomingItems.length === 0 ? `
                <div class="empty-state-mini">
                  <span class="empty-icon">🎉</span>
                  <p>No deadlines in the next 7 days! You're fully caught up.</p>
                </div>
              ` : `
                <ul class="upcoming-list">
                  ${upcomingItems.slice(0, 6).map(item => {
                    const diff = getDaysDifference(item.target_date, today);
                    const isDueToday = diff === 0;
                    const isTwoDays = diff === 2;
                    return `
                      <li class="upcoming-item">
                        <div class="upcoming-item-left">
                          <span class="type-pill type-${item.itemType.toLowerCase().replace(/[^a-z]/g, '')}">
                            ${item.itemType}
                          </span>
                          <div class="upcoming-item-info">
                            <span class="upcoming-title">${escapeHtml(item.title)}</span>
                            ${item.projectTitle ? `<span class="upcoming-sub">${escapeHtml(item.projectTitle)}</span>` : ''}
                          </div>
                        </div>
                        <div class="upcoming-item-right">
                          <span class="upcoming-date">${formatDate(item.target_date)}</span>
                          <span class="badge ${isDueToday ? 'badge-due-today' : (isTwoDays ? 'badge-warning' : 'badge-pending')}">
                            ${isDueToday ? 'Due Today' : (isTwoDays ? 'In 2 Days' : `${diff}d left`)}
                          </span>
                        </div>
                      </li>
                    `;
                  }).join('')}
                </ul>
              `}
            </div>
          </div>

          <!-- Right Column: Recently Completed Activities -->
          <div class="content-card">
            <div class="card-header">
              <div class="card-title">
                <span class="card-header-icon">🏆</span>
                <h3>Recently Completed</h3>
              </div>
              <button class="btn-text" id="btn-view-history">View Full History &rarr;</button>
            </div>
            <div class="card-body">
              ${history.length === 0 ? `
                <div class="empty-state-mini">
                  <span class="empty-icon">📋</span>
                  <p>No completed activities logged yet. Finish a task or project to see it tracked here!</p>
                </div>
              ` : `
                <ul class="recent-history-list">
                  ${history.slice(0, 6).map(h => `
                    <li class="recent-history-item">
                      <div class="history-item-marker">✓</div>
                      <div class="history-item-details">
                        <div class="history-item-name">${escapeHtml(h.item_name)}</div>
                        <div class="history-item-meta">
                          <span class="type-pill">${formatItemType(h.item_type)}</span>
                          ${h.project_name ? `<span>• Project: ${escapeHtml(h.project_name)}</span>` : ''}
                          <span>• Completed ${formatDate(h.completed_at)}</span>
                        </div>
                      </div>
                    </li>
                  `).join('')}
                </ul>
              `}
            </div>
          </div>
        </div>

        <!-- Quick Launch Shortcuts to Main Sections -->
        <div class="dashboard-shortcuts">
          <div class="shortcut-card" data-route="projects">
            <div class="shortcut-icon">📁</div>
            <h4>Projects & Tasks</h4>
            <p>Manage projects, deadlines, priorities & checklists.</p>
          </div>
          <div class="shortcut-card" data-route="todos">
            <div class="shortcut-icon">📌</div>
            <h4>Sticky To-Do Workspace</h4>
            <p>Daily, weekly & monthly color-coded sticky notes.</p>
          </div>
          <div class="shortcut-card" data-route="calendar">
            <div class="shortcut-icon">📅</div>
            <h4>Monthly Calendar</h4>
            <p>Consolidated schedule of all activities and milestones.</p>
          </div>
          <div class="shortcut-card" data-route="gantt">
            <div class="shortcut-icon">📊</div>
            <h4>Project Gantt Charts</h4>
            <p>Interactive timeline visualization with daily, weekly & monthly zoom.</p>
          </div>
        </div>
      </div>
    `;

    // Bind event handlers
    container.querySelector('#btn-quick-new-project')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:open-project-modal'));
    });

    container.querySelector('#btn-quick-new-todo')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:open-todo-modal'));
    });

    container.querySelector('#btn-view-calendar')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'calendar' }));
    });

    container.querySelector('#btn-view-history')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'history' }));
    });

    container.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', () => {
        const route = el.getAttribute('data-route');
        if (route) window.dispatchEvent(new CustomEvent('app:navigate', { detail: route }));
      });
    });

  } catch (err) {
    console.error('renderDashboard error:', err);
    container.innerHTML = `
      <div class="error-banner">
        <h3>Could not load dashboard data</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary mt-2" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

function formatItemType(type) {
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
