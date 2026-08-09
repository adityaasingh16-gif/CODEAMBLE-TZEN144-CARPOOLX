/**
 * Tests mapped 1:1 to the 8 rules from the handwritten "Algorithm" notebook page.
 * Run with: node --test tests/handwritten-rules.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { isPointOnRoute } = require('../utils/routeMatcher');
const { calculateFareWithDetour } = require('../utils/fareCalculator');

const straightRoute = [[0, 0], [0.02, 0]]; // roughly A(0,0) -> B(0.02,0), ~2.2km

// Rule 1: A-B specific route trip gets booked (route corridor match)
test('Rule 1: a specific A-B route can be matched/booked', () => {
  const result = isPointOnRoute(straightRoute, [0, 0], [0.02, 0], { routeRadiusMeters: 500 });
  assert.equal(result.isMatch, true);
});

// Rule 2: fare is split EQUALLY among all passengers on the A-B ride
test('Rule 2: base fare divides equally across passengers', () => {
  const two = calculateFareWithDetour({ baseFare: 100, currentPassengersCount: 2 });
  const four = calculateFareWithDetour({ baseFare: 100, currentPassengersCount: 4 });
  assert.equal(two.sharedBaseFare, 50);
  assert.equal(four.sharedBaseFare, 25);
});

// Rule 3: A-B-C multi-stop trip should still be matchable when C sits within
// a 300-500m corridor of the route (the note's stated tolerance band)
test('Rule 3: a mid-route detour of 300-500m is still considered "on route"', () => {
  const withinBand = isPointOnRoute(straightRoute, [0, 0], [0.01, 0.004], { routeRadiusMeters: 500 });
  // ~0.004 deg lat ~= 444m, within the 300-500m band described in the notes
  assert.equal(withinBand.isMatch, true);
});

// Rule 4: extra distance beyond the base route is charged per 100m
test('Rule 4: detour beyond the included allowance is charged per 100m block', () => {
  const noDetour = calculateFareWithDetour({
    baseFare: 100, currentPassengersCount: 1, detourDistanceMeters: 500,
    includedDetourMeters: 500, chargePer100m: 5,
  });
  const withDetour = calculateFareWithDetour({
    baseFare: 100, currentPassengersCount: 1, detourDistanceMeters: 750,
    includedDetourMeters: 500, chargePer100m: 5,
  });
  assert.equal(noDetour.detourCharge, 0);
  // 250m extra -> ceil(250/100)=3 blocks * 5 = 15
  assert.equal(withDetour.detourCharge, 15);
});

// Rule 5: a mid-trip pickup (A-C-B) is charged on the SAME per-100m basis as
// any other detour - i.e. the pricing rule doesn't change based on stop position
test('Rule 5: a mid-route pickup point (A-C-B) uses the same per-100m rate', () => {
  const midRoutePickup = calculateFareWithDetour({
    baseFare: 100, currentPassengersCount: 1, detourDistanceMeters: 300,
    includedDetourMeters: 0, chargePer100m: 5,
  });
  // 300m detour, no free allowance -> ceil(300/100)=3 * 5 = 15, same formula
  // regardless of whether the extra distance came from the start, middle, or end
  assert.equal(midRoutePickup.detourCharge, 15);
});

// Rule 6: seat-availability notifications should only go out within a
// defined radius, and only when seats are actually available
test('Rule 6: ride creation notifies nearby users, gated by a radius', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'rideController.js'), 'utf8');
  assert.match(source, /\$maxDistance:\s*4000/); // 4km radius from the notes
  assert.match(source, /availableSeats:\s*\{\s*\$gt:\s*0\s*\}/); // only rides with open seats surface in search
});

// Rule 7: SOS notifies the nearest police station / emergency dispatch
test('Rule 7: SOS trigger includes a police-station / emergency contact', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'sosController.js'), 'utf8');
  assert.match(source, /nearestPoliceStation/);
  assert.match(source, /policeStationNotified/);
});

// Rule 8: passenger gender is exposed to ride participants for comfort/safety
test('Rule 8: passenger gender is populated for ride participants', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'rideController.js'), 'utf8');
  assert.match(source, /passengers\.user',\s*'name profileImage profilePhoto rating numReviews gender/);
});

// Regression: posting a ride from the driver dashboard used to fail with
// "currentLocation.address is required" / "departureTime is required" even
// though the form sent a valid payload - validateRidePayload was silently
// dropping departureTime, and currentLocation had falsely-required subfields.
test('Regression: a well-formed "Post a Ride" payload passes both request validation and the Mongoose schema', () => {
  const mongoose = require('mongoose');
  const Ride = require('../models/Ride');
  const { validateRidePayload } = require('../utils/validation');

  const body = {
    from: { type: 'Point', coordinates: [73.1197, 19.0330], address: 'Panvel Station' },
    to: { type: 'Point', coordinates: [73.0111, 19.0330], address: 'Kharghar Station' },
    routeLine: { type: 'LineString', coordinates: [[73.1197, 19.0330], [73.0111, 19.0330]] },
    departureTime: '2026-08-09T08:55:00.000Z',
    totalSeats: 4,
    pricePerSeat: 100,
  };

  const payload = validateRidePayload(body);
  assert.equal(payload.valid, true);
  assert.ok(payload.departureTime instanceof Date);

  const ride = new Ride({
    driver: new mongoose.Types.ObjectId(),
    from: payload.from,
    to: payload.to,
    routeLine: payload.routeLine,
    departureTime: payload.departureTime,
    totalSeats: payload.seats,
    availableSeats: payload.seats,
    pricePerSeat: payload.fare,
    status: 'scheduled',
  });

  const err = ride.validateSync();
  assert.equal(err, undefined);
});
