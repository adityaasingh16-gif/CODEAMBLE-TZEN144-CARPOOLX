// ---------------------------------------------------------------------------
// Nearest-available-driver matching algorithm
//
// This mirrors how ride-hailing dispatch systems like Uber/Ola locate the
// closest free drivers around a rider:
//
//   1. SPATIAL INDEX LOOKUP (coarse pass) - rather than scanning every
//      driver row and computing distance one by one (O(n) over the whole
//      fleet), production systems bucket drivers into a spatial grid
//      (Uber's H3 hexagons / Ola's S2 cells are the well-known examples) so
//      a search only touches the handful of cells that overlap the search
//      radius. MongoDB's 2dsphere index gives us the same win here: a
//      `$geoNear`/`$near` query walks a geospatial B-tree instead of the
//      whole collection, and can return candidates already sorted by
//      straight-line distance.
//
//   2. RADIUS FILTER - candidates are constrained to a maxDistance (default
//      400 meters, matching the "find drivers within 400m" requirement).
//      This is the same idea as Uber/Ola's expanding-radius search: look
//      close first, only widen the radius if nobody nearby is free.
//
//   3. FINE RANKING (exact pass) - the coarse query gives "close enough"
//      candidates; we then recompute the precise great-circle (Haversine)
//      distance for each one and sort ascending, so the driver actually
//      nearest the rider is always first, unaffected by any index
//      approximation.
//
//   4. AVAILABILITY FILTER - only drivers who are online (isAvailable:
//      true), belong to the `driver` role, and have a location update
//      within the freshness window are eligible, so a driver who closed the
//      app 20 minutes ago doesn't get matched to a rider standing next to
//      their last known spot.
// ---------------------------------------------------------------------------

const { haversineDistance } = require('./routeMatcher');

const DEFAULT_SEARCH_RADIUS_METERS = 400;
const DEFAULT_LOCATION_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Finds available drivers within `radiusMeters` of a rider's pickup point,
 * ordered nearest-first.
 *
 * @param {import('mongoose').Model} UserModel - the User mongoose model
 *   (passed in rather than required directly so this stays easy to unit
 *   test with a mock/in-memory model).
 * @param {[number, number]} pickupCoords - [longitude, latitude] of the rider.
 * @param {object} [options]
 * @param {number} [options.radiusMeters=400] - search radius in meters.
 * @param {number} [options.limit=10] - max number of drivers to return.
 * @param {number} [options.freshnessMs=300000] - ignore drivers whose
 *   currentLocation.updatedAt is older than this (stale GPS pings).
 * @param {string|null} [options.excludeDriverId] - driver id to exclude
 *   (e.g. don't match a driver to themselves).
 * @returns {Promise<Array<{ driver: object, distanceMeters: number }>>}
 */
async function findNearestAvailableDrivers(UserModel, pickupCoords, options = {}) {
  if (!Array.isArray(pickupCoords) || pickupCoords.length !== 2 ||
    !pickupCoords.every((value) => Number.isFinite(value))) {
    throw new Error('pickupCoords must be a valid [longitude, latitude] pair.');
  }

  const radiusMeters = Number(options.radiusMeters) > 0
    ? Number(options.radiusMeters)
    : DEFAULT_SEARCH_RADIUS_METERS;
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 10;
  const freshnessMs = Number(options.freshnessMs) >= 0
    ? Number(options.freshnessMs)
    : DEFAULT_LOCATION_FRESHNESS_MS;

  const freshnessCutoff = new Date(Date.now() - freshnessMs);

  // --- Pass 1: coarse geospatial candidate lookup -------------------------
  // $near on a 2dsphere index does the same job as a spatial grid lookup:
  // it only walks drivers near the query point instead of the whole
  // collection, and returns them pre-sorted by distance.
  const query = {
    isDriver: true,
    isAvailable: true,
    accountStatus: 'active',
    'currentLocation.updatedAt': { $gte: freshnessCutoff },
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: pickupCoords },
        $maxDistance: radiusMeters,
      },
    },
  };
  if (options.excludeDriverId) {
    query._id = { $ne: options.excludeDriverId };
  }

  const candidates = await UserModel.find(query)
    .limit(Math.max(limit * 3, limit)) // over-fetch slightly for the fine ranking pass
    .select('name phone rating numReviews vehicleDetails currentLocation isVerified')
    .lean();

  // --- Pass 2: fine-grained ranking ---------------------------------------
  // Recompute exact Haversine distance so results are precisely
  // nearest-first, then hard-cap at the requested radius in case the
  // driver moved slightly between GPS pings and the index result.
  // --- Pass 2: fine-grained ranking (A* Algorithm & Haversine) ----------------
  const { defaultNodes, defaultGraph } = require('../data/defaultRoadGraph');
  const { rankDriversWithAStar } = require('./aStarRouting');

  let ranked = candidates
    .map((driver) => ({
      driver,
      distanceMeters: Math.round(
        haversineDistance(pickupCoords, driver.currentLocation.coordinates),
      ),
    }))
    .filter((entry) => entry.distanceMeters <= radiusMeters);

  if (options.useAStar !== false && ranked.length > 0) {
    // Run A* algorithm to calculate exact driving path and travel ETA
    const aStarRanked = rankDriversWithAStar(
      defaultGraph,
      defaultNodes,
      pickupCoords,
      ranked.map((item) => item.driver)
    );

    ranked = aStarRanked.map((aItem) => ({
      driver: aItem.driver,
      distanceMeters: Math.round((aItem.distanceKm || 0) * 1000),
      etaMinutes: aItem.etaMinutes,
      etaSeconds: aItem.etaSeconds,
      drivingPath: aItem.drivingPath,
    }));
  } else {
    ranked.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  return ranked.slice(0, limit);
}

/**
 * Pure in-memory variant of the same algorithm, useful for unit tests or
 * any caller that already has a driver list in hand (e.g. a Socket.IO
 * presence cache) and doesn't want to hit the database.
 *
 * @param {Array<{ _id: any, currentLocation: { coordinates: [number, number] } }>} drivers
 * @param {[number, number]} pickupCoords - [longitude, latitude]
 * @param {object} [options]
 * @param {number} [options.radiusMeters=400]
 * @param {number} [options.limit=10]
 */
function findNearestAvailableDriversInMemory(drivers, pickupCoords, options = {}) {
  const radiusMeters = Number(options.radiusMeters) > 0
    ? Number(options.radiusMeters)
    : DEFAULT_SEARCH_RADIUS_METERS;
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 10;

  return (drivers || [])
    .filter((driver) => Array.isArray(driver?.currentLocation?.coordinates))
    .map((driver) => ({
      driver,
      distanceMeters: Math.round(
        haversineDistance(pickupCoords, driver.currentLocation.coordinates),
      ),
    }))
    .filter((entry) => entry.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

module.exports = {
  DEFAULT_SEARCH_RADIUS_METERS,
  findNearestAvailableDrivers,
  findNearestAvailableDriversInMemory,
};
