const isFiniteNumber = (value) => Number.isFinite(Number(value));

const isGeoPoint = (point) => (
  point &&
  point.type === 'Point' &&
  Array.isArray(point.coordinates) &&
  point.coordinates.length === 2 &&
  point.coordinates.every((coordinate) => isFiniteNumber(coordinate))
);

const validateRidePayload = (body) => {
  const errors = [];
  const from = body.from || body.origin;
  const to = body.to || body.destination;
  const routeLine = body.routeLine || body.routeLineString;
  if (!isGeoPoint(from)) errors.push('A valid origin/from GeoJSON point is required.');
  if (!isGeoPoint(to)) errors.push('A valid destination/to GeoJSON point is required.');
  if (!routeLine || routeLine.type !== 'LineString' || !Array.isArray(routeLine.coordinates) || routeLine.coordinates.length < 2) {
    errors.push('A route line with at least two coordinates is required.');
  }
  const seats = Number(body.totalSeats);
  const fare = Number(body.pricePerSeat ?? body.baseFare);
  if (!Number.isInteger(seats) || seats < 1 || seats > 8) errors.push('Total seats must be an integer from 1 to 8.');
  if (!isFiniteNumber(fare) || fare < 0) errors.push('Price per seat/base fare must be a non-negative number.');
  const departureTime = body.departureTime ? new Date(body.departureTime) : null;
  if (!body.departureTime || !departureTime || Number.isNaN(departureTime.getTime())) errors.push('A valid departure time is required.');
  return { valid: errors.length === 0, errors, from, to, routeLine, seats, fare, departureTime };
};

const validateBookingPayload = (body) => {
  const pickup = body.pickupLocation || body.pickupPoint;
  const drop = body.dropLocation || body.dropoffPoint;
  const errors = [];
  if (!isGeoPoint(pickup)) errors.push('A valid pickup GeoJSON point is required.');
  if (!isGeoPoint(drop)) errors.push('A valid dropoff GeoJSON point is required.');
  const seats = Number(body.seatsBooked || 1);
  if (!Number.isInteger(seats) || seats < 1) errors.push('Seats booked must be a positive integer.');
  return { valid: errors.length === 0, errors, pickup, drop, seats };
};

const validateReviewPayload = (body) => {
  const rating = Number(body.rating ?? body.overall);
  const errors = [];
  if (!body.rideId || !body.targetUserId && !body.reviewedUserId) errors.push('Ride and target user are required.');
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) errors.push('Rating must be between 1 and 5.');
  return { valid: errors.length === 0, errors, rating };
};

const validateNotificationQuery = (query) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  return {
    valid: Number.isInteger(page) && page > 0 && Number.isInteger(limit) && limit > 0 && limit <= 50,
    page,
    limit,
  };
};

module.exports = {
  isGeoPoint,
  validateRidePayload,
  validateBookingPayload,
  validateReviewPayload,
  validateNotificationQuery,
};