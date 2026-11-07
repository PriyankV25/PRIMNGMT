// ==============================================================================
// Projects & Tasks View (Feature 1)
// Clean SaaS interface for personal projects, associated tasks & checklists
// ==============================================================================

import {
  fetchProjects,
  createProject,
  updateProject,
  completeProject,
  deleteProject,
  createProjectTask,
  updateProjectTask,
  toggleTaskComplete,
  deleteProjectTask
} from '../api.js';
import { formatDate, getTodayKolkata, getDeadlineInfo } from '../utils/date-utils.js';
import { showToast } from '../utils/notifications.js';

let activeProjects = [];
let selectedProjectId = null;
let currentTaskFilter = 'all'; // 'all' | 'pending' | 'completed'

export async function renderProjects(container) {
  container.innerHTML = `
    <div class="view-loading">
      <div class="spinner"></div>
      <p>Loading projects & tasks...</p>
    </div>
  `;

  await loadProjectsData(container);
}

async function loadProjectsData(container) {
  try {
    activeProjects = await fetchProjects();

    // If no project selected yet or selected project deleted, pick first project if available
    if (!selectedProjectId && activeProjects.length > 0) {
      selectedProjectId = activeProjects[0].id;
    } else if (selectedProjectId && !activeProjects.find(p => p.id === selectedProjectId)) {
      selectedProjectId = activeProjects[0]?.id || null;
    }

    renderProjectsLayout(container);
  } catch (err) {
    console.error('loadProjectsData error:', err);
    container.innerHTML = `
      <div class="error-banner">
        <h3>Error loading projects</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary mt-2" id="btn-retry-projects">Retry</button>
      </div>
    `;
    container.querySelector('#btn-retry-projects')?.addEventListener('click', () => renderProjects(container));
  }
}

function renderProjectsLayout(container) {
  const selectedProject = activeProjects.find(p => p.id === selectedProjectId);

  container.innerHTML = `
    <div class="projects-view-container animate-fade-in">
      <!-- Top Action Bar -->
      <div class="view-header">
        <div>
          <h2>Project & Task Management</h2>
          <p class="text-secondary">Organize personal projects, manage timelines, and track task deliverables.</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-primary" id="btn-create-project">
            <span class="icon">+</span> New Project
          </button>
        </div>
      </div>

      <!-- Main Two-Column Master-Detail Layout -->
      <div class="projects-master-detail">
        <!-- Left Column: Project Cards List -->
        <aside class="projects-sidebar">
          <div class="projects-sidebar-header">
            <h4>Projects (${activeProjects.length})</h4>
          </div>

          <div class="projects-cards-list" id="projects-list-scroll">
            ${activeProjects.length === 0 ? `
              <div class="empty-state-mini">
                <span class="empty-icon">📁</span>
                <p>No projects yet.<br>Click "New Project" to start your first one!</p>
              </div>
            ` : activeProjects.map(project => {
              const tasks = project.project_tasks || [];
              const completedCount = tasks.filter(t => t.status === 'completed').length;
              const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : (project.status === 'completed' ? 100 : 0);
              const isSelected = project.id === selectedProjectId;
              const isCompleted = project.status === 'completed' || project.status === 'Completed';
              const deadline = getDeadlineInfo(project.target_date, project.status);

              return `
                <div class="project-nav-card ${isSelected ? 'active' : ''} ${isCompleted ? 'completed' : ''}" data-project-id="${project.id}">
                  <div class="project-nav-card-top">
                    <span class="category-tag">${escapeHtml(project.category)}</span>
                    <span class="priority-badge priority-${project.priority.toLowerCase()}">${project.priority}</span>
                  </div>
                  <h4 class="project-nav-title ${isCompleted ? 'strikethrough' : ''}">${escapeHtml(project.name)}</h4>
                  
                  <div class="project-nav-meta">
                    <span class="date-chip">📅 ${formatDate(project.target_date)}</span>
                    <span class="badge ${deadline.badgeClass}">${deadline.label}</span>
                  </div>

                  <!-- Mini Progress Bar -->
                  <div class="progress-container">
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: ${progressPct}%;"></div>
                    </div>
                    <span class="progress-text">${completedCount}/${tasks.length} tasks (${progressPct}%)</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </aside>

        <!-- Right Column: Selected Project Detail & Task Management -->
        <main class="project-detail-panel">
          ${!selectedProject ? `
            <div class="no-selection-state">
              <span class="empty-icon">📂</span>
              <h3>No Project Selected</h3>
              <p>Select a project from the left or create a new project to start managing tasks.</p>
              <br>
              <button class="btn btn-primary mt-3" id="btn-create-project-empty">+ Create Project</button>
            </div>
          ` : renderProjectDetailContent(selectedProject)}
        </main>
      </div>
    </div>
  `;

  // Bind Events
  bindProjectsEvents(container, selectedProject);
}

function renderProjectDetailContent(project) {
  const tasks = project.project_tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (project.status === 'completed' ? 100 : 0);
  const isCompleted = project.status === 'completed' || project.status === 'Completed';
  const deadline = getDeadlineInfo(project.target_date, project.status);

  // Filter tasks
  let filteredTasks = tasks;
  if (currentTaskFilter === 'pending') {
    filteredTasks = tasks.filter(t => t.status !== 'completed');
  } else if (currentTaskFilter === 'completed') {
    filteredTasks = tasks.filter(t => t.status === 'completed');
  }

  return `
    <div class="project-detail-content animate-fade-in">
      <!-- Project Header Card -->
      <div class="project-detail-header-card">
        <div class="project-detail-header-top">
          <div class="project-tags">
            <span class="category-tag category-large">${escapeHtml(project.category)}</span>
            <span class="priority-badge priority-${project.priority.toLowerCase()}">${project.priority} Priority</span>
            <span class="badge ${deadline.badgeClass}">${deadline.label}</span>
          </div>
          <div class="project-actions">
            <button class="btn btn-sm ${isCompleted ? 'btn-secondary' : 'btn-success'}" id="btn-toggle-project-complete" title="${isCompleted ? 'Reopen Project' : 'Mark Project as Completed'}">
              ${isCompleted ? '↩ Reopen Project' : '✓ Mark Completed'}
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-edit-project" title="Edit Project Details">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-danger" id="btn-delete-project" title="Delete Project">
              🗑️ Delete
            </button>
          </div>
        </div>

        <h2 class="project-detail-title ${isCompleted ? 'strikethrough text-muted' : ''}">${escapeHtml(project.name)}</h2>
        ${project.description ? `<p class="project-detail-desc">${escapeHtml(project.description)}</p>` : ''}

        <div class="project-timeline-meta">
          <div class="timeline-meta-item">
            <span class="meta-label">Start Date:</span>
            <span class="meta-value">${formatDate(project.start_date)}</span>
          </div>
          <div class="timeline-meta-divider">→</div>
          <div class="timeline-meta-item">
            <span class="meta-label">Target Deadline:</span>
            <span class="meta-value" style="font-weight: 700;">${formatDate(project.target_date)}</span>
          </div>
          <div class="timeline-meta-item">
            <span class="meta-label">Total Duration:</span>
            <span class="meta-value">${Math.max(1, Math.round((new Date(project.target_date) - new Date(project.start_date)) / (1000 * 60 * 60 * 24)))} days</span>
          </div>
          <div class="timeline-meta-item">
            <button class="btn btn-sm btn-link" id="btn-view-gantt-chart">
              📊 View in Gantt Chart &rarr;
            </button>
          </div>
        </div>

        <!-- Project Progress Bar -->
        <div class="project-overall-progress">
          <div class="progress-header">
            <span>Overall Task Progress</span>
            <span class="progress-percent-bold">${progressPct}% (${completedTasks} of ${totalTasks} tasks completed)</span>
          </div>
          <div class="progress-bar progress-bar-large">
            <div class="progress-fill ${progressPct === 100 ? 'fill-completed' : ''}" style="width: ${progressPct}%;"></div>
          </div>
        </div>
      </div>

      <!-- Task Management Section -->
      <div class="tasks-section">
        <div class="tasks-section-header">
          <div class="tasks-header-left">
            <h3>Project Tasks (${totalTasks})</h3>
            <!-- Task Filter Tabs -->
            <div class="pill-tabs">
              <button class="pill-tab ${currentTaskFilter === 'all' ? 'active' : ''}" data-task-filter="all">All (${totalTasks})</button>
              <button class="pill-tab ${currentTaskFilter === 'pending' ? 'active' : ''}" data-task-filter="pending">Pending (${totalTasks - completedTasks})</button>
              <button class="pill-tab ${currentTaskFilter === 'completed' ? 'active' : ''}" data-task-filter="completed">Completed (${completedTasks})</button>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-task">
            <span class="icon">+</span> Add Task
          </button>
        </div>

        <!-- Tasks List -->
        <div class="tasks-list">
          ${filteredTasks.length === 0 ? `
            <div class="empty-state-mini">
              <span class="empty-icon">📝</span>
              <p>${totalTasks === 0 ? 'No tasks created for this project yet. Add your first task!' : 'No tasks match the selected filter.'}</p>
            </div>
          ` : filteredTasks.map(task => {
            const isTaskDone = task.status === 'completed';
            const taskDeadline = getDeadlineInfo(task.target_date, task.status);

            return `
              <div class="task-item-card ${isTaskDone ? 'task-done' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox-container">
                  <input type="checkbox" class="task-checkbox" id="chk-${task.id}" ${isTaskDone ? 'checked' : ''} data-task-id="${task.id}">
                  <label for="chk-${task.id}" class="checkbox-custom"></label>
                </div>

                <div class="task-content">
                  <div class="task-title-row">
                    <h4 class="task-name ${isTaskDone ? 'strikethrough text-muted' : ''}">${escapeHtml(task.name)}</h4>
                    <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
                  </div>

                  ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}

                  <div class="task-meta-row">
                    <span class="task-date-range">
                      📅 ${formatDate(task.start_date)} - ${formatDate(task.target_date)}
                    </span>
                    <span class="badge ${taskDeadline.badgeClass}">${taskDeadline.label}</span>
                  </div>
                </div>

                <div class="task-actions">
                  <button class="btn-icon btn-edit-task" title="Edit Task" data-task-id="${task.id}">✏️</button>
                  <button class="btn-icon btn-delete-task text-danger" title="Delete Task" data-task-id="${task.id}">🗑️</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function bindProjectsEvents(container, selectedProject) {
  // New Project button
  container.querySelectorAll('#btn-create-project, #btn-create-project-empty').forEach(btn => {
    btn.addEventListener('click', () => openProjectModal(null, container));
  });

  // Project navigation card clicks
  container.querySelectorAll('.project-nav-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedProjectId = card.getAttribute('data-project-id');
      renderProjectsLayout(container);
    });
  });

  if (!selectedProject) return;

  // View in Gantt chart
  container.querySelector('#btn-view-gantt-chart')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('app:navigate-gantt', { detail: selectedProject.id }));
  });

  // Toggle Project Complete
  container.querySelector('#btn-toggle-project-complete')?.addEventListener('click', async () => {
    const isCompleted = selectedProject.status === 'completed' || selectedProject.status === 'Completed';
    try {
      await completeProject(selectedProject, !isCompleted);
      showToast(isCompleted ? 'Project reopened.' : 'Project marked completed! Added to History.', 'success');
      await loadProjectsData(container);
    } catch (err) {
      showToast(`Error updating project: ${err.message}`, 'error');
    }
  });

  // Edit Project
  container.querySelector('#btn-edit-project')?.addEventListener('click', () => {
    openProjectModal(selectedProject, container);
  });

  // Delete Project
  container.querySelector('#btn-delete-project')?.addEventListener('click', async () => {
    if (!confirm(`Are you sure you want to delete project "${selectedProject.name}" and all its tasks? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteProject(selectedProject.id);
      showToast('Project deleted successfully.', 'info');
      selectedProjectId = null;
      await loadProjectsData(container);
    } catch (err) {
      showToast(`Error deleting project: ${err.message}`, 'error');
    }
  });

  // Add Task
  container.querySelector('#btn-add-task')?.addEventListener('click', () => {
    openTaskModal(null, selectedProject, container);
  });

  // Task Filter Tabs
  container.querySelectorAll('[data-task-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTaskFilter = tab.getAttribute('data-task-filter');
      renderProjectsLayout(container);
    });
  });

  // Task checkbox toggles
  container.querySelectorAll('.task-checkbox').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const taskId = chk.getAttribute('data-task-id');
      const task = selectedProject.project_tasks.find(t => t.id === taskId);
      if (!task) return;

      try {
        await toggleTaskComplete(task, selectedProject.name);
        showToast(task.status === 'completed' ? 'Task reopened.' : 'Task completed! Added to History.', 'success');
        await loadProjectsData(container);
      } catch (err) {
        showToast(`Error updating task: ${err.message}`, 'error');
        chk.checked = !chk.checked; // revert UI
      }
    });
  });

  // Edit Task button
  container.querySelectorAll('.btn-edit-task').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-task-id');
      const task = selectedProject.project_tasks.find(t => t.id === taskId);
      if (task) openTaskModal(task, selectedProject, container);
    });
  });

  // Delete Task button
  container.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-task-id');
      const task = selectedProject.project_tasks.find(t => t.id === taskId);
      if (!task) return;

      if (!confirm(`Delete task "${task.name}"?`)) return;

      try {
        await deleteProjectTask(task.id);
        showToast('Task deleted.', 'info');
        await loadProjectsData(container);
      } catch (err) {
        showToast(`Error deleting task: ${err.message}`, 'error');
      }
    });
  });
}

// ==============================================================================
// Project Creation / Editing Modal
// ==============================================================================
export function openProjectModal(projectToEdit = null, container = null) {
  const isEdit = !!projectToEdit;
  const today = getTodayKolkata();

  const modalHtml = `
    <div class="modal-overlay animate-fade-in" id="project-modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Project' : 'Create New Project'}</h3>
          <button class="modal-close" id="btn-modal-close">&times;</button>
        </div>
        <form id="project-form" class="modal-body">
          <div class="form-group">
            <label for="proj-name">Project Name <span class="required">*</span></label>
            <input type="text" id="proj-name" class="form-input" required maxlength="160" placeholder="e.g. Website Redesign & Launch" value="${escapeHtml(projectToEdit?.name || '')}">
          </div>

          <div class="form-group">
            <label for="proj-desc">Project Description</label>
            <textarea id="proj-desc" class="form-textarea" rows="3" placeholder="Outline scope, goals, and key deliverables...">${escapeHtml(projectToEdit?.description || '')}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label for="proj-category">Category</label>
              <select id="proj-category" class="form-select">
                ${['Development', 'Design', 'Personal', 'Research', 'Writing', 'Finance', 'General', 'Other'].map(cat => `
                  <option value="${cat}" ${projectToEdit?.category === cat ? 'selected' : ''}>${cat}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group col-half">
              <label for="proj-priority">Priority</label>
              <select id="proj-priority" class="form-select">
                ${['Low', 'Medium', 'High', 'Critical'].map(p => `
                  <option value="${p}" ${(projectToEdit?.priority || 'Medium') === p ? 'selected' : ''}>${p}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label for="proj-start-date">Start Date <span class="required">*</span></label>
              <input type="date" id="proj-start-date" class="form-input" required value="${projectToEdit?.start_date || today}">
            </div>

            <div class="form-group col-half">
              <label for="proj-target-date">Target Deadline <span class="required">*</span></label>
              <input type="date" id="proj-target-date" class="form-input" required value="${projectToEdit?.target_date || today}">
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-modal-submit">
              ${isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Inject modal into DOM
  const existingModal = document.getElementById('project-modal-overlay');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.getElementById('project-modal-overlay');
  const form = document.getElementById('project-form');

  const closeModal = () => modalEl.remove();

  modalEl.querySelector('#btn-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#btn-modal-cancel').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('proj-name').value.trim();
    const description = document.getElementById('proj-desc').value.trim();
    const category = document.getElementById('proj-category').value;
    const priority = document.getElementById('proj-priority').value;
    const start_date = document.getElementById('proj-start-date').value;
    const target_date = document.getElementById('proj-target-date').value;

    if (!name || !start_date || !target_date) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    if (new Date(target_date) < new Date(start_date)) {
      showToast('Target deadline cannot be before the start date.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-modal-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      if (isEdit) {
        await updateProject(projectToEdit.id, {
          name,
          description,
          category,
          priority,
          start_date,
          target_date
        });
        showToast('Project updated successfully.', 'success');
      } else {
        const newProj = await createProject({
          name,
          description,
          category,
          priority,
          start_date,
          target_date
        });
        selectedProjectId = newProj.id;
        showToast('Project created successfully.', 'success');
      }
      closeModal();
      if (container) {
        await loadProjectsData(container);
      } else {
        window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'projects' }));
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Project';
    }
  });
}

// ==============================================================================
// Task Creation / Editing Modal
// ==============================================================================
export function openTaskModal(taskToEdit = null, project, container = null) {
  const isEdit = !!taskToEdit;
  const today = getTodayKolkata();

  const modalHtml = `
    <div class="modal-overlay animate-fade-in" id="task-modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Task' : 'Add Task to ' + escapeHtml(project.name)}</h3>
          <button class="modal-close" id="btn-task-modal-close">&times;</button>
        </div>
        <form id="task-form" class="modal-body">
          <div class="form-group">
            <label for="task-name">Task Name <span class="required">*</span></label>
            <input type="text" id="task-name" class="form-input" required maxlength="200" placeholder="e.g. Design Landing Page Wireframes" value="${escapeHtml(taskToEdit?.name || '')}">
          </div>

          <div class="form-group">
            <label for="task-desc">Task Description</label>
            <textarea id="task-desc" class="form-textarea" rows="2" placeholder="Specific steps, checklist items, or notes...">${escapeHtml(taskToEdit?.description || '')}</textarea>
          </div>

          <div class="form-group">
            <label for="task-priority">Priority</label>
            <select id="task-priority" class="form-select">
              ${['Low', 'Medium', 'High', 'Critical'].map(p => `
                <option value="${p}" ${(taskToEdit?.priority || 'Medium') === p ? 'selected' : ''}>${p}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label for="task-start-date">Start Date <span class="required">*</span></label>
              <input type="date" id="task-start-date" class="form-input" required value="${taskToEdit?.start_date || project.start_date || today}">
            </div>

            <div class="form-group col-half">
              <label for="task-target-date">Target Deadline <span class="required">*</span></label>
              <input type="date" id="task-target-date" class="form-input" required value="${taskToEdit?.target_date || project.target_date || today}">
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-task-modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-task-modal-submit">
              ${isEdit ? 'Save Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const existingModal = document.getElementById('task-modal-overlay');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.getElementById('task-modal-overlay');
  const form = document.getElementById('task-form');

  const closeModal = () => modalEl.remove();

  modalEl.querySelector('#btn-task-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#btn-task-modal-cancel').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('task-name').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const priority = document.getElementById('task-priority').value;
    const start_date = document.getElementById('task-start-date').value;
    const target_date = document.getElementById('task-target-date').value;

    if (!name || !start_date || !target_date) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    if (new Date(target_date) < new Date(start_date)) {
      showToast('Task deadline cannot be earlier than its start date.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-task-modal-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      if (isEdit) {
        await updateProjectTask(taskToEdit.id, {
          name,
          description,
          priority,
          start_date,
          target_date
        });
        showToast('Task updated.', 'success');
      } else {
        await createProjectTask({
          project_id: project.id,
          name,
          description,
          priority,
          start_date,
          target_date
        });
        showToast('Task added to project.', 'success');
      }
      closeModal();
      if (container) await loadProjectsData(container);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Save Task' : 'Add Task';
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
