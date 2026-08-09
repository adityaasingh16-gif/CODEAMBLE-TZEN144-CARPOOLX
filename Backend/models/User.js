const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
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
const userSchema = new mongoose.Schema(
{
    name:
    {
        type: String,
        required: true,
        trim: true
    },
    email:
    {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password:
    {
        type: String,
        required: true,
        select: false
    },
    phone:
    {
        type: String,
        required: true,
        unique: true
    },
    profileImage:
    {
        type: String,
        default: ""
    },
    gender:
    {
        type: String,
        enum: ["male", "female", "other"]
    },
    age:
    {
        type: Number
    },
    role:
    {
        type: String,
        enum: ["driver", "passenger", "both"],
        default: "both"
    },
    isDriver:
    {
        type: Boolean,
        default: false
    },
    // No user could review/verify anyone else's documents before this -
    // there was no concept of "admin" in the schema at all. Defaults to
    // false; flip it manually in Atlas for whichever account should be
    // able to review driver verifications (see README).
    isAdmin:
    {
        type: Boolean,
        default: false
    },
    userType:
    {
        type: String,
        enum: ["student", "employee", "public"],
        default: "public"
    },
    organization:
    {
        type: String
    },
    organizationId:
    {
        type: String
    },
    isVerified:
    {
        type: Boolean,
        default: false
    },
    emailVerified:
    {
        type: Boolean,
        default: false
    },
    phoneVerified:
    {
        type: Boolean,
        default: false
    },
    drivingLicenseVerified:
    {
        type: Boolean,
        default: false
    },
    // Drivers flip this on/off from their dashboard ("Go Online" / "Go
    // Offline"). Only drivers with isAvailable: true and a fresh
    // currentLocation are considered by the nearest-driver matching
    // algorithm in utils/nearestDriverMatcher.js.
    isAvailable:
    {
        type: Boolean,
        default: false
    },
    // The license number/expiry themselves were never stored before - only
    // a "verified" boolean existed with nothing underneath it to verify.
    drivingLicense:
    {
        number: String,
        expiryDate: Date
    },
    // Tracks where a driver's verification currently stands, separate from
    // the boolean flags above (which say WHETHER it's verified, not
    // whether it's even been submitted yet).
    verificationStatus:
    {
        type: String,
        enum: ["not_submitted", "pending", "approved", "rejected"],
        default: "not_submitted"
    },
    verificationNote:
    {
        // Reason set by an admin on rejection, shown back to the driver.
        type: String,
        default: ""
    },
    collegeIdVerified:
    {
        type: Boolean,
        default: false
    },
    vehicleDetails:
    {

        make: String,

        model: String,

        color: String,

        plateNumber: String,

        capacity:
        {
            type: Number,
            default: 4
        },

        registrationNumber: String,

        fuelType: String

    },
    currentLocation:
    {
        type:
        {
            type: String,
            enum: ["Point"]
            // no default here on purpose - if we default this to "Point"
            // while coordinates stays empty, MongoDB's 2dsphere index
            // rejects the doc on save ("Point must be an array or object").
            // Leaving it undefined until real GPS coords are set keeps the
            // whole currentLocation field absent for new users.
        },

        coordinates:
        {
            type: [Number]
        },

        address: String,

        updatedAt: Date
    },
    emergencyContacts:
    [
        {

            name: String,

            phone: String,

            relation: String

        }
    ],
    emergencySOS:
    {
        type: Boolean,
        default: true
    },

    nearestPoliceStation:
    {

        name: String,

        phone: String

    },
    totalRidesAsDriver:
    {
        type: Number,
        default: 0
    },

    totalRidesAsPassenger:
    {
        type: Number,
        default: 0
    },

    completedRides:
    {
        type: Number,
        default: 0
    },

    cancelledRides:
    {
        type: Number,
        default: 0
    },
    averageDriverRating:
    {
        type: Number,
        default: 0
    },

    totalDriverRatings:
    {
        type: Number,
        default: 0
    },

    averagePassengerRating:
    {
        type: Number,
        default: 0
    },

    totalPassengerRatings:
    {
        type: Number,
        default: 0
    },
    rating:
    {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    numReviews:
    {
        type: Number,
        min: 0,
        default: 0
    },
    preferences:
    {
        preferredGender:
        {
            type: String,
            enum: ["any", "male", "female"],
            default: "any"
        },

        smokingAllowed:
        {
            type: Boolean,
            default: false
        },

        petsAllowed:
        {
            type: Boolean,
            default: false
        },

        acPreferred:
        {
            type: Boolean,
            default: false
        }

    },
    accountStatus:
    {
        type: String,
        enum:
        [
            "active",
            "suspended",
            "blocked"
        ],
        default: "active"
    }
},
{
    timestamps: true
}
);
userSchema.index({ currentLocation: "2dsphere" }, { sparse: true });
userSchema.virtual("isTopRated").get(function () {
    return this.rating >= 4.5 && this.numReviews >= 5;
});
userSchema.set("toJSON", { virtuals: true });

// email and phone already get an index automatically from `unique: true`
// above - no need to declare them again here.

// Guarantees currentLocation is either a valid GeoJSON point or entirely
// absent before hitting the 2dsphere index - Mongoose materializes inline
// nested objects as {} even with no defaults, which the geo index rejects.
userSchema.pre("save", function (next) {
    if (
        !this.currentLocation ||
        !Array.isArray(this.currentLocation.coordinates) ||
        this.currentLocation.coordinates.length !== 2
    ) {
        this.currentLocation = undefined;
    }
    next();
});

// Hash the password whenever it's set/changed, before saving.
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Used by authController's loginUser to check the submitted password.
userSchema.methods.matchPassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);