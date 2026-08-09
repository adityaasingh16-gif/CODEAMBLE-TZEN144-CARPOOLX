const Review = require('../models/Review');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

const average = (values) => values.length
  ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  : 0;

const createReview = async (req, res, next) => {
  try {
    const {
      rideId,
      bookingId,
      targetUserId,
      reviewedUserId,
      rating,
      overall,
      comment,
      review,
      tags,
      scoreBreakdown = {},
    } = req.body;
    const targetId = targetUserId || reviewedUserId;
    const overallRating = Number(overall ?? rating);
    if (!rideId || !targetId || !Number.isFinite(overallRating) || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ message: 'Ride, target user, and a rating between 1 and 5 are required.' });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (ride.status !== 'completed') return res.status(400).json({ message: 'Ratings are available after ride completion.' });
    if (targetId.toString() === req.user._id.toString()) return res.status(400).json({ message: 'You cannot rate yourself.' });

    const booking = bookingId
      ? await Booking.findById(bookingId)
      : await Booking.findOne({
        ride: ride._id,
        $or: [{ passenger: req.user._id }, { passenger: targetId }],
      });
    if (!booking || booking.ride.toString() !== ride._id.toString() ||
      booking.bookingStatus !== 'completed') {
      return res.status(403).json({ message: 'A completed booking for this ride is required.' });
    }

    const isDriver = ride.driver.toString() === req.user._id.toString();
    const isPassenger = booking.passenger.toString() === req.user._id.toString();
    const targetIsDriver = ride.driver.toString() === targetId.toString();
    const targetIsPassenger = ride.passengers.some((passenger) => passenger.user?.toString() === targetId.toString());
    if ((!isDriver && !isPassenger) || (isDriver && !targetIsPassenger) || (isPassenger && !targetIsDriver)) {
      return res.status(403).json({ message: 'Only participants can rate another participant on this ride.' });
    }

    const reviewType = isDriver ? 'driver-to-passenger' : 'passenger-to-driver';
    const existing = await Review.findOne({ booking: booking._id, reviewer: req.user._id, reviewedUser: targetId });
    if (existing) return res.status(409).json({ message: 'You have already rated this participant for this ride.' });

    const reviewRecord = await Review.create({
      ride: ride._id,
      booking: booking._id,
      reviewer: req.user._id,
      reviewedUser: targetId,
      reviewType,
      rating: overallRating,
      scoreBreakdown: {
        ...scoreBreakdown,
        overall: overallRating,
      },
      review: comment || review,
      tags: Array.isArray(tags) ? tags : [],
    });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'Target user not found.' });
    const reviews = await Review.find({ reviewedUser: targetId, isVisible: true }).select('rating reviewType scoreBreakdown');
    const driverReviews = reviews.filter((item) => item.reviewType === 'passenger-to-driver');
    const passengerReviews = reviews.filter((item) => item.reviewType === 'driver-to-passenger');
    target.rating = average(reviews.map((item) => item.rating));
    target.numReviews = reviews.length;
    target.averageDriverRating = average(driverReviews.map((item) => item.rating));
    target.totalDriverRatings = driverReviews.length;
    target.averagePassengerRating = average(passengerReviews.map((item) => item.rating));
    target.totalPassengerRatings = passengerReviews.length;
    await target.save();

    return res.status(201).json({
      success: true,
      review: reviewRecord,
      updatedTargetRating: target.rating,
      totalReviews: target.numReviews,
      isTopRated: target.rating >= 4.5 && target.numReviews >= 5,
    });
  } catch (error) {
    return next(error);
  }
};

const getUserReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ reviewedUser: req.params.userId, isVisible: true })
      .populate('reviewer', 'name profileImage profilePhoto')
      .sort({ createdAt: -1 });
    return res.json({ count: reviews.length, reviews });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createReview, getUserReviews };