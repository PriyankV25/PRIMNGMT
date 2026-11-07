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
