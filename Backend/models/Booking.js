const mongoose = require("mongoose");
const pointSchema = new mongoose.Schema(
{
    type:
    {
        type: String,
        enum: ["Point"],
        default: "Point"
    },
    coordinates:
    {
        type: [Number]
    },
    address:
    {
        type: String
    }
},
{ _id: false }
);
const bookingSchema = new mongoose.Schema(
{
    ride:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ride",
        required: true,
        index: true
    },
    passenger:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    driver:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    pickupLocation:
    {
        type: pointSchema,
        required: true
    },

    dropLocation:
    {
        type: pointSchema,
        required: true
    },
    isRouteMatched:
    {
        type: Boolean,
        default: false
    },

    pickupDistanceFromRoute:
    {
        type: Number,
        default: 0
    },
    dropDistanceFromRoute:
    {
        type: Number,
        default: 0
    },
    extraDistance:
    {
        type: Number,
        default: 0
    },
    extraTime:
    {
        type: Number,
        default: 0
    },
    baseFare:
    {
        type: Number,
        required: true
    },
    splitFare:
    {
        type: Number,
        default: 0
    },
    extraFare:
    {
        type: Number,
        default: 0
    },
    totalFare:
    {
        type: Number,
        required: true
    },
    seatsBooked:
    {
        type: Number,
        default: 1
    },
    bookingStatus:
    {
        type: String,
        enum:
        [
            "pending",
            "accepted",
            "rejected",
            "cancelled",
            "completed"
        ],
        default: "pending"
    },
    paymentStatus:
    {
        type: String,
        enum:
        [
            "pending",
            "paid",
            "failed",
            "refunded"
        ],
        default: "pending"
    },
    paymentMethod:
    {
        type: String,
        enum:
        [
            "cash",
            "upi",
            "card",
            "wallet"
        ],
        default: "cash"
    },
    paymentDetails:
    {
        paymentId: String,
        amountPaid: Number,
        recordedAt: {
            type: Date,
            default: Date.now
        }
    },
    rideOTP:
    {
        type: String
    },
    otpVerified:
    {
        type: Boolean,
        default: false
    },

    bookedAt:
    {
        type: Date,
        default: Date.now
    },
    pickupTime:
    {
        type: Date
    },
    dropTime:
    {
        type: Date
    },
    sosTriggered:
    {
        type: Boolean,
        default: false
    },
    sosTime:
    {
        type: Date
    },
    passengerRating:
    {
        type: Number,
        min: 1,
        max: 5
    },
    driverRating:
    {
        type: Number,
        min: 1,
        max: 5
    },
    passengerReview:
    {
        type: String,
        maxlength: 500
    },
    driverReview:
    {
        type: String,
        maxlength: 500
    },
    cancelledBy:
    {
        type: String,
        enum:
        [
            "driver",
            "passenger",
            "system"
        ]
    },
    cancellationReason:
    {
        type: String
    }
},
{
    timestamps: true
});
bookingSchema.index({ driver: 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ paymentStatus: 1 });
module.exports = mongoose.model("Booking", bookingSchema);