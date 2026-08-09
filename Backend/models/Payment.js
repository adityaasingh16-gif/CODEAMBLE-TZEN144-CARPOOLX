const mongoose = require("mongoose");
const paymentSchema = new mongoose.Schema(
{
    ride:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ride",
        required: true,
        index: true
    },

    booking:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
        unique: true
    },

    passenger:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    driver:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    baseFare:
    {
        type: Number,
        required: true,
        min: 0
    },

    splitFare:
    {
        type: Number,
        required: true,
        min: 0
    },

    extraDistance:
    {
        type: Number,
        default: 0
    },

    extraFare:
    {
        type: Number,
        default: 0
    },

    discount:
    {
        type: Number,
        default: 0
    },

    tax:
    {
        type: Number,
        default: 0
    },

    totalAmount:
    {
        type: Number,
        required: true
    },
    platformCommission:
    {
        type: Number,
        default: 0
    },

    driverEarnings:
    {
        type: Number,
        required: true
    },
    paymentMethod:
    {
        type: String,
        enum:
        [
            "cash",
            "upi",
            "card",
            "wallet",
            "net-banking"
        ],
        required: true
    },
    paymentStatus:
    {
        type: String,
        enum:
        [
            "pending",
            "processing",
            "completed",
            "failed",
            "cancelled",
            "refunded"
        ],
        default: "pending"
    },
    transactionId:
    {
        type: String,
        unique: true,
        sparse: true
    },

    paymentGateway:
    {
        type: String,
        enum:
        [
            "razorpay",
            "stripe",
            "paypal",
            "cash",
            "other"
        ]
    },

    gatewayResponse:
    {
        type: mongoose.Schema.Types.Mixed
    },
    refundAmount:
    {
        type: Number,
        default: 0
    },

    refundReason:
    {
        type: String
    },

    refundStatus:
    {
        type: String,
        enum:
        [
            "not-required",
            "pending",
            "completed"
        ],
        default: "not-required"
    },
    invoiceNumber:
    {
        type: String,
        unique: true,
        sparse: true
    },

    paymentDate:
    {
        type: Date
    },

    notes:
    {
        type: String,
        maxlength: 300
    }

},
{
    timestamps: true
});
paymentSchema.index({ passenger: 1 });

paymentSchema.index({ driver: 1 });

paymentSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model("Payment", paymentSchema);