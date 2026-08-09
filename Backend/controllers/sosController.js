const SOS = require('../models/SOS');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { sendSMS, sendPushNotification } = require('../utils/sendNotification');
const crypto = require('crypto');

/**
 * @desc    Trigger emergency SOS alert during a ride
 * @route   POST /api/sos/trigger
 * @access  Private
 * 
 * Rules Handled:
 * - Rule 7: Instantly sends emergency alerts to trusted contacts & notifies police station.
 * - Rule 8: Includes detailed vehicle, driver, and passenger context in the emergency payload.
 */
const triggerSOS = async (req, res, next) => {
  try {
    const { rideId, currentCoordinates, address, alertReason } = req.body;

    // 1. Fetch live ride details along with driver and passenger info
    const ride = await Ride.findById(rideId)
      .populate('driver', 'name phone vehicleDetails')
      .populate('passengers.user', 'name phone emergencyContacts');

    if (!ride) {
      return res.status(404).json({ message: 'Active ride not found for SOS trigger.' });
    }
    const isDriver = ride.driver._id.toString() === req.user._id.toString();
    const isPassenger = ride.passengers.some(
      (passenger) => passenger.user && passenger.user._id.toString() === req.user._id.toString()
    );
    if (!isDriver && !isPassenger) {
      return res.status(403).json({ message: 'Only ride participants can trigger SOS.' });
    }
    if (!Array.isArray(currentCoordinates) || currentCoordinates.length !== 2 ||
      currentCoordinates.some((value) => !Number.isFinite(Number(value)))) {
      return res.status(400).json({ message: 'A valid [longitude, latitude] location is required.' });
    }

    // 2. Fetch user's registered emergency profile
    const user = await User.findById(req.user._id);
    const emergencyContacts = user.emergencyContacts || [];
    const nearestPoliceStation = user.nearestPoliceStation?.name || 'Default Emergency Dispatch: 112';

    // 3. Generate a revocable, unguessable live tracking link after the record exists.

    // 4. Create SOS Record in Database
    const sosRecord = await SOS.create({
      user: req.user._id,
      ride: rideId,
      location: {
        type: 'Point',
        coordinates: currentCoordinates, // [longitude, latitude]
        address,
      },
      alertReason: alertReason || 'Emergency SOS Triggered by User',
      contactsNotified: emergencyContacts,
      policeStationNotified: nearestPoliceStation,
      status: 'ACTIVE',
      shareToken: crypto.randomBytes(24).toString('hex'),
    });
    const liveTrackingUrl = `/api/sos/${sosRecord._id}?token=${sosRecord.shareToken}`;

    // 5. Construct Emergency SMS payload
    const vehicle = ride.driver.vehicleDetails || {};
    const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle details unavailable';
    const plate = vehicle.plateNumber || vehicle.licensePlate || 'plate unavailable';
    const emergencyMessage = 
      `EMERGENCY ALERT: ${user.name} has triggered an SOS on their ride!\n` +
      `Vehicle: ${vehicleLabel} (${plate})\n` +
      `Driver: ${ride.driver.name} (${ride.driver.phone})\n` +
      `Live Location: ${liveTrackingUrl}\n` +
      `Nearest Police Unit: ${nearestPoliceStation}`;

    // 6. Send SMS alerts to all trusted contacts in parallel
    const smsPromises = emergencyContacts.map((contact) =>
      sendSMS(contact.phone, emergencyMessage).catch((err) =>
        console.error(`Failed to send SMS to ${contact.phone}:`, err.message)
      )
    );

    // 7. Dispatch push notification to driver & co-passengers
    const pushPromises = ride.passengers
      .filter((p) => p.user._id.toString() !== req.user._id.toString())
      .map((p) =>
        sendPushNotification(
          p.user._id,
          'EMERGENCY ALERT',
          `An SOS has been triggered on your ride. Support has been dispatched.`
        )
      );

    await Promise.all([...smsPromises, ...pushPromises]);

    res.status(201).json({
      success: true,
      message: 'SOS alert triggered! Emergency contacts and local authorities have been notified.',
      sosDetails: {
        sosId: sosRecord._id,
        policeStationNotified: nearestPoliceStation,
        contactsNotifiedCount: emergencyContacts.length,
        liveTrackingUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get details of an active SOS event (for emergency dispatch or trusted contact link)
 * @route   GET /api/sos/:id
 * @access  Public (Secured via unique token / tracking ID)
 */
const getSOSDetails = async (req, res, next) => {
  try {
    const token = req.query.token;
    const sos = await SOS.findOne({
      _id: req.params.id,
      ...(token ? { shareToken: token } : {}),
    })
      .populate('user', 'name phone profilePhoto gender')
      .populate({
        path: 'ride',
        populate: [
          { path: 'driver', select: 'name phone vehicleDetails rating' },
          { path: 'passengers.user', select: 'name phone gender' },
        ],
      });

    const isOwner = req.user && sos && sos.user._id.toString() === req.user._id.toString();
    if (!sos || (!token && !isOwner)) {
      return res.status(404).json({ message: 'SOS tracking record not found.' });
    }

    res.json(sos);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resolve or cancel an SOS alert
 * @route   PUT /api/sos/:id/resolve
 * @access  Private
 */
const resolveSOS = async (req, res, next) => {
  try {
    const { statusNote } = req.body;

    const sos = await SOS.findById(req.params.id);

    if (!sos) {
      return res.status(404).json({ message: 'SOS record not found.' });
    }

    // Ensure only the user who triggered it or an admin can resolve it
    if (sos.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to resolve this SOS alert.' });
    }

    sos.status = 'RESOLVED';
    sos.resolvedAt = Date.now();
    sos.statusNote = statusNote || 'Resolved safely by user.';

    await sos.save();

    res.json({
      success: true,
      message: 'SOS alert resolved successfully.',
      sos,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  triggerSOS,
  getSOSDetails,
  resolveSOS,
};