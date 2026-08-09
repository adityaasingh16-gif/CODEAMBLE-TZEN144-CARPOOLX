const Message = require('../models/Message');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/sendNotification');

/**
 * @desc    Get all messages for a specific ride room
 * @route   GET /api/chat/ride/:rideId
 * @access  Private
 */
const getRideMessages = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    // Verify ride exists
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    // Verify user is part of this ride (as driver or confirmed passenger)
    const isDriver = ride.driver.toString() === req.user._id.toString();
    const isPassenger = ride.passengers.some(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!isDriver && !isPassenger) {
      return res.status(403).json({ message: 'Not authorized to view chat for this ride.' });
    }
    // Fetch messages sorted chronologically
    const messages = await Message.find({ ride: rideId })
      .populate('sender', 'name profilePhoto isDriver')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a message within a ride group / direct chat
 * @route   POST /api/chat/send
 * @access  Private
 */
const sendMessage = async (req, res, next) => {
  try {
    const { rideId, recipientId, content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content cannot be empty.' });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    // Check membership authorization
    const isDriver = ride.driver.toString() === req.user._id.toString();
    const isPassenger = ride.passengers.some(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!isDriver && !isPassenger) {
      return res.status(403).json({ message: 'You are not part of this ride.' });
    }
    if (recipientId) {
      const isRecipientDriver = ride.driver.toString() === recipientId.toString();
      const isRecipientPassenger = ride.passengers.some(
        (passenger) => passenger.user.toString() === recipientId.toString(),
      );
      if (!isRecipientDriver && !isRecipientPassenger) {
        return res.status(400).json({ message: 'Recipient is not a member of this ride.' });
      }
    }

    // Create and save message
    const message = await Message.create({
      ride: rideId,
      sender: req.user._id,
      recipient: recipientId || null, // null implies broadcast to whole ride group
      content: content.trim(),
    });

    const populatedMessage = await Message.findById(message._id).populate(
      'sender',
      'name profilePhoto isDriver'
    );

    // Send Push Notification if recipient is specified
    if (recipientId) {
      await sendPushNotification(
        recipientId,
        `New message from ${req.user.name}`,
        content.length > 50 ? `${content.substring(0, 47)}...` : content
      );
    } else {
      // If group chat, notify all other members
      const recipientsToNotify = [ride.driver, ...ride.passengers.map((p) => p.user)]
        .filter((id) => id.toString() !== req.user._id.toString());

      for (const targetId of recipientsToNotify) {
        await sendPushNotification(
          targetId,
          `${req.user.name} (${ride.driver.toString() === req.user._id.toString() ? 'Driver' : 'Passenger'})`,
          content
        );
      }
    }

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark messages in a ride as read
 * @route   PUT /api/chat/read/:rideId
 * @access  Private
 */
const markAsRead = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    const isMember = ride.driver.toString() === req.user._id.toString() ||
      ride.passengers.some((p) => p.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'You are not part of this ride.' });
    await Message.updateMany(
      {
        ride: rideId,
        sender: { $ne: req.user._id },
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    res.json({ success: true, message: 'Messages marked as read.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRideMessages,
  sendMessage,
  markAsRead,
};