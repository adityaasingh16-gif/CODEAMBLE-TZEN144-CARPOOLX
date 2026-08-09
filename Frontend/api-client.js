// Single place that knows where the Backend API lives.
// Local dev: Backend runs on localhost:5001 (see Backend/.env PORT).
// Production: set this to your deployed backend URL (e.g. Render/Railway URL)
// before deploying, or override it by adding
//   <meta name="carpoolx-api-base" content="https://your-backend.onrender.com/api">
// to a page's <head> without touching this file.
(function () {
  const metaTag = document.querySelector('meta[name="carpoolx-api-base"]');
  const isLocalHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // Priority: explicit <meta name="carpoolx-api-base"> tag on the page,
  // then localhost default for local dev, then the deployed backend URL
  // as a safety net so pages never silently try to hit localhost:5001
  // from a production/deployed domain.
  window.CARPOOLX_API_BASE =
    (metaTag && metaTag.content) ||
    (isLocalHost
      ? 'http://localhost:5001/api'
      : 'https://codeamble-tzen144-carpoolx-2.onrender.com/api');
})();

async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${window.CARPOOLX_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    // fetch() itself throws (not the backend returning an error response)
    // when the server is unreachable - wrong CARPOOLX_API_BASE, backend not
    // running, no internet, or a CORS rejection. Surface a clear message
    // here instead of letting the raw "Failed to fetch" TypeError reach the
    // UI, since callers just show error.message directly to the user.
    throw new Error(
      `Could not reach the server at ${window.CARPOOLX_API_BASE}. Make sure the CarpoolX backend is running and reachable, then try again.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

// --- Auth calls -----------------------------------------------------------

// payload: { name, email, phone, password, gender, isDriver, vehicleDetails }
function apiRegister(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: payload });
}

// payload: { email, password }
function apiLogin(payload) {
  return apiRequest('/auth/login', { method: 'POST', body: payload });
}

function apiGetProfile() {
  return apiRequest('/auth/profile', { method: 'GET', auth: true });
}

function apiUpdateProfile(payload) {
  return apiRequest('/auth/profile', { method: 'PUT', body: payload, auth: true });
}

// --- Admin: driver document review -----------------------------------

function apiListDriversForReview(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/auth/admin/drivers${query}`, { method: 'GET', auth: true });
}

function apiReviewDriver(driverId, approve, note) {
  return apiRequest(`/auth/admin/drivers/${driverId}/review`, {
    method: 'PUT',
    body: { approve, note },
    auth: true,
  });
}

// --- Admin: general user list/search (passengers + drivers) -----------

function apiListAllUsers(search, role) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/auth/admin/users${query}`, { method: 'GET', auth: true });
}

function apiUpdateUserStatus(userId, status) {
  return apiRequest(`/auth/admin/users/${userId}/status`, {
    method: 'PUT',
    body: { status },
    auth: true,
  });
}

// --- Ride calls -------------------------------------------------------
// These hit the SAME matching/fare algorithm already built in
// Backend/utils/fareCalculator.js and routeMatcher.js - nothing about the
// algorithm changes here, this just replaces frontend hardcoded/fake data
// with the real search/create/book endpoints.

function apiSearchRides(pickup, dropoff) {
  const params = new URLSearchParams({
    pickupLng: pickup.coordinates[0],
    pickupLat: pickup.coordinates[1],
    dropoffLng: dropoff.coordinates[0],
    dropoffLat: dropoff.coordinates[1],
  });
  return apiRequest(`/rides/search?${params.toString()}`, { method: 'GET', auth: true });
}

function apiCreateRide(payload) {
  return apiRequest('/rides', { method: 'POST', body: payload, auth: true });
}

function apiBookRide(rideId, payload) {
  return apiRequest(`/rides/${rideId}/book`, { method: 'POST', body: payload, auth: true });
}

function apiGetRideHistory() {
  return apiRequest('/rides/history', { method: 'GET', auth: true });
}

function apiGetMyBookings() {
  return apiRequest('/bookings/my-bookings', { method: 'GET', auth: true });
}

function apiGetBookingById(bookingId) {
  return apiRequest(`/bookings/${bookingId}`, { method: 'GET', auth: true });
}

function apiCancelBooking(bookingId) {
  return apiRequest(`/bookings/${bookingId}/cancel`, { method: 'PUT', auth: true });
}

// --- Driver calls -------------------------------------------------------
// Rides the logged-in user has posted as a driver (Backend/routes/rideRoutes.js
// GET /mine), and the endpoint drivers use to move a ride through its
// lifecycle (scheduled -> in-progress -> completed/cancelled).
function apiGetMyRides() {
  return apiRequest('/rides/mine', { method: 'GET', auth: true });
}

function apiUpdateRideStatus(rideId, status) {
  return apiRequest(`/rides/${rideId}/status`, { method: 'PUT', body: { status }, auth: true });
}

// Driver "Go Online" / "Go Offline" toggle. Only drivers with
// isAvailable: true (and a recent location) show up in nearest-driver
// results - see Backend/utils/nearestDriverMatcher.js.
// payload: { isAvailable, coordinates: [lng, lat], address }
function apiSetDriverAvailability(payload) {
  return apiRequest('/rides/availability', { method: 'PATCH', body: payload, auth: true });
}

// Nearest available drivers within a radius (defaults to 400m on the
// backend) of a pickup point, nearest-first - the same lookup Uber/Ola run
// when matching a rider to a driver.
// pickup: { lng, lat }, options: { radius, limit }
function apiFindNearbyDrivers(pickup, options = {}) {
  const params = new URLSearchParams({ lng: pickup.lng, lat: pickup.lat });
  if (options.radius) params.set('radius', options.radius);
  if (options.limit) params.set('limit', options.limit);
  return apiRequest(`/rides/nearby-drivers?${params.toString()}`, { method: 'GET', auth: true });
}

function apiGetRideMessages(rideId) {
  return apiRequest(`/chat/ride/${encodeURIComponent(rideId)}`, { method: 'GET', auth: true });
}

function apiSendRideMessage(rideId, content, recipientId) {
  return apiRequest('/chat/send', {
    method: 'POST',
    body: { rideId, content, recipientId },
    auth: true,
  });
}

function apiMarkRideMessagesRead(rideId) {
  return apiRequest(`/chat/read/${encodeURIComponent(rideId)}`, { method: 'PUT', auth: true });
}

function apiSubmitReview(payload) {
  return apiRequest('/reviews', { method: 'POST', body: payload, auth: true });
}

function apiGetNotifications(page = 1, limit = 20) {
  return apiRequest(`/notifications?page=${page}&limit=${limit}`, { method: 'GET', auth: true });
}

function apiMarkAllNotificationsRead() {
  return apiRequest('/notifications/read-all', { method: 'PUT', auth: true });
}

// Free OpenStreetMap geocoder - turns a typed address into real
// coordinates. No API key needed. Used because the search/book endpoints
// need real [lng, lat], not the address strings the UI collects.
async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not look up that location.');
  const results = await response.json();
  if (!results.length) throw new Error(`Couldn't find "${query}" on the map. Try a more specific address.`);
  return {
    type: 'Point',
    coordinates: [parseFloat(results[0].lon), parseFloat(results[0].lat)],
    address: query,
  };
}

// Stores the backend's response (user fields + JWT token) as both:
//  - 'token' (used directly by API calls / Frontend/SRC/API/AXIOS.js)
//  - 'activeSession' (the shape dashboard.js and other pages already expect)
function persistSession(userResponse) {
  try {
    localStorage.setItem('token', userResponse.token);
    localStorage.setItem(
      'activeSession',
      JSON.stringify({
        username: userResponse.name,
        email: userResponse.email,
        role: userResponse.isDriver ? 'driver' : 'passenger',
        userId: userResponse._id,
      })
    );
    localStorage.setItem('currentUser', userResponse.name);
  } catch (e) {
    /* localStorage unavailable, ignore */
  }
}

function clearSession() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('activeSession');
    localStorage.removeItem('currentUser');
  } catch (e) {
    /* ignore */
  }
}
