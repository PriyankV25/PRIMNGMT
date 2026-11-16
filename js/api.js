// ==============================================================================
// Database Operations & API Service (Supabase CRUD)
// Row Level Security (RLS) automatically scopes all queries to auth.uid()
// ==============================================================================

import { getSupabase } from './config.js';
import { getCurrentUser } from './auth.js';

function getClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client is not available');
  return supabase;
}

function requireUserId() {
  const user = getCurrentUser();
  if (!user?.id) throw new Error('User is not authenticated');
  return user.id;
}

// ==============================================================================
// 1. PROJECTS
// ==============================================================================

export async function fetchProjects() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_tasks(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchProjects error:', error.message);
    throw error;
  }
  return data || [];
}

export async function fetchProjectById(id) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_tasks(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createProject({ name, description, category, priority, start_date, target_date }) {
  const supabase = getClient();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name,
      description: description || '',
      category: category || 'General',
      priority: priority || 'Medium',
      start_date,
      target_date,
      due_date: target_date,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(id, updates) {
  const supabase = getClient();
  if (updates.target_date) {
    updates.due_date = updates.target_date;
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeProject(project, isCompleted) {
  const supabase = getClient();
  const newStatus = isCompleted ? 'completed' : 'pending';
  const completedAt = isCompleted ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('projects')
    .update({
      status: newStatus,
      completed_at: completedAt
    })
    .eq('id', project.id)
    .select()
    .single();

  if (error) throw error;

  if (isCompleted) {
    await logCompletion({
      itemId: project.id,
      itemType: 'project',
      itemName: project.name,
      category: project.category,
      projectName: null,
      originalDeadline: project.target_date,
      completedAt
    });
  } else {
    await deleteCompletionRecord(project.id);
  }

  return data;
}

export async function deleteProject(id) {
  const supabase = getClient();
  await deleteCompletionRecord(id);
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// ==============================================================================
// 2. PROJECT TASKS
// ==============================================================================

export async function fetchAllTasks() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*, projects(id, name, category)')
    .order('target_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchTasksForProject(projectId) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createProjectTask({ project_id, name, description, start_date, target_date, priority }) {
  const supabase = getClient();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('project_tasks')
    .insert({
      project_id,
      user_id: userId,
      name,
      description: description || '',
      start_date,
      target_date,
      priority: priority || 'Medium',
      status: 'pending'
    })
    .select('*, projects(name)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectTask(id, updates) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('project_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleTaskComplete(task, projectName = null) {
  const supabase = getClient();
  const isCompleted = task.status !== 'completed';
  const newStatus = isCompleted ? 'completed' : 'pending';
  const completedAt = isCompleted ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('project_tasks')
    .update({
      status: newStatus,
      completed_at: completedAt
    })
    .eq('id', task.id)
    .select('*, projects(name)')
    .single();

  if (error) throw error;

  const resolvedProjectName = projectName || data.projects?.name || task.projects?.name || 'Project';

  if (isCompleted) {
    await logCompletion({
      itemId: task.id,
      itemType: 'task',
      itemName: task.name,
      category: 'Task',
      projectName: resolvedProjectName,
      originalDeadline: task.target_date,
      completedAt
    });
  } else {
    await deleteCompletionRecord(task.id);
  }

  return data;
}

export async function deleteProjectTask(id) {
  const supabase = getClient();
  await deleteCompletionRecord(id);
  const { error } = await supabase
    .from('project_tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// ==============================================================================
// 3. TO-DOS (Sticky Notes)
// ==============================================================================

export async function fetchTodos(type = null) {
  const supabase = getClient();
  let query = supabase
    .from('todos')
    .select('*')
    .order('target_date', { ascending: true });

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createTodo({ title, description, type, color, priority, target_date }) {
  const supabase = getClient();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: userId,
      title,
      description: description || '',
      type: type || 'daily',
      color: color || 'yellow',
      priority: priority || 'Medium',
      target_date,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTodo(id, updates) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleTodoComplete(todo) {
  const supabase = getClient();
  const isCompleted = todo.status !== 'completed';
  const newStatus = isCompleted ? 'completed' : 'pending';
  const completedAt = isCompleted ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('todos')
    .update({
      status: newStatus,
      completed_at: completedAt
    })
    .eq('id', todo.id)
    .select()
    .single();

  if (error) throw error;

  const itemType = `${todo.type}_todo`;
  if (isCompleted) {
    await logCompletion({
      itemId: todo.id,
      itemType,
      itemName: todo.title,
      category: `${todo.type.charAt(0).toUpperCase() + todo.type.slice(1)} To-Do`,
      projectName: null,
      originalDeadline: todo.target_date,
      completedAt
    });
  } else {
    await deleteCompletionRecord(todo.id);
  }

  return data;
}

export async function deleteTodo(id) {
  const supabase = getClient();
  await deleteCompletionRecord(id);
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// ==============================================================================
// 4. COMPLETION TRACKING HISTORY
// ==============================================================================

export async function fetchCompletionHistory(filterType = 'all') {
  const supabase = getClient();
  let query = supabase
    .from('completion_history')
    .select('*')
    .order('completed_at', { ascending: false });

  if (filterType && filterType !== 'all') {
    query = query.eq('item_type', filterType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function logCompletion({ itemId, itemType, itemName, category, projectName, originalDeadline, completedAt }) {
  const supabase = getClient();
  const userId = requireUserId();

  // Delete existing entry if any to maintain exact single completion record
  await deleteCompletionRecord(itemId);

  const { data, error } = await supabase
    .from('completion_history')
    .insert({
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      item_name: itemName,
      category: category || itemType,
      project_name: projectName || null,
      original_deadline: originalDeadline || null,
      completed_at: completedAt || new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.warn('logCompletion error:', error.message);
  }
  return data;
}

export async function deleteCompletionRecord(itemId) {
  const supabase = getClient();
  const { error } = await supabase
    .from('completion_history')
    .delete()
    .eq('item_id', itemId);

  if (error) {
    console.warn('deleteCompletionRecord error:', error.message);
  }
}

// ==============================================================================
// 5. CONSOLIDATED DATA FETCH FOR CALENDAR & DASHBOARD
// ==============================================================================

export async function fetchAllActivities() {
  const [projects, tasks, todos, history] = await Promise.all([
    fetchProjects(),
    fetchAllTasks(),
    fetchTodos('all'),
    fetchCompletionHistory('all')
  ]);

  return { projects, tasks, todos, history };
}

// ==============================================================================
// 6. NOTES WORKSPACE (Feature: Markdown Knowledge Management)
// ==============================================================================

/**
 * Fetch notes with optional filtering and sorting
 * @param {Object} options
 * @param {string} [options.category] - Filter by category ('all' or specific name)
 * @param {string} [options.tag] - Filter by tag ('all' or specific tag)
 * @param {string} [options.projectId] - Filter by project ('all', 'none', or UUID)
 * @param {string} [options.search] - Search term matching title or content
 * @param {string} [options.sort] - 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc' | 'title_asc' | 'title_desc'
 */
export async function fetchNotes({ category = 'all', tag = 'all', projectId = 'all', search = '', sort = 'updated_desc' } = {}) {
  const supabase = getClient();
  let query = supabase
    .from('notes')
    .select('*, projects(id, name, category, status)');

  // Category filter
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  // Project filter
  if (projectId && projectId !== 'all') {
    if (projectId === 'none') {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', projectId);
    }
  }

  // Tag filter using PostgreSQL array contains
  if (tag && tag !== 'all') {
    query = query.contains('tags', [tag]);
  }

  // Text search on title or content
  const cleanSearch = search.trim();
  if (cleanSearch) {
    // Sanitize search term to prevent Supabase filter injection
    const escaped = cleanSearch.replace(/[,()]/g, '');
    if (escaped) {
      query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }
  }

  // Sorting
  switch (sort) {
    case 'updated_asc':
      query = query.order('updated_at', { ascending: true });
      break;
    case 'created_desc':
      query = query.order('created_at', { ascending: false });
      break;
    case 'created_asc':
      query = query.order('created_at', { ascending: true });
      break;
    case 'title_asc':
      query = query.order('title', { ascending: true });
      break;
    case 'title_desc':
      query = query.order('title', { ascending: false });
      break;
    case 'updated_desc':
    default:
      query = query.order('updated_at', { ascending: false });
      break;
  }

  const { data, error } = await query;
  if (error) {
    console.error('fetchNotes error:', error.message);
    throw error;
  }
  return data || [];
}

/**
 * Fetch a single note by ID
 */
export async function fetchNoteById(id) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('notes')
    .select('*, projects(id, name, category, status)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new note
 */
export async function createNote({ title, content = '', category = 'Personal', tags = [], project_id = null }) {
  const supabase = getClient();
  const userId = requireUserId();

  const cleanTitle = (title || '').trim();
  if (!cleanTitle) {
    throw new Error('Note title is required.');
  }

  const validCategories = [
    'Meeting Notes', 'Learning Notes', 'Technical Notes',
    'Project Ideas', 'Research', 'Personal', 'Documentation', 'Other'
  ];
  const finalCategory = validCategories.includes(category) ? category : 'Personal';

  const cleanTags = Array.isArray(tags)
    ? [...new Set(tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))]
    : [];

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      title: cleanTitle,
      content: content || '',
      category: finalCategory,
      tags: cleanTags,
      project_id: project_id || null
    })
    .select('*, projects(id, name, category, status)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing note
 */
export async function updateNote(id, updates) {
  const supabase = getClient();
  const cleanUpdates = {};

  if (updates.title !== undefined) {
    const cleanTitle = String(updates.title).trim();
    if (!cleanTitle) throw new Error('Note title cannot be empty.');
    cleanUpdates.title = cleanTitle;
  }

  if (updates.content !== undefined) {
    cleanUpdates.content = updates.content;
  }

  if (updates.category !== undefined) {
    cleanUpdates.category = updates.category;
  }

  if (updates.tags !== undefined) {
    cleanUpdates.tags = Array.isArray(updates.tags)
      ? [...new Set(updates.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))]
      : [];
  }

  if (updates.project_id !== undefined) {
    cleanUpdates.project_id = updates.project_id || null;
  }

  const { data, error } = await supabase
    .from('notes')
    .update(cleanUpdates)
    .eq('id', id)
    .select('*, projects(id, name, category, status)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a note by ID
 */
export async function deleteNote(id) {
  const supabase = getClient();
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Upload an image file for notes to private Supabase Storage
 * Returns object with storage path and signed URL for markdown embedding
 * @param {File|Blob} file
 * @param {string} [originalName]
 */
export async function uploadNoteImage(file, originalName = 'image.png') {
  const supabase = getClient();
  const userId = requireUserId();

  const maxSizeBytes = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSizeBytes) {
    throw new Error('Image size exceeds 5MB limit.');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const mimeType = file.type || 'image/png';
  if (!allowedTypes.includes(mimeType)) {
    throw new Error('Unsupported image format. Allowed: JPG, PNG, GIF, WebP, SVG.');
  }

  // Derive file extension
  let ext = 'png';
  if (mimeType === 'image/jpeg') ext = 'jpg';
  else if (mimeType === 'image/gif') ext = 'gif';
  else if (mimeType === 'image/webp') ext = 'webp';
  else if (mimeType === 'image/svg+xml') ext = 'svg';
  else if (originalName && originalName.includes('.')) {
    ext = originalName.split('.').pop().toLowerCase();
  }

  const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
  const storagePath = `${userId}/${filename}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('note-images')
    .upload(storagePath, file, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('uploadNoteImage error:', uploadError);
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  // Generate a long-lived signed URL for displaying the image inside the application (1 year)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('note-images')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signedError) {
    console.warn('createSignedUrl warning:', signedError);
  }

  return {
    path: storagePath,
    signedUrl: signedData?.signedUrl || '',
    filename
  };
}

/**
 * Remove an image from Supabase Storage
 */
export async function deleteNoteImage(storagePath) {
  const supabase = getClient();
  const { error } = await supabase.storage
    .from('note-images')
    .remove([storagePath]);

  if (error) {
    console.warn('deleteNoteImage warning:', error.message);
  }
}

