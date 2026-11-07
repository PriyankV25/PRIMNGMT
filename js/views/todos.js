// ==============================================================================
// To-Do List Management (Feature 2)
// Modern Digital Sticky Notes Workspace (Daily, Weekly, Monthly To-Dos)
// ==============================================================================

import {
  fetchTodos,
  createTodo,
  updateTodo,
  toggleTodoComplete,
  deleteTodo
} from '../api.js';
import { formatDate, getTodayKolkata, getDeadlineInfo, addDays } from '../utils/date-utils.js';
import { showToast } from '../utils/notifications.js';

let activeTodos = [];
let currentTab = 'all'; // 'all' | 'daily' | 'weekly' | 'monthly'

const STICKY_COLORS = [
  { id: 'yellow', label: 'Warm Amber', bg: '#fef9c3', border: '#fde047', accent: '#ca8a04' },
  { id: 'peach', label: 'Sunset Peach', bg: '#ffedd5', border: '#fed7aa', accent: '#ea580c' },
  { id: 'green', label: 'Mint Herbal', bg: '#dcfce7', border: '#bbf7d0', accent: '#16a34a' },
  { id: 'blue', label: 'Sky Azure', bg: '#e0f2fe', border: '#bae6fd', accent: '#0284c7' },
  { id: 'purple', label: 'Soft Lavender', bg: '#ede9fe', border: '#ddd6fe', accent: '#7c3aed' },
  { id: 'pink', label: 'Rose Blush', bg: '#fce7f3', border: '#fbcfe8', accent: '#db2777' }
];

export async function renderTodos(container) {
  container.innerHTML = `
    <div class="view-loading">
      <div class="spinner"></div>
      <p>Arranging your sticky notes workspace...</p>
    </div>
  `;

  await loadTodosData(container);
}

async function loadTodosData(container) {
  try {
    activeTodos = await fetchTodos('all');
    renderTodosLayout(container);
  } catch (err) {
    console.error('loadTodosData error:', err);
    container.innerHTML = `
      <div class="error-banner">
        <h3>Could not load to-do notes</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary mt-2" id="btn-retry-todos">Retry</button>
      </div>
    `;
    container.querySelector('#btn-retry-todos')?.addEventListener('click', () => renderTodos(container));
  }
}

function renderTodosLayout(container) {
  const dailyCount = activeTodos.filter(t => t.type === 'daily').length;
  const weeklyCount = activeTodos.filter(t => t.type === 'weekly').length;
  const monthlyCount = activeTodos.filter(t => t.type === 'monthly').length;

  let filteredTodos = activeTodos;
  if (currentTab !== 'all') {
    filteredTodos = activeTodos.filter(t => t.type === currentTab);
  }

  // Pre-calculate rotation angles to create realistic subtle pinboard tilt
  const rotationAngles = [-1.5, 1.2, -0.8, 1.6, -1.2, 0.9, -1.4, 1.3];

  container.innerHTML = `
    <div class="todos-workspace-wrapper animate-fade-in">
      <!-- Top Action Bar & Workspace Controls -->
      <div class="view-header">
        <div>
          <h2>Sticky Notes To-Do Workspace</h2>
          <p class="text-secondary">Capture your daily, weekly, and monthly deliverables on digital sticky notes.</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-primary" id="btn-create-todo">
            <span class="icon">📌</span> Post New Note
          </button>
        </div>
      </div>

      <!-- Navigation Filter Tabs -->
      <div class="sticky-tabs-bar">
        <div class="sticky-nav-tabs">
          <button class="sticky-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">
            <span class="tab-emoji">📋</span> All Notes (${activeTodos.length})
          </button>
          <button class="sticky-tab ${currentTab === 'daily' ? 'active' : ''}" data-tab="daily">
            <span class="tab-emoji">☀️</span> Daily To-Dos (${dailyCount})
          </button>
          <button class="sticky-tab ${currentTab === 'weekly' ? 'active' : ''}" data-tab="weekly">
            <span class="tab-emoji">🗓️</span> Weekly To-Dos (${weeklyCount})
          </button>
          <button class="sticky-tab ${currentTab === 'monthly' ? 'active' : ''}" data-tab="monthly">
            <span class="tab-emoji">🎯</span> Monthly To-Dos (${monthlyCount})
          </button>
        </div>
      </div>

      <!-- Digital Pinboard / Grid of Sticky Notes -->
      <div class="sticky-pinboard-grid">
        ${filteredTodos.length === 0 ? `
          <div class="empty-pinboard-state">
            <div class="empty-pinboard-card">
              <span class="pin-graphic">📌</span>
              <h3>No Sticky Notes in ${currentTab.toUpperCase()}</h3>
              <p>Your corkboard is clean! Click "Post New Note" to pin your next to-do item.</p>
              <button class="btn btn-primary mt-3" id="btn-create-todo-empty">+ Post Note</button>
            </div>
          </div>
        ` : filteredTodos.map((todo, idx) => {
          const isDone = todo.status === 'completed';
          const angle = rotationAngles[idx % rotationAngles.length];
          const deadline = getDeadlineInfo(todo.target_date, todo.status);
          const colorClass = `sticky-color-${todo.color || 'yellow'}`;

          return `
            <div class="sticky-note-card ${colorClass} ${isDone ? 'is-completed' : ''}" 
                 style="--tilt-angle: ${angle}deg;" 
                 data-todo-id="${todo.id}">
              
              <!-- Sticky Tape / Pushpin Graphic -->
              <div class="sticky-pin-strip">
                <span class="sticky-tape-graphic"></span>
              </div>

              <!-- Top Bar: Type Pill & Quick Actions -->
              <div class="sticky-top-bar">
                <span class="sticky-type-badge">${todo.type} to-do</span>
                <span class="sticky-priority-pill priority-${todo.priority.toLowerCase()}">${todo.priority}</span>
              </div>

              <!-- Note Title & Content -->
              <div class="sticky-body">
                <h3 class="sticky-title ${isDone ? 'completed-text' : ''}">${escapeHtml(todo.title)}</h3>
                ${todo.description ? `<p class="sticky-desc ${isDone ? 'completed-text' : ''}">${escapeHtml(todo.description)}</p>` : ''}
              </div>

              <!-- Completed Watermark Stamp (revealed when done) -->
              ${isDone ? `<div class="completed-stamp animate-pop-in">COMPLETED</div>` : ''}

              <!-- Bottom Bar: Date & Interactive Checkbox -->
              <div class="sticky-footer">
                <div class="sticky-footer-left">
                  <span class="sticky-date">📅 ${formatDate(todo.target_date)}</span>
                  <span class="badge ${deadline.badgeClass}">${deadline.label}</span>
                </div>

                <div class="sticky-footer-right">
                  <!-- Checkbox toggle -->
                  <label class="sticky-checkbox-label" title="${isDone ? 'Mark Incomplete' : 'Mark Completed'}">
                    <input type="checkbox" class="sticky-chk" data-todo-id="${todo.id}" ${isDone ? 'checked' : ''}>
                    <span class="sticky-chk-custom"></span>
                  </label>
                  <!-- Edit & Delete buttons -->
                  <div class="sticky-hover-actions">
                    <button class="btn-icon btn-edit-todo" title="Edit Note" data-todo-id="${todo.id}">✏️</button>
                    <button class="btn-icon btn-delete-todo text-danger" title="Delete Note" data-todo-id="${todo.id}">🗑️</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  bindTodosEvents(container);
}

function bindTodosEvents(container) {
  // New Note button
  container.querySelectorAll('#btn-create-todo, #btn-create-todo-empty').forEach(btn => {
    btn.addEventListener('click', () => openTodoModal(null, container));
  });

  // Filter Tabs
  container.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.getAttribute('data-tab');
      renderTodosLayout(container);
    });
  });

  // Checkbox toggle
  container.querySelectorAll('.sticky-chk').forEach(chk => {
    chk.addEventListener('change', async () => {
      const todoId = chk.getAttribute('data-todo-id');
      const todo = activeTodos.find(t => t.id === todoId);
      if (!todo) return;

      const isCompleted = chk.checked;
      try {
        await toggleTodoComplete(todo);
        showToast(isCompleted ? 'Sticky note marked completed! Added to History.' : 'Sticky note reopened.', 'success');
        await loadTodosData(container);
      } catch (err) {
        showToast(`Error updating to-do: ${err.message}`, 'error');
        chk.checked = !chk.checked; // revert
      }
    });
  });

  // Edit Note
  container.querySelectorAll('.btn-edit-todo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const todoId = btn.getAttribute('data-todo-id');
      const todo = activeTodos.find(t => t.id === todoId);
      if (todo) openTodoModal(todo, container);
    });
  });

  // Delete Note
  container.querySelectorAll('.btn-delete-todo').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const todoId = btn.getAttribute('data-todo-id');
      const todo = activeTodos.find(t => t.id === todoId);
      if (!todo) return;

      if (!confirm(`Delete sticky note "${todo.title}"?`)) return;

      try {
        await deleteTodo(todo.id);
        showToast('Sticky note removed.', 'info');
        await loadTodosData(container);
      } catch (err) {
        showToast(`Error deleting to-do: ${err.message}`, 'error');
      }
    });
  });
}

// ==============================================================================
// Sticky Note Modal (Create & Edit)
// ==============================================================================
export function openTodoModal(todoToEdit = null, container = null) {
  const isEdit = !!todoToEdit;
  const today = getTodayKolkata();

  let defaultTargetDate = today;
  if (!isEdit) {
    if (currentTab === 'weekly') {
      defaultTargetDate = addDays(today, 7);
    } else if (currentTab === 'monthly') {
      defaultTargetDate = addDays(today, 30);
    }
  }

  const selectedColor = todoToEdit?.color || 'yellow';

  const modalHtml = `
    <div class="modal-overlay animate-fade-in" id="todo-modal-overlay">
      <div class="modal-card modal-card-sticky">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Sticky Note' : 'Post New Sticky Note'}</h3>
          <button class="modal-close" id="btn-todo-modal-close">&times;</button>
        </div>
        <form id="todo-form" class="modal-body">
          <div class="form-group">
            <label for="todo-title">Note Title / Activity <span class="required">*</span></label>
            <input type="text" id="todo-title" class="form-input" required maxlength="180" placeholder="e.g. Review personal tax filing or Ship feature branch" value="${escapeHtml(todoToEdit?.title || '')}">
          </div>

          <div class="form-group">
            <label for="todo-desc">Details / Notes</label>
            <textarea id="todo-desc" class="form-textarea" rows="3" placeholder="Add checklist points, links, or notes...">${escapeHtml(todoToEdit?.description || '')}</textarea>
          </div>

          <!-- Color Swatch Selector -->
          <div class="form-group">
            <label>Sticky Note Color</label>
            <div class="color-swatches" id="color-swatches-container">
              ${STICKY_COLORS.map(c => `
                <label class="color-swatch-item">
                  <input type="radio" name="todo-color" value="${c.id}" ${selectedColor === c.id ? 'checked' : ''}>
                  <span class="color-swatch-circle" style="background-color: ${c.bg}; border-color: ${c.border};" title="${c.label}"></span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label for="todo-type">List Type</label>
              <select id="todo-type" class="form-select">
                <option value="daily" ${(todoToEdit?.type || currentTab) === 'daily' ? 'selected' : ''}>☀️ Daily To-Do</option>
                <option value="weekly" ${(todoToEdit?.type || currentTab) === 'weekly' ? 'selected' : ''}>🗓️ Weekly To-Do</option>
                <option value="monthly" ${(todoToEdit?.type || currentTab) === 'monthly' ? 'selected' : ''}>🎯 Monthly To-Do</option>
              </select>
            </div>

            <div class="form-group col-half">
              <label for="todo-priority">Priority</label>
              <select id="todo-priority" class="form-select">
                ${['Low', 'Medium', 'High', 'Critical'].map(p => `
                  <option value="${p}" ${(todoToEdit?.priority || 'Medium') === p ? 'selected' : ''}>${p}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="todo-target-date">Deadline Date <span class="required">*</span></label>
            <input type="date" id="todo-target-date" class="form-input" required value="${todoToEdit?.target_date || defaultTargetDate}">
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-todo-modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-todo-modal-submit">
              ${isEdit ? 'Save Changes' : 'Pin Note to Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const existingModal = document.getElementById('todo-modal-overlay');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.getElementById('todo-modal-overlay');
  const form = document.getElementById('todo-form');

  const closeModal = () => modalEl.remove();

  modalEl.querySelector('#btn-todo-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#btn-todo-modal-cancel').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('todo-title').value.trim();
    const description = document.getElementById('todo-desc').value.trim();
    const type = document.getElementById('todo-type').value;
    const priority = document.getElementById('todo-priority').value;
    const target_date = document.getElementById('todo-target-date').value;
    const color = form.querySelector('input[name="todo-color"]:checked')?.value || 'yellow';

    if (!title || !target_date) {
      showToast('Please provide a title and deadline.', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-todo-modal-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    try {
      if (isEdit) {
        await updateTodo(todoToEdit.id, {
          title,
          description,
          type,
          color,
          priority,
          target_date
        });
        showToast('Sticky note updated.', 'success');
      } else {
        await createTodo({
          title,
          description,
          type,
          color,
          priority,
          target_date
        });
        showToast('New sticky note pinned!', 'success');
      }
      closeModal();
      if (container) {
        await loadTodosData(container);
      } else {
        window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'todos' }));
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Save Changes' : 'Pin Note to Board';
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
