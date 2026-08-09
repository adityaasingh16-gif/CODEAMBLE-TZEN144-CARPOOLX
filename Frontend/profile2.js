document.addEventListener('DOMContentLoaded', () => {
  // Initialize icons if lucide is available (defensive)
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  function navigateIfExists(dest) {
    window.location.href = dest;
  }

  // DOM Elements - Profile Display
  const nameDisplay = document.getElementById('display-name');
  const phoneDisplay = document.getElementById('display-phone');
  const emailDisplay = document.getElementById('display-email');
  const emergencyDisplay = document.getElementById('display-emergency');
  const sosDisplay = document.getElementById('display-sos-status');
  const avatarImg = document.getElementById('user-avatar');

  // DOM Elements - Edit Modal
  const editModal = document.getElementById('edit-modal');
  const openEditBtn = document.getElementById('open-edit-modal');
  const closeEditBtn = document.getElementById('close-modal');
  const saveEditBtn = document.getElementById('save-profile');

  const inputName = document.getElementById('input-username');
  const inputPhone = document.getElementById('input-phone');
  const inputEmail = document.getElementById('input-email');
  const inputEmergency = document.getElementById('input-emergency');
  const currencyDisplay = document.getElementById('display-currency');
  const countryDisplay = document.getElementById('display-country');
  const sharedRidesValue = document.getElementById('stat-shared-rides');
  const co2SavedValue = document.getElementById('stat-co2-saved');
  const coRiderRatingValue = document.getElementById('stat-rating');
 
  const PROFILE_SESSION_KEY = 'activeSession';
  const RIDE_HISTORY_KEY = 'rideHistory';

  function getStoredRideHistory() {
    try {
      const raw = localStorage.getItem(RIDE_HISTORY_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read stored ride history', e);
    }
    return [];
  }

  function saveRideHistory(rides) {
    try {
      localStorage.setItem(RIDE_HISTORY_KEY, JSON.stringify(rides));
    } catch (e) {
      console.warn('Could not save ride history', e);
    }
  }

  function updateSharingStats(apiData = null) {
    const rides = getStoredRideHistory();
    const sharedRides = apiData ? apiData.bookings.length : rides.length;
    const co2Saved = Math.round(rides.reduce((sum, ride) => sum + ((Number(ride.coRiders) || 1) * 2.5), 0));
    // Only average rides that actually have a real rating - a ride with no
    // rating yet used to be silently counted as 4.9, which inflated the
    // average with a fabricated number instead of the user's real data.
    const ratedRides = rides.filter((ride) => Number(ride.rating) > 0);
    const rating = apiData?.profile?.rating
      ? Number(apiData.profile.rating).toFixed(1)
      : ratedRides.length
        ? (ratedRides.reduce((sum, ride) => sum + Number(ride.rating), 0) / ratedRides.length).toFixed(1)
        : '0.0';

    if (sharedRidesValue) sharedRidesValue.textContent = sharedRides.toString();
    if (co2SavedValue) co2SavedValue.textContent = `${co2Saved} kg`;
    if (coRiderRatingValue) coRiderRatingValue.textContent = `${rating} ★`;
  }

 
  function getStoredSession() {
    try {
      const raw = localStorage.getItem(PROFILE_SESSION_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read stored profile session', e);
    }
    return {};
  }
 
  function saveStoredSession(data) {
    try {
      localStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not persist profile session', e);
    }
  }
 
  function formatCurrencyMetadata(data) {
    if (!data) return {
      code: 'INR',
      symbol: '₹',
      country: 'India'
    };
    return {
      code: data.code || 'INR',
      symbol: data.symbol || '₹',
      country: data.country || 'India'
    };
  }
 
  // CarpoolX is India-only (Aadhaar/PAN driver verification, Indian mobile
  // numbers) so currency is always INR. This used to guess a currency from
  // geolocation/browser locale and could label a real rupee balance as
  // USD/EUR/etc. depending on the visitor's device - the amount itself
  // never changed, only the misleading symbol.
  function setCurrencyDisplay(metadata) {
    const formatted = formatCurrencyMetadata(metadata);
    if (currencyDisplay) currencyDisplay.textContent = `${formatted.symbol} (${formatted.code})`;
    if (countryDisplay) countryDisplay.textContent = formatted.country;
  }

  function applyLocationCurrency() {
    setCurrencyDisplay({ code: 'INR', symbol: '₹', country: 'India' });
  }
 
  function loadProfileFromSession() {
    const session = getStoredSession();
    const username = session.username || session.user?.username || '';
    const email = session.email || (username && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(username) ? username : '');
    const phone = session.mobile || session.phone || session.phoneNumber || (username && /^[0-9]{10,15}$/.test(username) ? username : '');
    const displayName = username || (email ? email.split('@')[0] : 'User');

    if (nameDisplay) nameDisplay.textContent = displayName;
    if (inputName) inputName.value = displayName;

    if (email) {
      if (emailDisplay) emailDisplay.textContent = email;
      if (inputEmail) inputEmail.value = email;
    } else if (emailDisplay) {
      emailDisplay.textContent = 'Not added';
    }

    if (phone) {
      if (phoneDisplay) phoneDisplay.textContent = phone;
      if (inputPhone) inputPhone.value = phone;
    } else if (phoneDisplay) {
      phoneDisplay.textContent = 'Not added';
    }
    if (session.currency) {
      setCurrencyDisplay(session.currency);
    }
  }
  
  loadProfileFromSession();
  async function loadLiveProfile() {
    if (!localStorage.getItem('token') || typeof apiGetProfile !== 'function') return;
    try {
      const [profile, history] = await Promise.all([apiGetProfile(), apiGetRideHistory()]);
      const session = getStoredSession();
      session.username = profile.name;
      session.email = profile.email;
      session.phone = profile.phone;
      session.userId = profile._id;
      saveStoredSession(session);
      if (nameDisplay) nameDisplay.textContent = profile.name;
      if (phoneDisplay) phoneDisplay.textContent = profile.phone || 'Not added';
      if (emailDisplay) emailDisplay.textContent = profile.email;
      if (emergencyDisplay) emergencyDisplay.textContent = `${(profile.emergencyContacts || []).length} Contacts Added`;
      if (sosDisplay) sosDisplay.textContent = `Auto-alert: ${profile.emergencySOS === false ? 'OFF' : 'ON'}`;
      if (coRiderRatingValue) coRiderRatingValue.textContent = `${Number(profile.rating || 0).toFixed(1)} ★`;
      // Also populate the Edit Details modal's actual input fields with the
      // real backend record - previously only the read-only display spans
      // above were updated here, so opening "Edit" could still show
      // whatever was last cached in localStorage (or the placeholder) even
      // though the true profile had different data.
      if (inputName) inputName.value = profile.name || '';
      if (inputPhone) inputPhone.value = profile.phone || '';
      if (inputEmail) inputEmail.value = profile.email || '';
      if (inputEmergency) inputEmergency.value = (profile.emergencyContacts || []).length;
      updateSharingStats({ profile, bookings: history.bookings || [] });
    } catch (error) {
      console.warn('Could not load the live profile.', error);
      updateSharingStats();
    }
  }
  updateSharingStats();
  loadLiveProfile();
    applyLocationCurrency();
 
  // Camera & Gallery Upload trigger
  const cameraBtn = document.getElementById('trigger-camera');
  const fileInput = document.getElementById('image-file-input');

  if (cameraBtn && fileInput) {
    cameraBtn.addEventListener('click', () => fileInput.click());

    // Allow clicking the avatar image to open picker as well
    if (avatarImg) {
      avatarImg.style.cursor = 'pointer';
      avatarImg.addEventListener('click', () => fileInput.click());
    }

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (avatarImg) avatarImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Profile Edit Modal logic
  if (openEditBtn && editModal) openEditBtn.addEventListener('click', () => editModal.classList.add('active'));
  if (closeEditBtn && editModal) closeEditBtn.addEventListener('click', () => editModal.classList.remove('active'));

  // Close modal when clicking on the overlay background
  if (editModal) {
    editModal.addEventListener('click', (ev) => {
      if (ev.target === editModal) editModal.classList.remove('active');
    });
  }

  if (saveEditBtn) {
    saveEditBtn.addEventListener('click', async () => {
      // Validate inputs using FormUtils rules before applying
      const rules = {
        'input-username': [ { test: FormUtils.validators.required, message: 'Name cannot be empty.' } ],
        'input-phone': [ { test: (v) => FormUtils.validators.phone10(v.replace(/\D/g,'')), message: 'Phone must be 10 digits.' } ],
        'input-email': [ { test: FormUtils.validators.email, message: 'Please enter a valid email.' } ],
        'input-emergency': [ { test: (v) => v === '' || !isNaN(Number(v)), message: 'Emergency contacts must be a number.' } ]
      };
 
      const ok = FormUtils.validateRules(rules);
      if (!ok) return; // do not save if validation fails
 
      const session = getStoredSession();
      if (inputName && inputName.value.trim() !== '') {
        const name = inputName.value.trim();
        if (nameDisplay) nameDisplay.textContent = name;
        session.username = name;
      }
      if (inputPhone && inputPhone.value.trim() !== '') {
        const phone = inputPhone.value.trim();
        if (phoneDisplay) phoneDisplay.textContent = phone;
        session.mobile = phone;
        session.phone = phone;
      }
      if (inputEmail && inputEmail.value.trim() !== '') {
        const email = inputEmail.value.trim();
        if (emailDisplay) emailDisplay.textContent = email;
        session.email = email;
      }
      if (inputEmergency && inputEmergency.value !== '') {
        const emergencyText = `${inputEmergency.value} Contacts Added`;
        if (emergencyDisplay) emergencyDisplay.textContent = emergencyText;
        session.emergencyContacts = inputEmergency.value;
      }
      if (session.currency) {
        setCurrencyDisplay(session.currency);
      }
 
      try {
        if (typeof apiUpdateProfile === 'function' && localStorage.getItem('token')) {
          const updated = await apiUpdateProfile({
            name: inputName?.value.trim(),
            phone: inputPhone?.value.trim(),
            email: inputEmail?.value.trim(),
            password: document.getElementById('input-password')?.value || undefined,
          });
          session.username = updated.name;
          session.email = updated.email;
          session.phone = updated.phone;
          if (typeof persistSession === 'function' && updated.token) persistSession(updated);
        }
        saveStoredSession(session);
        if (editModal) editModal.classList.remove('active');
      } catch (error) {
        alert(error.message || 'Could not save profile changes.');
      }
    });
  }

  // SOS Modal Logic
  const sosModal = document.getElementById('sos-modal');
  const openSosBtn = document.getElementById('open-sos-modal');
  const closeSosBtn = document.getElementById('close-sos-modal');
  const sosOptOn = document.getElementById('sos-opt-on');
  const sosOptOff = document.getElementById('sos-opt-off');

  if (openSosBtn && sosModal) openSosBtn.addEventListener('click', () => sosModal.classList.add('active'));
  if (closeSosBtn && sosModal) closeSosBtn.addEventListener('click', () => sosModal.classList.remove('active'));

  // Close sos modal when clicking on overlay
  if (sosModal) {
    sosModal.addEventListener('click', (ev) => {
      if (ev.target === sosModal) sosModal.classList.remove('active');
    });
  }

  if (sosOptOn && sosOptOff) {
    sosOptOn.addEventListener('click', () => {
      sosOptOn.classList.add('active');
      sosOptOff.classList.remove('active');
      if (sosDisplay) sosDisplay.textContent = 'Auto-alert: ON';
      persistSosPreference(true);
    });

    sosOptOff.addEventListener('click', () => {
      sosOptOff.classList.add('active');
      sosOptOn.classList.remove('active');
      if (sosDisplay) sosDisplay.textContent = 'Auto-alert: OFF';
      persistSosPreference(false);
    });
  }

  async function persistSosPreference(enabled) {
    if (typeof apiUpdateProfile !== 'function' || !localStorage.getItem('token')) return;
    try {
      await apiUpdateProfile({ emergencySOS: enabled });
    } catch (error) {
      alert(error.message || 'Could not save SOS preference.');
    }
  }

  // Navigation handlers for known destinations in the project
  // Log Out button -> login.html
  const logoutBtn = document.querySelector('.btn-item.logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      // Clear any auth tokens in localStorage/sessionStorage (best-effort)
      try {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('authToken');
      } catch (e) { /* ignore */ }

      navigateIfExists('login.html');
    });
  }

  // Emergency contacts detail -> opens the Edit Profile modal, focused on
  // the Emergency Contacts field, so it can actually be updated here.
  // (Previously this sent the user to history.html - ride history has
  // nothing to do with emergency contacts, that was a leftover/wrong link.)
  const emergencyEl = document.getElementById('display-emergency');
  if (emergencyEl) {
    const emergencyCard = emergencyEl.closest('.detail-item');
    if (emergencyCard && editModal) {
      emergencyCard.style.cursor = 'pointer';
      emergencyCard.addEventListener('click', () => {
        editModal.classList.add('active');
        const emergencyInput = document.getElementById('input-emergency');
        if (emergencyInput) emergencyInput.focus();
      });
    }
  }

  // Clicking the username navigates to profile.html (alternate profile view)
  if (nameDisplay) {
    nameDisplay.style.cursor = 'pointer';
    nameDisplay.addEventListener('click', () => navigateIfExists('profile.html'));
  }

  // Accessibility: close modals with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (editModal && editModal.classList.contains('active')) editModal.classList.remove('active');
      if (sosModal && sosModal.classList.contains('active')) sosModal.classList.remove('active');
    }
  });

});
