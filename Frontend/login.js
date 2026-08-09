const form = document.getElementById('authForm');
const submitBtn = document.getElementById('submitBtn');
const messageBox = document.getElementById('formMessage');
const toggleButtons = document.querySelectorAll('.toggle-btn');

let mode = 'login';

function setMode(nextMode) {
  mode = nextMode;
  form.dataset.mode = nextMode;
  submitBtn.textContent = nextMode === 'register' ? 'Create account' : 'Login';
  form.reset();
  messageBox.textContent = '';

  toggleButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === nextMode);
  });
}

toggleButtons.forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'register' ? 'Creating account...' : 'Signing in...';
  messageBox.textContent = '';

  try {
    const response = await fetch(`/api/${mode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed.');
    }

    if (data.success) {
      // persist structured session for other pages
      try { localStorage.setItem('activeSession', JSON.stringify({ username, email: data.user?.email || null, role: data.user?.role || null })); } catch(e){}
      try { localStorage.setItem('currentUser', username); } catch(e){}
    }

    messageBox.textContent = data.message;

    if (data.success) {
      window.location.replace(data.redirectTo || 'index final 1.html');
    }
  } catch (error) {
    messageBox.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'register' ? 'Create account' : 'Login';
  }
});

setMode('login');
