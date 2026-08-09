const mongoose = require("mongoose");
const otpSchema = new mongoose.Schema(
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
    otpCode:
    {
        type: String,
        required: true
    },

    otpType:
    {
        type: String,
        enum:
        [
            "ride-start",
            "ride-end"
        ],
        default: "ride-start"
    },
    isVerified:
    {
        type: Boolean,
        default: false
    },

    verifiedAt:
    {
        type: Date
    },

    attempts:
    {
        type: Number,
        default: 0
    },

    maxAttempts:
    {
        type: Number,
        default: 5
    },
    expiresAt:
    {
        type: Date,
        required: true
    },

    isExpired:
    {
        type: Boolean,
        default: false
    }

},
{
    timestamps: true
});
otpSchema.index(
{
    expiresAt: 1
},
{
    expireAfterSeconds: 0
});
otpSchema.index({ passenger: 1 });

otpSchema.index({ driver: 1 });

otpSchema.index({ otpCode: 1 });

module.exports = mongoose.model("OTP", otpSchema);