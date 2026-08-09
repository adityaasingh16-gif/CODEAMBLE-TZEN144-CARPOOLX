const Notification = require('../models/Notification');

const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = { recipient: req.user._id };
    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments({ ...filter, isRead: false }),
      Notification.countDocuments(filter),
    ]);
    return res.json({ notifications, unreadCount, total, page, limit });
  } catch (error) {
    return next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    return res.json(notification);
  } catch (error) {
    return next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyNotifications, markNotificationRead, markAllNotificationsRead };