// ==============================================================================
// PRIMNGMT: Notes Workspace View Module
// Personal Markdown Knowledge Management, Dual-Tab Editor, Tag Manager & Image Pasting
// ==============================================================================

import {
  fetchNotes,
  fetchNoteById,
  createNote,
  updateNote,
  deleteNote,
  uploadNoteImage,
  fetchProjects
} from '../api.js';
import { parseMarkdown, escapeHtml, extractPlainTextPreview } from '../utils/markdown.js';
import { formatDate, formatDateTime } from '../utils/date-utils.js';
import { showToast } from '../utils/notifications.js';

// Available categories
export const NOTE_CATEGORIES = [
  'Meeting Notes',
  'Learning Notes',
  'Technical Notes',
  'Project Ideas',
  'Research',
  'Personal',
  'Documentation',
  'Other'
];

// Map category to CSS class for colored badges
function getCategoryBadgeClass(category) {
  switch (category) {
    case 'Meeting Notes': return 'cat-meeting';
    case 'Learning Notes': return 'cat-learning';
    case 'Technical Notes': return 'cat-technical';
    case 'Project Ideas': return 'cat-ideas';
    case 'Research': return 'cat-research';
    case 'Personal': return 'cat-personal';
    case 'Documentation': return 'cat-documentation';
    default: return 'cat-other';
  }
}

// Module-level state
let notesList = [];
let projectsList = [];
let activeCategory = 'all';
let activeTag = 'all';
let activeProjectId = 'all';
let activeSort = 'updated_desc';
let searchQuery = '';
let searchDebounceTimeout = null;

/**
 * Main entry point for the Notes view
 * @param {HTMLElement} container - DOM container element
 * @param {string} [targetNoteId] - Optional note ID to view immediately
 */
export async function renderNotes(container, targetNoteId = null) {
  container.innerHTML = `
    <div class="view-loading">
      <div class="spinner"></div>
      <p>Loading your notes workspace...</p>
    </div>
  `;

  await loadNotesData(container, targetNoteId);
}

/**
 * Fetch notes and projects, then render the layout
 */
async function loadNotesData(container, targetNoteId = null) {
  try {
    const [notes, projects] = await Promise.all([
      fetchNotes({
        category: activeCategory,
        tag: activeTag,
        projectId: activeProjectId,
        search: searchQuery,
        sort: activeSort
      }),
      fetchProjects()
    ]);

    notesList = notes;
    projectsList = projects || [];

    renderNotesLayout(container);

    // If a specific note ID was requested, open its viewer
    if (targetNoteId) {
      const targetNote = notesList.find(n => n.id === targetNoteId);
      if (targetNote) {
        openNoteViewerModal(targetNote, container);
      }
    }
  } catch (err) {
    console.error('loadNotesData error:', err);
    container.innerHTML = `
      <div class="error-banner">
        <h3>Error loading notes</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary mt-2" id="btn-retry-notes">Retry</button>
      </div>
    `;
    container.querySelector('#btn-retry-notes')?.addEventListener('click', () => renderNotes(container));
  }
}

/**
 * Extract all unique tags across the loaded notes
 */
function getAllTags() {
  const tagsSet = new Set();
  notesList.forEach(n => {
    if (Array.isArray(n.tags)) {
      n.tags.forEach(t => {
        if (t && String(t).trim()) tagsSet.add(String(t).trim().toLowerCase());
      });
    }
  });
  return Array.from(tagsSet).sort();
}

/**
 * Render the full Notes Workspace UI
 */
function renderNotesLayout(container) {
  const allTags = getAllTags();
  const hasActiveFilters = activeCategory !== 'all' || activeTag !== 'all' || activeProjectId !== 'all' || searchQuery.trim() !== '';

  container.innerHTML = `
    <div class="notes-view-container animate-fade-in">
      <!-- Workspace Header -->
      <div class="view-header">
        <div>
          <h2>Notes Workspace</h2>
          <p class="text-secondary">Personal Markdown knowledge management, meeting minutes, and project documentation.</p>
        </div>
        <div class="view-header-actions">
          <span class="notes-stats-badge">
            <span>📝</span> ${notesList.length} ${notesList.length === 1 ? 'Note' : 'Notes'}
          </span>
          <button class="btn btn-primary" id="btn-create-note">
            <span class="icon">+</span> New Note
          </button>
        </div>
      </div>

      <!-- Controls & Filter Toolbar -->
      <div class="notes-controls-bar">
        <!-- Search Input -->
        <div class="notes-search-wrapper">
          <span class="notes-search-icon">🔍</span>
          <input
            type="text"
            id="notes-search-input"
            class="notes-search-input"
            placeholder="Search notes by title or content..."
            value="${escapeHtml(searchQuery)}"
            autocomplete="off"
          />
          <button
            class="notes-search-clear"
            id="btn-clear-search"
            title="Clear search"
            style="${searchQuery ? 'display: block;' : 'display: none;'}"
          >&times;</button>
        </div>

        <!-- Filter Dropdowns -->
        <div class="notes-filters-group">
          <!-- Category Filter -->
          <select id="filter-category" class="notes-filter-select" title="Filter by category">
            <option value="all" ${activeCategory === 'all' ? 'selected' : ''}>All Categories</option>
            ${NOTE_CATEGORIES.map(cat => `
              <option value="${cat}" ${activeCategory === cat ? 'selected' : ''}>${cat}</option>
            `).join('')}
          </select>

          <!-- Tag Filter -->
          <select id="filter-tag" class="notes-filter-select" title="Filter by tag">
            <option value="all" ${activeTag === 'all' ? 'selected' : ''}>All Tags</option>
            ${allTags.map(tag => `
              <option value="${tag}" ${activeTag === tag ? 'selected' : ''}>#${escapeHtml(tag)}</option>
            `).join('')}
          </select>

          <!-- Project Filter -->
          <select id="filter-project" class="notes-filter-select" title="Filter by associated project">
            <option value="all" ${activeProjectId === 'all' ? 'selected' : ''}>All Projects</option>
            <option value="none" ${activeProjectId === 'none' ? 'selected' : ''}>Standalone (No Project)</option>
            ${projectsList.map(p => `
              <option value="${p.id}" ${activeProjectId === p.id ? 'selected' : ''}>📁 ${escapeHtml(p.name)}</option>
            `).join('')}
          </select>

          <!-- Sort Dropdown -->
          <select id="filter-sort" class="notes-filter-select" title="Sort notes">
            <option value="updated_desc" ${activeSort === 'updated_desc' ? 'selected' : ''}>Updated (Newest)</option>
            <option value="updated_asc" ${activeSort === 'updated_asc' ? 'selected' : ''}>Updated (Oldest)</option>
            <option value="created_desc" ${activeSort === 'created_desc' ? 'selected' : ''}>Created (Newest)</option>
            <option value="created_asc" ${activeSort === 'created_asc' ? 'selected' : ''}>Created (Oldest)</option>
            <option value="title_asc" ${activeSort === 'title_asc' ? 'selected' : ''}>Title (A to Z)</option>
            <option value="title_desc" ${activeSort === 'title_desc' ? 'selected' : ''}>Title (Z to A)</option>
          </select>

          ${hasActiveFilters ? `
            <button class="btn btn-secondary btn-sm" id="btn-reset-filters" title="Reset all active filters">
              Reset Filters
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Notes Grid / Empty State -->
      ${notesList.length === 0 ? `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <h3>${hasActiveFilters ? 'No notes match your filters' : 'Your Notes Workspace is Empty'}</h3>
          <p class="text-secondary">
            ${hasActiveFilters
              ? 'Try clearing your search query or choosing different category and tag filters.'
              : 'Capture your thoughts, write documentation, take meeting minutes, and paste screenshots.'}
          </p>
          <div class="mt-3">
            ${hasActiveFilters ? `
              <button class="btn btn-secondary" id="btn-empty-reset">Reset Filters</button>
            ` : `
              <button class="btn btn-primary" id="btn-empty-create">
                <span class="icon">+</span> Create Your First Note
              </button>
            `}
          </div>
        </div>
      ` : `
        <div class="notes-cards-grid">
          ${notesList.map(note => renderNoteCardHtml(note)).join('')}
        </div>
      `}
    </div>
  `;

  attachWorkspaceEventListeners(container);
}

/**
 * Generate HTML string for an individual note card
 */
function renderNoteCardHtml(note) {
  const catClass = getCategoryBadgeClass(note.category);
  const plainSnippet = extractPlainTextPreview(note.content, 140);
  const projectName = note.projects?.name || null;
  const tags = Array.isArray(note.tags) ? note.tags : [];
  const updatedDateStr = formatDate(note.updated_at);

  return `
    <article class="note-card" data-note-id="${note.id}">
      <div>
        <div class="note-card-top">
          <div class="note-card-badges">
            <span class="note-category-badge ${catClass}">${escapeHtml(note.category || 'Personal')}</span>
            ${projectName ? `
              <span class="note-project-badge" title="Project: ${escapeHtml(projectName)}">
                <span>📁</span> ${escapeHtml(projectName)}
              </span>
            ` : ''}
          </div>
          <div class="note-card-actions" onclick="event.stopPropagation();">
            <button class="btn-icon-sm btn-edit-note" data-note-id="${note.id}" title="Edit Note">✏️</button>
            <button class="btn-icon-sm btn-danger-hover btn-delete-note" data-note-id="${note.id}" title="Delete Note">🗑️</button>
          </div>
        </div>

        <h3 class="note-card-title">${escapeHtml(note.title)}</h3>
        <p class="note-card-snippet">${escapeHtml(plainSnippet)}</p>
      </div>

      <div>
        ${tags.length > 0 ? `
          <div class="note-card-tags" onclick="event.stopPropagation();">
            ${tags.slice(0, 5).map(t => `
              <span class="note-tag-chip" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>
            `).join('')}
            ${tags.length > 5 ? `<span class="note-tag-chip">+${tags.length - 5}</span>` : ''}
          </div>
        ` : ''}

        <div class="note-card-footer">
          <span>Updated ${updatedDateStr}</span>
          <span class="text-secondary">Read Note &rarr;</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Attach event listeners to the workspace elements
 */
function attachWorkspaceEventListeners(container) {
  // "+ New Note" Header button
  container.querySelector('#btn-create-note')?.addEventListener('click', () => {
    openNoteEditorModal(null, container);
  });

  // Empty state buttons
  container.querySelector('#btn-empty-create')?.addEventListener('click', () => {
    openNoteEditorModal(null, container);
  });
  container.querySelector('#btn-empty-reset')?.addEventListener('click', () => {
    resetFilters(container);
  });
  container.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
    resetFilters(container);
  });

  // Search input with debounce
  const searchInput = container.querySelector('#notes-search-input');
  const clearSearchBtn = container.querySelector('#btn-clear-search');

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (clearSearchBtn) {
      clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    }

    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(async () => {
      await loadNotesData(container);
    }, 300);
  });

  clearSearchBtn?.addEventListener('click', async () => {
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    await loadNotesData(container);
  });

  // Category filter
  container.querySelector('#filter-category')?.addEventListener('change', async (e) => {
    activeCategory = e.target.value;
    await loadNotesData(container);
  });

  // Tag filter
  container.querySelector('#filter-tag')?.addEventListener('change', async (e) => {
    activeTag = e.target.value;
    await loadNotesData(container);
  });

  // Project filter
  container.querySelector('#filter-project')?.addEventListener('change', async (e) => {
    activeProjectId = e.target.value;
    await loadNotesData(container);
  });

  // Sort filter
  container.querySelector('#filter-sort')?.addEventListener('change', async (e) => {
    activeSort = e.target.value;
    await loadNotesData(container);
  });

  // Card click -> Open reader modal
  container.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', () => {
      const noteId = card.getAttribute('data-note-id');
      const note = notesList.find(n => n.id === noteId);
      if (note) openNoteViewerModal(note, container);
    });
  });

  // Edit Note button on card
  container.querySelectorAll('.btn-edit-note').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteId = btn.getAttribute('data-note-id');
      const note = notesList.find(n => n.id === noteId);
      if (note) openNoteEditorModal(note, container);
    });
  });

  // Delete Note button on card
  container.querySelectorAll('.btn-delete-note').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const noteId = btn.getAttribute('data-note-id');
      const note = notesList.find(n => n.id === noteId);
      if (!note) return;

      if (!confirm(`Are you sure you want to delete note "${note.title}"? This cannot be undone.`)) {
        return;
      }

      try {
        await deleteNote(note.id);
        showToast('Note deleted successfully.', 'info');
        await loadNotesData(container);
      } catch (err) {
        showToast(`Error deleting note: ${err.message}`, 'error');
      }
    });
  });

  // Tag chip click on card -> instantly filter by tag
  container.querySelectorAll('.note-tag-chip[data-tag]').forEach(chip => {
    chip.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tag = chip.getAttribute('data-tag');
      if (tag) {
        activeTag = tag;
        await loadNotesData(container);
      }
    });
  });
}

function resetFilters(container) {
  activeCategory = 'all';
  activeTag = 'all';
  activeProjectId = 'all';
  searchQuery = '';
  loadNotesData(container);
}

// ==============================================================================
// Note Editor Modal (Create / Edit with Markdown Toolbar, Image Paste & Tabs)
// ==============================================================================

/**
 * Open the Note Editor modal with Edit & Preview tabs
 * @param {Object|null} noteToEdit
 * @param {HTMLElement} [container]
 * @param {string|null} [defaultProjectId]
 */
export function openNoteEditorModal(noteToEdit = null, container = null, defaultProjectId = null) {
  const isEdit = !!noteToEdit;
  let currentTags = Array.isArray(noteToEdit?.tags) ? [...noteToEdit.tags] : [];

  const modalHtml = `
    <div class="modal-overlay animate-fade-in" id="note-editor-overlay">
      <div class="modal-card modal-card-notes">
        <!-- Modal Header -->
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Note' : 'Create Note'}</h3>
          <button class="modal-close" id="btn-close-note-editor">&times;</button>
        </div>

        <!-- Dual Tabs: Edit vs Preview -->
        <div class="notes-editor-tabs">
          <button type="button" class="notes-tab-btn active" id="tab-btn-edit">
            <span>✏️</span> Edit
          </button>
          <button type="button" class="notes-tab-btn" id="tab-btn-preview">
            <span>👁️</span> Preview
          </button>
        </div>

        <!-- Form Body -->
        <form id="note-editor-form" class="notes-editor-body">
          <!-- Edit View Pane -->
          <div id="pane-edit" style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- Title -->
            <div class="form-group">
              <label for="note-input-title">Note Title <span class="required">*</span></label>
              <input
                type="text"
                id="note-input-title"
                class="form-input"
                required
                maxlength="250"
                placeholder="e.g. System Architecture Review & Milestones"
                value="${escapeHtml(noteToEdit?.title || '')}"
              />
            </div>

            <!-- Category & Associated Project -->
            <div class="form-row">
              <div class="form-group col-half">
                <label for="note-input-category">Category</label>
                <select id="note-input-category" class="form-select">
                  ${NOTE_CATEGORIES.map(cat => `
                    <option value="${cat}" ${(noteToEdit?.category || 'Personal') === cat ? 'selected' : ''}>${cat}</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group col-half">
                <label for="note-input-project">Associated Project</label>
                <select id="note-input-project" class="form-select">
                  <option value="">None (Standalone Note)</option>
                  ${projectsList.map(p => `
                    <option value="${p.id}" ${(noteToEdit?.project_id || defaultProjectId) === p.id ? 'selected' : ''}>
                      📁 ${escapeHtml(p.name)}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Tags Manager -->
            <div class="form-group">
              <label>Tags <span class="text-secondary">(Type tag and press Enter or comma)</span></label>
              <div class="tags-input-container" id="tags-chip-box">
                <!-- Rendered dynamically -->
                <input
                  type="text"
                  id="tag-text-input"
                  class="tags-text-input"
                  placeholder="Add tag..."
                  maxlength="40"
                />
              </div>
            </div>

            <!-- Markdown Toolbar -->
            <div class="notes-toolbar">
              <button type="button" class="notes-toolbar-btn" data-format="bold" title="Bold (Ctrl+B)"><b>B</b></button>
              <button type="button" class="notes-toolbar-btn" data-format="italic" title="Italic (Ctrl+I)"><i>I</i></button>
              <button type="button" class="notes-toolbar-btn" data-format="strike" title="Strikethrough"><s>S</s></button>
              
              <div class="notes-toolbar-divider"></div>
              
              <button type="button" class="notes-toolbar-btn" data-format="h1" title="Heading 1">H1</button>
              <button type="button" class="notes-toolbar-btn" data-format="h2" title="Heading 2">H2</button>
              <button type="button" class="notes-toolbar-btn" data-format="h3" title="Heading 3">H3</button>

              <div class="notes-toolbar-divider"></div>

              <button type="button" class="notes-toolbar-btn" data-format="ul" title="Bullet List">• List</button>
              <button type="button" class="notes-toolbar-btn" data-format="ol" title="Numbered List">1. List</button>
              <button type="button" class="notes-toolbar-btn" data-format="check" title="Task Checklist">☑ Check</button>

              <div class="notes-toolbar-divider"></div>

              <button type="button" class="notes-toolbar-btn" data-format="code" title="Code Block">&lt;/&gt;</button>
              <button type="button" class="notes-toolbar-btn" data-format="inline-code" title="Inline Code">\`code\`</button>
              <button type="button" class="notes-toolbar-btn" data-format="quote" title="Blockquote">” Quote</button>
              <button type="button" class="notes-toolbar-btn" data-format="link" title="Insert Link (Ctrl+K)">🔗 Link</button>

              <div class="notes-toolbar-divider"></div>

              <button type="button" class="notes-toolbar-btn" id="btn-toolbar-upload-image" title="Upload Image File">
                🖼️ Image
              </button>

              <span class="notes-toolbar-hint">
                <span>📋 Paste image directly</span>
              </span>
            </div>

            <!-- Hidden file input for manual image upload -->
            <input type="file" id="note-image-file-input" accept="image/*" style="display: none;" />

            <!-- Image Upload Status Banner -->
            <div id="image-upload-indicator" style="display: none;"></div>

            <!-- Note Content Textarea -->
            <div class="form-group">
              <label for="note-input-content">Markdown Content</label>
              <textarea
                id="note-input-content"
                class="notes-textarea"
                rows="14"
                placeholder="Write your note in Markdown... Use formatting toolbar or keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K). Paste images directly from your clipboard."
              >${escapeHtml(noteToEdit?.content || '')}</textarea>
            </div>
          </div>

          <!-- Preview Pane (Hidden by default) -->
          <div id="pane-preview" style="display: none;">
            <div class="markdown-preview-container" id="markdown-live-preview">
              <!-- Rendered via parseMarkdown() on tab switch -->
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-cancel-note-editor">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-note">
              ${isEdit ? 'Save Changes' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Remove any lingering overlay
  const existingModal = document.getElementById('note-editor-overlay');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('note-editor-overlay');
  const form = document.getElementById('note-editor-form');
  const textarea = document.getElementById('note-input-content');
  const tagBox = document.getElementById('tags-chip-box');
  const tagInput = document.getElementById('tag-text-input');
  const tabEdit = document.getElementById('tab-btn-edit');
  const tabPreview = document.getElementById('tab-btn-preview');
  const paneEdit = document.getElementById('pane-edit');
  const panePreview = document.getElementById('pane-preview');
  const previewContainer = document.getElementById('markdown-live-preview');
  const fileInput = document.getElementById('note-image-file-input');
  const uploadIndicator = document.getElementById('image-upload-indicator');

  const closeModal = () => modalEl.remove();

  modalEl.querySelector('#btn-close-note-editor').addEventListener('click', closeModal);
  modalEl.querySelector('#btn-cancel-note-editor').addEventListener('click', closeModal);

  // Tab switching: Edit vs Preview
  tabEdit.addEventListener('click', () => {
    tabEdit.classList.add('active');
    tabPreview.classList.remove('active');
    paneEdit.style.display = 'flex';
    panePreview.style.display = 'none';
  });

  tabPreview.addEventListener('click', () => {
    tabPreview.classList.add('active');
    tabEdit.classList.remove('active');
    paneEdit.style.display = 'none';
    panePreview.style.display = 'block';

    // Render live markdown
    const md = textarea.value;
    previewContainer.innerHTML = md.trim()
      ? parseMarkdown(md)
      : '<p class="text-secondary" style="font-style: italic;">Nothing to preview yet. Switch back to Edit and write some Markdown!</p>';
  });

  // Tag Chips Management
  function renderTagChips() {
    // Remove existing chips except the text input
    tagBox.querySelectorAll('.tag-badge-editable').forEach(el => el.remove());

    currentTags.forEach((tag, idx) => {
      const chip = document.createElement('span');
      chip.className = 'tag-badge-editable';
      chip.innerHTML = `
        <span>#${escapeHtml(tag)}</span>
        <button type="button" class="tag-remove-btn" data-tag-idx="${idx}" title="Remove tag">&times;</button>
      `;
      chip.querySelector('.tag-remove-btn').addEventListener('click', () => {
        currentTags.splice(idx, 1);
        renderTagChips();
      });
      tagBox.insertBefore(chip, tagInput);
    });
  }

  function addTag(raw) {
    const clean = raw.trim().replace(/^#/, '').toLowerCase();
    if (clean && !currentTags.includes(clean)) {
      currentTags.push(clean);
      renderTagChips();
    }
  }

  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput.value);
      tagInput.value = '';
    } else if (e.key === 'Backspace' && !tagInput.value && currentTags.length > 0) {
      currentTags.pop();
      renderTagChips();
    }
  });

  tagInput.addEventListener('blur', () => {
    if (tagInput.value.trim()) {
      addTag(tagInput.value);
      tagInput.value = '';
    }
  });

  renderTagChips();

  // Helper for inserting markdown text around current cursor selection
  function insertFormat(before, after = '', placeholder = '') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end) || placeholder;

    const replacement = `${before}${selected}${after}`;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();

    const newCursorPos = start + before.length + selected.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }

  // Toolbar button formatting handlers
  modalEl.querySelectorAll('.notes-toolbar-btn[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.getAttribute('data-format');
      switch (format) {
        case 'bold':
          insertFormat('**', '**', 'bold text');
          break;
        case 'italic':
          insertFormat('*', '*', 'italic text');
          break;
        case 'strike':
          insertFormat('~~', '~~', 'strikethrough text');
          break;
        case 'h1':
          insertFormat('\n# ', '\n', 'Heading 1');
          break;
        case 'h2':
          insertFormat('\n## ', '\n', 'Heading 2');
          break;
        case 'h3':
          insertFormat('\n### ', '\n', 'Heading 3');
          break;
        case 'ul':
          insertFormat('\n- ', '\n', 'List item');
          break;
        case 'ol':
          insertFormat('\n1. ', '\n', 'List item');
          break;
        case 'check':
          insertFormat('\n- [ ] ', '\n', 'Checklist item');
          break;
        case 'code':
          insertFormat('\n```javascript\n', '\n```\n', '// write code here');
          break;
        case 'inline-code':
          insertFormat('`', '`', 'code');
          break;
        case 'quote':
          insertFormat('\n> ', '\n', 'Quote text');
          break;
        case 'link':
          insertFormat('[', '](https://example.com)', 'link text');
          break;
      }
    });
  });

  // Keyboard Shortcuts (Ctrl+B, Ctrl+I, Ctrl+K)
  textarea.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormat('**', '**', 'bold text');
    } else if (e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormat('*', '*', 'italic text');
    } else if (e.key.toLowerCase() === 'k') {
      e.preventDefault();
      insertFormat('[', '](https://example.com)', 'link text');
    }
  });

  // Image Uploading Handler
  async function handleImageUpload(file) {
    if (!file) return;

    uploadIndicator.style.display = 'flex';
    uploadIndicator.className = 'image-upload-status uploading';
    uploadIndicator.innerHTML = `<span>⏳ Uploading image (${(file.size / 1024).toFixed(1)} KB)...</span>`;

    try {
      const result = await uploadNoteImage(file, file.name);
      uploadIndicator.className = 'image-upload-status success';
      uploadIndicator.innerHTML = `<span>✓ Image uploaded successfully!</span>`;

      // Insert markdown image syntax at cursor
      const imgMarkdown = `\n![${escapeHtml(file.name || 'image')}](${result.signedUrl})\n`;
      insertFormat(imgMarkdown, '', '');

      setTimeout(() => {
        uploadIndicator.style.display = 'none';
      }, 3000);
    } catch (err) {
      console.error('Image upload failed:', err);
      uploadIndicator.className = 'image-upload-status error';
      uploadIndicator.innerHTML = `<span>❌ Upload failed: ${escapeHtml(err.message)}</span>`;
      showToast(`Image upload failed: ${err.message}`, 'error');
    }
  }

  // Clipboard Image Paste Handler
  textarea.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handleImageUpload(file);
        }
        break;
      }
    }
  });

  // Manual File Upload Button
  modalEl.querySelector('#btn-toolbar-upload-image')?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    if (fileInput.files && fileInput.files[0]) {
      await handleImageUpload(fileInput.files[0]);
      fileInput.value = ''; // reset so same file can be selected again
    }
  });

  // Form Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('note-input-title').value.trim();
    const content = textarea.value;
    const category = document.getElementById('note-input-category').value;
    const project_id = document.getElementById('note-input-project').value || null;

    if (!title) {
      showToast('Please enter a note title.', 'error');
      return;
    }

    const saveBtn = document.getElementById('btn-save-note');
    saveBtn.disabled = true;
    saveBtn.textContent = isEdit ? 'Saving...' : 'Creating...';

    try {
      if (isEdit) {
        await updateNote(noteToEdit.id, {
          title,
          content,
          category,
          tags: currentTags,
          project_id
        });
        showToast('Note updated successfully.', 'success');
      } else {
        await createNote({
          title,
          content,
          category,
          tags: currentTags,
          project_id
        });
        showToast('Note created successfully!', 'success');
      }

      closeModal();
      if (container) {
        await loadNotesData(container);
      }
    } catch (err) {
      console.error('Note save error:', err);
      showToast(`Error saving note: ${err.message}`, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Note';
    }
  });
}

// ==============================================================================
// Note Viewer Modal (Distraction-Free Reading Mode)
// ==============================================================================

/**
 * Open the Note Reader View modal
 * @param {Object} note
 * @param {HTMLElement} container
 */
export function openNoteViewerModal(note, container) {
  const catClass = getCategoryBadgeClass(note.category);
  const projectName = note.projects?.name || null;
  const tags = Array.isArray(note.tags) ? note.tags : [];
  const parsedHtml = parseMarkdown(note.content);

  const modalHtml = `
    <div class="modal-overlay animate-fade-in" id="note-viewer-overlay">
      <div class="modal-card modal-card-notes">
        <!-- Header -->
        <div class="modal-header">
          <div class="note-viewer-meta">
            <span class="note-category-badge ${catClass}">${escapeHtml(note.category || 'Personal')}</span>
            ${projectName ? `
              <span class="note-project-badge">
                <span>📁</span> ${escapeHtml(projectName)}
              </span>
            ` : ''}
            <span>• Updated ${formatDateTime(note.updated_at)}</span>
          </div>
          <button class="modal-close" id="btn-close-note-viewer">&times;</button>
        </div>

        <!-- Body -->
        <div class="notes-editor-body">
          <div class="note-viewer-header">
            <h1 class="note-viewer-title">${escapeHtml(note.title)}</h1>
            ${tags.length > 0 ? `
              <div class="note-card-tags">
                ${tags.map(t => `<span class="note-tag-chip">#${escapeHtml(t)}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          <div class="markdown-preview-container note-viewer-content">
            ${parsedHtml || '<p class="text-secondary" style="font-style: italic;">No content in this note.</p>'}
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer" style="justify-content: space-between;">
          <button type="button" class="btn btn-danger btn-sm" id="btn-viewer-delete">
            🗑️ Delete Note
          </button>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary" id="btn-viewer-close">Close</button>
            <button type="button" class="btn btn-primary" id="btn-viewer-edit">✏️ Edit Note</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById('note-viewer-overlay');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('note-viewer-overlay');
  const closeModal = () => modalEl.remove();

  modalEl.querySelector('#btn-close-note-viewer').addEventListener('click', closeModal);
  modalEl.querySelector('#btn-viewer-close').addEventListener('click', closeModal);

  // Edit Note
  modalEl.querySelector('#btn-viewer-edit').addEventListener('click', () => {
    closeModal();
    openNoteEditorModal(note, container);
  });

  // Delete Note
  modalEl.querySelector('#btn-viewer-delete').addEventListener('click', async () => {
    if (!confirm(`Are you sure you want to delete note "${note.title}"?`)) {
      return;
    }

    try {
      await deleteNote(note.id);
      showToast('Note deleted successfully.', 'info');
      closeModal();
      if (container) {
        await loadNotesData(container);
      }
    } catch (err) {
      showToast(`Error deleting note: ${err.message}`, 'error');
    }
  });
}
