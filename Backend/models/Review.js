const mongoose = require("mongoose");
const reviewSchema = new mongoose.Schema(
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
        index: true
    },

    reviewer:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    reviewedUser:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    scoreBreakdown:
    {
        driving: { type: Number, min: 1, max: 5 },
        behaviour: { type: Number, min: 1, max: 5 },
        safety: { type: Number, min: 1, max: 5 },
        vehicleCleanliness: { type: Number, min: 1, max: 5 },
        overall: { type: Number, min: 1, max: 5 }
    },
    reviewType:
    {
        type: String,
        enum:
        [
            "driver-to-passenger",
            "passenger-to-driver"
        ],
        required: true
    },
    rating:
    {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review:
    {
        type: String,
        trim: true,
        maxlength: 500
    },
    tags:
    [
        {
            type: String,
            enum:
            [
                "punctual",
                "friendly",
                "safe-driver",
                "clean-vehicle",
                "good-behaviour",
                "helpful",
                "late",
                "rude",
                "unsafe-driving",
                "cancelled-last-minute",
                "other"
            ]
        }
    ],
    isReported:
    {
        type: Boolean,
        default: false
    },

    reportReason:
    {
        type: String,
        maxlength: 300
    },
    isVisible:
    {
        type: Boolean,
        default: true
    }

},
{
    timestamps: true
});
reviewSchema.index(
{
    booking: 1,
    reviewer: 1,
    reviewedUser: 1
},
{
    unique: true
}
);
reviewSchema.index({ reviewer: 1 });
reviewSchema.index({ reviewedUser: 1 });
reviewSchema.index({ rating: 1 });
module.exports = mongoose.model("Review", reviewSchema);