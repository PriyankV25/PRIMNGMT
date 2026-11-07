// ==============================================================================
// Authentication Handler using Supabase Auth
// ==============================================================================

import { getSupabase } from './config.js';
import { showToast } from './utils/notifications.js';

let currentUser = null;
const authListeners = [];

export async function initAuth() {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Error fetching session:', error.message);
    }
    currentUser = session?.user || null;
  } catch (err) {
    console.error('Session init error:', err);
  }

  // Subscribe to auth state updates
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Auth Event]', event, session?.user?.email);
    currentUser = session?.user || null;
    notifyAuthListeners(currentUser);
  });

  return currentUser;
}

export function getCurrentUser() {
  return currentUser;
}

export function onAuthStateChanged(callback) {
  authListeners.push(callback);
  // Immediate call with current state
  callback(currentUser);
}

function notifyAuthListeners(user) {
  authListeners.forEach(listener => {
    try {
      listener(user);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
}

export async function loginUser(email, password) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  currentUser = data.user;
  showToast('Logged in successfully!', 'success');
  return data.user;
}

export async function signUpUser(email, password) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    throw error;
  }

  // If email confirmation is required:
  if (data.user && !data.session) {
    showToast('Registration successful! Please check your email to verify your account, or sign in.', 'info', 6000);
  } else {
    showToast('Account created and signed in!', 'success');
    currentUser = data.user;
  }

  return data;
}

export async function logoutUser() {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast(`Logout error: ${error.message}`, 'error');
  } else {
    currentUser = null;
    showToast('You have been logged out.', 'info');
  }
}
