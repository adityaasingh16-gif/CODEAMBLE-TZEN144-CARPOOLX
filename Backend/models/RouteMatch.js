const mongoose = require("mongoose");
const routeMatchSchema = new mongoose.Schema(
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
    isMatched:
    {
        type: Boolean,
        default: false
    },

    pickupDistance:
    {
        type: Number,
        required: true,
        default: 0
    },

    dropDistance:
    {
        type: Number,
        required: true,
        default: 0
    },

    maxAllowedDistance:
    {
        type: Number,
        default: 500
    },
    extraDistance:
    {
        type: Number,
        default: 0
    },

    extraDuration:
    {
        type: Number,
        default: 0
    },

    detourRequired:
    {
        type: Boolean,
        default: false
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

    finalFare:
    {
        type: Number,
        default: 0
    },
    originalDistance:
    {
        type: Number,
        default: 0
    },

    updatedDistance:
    {
        type: Number,
        default: 0
    },

    originalDuration:
    {
        type: Number,
        default: 0
    },

    updatedDuration:
    {
        type: Number,
        default: 0
    },

    routePolyline:
    {
        type: String
    },
    matchReason:
    {
        type: String,
        enum:
        [
            "exact-route",
            "within-radius",
            "detour-required",
            "outside-radius"
        ]
    }

},
{
    timestamps: true
});
routeMatchSchema.index({ passenger: 1 });

routeMatchSchema.index({ isMatched: 1 });

module.exports = mongoose.model("RouteMatch", routeMatchSchema);