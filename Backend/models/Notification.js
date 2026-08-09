const mongoose = require("mongoose");
const notificationSchema = new mongoose.Schema(
{
    recipient:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    sender:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    ride:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ride"
    },
    booking:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking"
    },
    notificationType:
    {
        type: String,
        enum:
        [
            "ride-created",
            "nearby-ride",
            "booking-request",
            "booking-accepted",
            "booking-rejected",
            "booking-cancelled",
            "ride-started",
            "ride-completed",
            "ride-cancelled",
            "payment-success",
            "payment-failed",
            "review-reminder",
            "sos-alert",
            "route-update",
            "general"
        ],
        required: true
    },
    title:
    {
        type: String,
        required: true,
        trim: true
    },
    message:
    {
        type: String,
        required: true,
        trim: true
    },
    data:
    {
        type: mongoose.Schema.Types.Mixed
    },
    isRead:
    {
        type: Boolean,
        default: false
    },

    readAt:
    {
        type: Date
    },
    deliveryStatus:
    {
        type: String,
        enum:
        [
            "pending",
            "sent",
            "delivered",
            "failed"
        ],
        default: "pending"
    },

    deliveredAt:
    {
        type: Date
    },
    priority:
    {
        type: String,
        enum:
        [
            "low",
            "medium",
            "high",
            "critical"
        ],
        default: "medium"
    },
    channel:
    {
        type: String,
        enum:
        [
            "in-app",
            "push",
            "email",
            "sms"
        ],
        default: "push"
    },
    expiresAt:
    {
        type: Date
    }

},
{
    timestamps: true
});
notificationSchema.index({ ride: 1 });

notificationSchema.index({ booking: 1 });

notificationSchema.index({ notificationType: 1 });

notificationSchema.index({ isRead: 1 });

notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);