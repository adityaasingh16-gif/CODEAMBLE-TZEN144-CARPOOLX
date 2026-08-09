const Notification = require('../models/Notification');

const sendSMS = async (phone, message) => {
  return { success: true };
};

const sendPushNotification = async (userId, title, body, data = {}) => {
  const notificationType = data.notificationType || 'general';
  const notification = await Notification.create({
    recipient: userId,
    ride: data.ride,
    booking: data.booking,
    notificationType,
    title,
    message: body,
    data,
    deliveryStatus: 'sent',
    deliveredAt: new Date(),
    channel: 'in-app',
  });
  return { success: true, notification };
};

module.exports = { sendSMS, sendPushNotification };
