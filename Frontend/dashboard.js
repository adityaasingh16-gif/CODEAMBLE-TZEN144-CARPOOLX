document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const themeToggle = document.getElementById('themeToggle');
    const profileButton = document.getElementById('profileButton');
    const profileName = document.getElementById('profileName');
    const profileSubtitle = document.getElementById('profileSubtitle');
    const profilePrimaryAction = document.getElementById('profilePrimaryAction');
    const logoutButton = document.getElementById('logoutButton');
    const profileLogoutButton = document.getElementById('profileLogoutButton');
    const topAvatar = document.getElementById('topAvatar');
    const profileAvatar = document.getElementById('profileAvatar');
    const settingsToggles = Array.from(document.querySelectorAll('.setting-toggle'));

    if (!sidebar) return;

    const applyTheme = (isLight) => {
        // Smooth transition for colors
        document.documentElement.classList.add('theme-transition');
        setTimeout(()=> document.documentElement.classList.remove('theme-transition'), 400);

        document.body.classList.toggle('theme-light', isLight);
        if (themeToggle) {
            // Use icon to indicate current mode (sun = light, moon = dark)
            themeToggle.textContent = isLight ? '☀️' : '🌙';
            themeToggle.setAttribute('aria-pressed', String(isLight));
            themeToggle.setAttribute('title', isLight ? 'Light mode' : 'Dark mode');
        }
    };

    const getCurrentUser = () => {
        // Prefer structured activeSession (JSON), fallback to legacy currentUser string
        try {
            const raw = localStorage.getItem('activeSession');
            if (raw) {
                const session = JSON.parse(raw);
                return session && (session.username || session.email) ? (session.username || session.email) : null;
            }
        } catch (e) { /* ignore */ }
        const user = localStorage.getItem('currentUser');
        return user ? user : null;
    };

    const saveSettings = () => {
        const savedSettings = settingsToggles.reduce((acc, toggle) => {
            acc[toggle.dataset.setting] = toggle.checked;
            return acc;
        }, {});
        localStorage.setItem('dashboard-settings', JSON.stringify(savedSettings));
    };

    const loadSettings = () => {
        const storedSettings = localStorage.getItem('dashboard-settings');
        if (!storedSettings) return;
        try {
            const parsed = JSON.parse(storedSettings);
            settingsToggles.forEach((toggle) => {
                if (typeof parsed[toggle.dataset.setting] === 'boolean') {
                    toggle.checked = parsed[toggle.dataset.setting];
                }
            });
        } catch (error) {
            console.warn('Unable to load dashboard settings', error);
        }
    };

    const updateProfileUi = () => {
        const user = getCurrentUser();
        const loggedIn = Boolean(user);
        const displayName = loggedIn ? user : 'Guest';
        const initial = displayName.charAt(0).toUpperCase();

        if (profileButton) {
            profileButton.textContent = loggedIn ? 'Profile' : 'Login';
        }

        if (profileName) {
            profileName.textContent = loggedIn ? `Hello, ${user}` : 'Your profile';
        }

        if (profileSubtitle) {
            profileSubtitle.textContent = loggedIn
                ? 'Your account is connected to this dashboard.'
                : 'Sign in to connect your rides and settings.';
        }

        if (profilePrimaryAction) {
            profilePrimaryAction.textContent = loggedIn ? 'View settings' : 'Go to login';
        }

        if (topAvatar) {
            topAvatar.textContent = initial;
        }

        if (profileAvatar) {
            profileAvatar.textContent = initial;
        }
    };

    const bootstrapAuth = async () => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            updateProfileUi();
            return;
        }

        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) {
                throw new Error('Not authenticated');
            }

            const data = await response.json();
            if (data.success && data.user?.username) {
                // store structured activeSession for downstream pages
                try { localStorage.setItem('activeSession', JSON.stringify({ username: data.user.username, email: data.user.email || null, role: data.user.role || null })); } catch(e){}
                updateProfileUi();
                return;
            }

            throw new Error('Not authenticated');
        } catch (error) {
            // Don't force a redirect when auth check fails (e.g. local dev).
            localStorage.removeItem('currentUser');
            updateProfileUi();
            console.warn('Auth check failed; continuing as guest.', error);
        }
    };

    const savedTheme = localStorage.getItem('dashboard-theme');
    if (savedTheme === 'light') {
        applyTheme(true);
    } else if (savedTheme === 'dark') {
        applyTheme(false);
    } else {
        applyTheme(window.matchMedia('(prefers-color-scheme: light)').matches);
    }

    loadSettings();
    updateProfileUi();
    bootstrapAuth();

    // initialize menuToggle aria state
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
    }

    if (menuToggle) {
        // toggle and update aria-expanded
        menuToggle.addEventListener('click', function () {
            const isOpen = sidebar.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            if (isOpen) {
                // show overlay
                const overlay = document.getElementById('sidebarOverlay');
                if (overlay) { overlay.classList.add('visible'); overlay.setAttribute('aria-hidden','false'); }
                // focus first focusable element in sidebar
                const focusable = sidebar.querySelector('a, button, input, [tabindex]:not([tabindex="-1"])');
                if (focusable) focusable.focus();
                // trap focus within sidebar
                document.addEventListener('keydown', trapFocus);
            } else {
                const overlay = document.getElementById('sidebarOverlay');
                if (overlay) { overlay.classList.remove('visible'); overlay.setAttribute('aria-hidden','true'); }
                document.removeEventListener('keydown', trapFocus);
            }
        });
    }

    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
            if (menuToggle) menuToggle.setAttribute('aria-expanded','false');
        });
    });

    document.addEventListener('click', function (event) {
        const clickedInsideSidebar = sidebar.contains(event.target);
        const clickedToggle = menuToggle ? menuToggle.contains(event.target) : false;

        if (!clickedInsideSidebar && !clickedToggle && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (menuToggle) menuToggle.setAttribute('aria-expanded','false');
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) { overlay.classList.remove('visible'); overlay.setAttribute('aria-hidden','true'); }
            document.removeEventListener('keydown', trapFocus);
        }
    });

    // close sidebar when overlay is clicked
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function(){
            sidebar.classList.remove('open');
            if (menuToggle) menuToggle.setAttribute('aria-expanded','false');
            sidebarOverlay.classList.remove('visible');
            sidebarOverlay.setAttribute('aria-hidden','true');
            document.removeEventListener('keydown', trapFocus);
        });
    }

    // Close sidebar with Escape key
    document.addEventListener('keydown', function(e){
        if (e.key === 'Escape' && sidebar.classList.contains('open')){
            sidebar.classList.remove('open');
            if (menuToggle) menuToggle.setAttribute('aria-expanded','false');
            if (sidebarOverlay) { sidebarOverlay.classList.remove('visible'); sidebarOverlay.setAttribute('aria-hidden','true'); }
            document.removeEventListener('keydown', trapFocus);
        }
    });

    // Focus trap implementation for sidebar when open
    function trapFocus(e) {
        if (e.key !== 'Tab') return;
        const focusable = Array.from(sidebar.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) { // backwards
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else { // forwards
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            const isLight = !document.body.classList.contains('theme-light');
            applyTheme(isLight);
            localStorage.setItem('dashboard-theme', isLight ? 'light' : 'dark');
        });
    }

    if (profileButton) {
        profileButton.addEventListener('click', function () {
            window.location.href = '/';
        });
    }

    if (profilePrimaryAction) {
        profilePrimaryAction.addEventListener('click', function () {
            window.location.href = '/';
        });
    }

    const handleLogout = async function () {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            try { localStorage.removeItem('activeSession'); } catch(e){}
            try { localStorage.removeItem('currentUser'); } catch(e){}
            window.location.replace('login.html');
        }
    };

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    if (profileLogoutButton) {
        profileLogoutButton.addEventListener('click', handleLogout);
    }

    settingsToggles.forEach((toggle) => {
        toggle.addEventListener('change', saveSettings);
    });

    window.addEventListener('resize', function () {
        if (window.innerWidth > 960) {
            sidebar.classList.remove('open');
        }
    });
});
