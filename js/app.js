// ==============================================================================
// Main Application Controller (Vanilla JS SPA Router & Shell)
// ==============================================================================

import { initAuth, getCurrentUser, onAuthStateChanged, logoutUser, loginUser, signUpUser } from './auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderProjects, openProjectModal } from './views/projects.js';
import { renderTodos, openTodoModal } from './views/todos.js';
import { renderCalendar } from './views/calendar.js';
import { renderGantt } from './views/gantt.js';
import { renderHistory } from './views/history.js';
import { showToast } from './utils/notifications.js';

let currentView = 'dashboard';
let pendingGanttProjectId = null;

// ==============================================================================
// 1. Initialization
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing Personal Project Management SPA...');
  startClock();
  initGlobalEventListeners();

  await initAuth();

  onAuthStateChanged((user) => {
    if (user) {
      showAuthenticatedLayout(user);
      navigateTo(currentView);
    } else {
      showAuthScreen();
    }
  });
});

// ==============================================================================
// 2. View Router & Navigation
// ==============================================================================
export function navigateTo(viewName, param = null) {
  currentView = viewName;

  // Update sidebar active link
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Close mobile sidebar if open
  document.getElementById('sidebar')?.classList.remove('mobile-open');

  const mainContent = document.getElementById('main-content-view');
  if (!mainContent) return;

  switch (viewName) {
    case 'dashboard':
      renderDashboard(mainContent);
      break;
    case 'projects':
      renderProjects(mainContent);
      break;
    case 'todos':
      renderTodos(mainContent);
      break;
    case 'calendar':
      renderCalendar(mainContent);
      break;
    case 'gantt':
      renderGantt(mainContent, param || pendingGanttProjectId);
      pendingGanttProjectId = null;
      break;
    case 'history':
      renderHistory(mainContent);
      break;
    default:
      renderDashboard(mainContent);
  }

  // Update window title
  const titles = {
    dashboard: 'Dashboard',
    projects: 'Projects & Tasks',
    todos: 'Sticky To-Dos',
    calendar: 'Monthly Calendar',
    gantt: 'Gantt Charts',
    history: 'Completion History'
  };
  document.title = `${titles[viewName] || 'Overview'} | FlowCraft Personal`;
}

// ==============================================================================
// 3. UI State: Authenticated Layout vs Login Screen
// ==============================================================================
function showAuthenticatedLayout(user) {
  const authContainer = document.getElementById('auth-view');
  const appContainer = document.getElementById('app-shell');

  if (authContainer) authContainer.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';

  // Populate user profile info in top bar
  const userEmailEl = document.getElementById('user-email-display');
  const userAvatarEl = document.getElementById('user-avatar-initial');

  if (userEmailEl) userEmailEl.textContent = user.email || 'Personal User';
  if (userAvatarEl) {
    const initial = (user.email ? user.email.charAt(0) : 'U').toUpperCase();
    userAvatarEl.textContent = initial;
  }
}

function showAuthScreen() {
  const authContainer = document.getElementById('auth-view');
  const appContainer = document.getElementById('app-shell');

  if (appContainer) appContainer.style.display = 'none';
  if (authContainer) {
    authContainer.style.display = 'flex';
    renderAuthForm();
  }
}

function renderAuthForm() {
  const container = document.getElementById('auth-view');
  if (!container) return;

  container.innerHTML = `
    <div class="auth-card animate-fade-in">
      <div class="auth-header">
        <div class="auth-logo">
          <span class="logo-icon">🚀</span>
          <h1>FlowCraft</h1>
        </div>
        <p class="auth-subtitle">Personal Project Management & Productivity Dashboard</p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" id="tab-login">Sign In</button>
        <button class="auth-tab" id="tab-signup">Create Account</button>
      </div>

      <form id="auth-form" class="auth-body">
        <div class="form-group">
          <label for="auth-email">Email Address</label>
          <input type="email" id="auth-email" class="form-input" required placeholder="priyank.saxena.dev@gmail.com" value="priyank.saxena.dev@gmail.com">
        </div>

        <div class="form-group">
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" class="form-input" required minlength="6" placeholder="••••••••">
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-auth-submit">
          Sign In
        </button>

        <div class="auth-help-note">
          <p>Exclusively for individual productivity. Powered securely by Supabase Authentication & PostgreSQL RLS.</p>
        </div>
      </form>
    </div>
  `;

  let mode = 'login';
  const tabLogin = container.querySelector('#tab-login');
  const tabSignup = container.querySelector('#tab-signup');
  const submitBtn = container.querySelector('#btn-auth-submit');
  const form = container.querySelector('#auth-form');

  tabLogin.addEventListener('click', () => {
    mode = 'login';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    submitBtn.textContent = 'Sign In';
  });

  tabSignup.addEventListener('click', () => {
    mode = 'signup';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    submitBtn.textContent = 'Create Free Account';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
      showToast('Please enter both email and password.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
      if (mode === 'login') {
        await loginUser(email, password);
      } else {
        await signUpUser(email, password);
      }
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Free Account';
    }
  });
}

// ==============================================================================
// 4. Global Event Handlers
// ==============================================================================
function initGlobalEventListeners() {
  // Sidebar navigation link clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      if (view) navigateTo(view);
    });
  });

  // Mobile menu toggle
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('mobile-open');
  });

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to log out?')) {
      await logoutUser();
    }
  });

  // Top header "+ New" quick button
  document.getElementById('btn-header-quick-add')?.addEventListener('click', () => {
    const mainContent = document.getElementById('main-content-view');
    openProjectModal(null, mainContent);
  });

  // Custom App Events
  window.addEventListener('app:navigate', (e) => {
    navigateTo(e.detail);
  });

  window.addEventListener('app:navigate-gantt', (e) => {
    pendingGanttProjectId = e.detail;
    navigateTo('gantt', e.detail);
  });

  window.addEventListener('app:open-project-modal', () => {
    const mainContent = document.getElementById('main-content-view');
    openProjectModal(null, mainContent);
  });

  window.addEventListener('app:open-todo-modal', () => {
    const mainContent = document.getElementById('main-content-view');
    openTodoModal(null, mainContent);
  });
}

// Live IST Clock
function startClock() {
  const clockEl = document.getElementById('header-live-clock');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    clockEl.textContent = `${timeStr} IST`;
  }

  update();
  setInterval(update, 1000);
}
