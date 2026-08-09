const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  isPointOnRoute,
  findMatchingRides,
  haversineDistance,
} = require('../utils/routeMatcher');
const { calculateFareWithDetour } = require('../utils/fareCalculator');
const {
  isGeoPoint,
  validateRidePayload,
  validateBookingPayload,
  validateReviewPayload,
  validateNotificationQuery,
} = require('../utils/validation');

const straightRoute = [[0, 0], [0.01, 0], [0.02, 0]];
const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

test('route matcher accepts ordered stops close to the route', () => {
  const result = isPointOnRoute(straightRoute, [0.005, 0.0005], [0.015, -0.0005], {
    routeRadiusMeters: 500,
  });
  assert.equal(result.isMatch, true);
  assert.ok(result.pickupDistanceMeters > 0);
  assert.ok(result.routeLengthMeters > 2000);
});

test('route matcher rejects stops outside the route corridor', () => {
  const result = isPointOnRoute(straightRoute, [0.005, 0.01], [0.015, 0.01], {
    routeRadiusMeters: 500,
  });
  assert.equal(result.isMatch, false);
});

test('route matcher rejects stops in the wrong order', () => {
  const result = isPointOnRoute(straightRoute, [0.016, 0], [0.004, 0], {
    routeRadiusMeters: 500,
  });
  assert.equal(result.isMatch, false);
});

test('route matcher finds only compatible rides and preserves ride identity', () => {
  const rides = [
    { _id: 'match', routeLine: { coordinates: straightRoute } },
    { _id: 'miss', routeLine: { coordinates: [[0, 0.02], [0.02, 0.02]] } },
  ];
  const matches = findMatchingRides(rides, [0.005, 0], [0.015, 0], { routeRadiusMeters: 500 });
  assert.deepEqual(matches.map(({ ride }) => ride._id), ['match']);
});

test('distance calculation returns a positive geographic distance', () => {
  assert.ok(haversineDistance([0, 0], [0.01, 0]) > 1000);
});

test('fare splitting includes only detour distance beyond the allowance', () => {
  const direct = calculateFareWithDetour({
    baseFare: 100,
    currentPassengersCount: 2,
    detourDistanceMeters: 500,
    chargePer100m: 5,
  });
  const detour = calculateFareWithDetour({
    baseFare: 100,
    currentPassengersCount: 2,
    detourDistanceMeters: 650,
    chargePer100m: 5,
  });
  assert.equal(direct.sharedBaseFare, 50);
  assert.equal(direct.detourCharge, 0);
  assert.equal(detour.detourCharge, 10);
  assert.equal(detour.totalFareForPassenger, 60);
});

test('fare calculation rejects invalid passenger counts', () => {
  assert.throws(
    () => calculateFareWithDetour({ baseFare: 100, currentPassengersCount: 0 }),
    /At least one passenger/,
  );
});

test('ride, booking, review, and notification query validation rejects malformed input', () => {
  const invalidRide = validateRidePayload({
    from: point(0, 0),
    to: point(0.02, 0),
    routeLine: { type: 'LineString', coordinates: straightRoute },
    totalSeats: 0,
    pricePerSeat: 10,
    departureTime: 'not-a-date',
  });
  assert.equal(invalidRide.valid, false);

  const validBooking = validateBookingPayload({
    pickupLocation: point(0.005, 0),
    dropLocation: point(0.015, 0),
    seatsBooked: 1,
  });
  assert.equal(validBooking.valid, true);
  assert.equal(validateReviewPayload({ rideId: 'ride', targetUserId: 'user', rating: 5 }).valid, true);
  assert.equal(validateReviewPayload({ rideId: 'ride', targetUserId: 'user', rating: 6 }).valid, false);
  assert.equal(validateNotificationQuery({ page: 1, limit: 50 }).valid, true);
  assert.equal(validateNotificationQuery({ page: 0, limit: 51 }).valid, false);
  assert.equal(isGeoPoint(point(1, 2)), true);
  assert.equal(isGeoPoint({ type: 'Point', coordinates: [1] }), false);
});

test('booking source keeps atomic seat reservation and rollback safeguards', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'rideController.js'), 'utf8');
  assert.match(source, /findOneAndUpdate/);
  assert.match(source, /availableSeats:\s*\{\s*\$gte:\s*payload\.seats\s*\}/);
  assert.match(source, /\$inc:\s*\{\s*availableSeats:\s*-payload\.seats\s*\}/);
  assert.match(source, /\$pull:\s*\{\s*'passengers'/);
});

test('SOS source requires ride membership and an unguessable share token', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'sosController.js'), 'utf8');
  assert.match(source, /Only ride participants can trigger SOS/);
  assert.match(source, /crypto\.randomBytes/);
  assert.match(source, /shareToken: token/);
});

test('auth source normalizes credentials and rate-limits public auth routes', () => {
  const authController = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'authController.js'), 'utf8');
  const authRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'authRoutes.js'), 'utf8');
  assert.match(authController, /normalizeEmail/);
  assert.match(authController, /normalizePhone/);
  assert.match(authController, /password\.length < 8/);
  assert.match(authRoutes, /rateLimit/);
});

test('chat source validates direct recipients against ride membership', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'chatController.js'), 'utf8');
  assert.match(source, /Recipient is not a member of this ride/);
  assert.match(source, /isRecipientDriver/);
});

// --- Nearest-available-driver matching (Uber/Ola-style, 400m radius) ------

const { findNearestAvailableDriversInMemory, DEFAULT_SEARCH_RADIUS_METERS } =
  require('../utils/nearestDriverMatcher');

test('nearest-driver matcher defaults to a 400m search radius', () => {
  assert.equal(DEFAULT_SEARCH_RADIUS_METERS, 400);
});

test('nearest-driver matcher only returns drivers within the radius, nearest first', () => {
  const pickup = [0, 0];
  // Rough conversion near the equator: 1 degree of longitude ~= 111,320m.
  const metersToLng = (m) => m / 111320;
  const drivers = [
    { _id: 'far', currentLocation: { coordinates: [metersToLng(900), 0] } },   // ~900m away
    { _id: 'near', currentLocation: { coordinates: [metersToLng(150), 0] } },  // ~150m away
    { _id: 'nearest', currentLocation: { coordinates: [metersToLng(50), 0] } }, // ~50m away
    { _id: 'edge', currentLocation: { coordinates: [metersToLng(399), 0] } },  // just inside 400m
  ];

  const results = findNearestAvailableDriversInMemory(drivers, pickup, { radiusMeters: 400 });

  assert.equal(results.length, 3); // 'far' (900m) must be excluded
  assert.equal(results[0].driver._id, 'nearest');
  assert.equal(results[1].driver._id, 'near');
  assert.equal(results[2].driver._id, 'edge');
  assert.ok(results[0].distanceMeters < results[1].distanceMeters);
  assert.ok(results[1].distanceMeters < results[2].distanceMeters);
});

test('nearest-driver matcher respects a custom limit', () => {
  const pickup = [0, 0];
  const metersToLng = (m) => m / 111320;
  const drivers = Array.from({ length: 5 }, (_, i) => ({
    _id: `driver-${i}`,
    currentLocation: { coordinates: [metersToLng(10 * (i + 1)), 0] },
  }));

  const results = findNearestAvailableDriversInMemory(drivers, pickup, { radiusMeters: 400, limit: 2 });
  assert.equal(results.length, 2);
  assert.equal(results[0].driver._id, 'driver-0');
  assert.equal(results[1].driver._id, 'driver-1');
});

test('nearest-driver controller route is registered and availability is gated on isDriver + isAvailable', () => {
  const controllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'rideController.js'), 'utf8');
  const routesSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'rideRoutes.js'), 'utf8');
  const userModelSource = fs.readFileSync(path.join(__dirname, '..', 'models', 'User.js'), 'utf8');

  assert.match(routesSource, /\/nearby-drivers/);
  assert.match(routesSource, /\/availability/);
  assert.match(controllerSource, /findNearestAvailableDrivers/);
  assert.match(userModelSource, /isAvailable/);
});

// --- A* Algorithm & Routing Tests ------------------------------------------
const { aStarSearch } = require('../utils/aStarRouting');
const { defaultNodes, defaultGraph } = require('../data/defaultRoadGraph');

test('A* algorithm computes optimal path between nodes', () => {
  const result = aStarSearch(defaultGraph, defaultNodes, 'N1', 'N4');
  assert.ok(result);
  assert.ok(result.totalDistanceKm > 0);
  assert.ok(result.etaMinutes > 0);
  assert.equal(result.pathNodes[0].id, 'N1');
  assert.equal(result.pathNodes[result.pathNodes.length - 1].id, 'N4');
});