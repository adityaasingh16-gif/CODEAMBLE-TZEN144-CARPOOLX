const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const { calculateFareWithDetour } = require('../utils/fareCalculator');
const { sendPushNotification } = require('../utils/sendNotification');

const serializeBooking = (booking) => {
  const value = booking.toObject ? booking.toObject() : booking;
  return { ...value, seatPrice: value.totalFare, detourCharge: value.extraFare, status: value.bookingStatus };
};

const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ passenger: req.user._id })
      .populate({ path: 'ride', populate: { path: 'driver', select: 'name phone rating numReviews vehicleDetails profileImage' } })
      .sort({ createdAt: -1 });
    return res.json(bookings.map(serializeBooking));
  } catch (error) {
    return next(error);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('passenger', 'name phone profileImage gender')
      .populate({ path: 'ride', populate: [
        { path: 'driver', select: 'name phone profileImage vehicleDetails rating' },
        { path: 'passengers.user', select: 'name phone rating gender' },
      ] });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const isPassenger = booking.passenger._id.toString() === req.user._id.toString();
    const isDriver = booking.ride.driver._id.toString() === req.user._id.toString();
    if (!isPassenger && !isDriver) return res.status(403).json({ message: 'Not authorized to view this booking.' });
    return res.json(serializeBooking(booking));
  } catch (error) {
    return next(error);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.passenger.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized to cancel this booking.' });
    if (!['pending', 'accepted'].includes(booking.bookingStatus)) return res.status(400).json({ message: 'Booking is no longer active.' });
    const ride = await Ride.findById(booking.ride);
    if (!ride || ['completed', 'cancelled'].includes(ride.status)) return res.status(400).json({ message: 'This ride can no longer be cancelled.' });

    booking.bookingStatus = 'cancelled';
    booking.cancelledBy = 'passenger';
    await booking.save();
    await Ride.updateOne(
      { _id: ride._id },
      { $inc: { availableSeats: booking.seatsBooked }, $pull: { passengers: { user: req.user._id } } },
    );
    const activeBookings = await Booking.find({ ride: ride._id, bookingStatus: { $in: ['pending', 'accepted'] } });
    const count = activeBookings.reduce((sum, item) => sum + item.seatsBooked, 0);
    await Promise.all(activeBookings.map(async (item) => {
      const fare = calculateFareWithDetour({
        baseFare: ride.pricePerSeat,
        currentPassengersCount: Math.max(1, count),
        detourDistanceMeters: item.extraDistance,
        chargePer100m: ride.fareSettings?.extraChargePer100m || 5,
        includedDetourMeters: Number(ride.maxDetourDistance) || 500,
      });
      return Booking.updateOne({ _id: item._id }, { $set: { splitFare: fare.sharedBaseFare, extraFare: fare.detourCharge, totalFare: fare.totalFareForPassenger } });
    }));
    await sendPushNotification(ride.driver, 'Booking Cancelled', 'A passenger cancelled their booking.', { notificationType: 'booking-cancelled', ride: ride._id });
    return res.json({ success: true, message: 'Booking cancelled successfully.', booking: serializeBooking(booking) });
  } catch (error) {
    return next(error);
  }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentId, paymentMethod, amountPaid } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.passenger.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only the passenger can update this payment.' });
    if (!['cash', 'upi', 'card', 'wallet'].includes(paymentMethod)) return res.status(400).json({ message: 'Unsupported payment method.' });
    if (Number(amountPaid) !== Number(booking.totalFare)) return res.status(400).json({ message: 'Paid amount must match the booking fare.' });
    if (!paymentId && paymentMethod !== 'cash') return res.status(400).json({ message: 'A payment reference is required.' });
    booking.paymentStatus = 'paid';
    booking.paymentMethod = paymentMethod;
    booking.paymentDetails = { paymentId, amountPaid: Number(amountPaid) };
    await booking.save();
    await sendPushNotification(booking.driver, 'Payment Received', 'Payment was recorded for a booking.', { notificationType: 'payment-success', booking: booking._id, ride: booking.ride });
    return res.json({ success: true, message: 'Payment recorded.', booking: serializeBooking(booking) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyBookings, getBookingById, cancelBooking, updatePaymentStatus };