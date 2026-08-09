'use strict';

// Shared, non-sensitive demo data used by both the web API and MCP server.
const DRIVER_CATALOG = Object.freeze([
  {
    name: 'Aarav Kumar',
    phone: '+91 98765 43210',
    route: [
      { x: 20, y: 70 },
      { x: 36, y: 54 },
      { x: 54, y: 40 },
      { x: 72, y: 30 },
      { x: 86, y: 42 }
    ]
  },
  {
    name: 'Neha Singh',
    phone: '+91 81234 56789',
    route: [
      { x: 18, y: 22 },
      { x: 34, y: 30 },
      { x: 48, y: 46 },
      { x: 64, y: 58 },
      { x: 80, y: 68 }
    ]
  },
  {
    name: 'Rohan Deshpande',
    phone: '+91 99887 66554',
    route: [
      { x: 28, y: 78 },
      { x: 42, y: 66 },
      { x: 56, y: 50 },
      { x: 70, y: 38 },
      { x: 84, y: 26 }
    ]
  }
]);

const liveTrackers = new Map();

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function getTrackingSnapshot(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const driver = DRIVER_CATALOG.find((candidate) => {
    const candidatePhone = normalizePhone(candidate.phone);
    return candidatePhone === normalizedPhone || candidatePhone.endsWith(normalizedPhone);
  });

  if (!driver) {
    return null;
  }

  const trackerState = liveTrackers.get(driver.phone) || { index: -1 };
  const nextIndex = (trackerState.index + 1) % driver.route.length;
  liveTrackers.set(driver.phone, { index: nextIndex });

  const point = driver.route[nextIndex];
  const speed = 18 + ((nextIndex + 1) % 5) * 4;
  const etaMinutes = Math.max(2, driver.route.length - nextIndex);

  return {
    success: true,
    driver: driver.name,
    phone: driver.phone,
    status: 'En route',
    speed: `${speed} km/h`,
    eta: `${etaMinutes} min`,
    location: point,
    lastUpdate: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  };
}

function listAvailableDrivers() {
  return DRIVER_CATALOG.map(({ name, phone }) => ({
    name,
    phone,
    status: 'Available'
  }));
}

module.exports = {
  getTrackingSnapshot,
  listAvailableDrivers,
  normalizePhone
};
