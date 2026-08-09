const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { calculateFareWithDetour } = require('../utils/fareCalculator');
const { isPointOnRoute } = require('../utils/routeMatcher');
const { sendPushNotification } = require('../utils/sendNotification');
const { validateRidePayload, validateBookingPayload } = require('../utils/validation');
const {
  findNearestAvailableDrivers,
  DEFAULT_SEARCH_RADIUS_METERS,
} = require('../utils/nearestDriverMatcher');

const activePassengerFilter = { bookingStatus: { $in: ['pending', 'accepted'] } };

const serializeBooking = (booking) => {
  const value = booking.toObject ? booking.toObject() : booking;
  return {
    ...value,
    seatPrice: value.totalFare,
    detourCharge: value.extraFare,
    status: value.bookingStatus,
    pickupPoint: value.pickupLocation,
    dropoffPoint: value.dropLocation,
  };
};

const createRide = async (req, res, next) => {
  try {
    if (!req.user.isDriver) {
      return res.status(403).json({ message: 'Only registered drivers can create rides.' });
    }
    if (process.env.REQUIRE_DRIVER_VERIFICATION === 'true' &&
      req.user.verificationStatus !== 'approved' &&
      !req.user.drivingLicenseVerified) {
      return res.status(403).json({ message: 'Driver verification is required before posting a ride.' });
    }

    const payload = validateRidePayload(req.body);
    if (!payload.valid) return res.status(400).json({ message: payload.errors.join(' ') });

    const ride = await Ride.create({
      driver: req.user._id,
      from: payload.from,
      to: payload.to,
      routeLine: payload.routeLine,
      departureTime: payload.departureTime,
      totalSeats: payload.seats,
      availableSeats: payload.seats,
      pricePerSeat: payload.fare,
      fareSettings: {
        splitFare: true,
        extraChargePer100m: Number(req.body.extraChargePer100m) >= 0
          ? Number(req.body.extraChargePer100m)
          : 5,
      },
      preferences: req.body.preferences,
      visibility: req.body.visibility || 'public',
      allowedUserTypes: Array.isArray(req.body.allowedUserTypes) ? req.body.allowedUserTypes : [],
      route: req.body.route || {},
      vehicleDetails: req.user.vehicleDetails,
      status: 'scheduled',
    });

    let nearbyPassengers = [];
    if (payload.from && payload.from.coordinates) {
      nearbyPassengers = await User.find({
        _id: { $ne: req.user._id },
        isDriver: false,
        currentLocation: {
          $near: {
            $geometry: payload.from,
            $maxDistance: 4000,
          },
        },
      }).select('_id');
    }

    await Promise.all(nearbyPassengers.map((passenger) => sendPushNotification(
      passenger._id,
      'New Ride Available Nearby!',
      `A driver created a trip from ${payload.from.address} to ${payload.to.address}.`,
      { notificationType: 'nearby-ride', ride: ride._id },
    )));

    return res.status(201).json({
      success: true,
      message: 'Ride created and nearby passengers notified.',
      ride,
      notifiedPassengerCount: nearbyPassengers.length,
    });
  } catch (error) {
    return next(error);
  }
};

const searchRides = async (req, res, next) => {
  try {
    const { pickupLng, pickupLat, dropoffLng, dropoffLat, departureTime, maxTimeDifferenceMinutes } = req.query;
    const coordinates = [pickupLng, pickupLat, dropoffLng, dropoffLat].map(Number);
    if (coordinates.some((value) => !Number.isFinite(value))) {
      return res.status(400).json({ message: 'Valid pickup and dropoff coordinates are required.' });
    }

    const [pickupLngValue, pickupLatValue, dropoffLngValue, dropoffLatValue] = coordinates;
    const passengerPickup = [pickupLngValue, pickupLatValue];
    const passengerDropoff = [dropoffLngValue, dropoffLatValue];
    const requestedDeparture = departureTime ? new Date(departureTime) : null;
    const maxDifference = Number(maxTimeDifferenceMinutes || 60);

    const activeRides = await Ride.find({
      status: 'scheduled',
      availableSeats: { $gt: 0 },
      departureTime: { $gte: new Date() },
    }).populate('driver', 'name phone rating numReviews isTopRated profileImage profilePhoto gender userType organization organizationId vehicleDetails');

    const matchingRides = [];
    for (const ride of activeRides) {
      if (!ride.driver) continue;
      if (ride.visibility === 'college' && ride.driver.userType !== 'student') continue;
      if (ride.visibility === 'office' && ride.driver.userType !== 'employee') continue;
      if (Array.isArray(ride.allowedUserTypes) && ride.allowedUserTypes.length &&
        !ride.allowedUserTypes.includes(req.user.userType)) continue;
      const preference = ride.preferences?.genderPreference;
      if ((preference === 'male-only' && req.user.gender !== 'male') ||
        (preference === 'female-only' && req.user.gender !== 'female')) continue;
      if (requestedDeparture && Math.abs(new Date(ride.departureTime) - requestedDeparture) >
        maxDifference * 60 * 1000) continue;

      const matchResult = isPointOnRoute(
        ride.routeLine?.coordinates || [],
        passengerPickup,
        passengerDropoff,
        { routeRadiusMeters: Number(ride.routeRadius) || 4000 },
      );
      if (!matchResult.isMatch) continue;

      const fareDetails = calculateFareWithDetour({
        baseFare: ride.pricePerSeat,
        currentPassengersCount: ride.totalSeats - ride.availableSeats + 1,
        detourDistanceMeters: matchResult.detourDistanceMeters,
        chargePer100m: ride.fareSettings?.extraChargePer100m || 5,
        includedDetourMeters: Number(ride.maxDetourDistance) || 500,
        toll: ride.route?.toll || 0,
        waitingMinutes: ride.route?.waitingMinutes || 0,
      });
      const timeScore = requestedDeparture
        ? Math.max(0, 1 - Math.abs(new Date(ride.departureTime) - requestedDeparture) / (maxDifference * 60 * 1000))
        : 1;
      const matchScore = (
        matchResult.routeSimilarity * 0.55 +
        timeScore * 0.2 +
        Math.min(1, (ride.driver.rating || 0) / 5) * 0.25
      );
      matchingRides.push({
        ride,
        detourDistanceMeters: matchResult.detourDistanceMeters,
        pickupDistanceMeters: matchResult.pickupDistanceMeters,
        dropoffDistanceMeters: matchResult.dropoffDistanceMeters,
        routeSimilarity: matchResult.routeSimilarity,
        matchScore: Number(matchScore.toFixed(3)),
        isDirectPath: matchResult.detourDistanceMeters === 0,
        fareBreakdown: fareDetails,
      });
    }
    matchingRides.sort((a, b) => b.matchScore - a.matchScore);
    return res.json({ count: matchingRides.length, rides: matchingRides });
  } catch (error) {
    return next(error);
  }
};

const bookRide = async (req, res, next) => {
  try {
    const payload = validateBookingPayload(req.body);
    if (!payload.valid) return res.status(400).json({ message: payload.errors.join(' ') });

    const ride = await Ride.findById(req.params.id).populate('driver', 'name phone rating profileImage vehicleDetails');
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (ride.driver._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'A driver cannot book their own ride.' });
    }
    if (ride.status !== 'scheduled') return res.status(400).json({ message: 'This ride is no longer open for booking.' });

    const existingBooking = await Booking.findOne({
      ride: ride._id,
      passenger: req.user._id,
      bookingStatus: { $in: ['pending', 'accepted'] },
    });
    if (existingBooking) return res.status(409).json({ message: 'You already have an active booking for this ride.' });

    const matchResult = isPointOnRoute(
      ride.routeLine?.coordinates || [],
      payload.pickup.coordinates,
      payload.drop.coordinates,
      { routeRadiusMeters: Number(ride.routeRadius) || 4000 },
    );
    if (!matchResult.isMatch) return res.status(400).json({ message: 'Pickup and dropoff do not follow this ride route.' });

    const activeCount = await Booking.countDocuments({ ride: ride._id, ...activePassengerFilter });
    const fareDetails = calculateFareWithDetour({
      baseFare: ride.pricePerSeat,
      currentPassengersCount: activeCount + payload.seats,
      detourDistanceMeters: matchResult.detourDistanceMeters,
      chargePer100m: ride.fareSettings?.extraChargePer100m || 5,
      includedDetourMeters: Number(ride.maxDetourDistance) || 500,
      toll: ride.route?.toll || 0,
    });

    const updatedRide = await Ride.findOneAndUpdate(
      { _id: ride._id, status: 'scheduled', availableSeats: { $gte: payload.seats } },
      {
        $inc: { availableSeats: -payload.seats },
        $push: {
          passengers: {
            user: req.user._id,
            pickupLocation: payload.pickup,
            dropLocation: payload.drop,
            seatsBooked: payload.seats,
            extraDistance: matchResult.detourDistanceMeters,
            extraFare: fareDetails.detourCharge,
            finalFare: fareDetails.totalFareForPassenger,
            status: 'confirmed',
          },
        },
      },
      { new: true },
    );
    if (!updatedRide) return res.status(409).json({ message: 'That seat was just booked by another passenger.' });

    let booking;
    try {
      booking = await Booking.create({
        ride: ride._id,
        passenger: req.user._id,
        driver: ride.driver._id,
        pickupLocation: payload.pickup,
        dropLocation: payload.drop,
        isRouteMatched: true,
        pickupDistanceFromRoute: matchResult.pickupDistanceMeters,
        dropDistanceFromRoute: matchResult.dropoffDistanceMeters,
        extraDistance: matchResult.detourDistanceMeters,
        baseFare: ride.pricePerSeat,
        splitFare: fareDetails.sharedBaseFare,
        extraFare: fareDetails.detourCharge,
        totalFare: fareDetails.totalFareForPassenger,
        seatsBooked: payload.seats,
        bookingStatus: 'accepted',
      });
    } catch (error) {
      await Ride.updateOne(
        { _id: ride._id },
        { $inc: { availableSeats: payload.seats }, $pull: { 'passengers': { user: req.user._id } } },
      );
      throw error;
    }

    const currentBookings = await Booking.find({ ride: ride._id, ...activePassengerFilter });
    const passengerCount = currentBookings.reduce((sum, item) => sum + item.seatsBooked, 0);
    await Promise.all(currentBookings.map(async (item) => {
      const nextFare = calculateFareWithDetour({
        baseFare: ride.pricePerSeat,
        currentPassengersCount: passengerCount,
        detourDistanceMeters: item.extraDistance,
        chargePer100m: ride.fareSettings?.extraChargePer100m || 5,
        includedDetourMeters: Number(ride.maxDetourDistance) || 500,
      });
      await Booking.updateOne({ _id: item._id }, {
        $set: {
          splitFare: nextFare.sharedBaseFare,
          extraFare: nextFare.detourCharge,
          totalFare: nextFare.totalFareForPassenger,
        },
      });
    }));

    await sendPushNotification(
      ride.driver._id,
      'New Passenger Booking',
      `${req.user.name} booked a seat on your ride.`,
      { notificationType: 'booking-accepted', ride: ride._id, booking: booking._id },
    );
    const fullRideInfo = await Ride.findById(ride._id)
      .populate('driver', 'name phone rating numReviews profileImage profilePhoto vehicleDetails')
      .populate('passengers.user', 'name profileImage profilePhoto rating numReviews gender isVerified');
    const refreshedBooking = await Booking.findById(booking._id);
    return res.status(201).json({
      message: 'Seat booked successfully.',
      booking: serializeBooking(refreshedBooking),
      rideDetails: fullRideInfo,
    });
  } catch (error) {
    return next(error);
  }
};

const getRideSafetyDetails = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('driver', 'name phone profileImage profilePhoto rating numReviews isTopRated vehicleDetails isVerified')
      .populate('passengers.user', 'name profileImage profilePhoto rating numReviews gender isVerified');
    if (!ride) return res.status(404).json({ message: 'Ride details not found.' });
    const isDriver = ride.driver._id.toString() === req.user._id.toString();
    const isPassenger = ride.passengers.some((passenger) => passenger.user?._id.toString() === req.user._id.toString());
    if (!isDriver && !isPassenger) return res.status(403).json({ message: 'Ride membership is required to view safety details.' });
    return res.json({ ride, driver: ride.driver, passengers: ride.passengers.map((p) => p.user), vehicle: ride.driver.vehicleDetails });
  } catch (error) {
    return next(error);
  }
};

const getMyRides = async (req, res, next) => {
  try {
    const rides = await Ride.find({ driver: req.user._id }).sort({ departureTime: -1 }).populate('passengers.user', 'name rating gender');
    return res.json(rides);
  } catch (error) {
    return next(error);
  }
};

const getRideHistory = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ passenger: req.user._id })
      .populate({ path: 'ride', populate: { path: 'driver', select: 'name rating numReviews vehicleDetails' } })
      .sort({ createdAt: -1 });
    const drivenRides = await Ride.find({ driver: req.user._id }).sort({ departureTime: -1 });
    return res.json({ bookings: bookings.map(serializeBooking), drivenRides });
  } catch (error) {
    return next(error);
  }
};

const updateRideStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['scheduled', 'in-progress', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid ride status.' });
    const ride = await Ride.findOne({ _id: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    const transitions = {
      scheduled: ['in-progress', 'cancelled'],
      'in-progress': ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };
    if (!transitions[ride.status].includes(status)) return res.status(400).json({ message: `Cannot change ride from ${ride.status} to ${status}.` });
    ride.status = status;
    await ride.save();
    if (status === 'completed' || status === 'cancelled') {
      await Booking.updateMany(
        { ride: ride._id, bookingStatus: { $in: ['pending', 'accepted'] } },
        { $set: { bookingStatus: status === 'completed' ? 'completed' : 'cancelled' } },
      );
    }
    const bookingRecipients = await Booking.find({ ride: ride._id }).distinct('passenger');
    await Promise.all(bookingRecipients.map((recipient) => sendPushNotification(
      recipient,
      `Ride ${status}`,
      `Your ride has been marked ${status}.`,
      { notificationType: status === 'completed' ? 'ride-completed' : status === 'in-progress' ? 'ride-started' : 'ride-cancelled', ride: ride._id },
    )));
    return res.json({ success: true, ride });
  } catch (error) {
    return next(error);
  }
};

const updateRideLocation = async (req, res, next) => {
  try {
    const { coordinates, address, speed, heading } = req.body;
    if (!Array.isArray(coordinates) || coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(Number(value)))) {
      return res.status(400).json({ message: 'A valid [longitude, latitude] location is required.' });
    }
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id, status: 'in-progress' },
      { currentLocation: { type: 'Point', coordinates: coordinates.map(Number), address, updatedAt: new Date(), speed, heading } },
      { new: true },
    );
    if (!ride) return res.status(404).json({ message: 'Active driver ride not found.' });
    return res.json({ success: true, location: ride.currentLocation });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Find available drivers nearest to a pickup point, within a
 *          400m radius by default - the same "who's closest right now"
 *          lookup Uber/Ola run when a rider requests a ride.
 * @route   GET /api/rides/nearby-drivers?lng=&lat=&radius=&limit=
 * @access  Private
 */
const findNearbyDrivers = async (req, res, next) => {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json({ message: 'Valid lng and lat query parameters are required.' });
    }

    const radiusMeters = req.query.radius ? Number(req.query.radius) : DEFAULT_SEARCH_RADIUS_METERS;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const matches = await findNearestAvailableDrivers(User, [lng, lat], {
      radiusMeters,
      limit,
      excludeDriverId: req.user._id,
    });

    return res.json({
      count: matches.length,
      radiusMeters,
      drivers: matches.map(({ driver, distanceMeters }) => ({
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        rating: driver.rating,
        numReviews: driver.numReviews,
        isVerified: driver.isVerified,
        vehicleDetails: driver.vehicleDetails,
        location: driver.currentLocation,
        distanceMeters,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Driver goes online/offline. Only drivers with isAvailable: true
 *          (and a recent location ping) are considered by the
 *          nearest-driver matching algorithm above.
 * @route   PATCH /api/rides/availability
 * @access  Private (driver)
 */
const setDriverAvailability = async (req, res, next) => {
  try {
    if (!req.user.isDriver) {
      return res.status(403).json({ message: 'Only registered drivers can toggle availability.' });
    }
    const { isAvailable, coordinates, address } = req.body;
    const update = { isAvailable: Boolean(isAvailable) };
    if (Array.isArray(coordinates) && coordinates.length === 2 &&
      coordinates.every((value) => Number.isFinite(Number(value)))) {
      update.currentLocation = {
        type: 'Point',
        coordinates: coordinates.map(Number),
        address,
        updatedAt: new Date(),
      };
    }
    const driver = await User.findByIdAndUpdate(req.user._id, update, { new: true })
      .select('name isAvailable currentLocation');
    return res.json({ success: true, isAvailable: driver.isAvailable, location: driver.currentLocation });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Calculate shortest driving path using A* algorithm
 * @route   POST /api/rides/astar-route
 * @access  Public / Private
 */
const calculateAStarRoute = async (req, res, next) => {
  try {
    const { defaultNodes, defaultGraph } = require('../data/defaultRoadGraph');
    const { aStarSearch, findNearestGraphNode } = require('../utils/aStarRouting');

    const { startCoords, goalCoords, startNodeId, goalNodeId } = req.body;

    let startId = startNodeId;
    let goalId = goalNodeId;

    if (!startId && Array.isArray(startCoords)) {
      startId = findNearestGraphNode(defaultNodes, startCoords);
    }
    if (!goalId && Array.isArray(goalCoords)) {
      goalId = findNearestGraphNode(defaultNodes, goalCoords);
    }

    if (!startId || !goalId) {
      return res.status(400).json({ message: 'Valid start and goal points/nodes are required.' });
    }

    const route = aStarSearch(defaultGraph, defaultNodes, startId, goalId);

    if (!route) {
      return res.status(404).json({ message: 'No viable driving route found between specified points.' });
    }

    return res.json({
      success: true,
      algorithm: 'A* (A-Star) Pathfinding',
      evaluationFormula: 'f(n) = g(n) + h(n)',
      startNode: defaultNodes[startId],
      goalNode: defaultNodes[goalId],
      route,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createRide,
  searchRides,
  bookRide,
  getRideSafetyDetails,
  getMyRides,
  getRideHistory,
  updateRideStatus,
  updateRideLocation,
  findNearbyDrivers,
  setDriverAvailability,
  calculateAStarRoute,
};