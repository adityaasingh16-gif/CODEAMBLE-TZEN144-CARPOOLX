const profileName = document.getElementById('profileName');
const profileSubtitle = document.getElementById('profileSubtitle');
const profileAvatar = document.getElementById('profileAvatar');
const detailUsername = document.getElementById('detailUsername');
const detailStatus = document.getElementById('detailStatus');
const detailTheme = document.getElementById('detailTheme');
const loginButton = document.getElementById('loginButton');
const dashboardButton = document.getElementById('dashboardButton');
const logoutButton = document.getElementById('logoutButton');
const settingToggles = Array.from(document.querySelectorAll('.setting-toggle'));

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('activeSession');
    if (raw) {
      const session = JSON.parse(raw);
      return session && (session.username || session.email) ? (session.username || session.email) : null;
    }
  } catch (e) { /* ignore */ }
  return localStorage.getItem('currentUser');
}

function saveSettings() {
  const settings = settingToggles.reduce((acc, toggle) => {
    acc[toggle.dataset.setting] = toggle.checked;
    return acc;
  }, {});
  localStorage.setItem('dashboard-settings', JSON.stringify(settings));
}

function loadSettings() {
  const storedSettings = localStorage.getItem('dashboard-settings');
  if (!storedSettings) return;
  try {
    const parsed = JSON.parse(storedSettings);
    settingToggles.forEach((toggle) => {
      if (typeof parsed[toggle.dataset.setting] === 'boolean') {
        toggle.checked = parsed[toggle.dataset.setting];
      }
    });
  } catch (error) {
    console.warn('Unable to load profile settings', error);
  }
}

function updateProfileUi() {
  const user = getCurrentUser();
  const isLoggedIn = Boolean(user);
  const label = isLoggedIn ? user : 'Guest';
  const initial = label.charAt(0).toUpperCase();

  if (profileName) profileName.textContent = isLoggedIn ? `Welcome back, ${label}` : 'Welcome to SATHIGO';
  if (profileSubtitle) profileSubtitle.textContent = isLoggedIn ? 'Your account is connected to this dashboard.' : 'Sign in to unlock full account features.';
  if (profileAvatar) profileAvatar.textContent = initial;
  if (detailUsername) detailUsername.textContent = isLoggedIn ? label : 'Not signed in';
  if (detailStatus) detailStatus.textContent = isLoggedIn ? 'Active' : 'Guest';
  if (detailTheme) detailTheme.textContent = document.body.classList.contains('theme-light') ? 'Light' : 'Dark';

  if (loginButton) {
    loginButton.textContent = isLoggedIn ? 'Stay signed in' : 'Go to login';
  }
}

function applyTheme(isLight) {
  document.body.classList.toggle('theme-light', isLight);
}

const savedTheme = localStorage.getItem('dashboard-theme');
if (savedTheme === 'light') {
  applyTheme(true);
} else if (savedTheme === 'dark') {
  applyTheme(false);
} else {
  applyTheme(window.matchMedia('(prefers-color-scheme: light)').matches);
}

if (loginButton) {
  loginButton.addEventListener('click', () => {
    window.location.href = 'login.html';
  });
}

if (dashboardButton) {
  dashboardButton.addEventListener('click', () => {
  window.location.href = 'index final 1.html';
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });
}

settingToggles.forEach((toggle) => toggle.addEventListener('change', saveSettings));

loadSettings();
updateProfileUi();
