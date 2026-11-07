// ==============================================================================
// Project Gantt Charts View (Feature 4)
// Professional, interactive Gantt chart with Daily, Weekly & Monthly timeline zoom
// ==============================================================================

import { fetchProjects } from '../api.js';
import { formatDate, getTodayKolkata, getDaysDifference } from '../utils/date-utils.js';

let allProjects = [];
let selectedProjectId = null;
let currentScale = 'daily'; // 'daily' | 'weekly' | 'monthly'

export async function renderGantt(container, targetProjectId = null) {
  if (targetProjectId) {
    selectedProjectId = targetProjectId;
  }

  container.innerHTML = `
    <div class="view-loading">
      <div class="spinner"></div>
      <p>Rendering interactive Gantt chart engine...</p>
    </div>
  `;

  await loadGanttData(container);
}

async function loadGanttData(container) {
  try {
    allProjects = await fetchProjects();

    if (!selectedProjectId && allProjects.length > 0) {
      selectedProjectId = allProjects[0].id;
    } else if (selectedProjectId && !allProjects.find(p => p.id === selectedProjectId)) {
      selectedProjectId = allProjects[0]?.id || null;
    }

    renderGanttLayout(container);
  } catch (err) {
    console.error('loadGanttData error:', err);
    container.innerHTML = `
      <div class="error-banner">
        <h3>Could not load Gantt chart</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary mt-2" id="btn-retry-gantt">Retry</button>
      </div>
    `;
    container.querySelector('#btn-retry-gantt')?.addEventListener('click', () => renderGantt(container));
  }
}

function renderGanttLayout(container) {
  const selectedProject = allProjects.find(p => p.id === selectedProjectId);

  container.innerHTML = `
    <div class="gantt-view-container animate-fade-in">
      <!-- Top Controls Bar -->
      <div class="gantt-header-bar">
        <div class="gantt-header-left">
          <h2>Project Gantt Chart</h2>
          <p class="text-secondary">Visualize master project schedules, milestones, and task deliverables.</p>
        </div>

        <div class="gantt-header-right">
          <!-- Project Selector Dropdown -->
          <div class="gantt-project-selector">
            <label for="gantt-project-select">Active Project:</label>
            <select id="gantt-project-select" class="form-select select-styled">
              ${allProjects.length === 0 ? `
                <option value="">No projects available</option>
              ` : allProjects.map(p => `
                <option value="${p.id}" ${p.id === selectedProjectId ? 'selected' : ''}>
                  ${escapeHtml(p.name)} (${p.category})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Timeline Scale Switcher (Daily, Weekly, Monthly) -->
          <div class="scale-switcher">
            <span class="scale-label">Scale:</span>
            <div class="pill-tabs">
              <button class="pill-tab ${currentScale === 'daily' ? 'active' : ''}" data-scale="daily">Daily</button>
              <button class="pill-tab ${currentScale === 'weekly' ? 'active' : ''}" data-scale="weekly">Weekly</button>
              <button class="pill-tab ${currentScale === 'monthly' ? 'active' : ''}" data-scale="monthly">Monthly</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Gantt Main Canvas or Empty State -->
      ${!selectedProject ? `
        <div class="empty-state-card">
          <span class="empty-icon">📊</span>
          <h3>No Project Available</h3>
          <p>Create a project and add tasks to visualize its timeline in the Gantt chart.</p>
          <button class="btn btn-primary mt-3" id="btn-gantt-create-proj">+ Create Project</button>
        </div>
      ` : renderGanttChart(selectedProject)}
    </div>
  `;

  bindGanttEvents(container, selectedProject);
}

function renderGanttChart(project) {
  const tasks = project.project_tasks || [];
  const todayStr = getTodayKolkata();

  // Determine timeline bounds (earliest date and latest date)
  let earliestDate = project.start_date || todayStr;
  let latestDate = project.target_date || todayStr;

  tasks.forEach(t => {
    if (t.start_date && t.start_date < earliestDate) earliestDate = t.start_date;
    if (t.target_date && t.target_date > latestDate) latestDate = t.target_date;
  });

  // Add 3 days buffer on left and 5 days on right so bars are comfortable
  const startDateObj = parseDate(earliestDate);
  startDateObj.setDate(startDateObj.getDate() - 3);

  const endDateObj = parseDate(latestDate);
  endDateObj.setDate(endDateObj.getDate() + 5);

  // Column width & date step based on scale
  let colWidth = 46; // px per day in daily view
  if (currentScale === 'weekly') colWidth = 120; // px per week
  if (currentScale === 'monthly') colWidth = 160; // px per month

  // Generate scale columns
  const scaleColumns = generateScaleColumns(startDateObj, endDateObj, currentScale);
  const totalTimelineWidth = scaleColumns.totalWidth;

  // Helper to convert date to pixel X offset
  const getPixelOffset = (dateStr) => {
    const d = parseDate(dateStr);
    const diffDays = (d.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24);
    if (currentScale === 'daily') {
      return diffDays * colWidth;
    } else if (currentScale === 'weekly') {
      return (diffDays / 7) * colWidth;
    } else {
      // Monthly
      return (diffDays / 30.4375) * colWidth;
    }
  };

  // Helper to get bar width
  const getBarWidth = (startStr, endStr) => {
    const startX = getPixelOffset(startStr);
    const endX = getPixelOffset(endStr);
    const oneDayWidth = currentScale === 'daily' ? colWidth : (currentScale === 'weekly' ? colWidth / 7 : colWidth / 30);
    return Math.max(oneDayWidth, endX - startX + oneDayWidth);
  };

  // Today marker coordinate
  const todayX = getPixelOffset(todayStr);
  const isTodayVisible = todayX >= 0 && todayX <= totalTimelineWidth;

  // Project progress
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const projectProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : (project.status === 'completed' ? 100 : 0);

  return `
    <div class="gantt-chart-wrapper">
      <!-- Project Summary Banner -->
      <div class="gantt-summary-banner">
        <div class="summary-left">
          <span class="project-name-bold">${escapeHtml(project.name)}</span>
          <span class="category-tag">${escapeHtml(project.category)}</span>
          <span class="priority-badge priority-${project.priority.toLowerCase()}">${project.priority}</span>
        </div>
        <div class="summary-right">
          <span class="summary-dates">📅 ${formatDate(project.start_date)} &rarr; ${formatDate(project.target_date)}</span>
          <span class="progress-pill">${projectProgress}% Complete (${completedTasks}/${tasks.length} tasks)</span>
        </div>
      </div>
       <br><br>

      <!-- Gantt Workspace Grid -->
      <div class="gantt-split-board">
        <!-- LEFT: Fixed Task Name & Info Column -->
        <div class="gantt-fixed-column">
          <!-- Header cell -->
          <div class="gantt-header-cell">
            <span class="header-col-title">Task / Timeline Activity</span>
          </div>

          <!-- Master Project Row -->
          <div class="gantt-row-cell row-master-project">
            <span class="master-icon">📁</span>
            <div class="row-task-info">
              <span class="row-task-title font-bold">${escapeHtml(project.name)}</span>
              <span class="row-task-meta">Master Project Duration</span>
            </div>
          </div>

          <!-- Task Rows -->
          ${tasks.length === 0 ? `
            <div class="gantt-row-cell empty-tasks-cell">
              <span class="text-secondary text-sm">No tasks added to this project yet.</span>
            </div>
          ` : tasks.map((task, idx) => {
            const isDone = task.status === 'completed';
            return `
              <div class="gantt-row-cell ${isDone ? 'row-done' : ''}" title="${escapeHtml(task.name)}">
                <span class="row-index">${idx + 1}.</span>
                <div class="row-task-info">
                  <span class="row-task-title ${isDone ? 'strikethrough text-muted' : ''}">${escapeHtml(task.name)}</span>
                  <span class="row-task-dates">${formatDate(task.start_date, { hideYear: true })} - ${formatDate(task.target_date, { hideYear: true })}</span>
                </div>
                <span class="priority-dot priority-${task.priority.toLowerCase()}" title="${task.priority} Priority"></span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- RIGHT: Horizontally Scrollable Timeline -->
        <div class="gantt-scroll-panel" id="gantt-scroll-container">
          <div class="gantt-timeline-canvas" style="width: ${totalTimelineWidth}px;">
            
            <!-- Timeline Header Row -->
            <div class="gantt-timeline-header">
              ${scaleColumns.headers.map(col => `
                <div class="timeline-header-block" style="width: ${col.width}px; left: ${col.left}px;">
                  <span class="header-main-label">${col.mainLabel}</span>
                  <span class="header-sub-label">${col.subLabel}</span>
                </div>
              `).join('')}
            </div>

            <!-- Background Grid Lines -->
            <div class="gantt-grid-backdrop">
              ${scaleColumns.headers.map(col => `
                <div class="grid-line" style="left: ${col.left}px;"></div>
              `).join('')}
            </div>

            <!-- Today's Date Vertical Marker -->
            ${isTodayVisible ? `
              <div class="gantt-today-line" style="left: ${todayX}px;">
                <div class="today-marker-pill">TODAY</div>
              </div>
            ` : ''}

            <!-- Master Project Timeline Bar Row -->
            <div class="gantt-timeline-row row-master-project">
              <div class="gantt-bar master-project-bar" 
                   style="left: ${getPixelOffset(project.start_date)}px; width: ${getBarWidth(project.start_date, project.target_date)}px;"
                   title="${escapeHtml(project.name)}: ${formatDate(project.start_date)} to ${formatDate(project.target_date)} (${projectProgress}% done)">
                <div class="bar-progress-fill" style="width: ${projectProgress}%;"></div>
                <span class="bar-label">${escapeHtml(project.name)}</span>
                <span class="bar-date-endpoint end-chip">${formatDate(project.target_date, { hideYear: true })}</span>
              </div>
            </div>

            <!-- Task Timeline Bar Rows -->
            ${tasks.map(task => {
              const isDone = task.status === 'completed';
              const isOverdue = !isDone && task.target_date < todayStr;
              const barLeft = getPixelOffset(task.start_date);
              const barWidth = getBarWidth(task.start_date, task.target_date);

              let statusClass = 'bar-pending';
              if (isDone) statusClass = 'bar-completed';
              else if (isOverdue) statusClass = 'bar-overdue';

              return `
                <div class="gantt-timeline-row">
                  <div class="gantt-bar ${statusClass} priority-border-${task.priority.toLowerCase()}" 
                       style="left: ${barLeft}px; width: ${barWidth}px;"
                       title="${escapeHtml(task.name)} | Due: ${formatDate(task.target_date)} | Status: ${isDone ? 'Completed' : (isOverdue ? 'Overdue' : 'In Progress')}">
                    <span class="bar-status-icon">${isDone ? '✓' : (isOverdue ? '!' : '•')}</span>
                    <span class="bar-label">${escapeHtml(task.name)}</span>
                    <span class="bar-date-endpoint">${formatDate(task.target_date, { hideYear: true })}</span>
                  </div>
                </div>
              `;
            }).join('')}

          </div>
        </div>
      </div>
    </div>
  `;
}

function generateScaleColumns(startDate, endDate, scale) {
  const headers = [];
  const current = new Date(startDate.getTime());
  let currentX = 0;

  if (scale === 'daily') {
    const colWidth = 46;
    while (current <= endDate) {
      const dayNum = current.getDate();
      const dayName = current.toLocaleDateString('en-US', { weekday: 'narrow' });
      const monthShort = current.toLocaleDateString('en-US', { month: 'short' });
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;

      headers.push({
        left: currentX,
        width: colWidth,
        mainLabel: `${dayName} ${dayNum}`,
        subLabel: dayNum === 1 ? monthShort : '',
        isWeekend
      });

      currentX += colWidth;
      current.setDate(current.getDate() + 1);
    }
  } else if (scale === 'weekly') {
    const colWidth = 120;
    while (current <= endDate) {
      const weekStartStr = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekEnd = new Date(current.getTime() + 6 * 24 * 60 * 60 * 1000);
      const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      headers.push({
        left: currentX,
        width: colWidth,
        mainLabel: `Week of ${weekStartStr}`,
        subLabel: `${weekStartStr} - ${weekEndStr}`
      });

      currentX += colWidth;
      current.setDate(current.getDate() + 7);
    }
  } else {
    // Monthly
    const colWidth = 160;
    while (current <= endDate) {
      const monthYear = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      headers.push({
        left: currentX,
        width: colWidth,
        mainLabel: monthYear,
        subLabel: '30 Days'
      });

      currentX += colWidth;
      current.setMonth(current.getMonth() + 1);
    }
  }

  return { headers, totalWidth: Math.max(900, currentX) };
}

function parseDate(dateStr) {
  const parts = dateStr.split('T')[0].split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function bindGanttEvents(container, selectedProject) {
  // Project Selector
  container.querySelector('#gantt-project-select')?.addEventListener('change', (e) => {
    selectedProjectId = e.target.value;
    renderGanttLayout(container);
  });

  // Scale Switcher (Daily, Weekly, Monthly)
  container.querySelectorAll('[data-scale]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentScale = btn.getAttribute('data-scale');
      renderGanttLayout(container);
    });
  });

  // Create Project empty state button
  container.querySelector('#btn-gantt-create-proj')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('app:open-project-modal'));
  });

  // Auto-scroll timeline to Today line or start if present
  const scrollContainer = container.querySelector('#gantt-scroll-container');
  const todayMarker = container.querySelector('.gantt-today-line');
  if (scrollContainer && todayMarker) {
    const todayLeft = parseInt(todayMarker.style.left || '0', 10);
    if (todayLeft > 300) {
      scrollContainer.scrollLeft = todayLeft - 200;
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
