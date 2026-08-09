const EARTH_RADIUS_METERS = 6371000;

const toRadians = (value) => (value * Math.PI) / 180;

const haversineDistance = (a, b) => {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const distanceToSegment = (point, start, end) => {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos(toRadians(point[1]));
  const project = ([lng, lat]) => [lng * lngScale, lat * latScale];
  const p = project(point);
  const a = project(start);
  const b = project(end);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  const closest = [a[0] + t * dx, a[1] + t * dy];
  return Math.hypot(p[0] - closest[0], p[1] - closest[1]);
};

const calculateMinDistanceToRoute = (routeCoords, point) => {
  if (!Array.isArray(routeCoords) || routeCoords.length < 2 || !Array.isArray(point)) {
    return Infinity;
  }
  let minimum = Infinity;
  for (let index = 1; index < routeCoords.length; index += 1) {
    minimum = Math.min(minimum, distanceToSegment(point, routeCoords[index - 1], routeCoords[index]));
  }
  return Math.round(minimum);
};

const routeLength = (routeCoords) => {
  if (!Array.isArray(routeCoords)) return 0;
  return routeCoords.slice(1).reduce((total, point, index) => (
    total + haversineDistance(routeCoords[index], point)
  ), 0);
};

const closestRouteProgress = (routeCoords, point) => {
  if (!Array.isArray(routeCoords) || routeCoords.length < 2) return null;
  let closest = { distance: Infinity, progress: 0 };
  let travelled = 0;
  for (let index = 1; index < routeCoords.length; index += 1) {
    const start = routeCoords[index - 1];
    const end = routeCoords[index];
    const segmentLength = haversineDistance(start, end);
    const distance = distanceToSegment(point, start, end);
    if (distance < closest.distance) {
      closest = { distance, progress: travelled + segmentLength / 2 };
    }
    travelled += segmentLength;
  }
  return closest;
};

/**
 * A point is a route candidate when both stops are within the driver's
 * route corridor. The actual detour is the distance from the route to both
 * requested stops. Detours above the included threshold remain matchable but
 * receive a per-100m surcharge in fareCalculator.
 */
const isPointOnRoute = (
  routeCoordinates,
  pickupCoords,
  dropoffCoords,
  { routeRadiusMeters = 500, directThresholdMeters = 50 } = {},
) => {
  const pickup = closestRouteProgress(routeCoordinates, pickupCoords);
  const dropoff = closestRouteProgress(routeCoordinates, dropoffCoords);
  if (!pickup || !dropoff || pickup.progress > dropoff.progress) {
    return { isMatch: false, detourDistanceMeters: Infinity };
  }

  const pickupDistance = Math.round(pickup.distance);
  const dropoffDistance = Math.round(dropoff.distance);
  if (pickupDistance > routeRadiusMeters || dropoffDistance > routeRadiusMeters) {
    return { isMatch: false, detourDistanceMeters: Infinity };
  }

  const extraDistanceMeters = pickupDistance + dropoffDistance;
  return {
    isMatch: true,
    pickupDistanceMeters: pickupDistance,
    dropoffDistanceMeters: dropoffDistance,
    detourDistanceMeters: extraDistanceMeters <= directThresholdMeters ? 0 : extraDistanceMeters,
    routeSimilarity: Math.max(0, 1 - extraDistanceMeters / (routeRadiusMeters * 2)),
    routeLengthMeters: Math.round(routeLength(routeCoordinates)),
  };
};

const findMatchingRides = (rides, pickupCoords, dropoffCoords, options) => rides
  .map((ride) => ({
    ride,
    match: isPointOnRoute(
      ride.routeLine?.coordinates || ride.routeGeometry?.coordinates || [],
      pickupCoords,
      dropoffCoords,
      options,
    ),
  }))
  .filter((entry) => entry.match.isMatch);

module.exports = {
  isPointOnRoute,
  findMatchingRides,
  haversineDistance,
  calculateMinDistanceToRoute,
};