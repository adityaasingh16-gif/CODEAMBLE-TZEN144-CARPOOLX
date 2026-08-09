const mongoose = require('mongoose');

// Helper sub-schema for GeoJSON Point locations
const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

// Helper sub-schema for GeoJSON LineString (Driving path geometry)
const lineStringSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString',
      required: true,
    },
    coordinates: {
      type: [[Number]], // Array of [longitude, latitude] coordinate pairs along driving path
      required: true,
    },
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    from: {
      type: pointSchema,
      required: true,
    },
    to: {
      type: pointSchema,
      required: true,
    },

    // GeoJSON LineString of full driving route (Used for 300m-500m detour spatial queries)
    routeLine: lineStringSchema,

    route: {
      polyline: String,
      totalDistance: {
        type: Number, // In meters
        default: 0,
      },
      totalDuration: {
        type: Number, // In seconds/minutes
        default: 0,
      },
    },

    departureTime: {
      type: Date,
      required: true,
      index: true,
    },
    estimatedArrival: {
      type: Date,
    },
    bookingDeadline: {
      type: Date,
    },

    totalSeats: {
      type: Number,
      required: true,
      min: 1,
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePerSeat: {
      type: Number,
      required: true,
      min: 0,
    },

    // Rules 2, 4, & 5: Fare splitting and Detour pricing configuration
    fareSettings: {
      splitFare: {
        type: Boolean,
        default: true,
      },
      costPerKm: {
        type: Number,
        default: 10,
      },
      extraChargePer100m: {
        type: Number,
        default: 5, // Charge ₹5 per extra 100 meters detour (Rule 4)
      },
    },

    passengers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        pickupLocation: pointSchema,
        dropLocation: pointSchema,
        seatsBooked: {
          type: Number,
          default: 1,
        },
        extraDistance: {
          type: Number,
          default: 0,
        },
        extraFare: {
          type: Number,
          default: 0,
        },
        finalFare: {
          type: Number,
          default: 0,
        },
        status: {
          type: String,
          enum: ['pending', 'confirmed', 'cancelled'],
          default: 'pending',
        },
      },
    ],

    // Algorithmic Constraints
    routeRadius: {
      type: Number,
      default: 4000, // Route corridor for pickup/dropoff matching in meters
    },
    maxDetourDistance: {
      type: Number,
      default: 500,
    },
    notificationRadius: {
      type: Number,
      default: 4000, // Send alerts to users within 4km radius (Rule 6)
    },

    detour: {
      totalExtraDistance: {
        type: Number,
        default: 0,
      },
      totalExtraTime: {
        type: Number,
        default: 0,
      },
    },

    rideMatching: {
      matchedPassengers: {
        type: Number,
        default: 0,
      },
      routeFilled: {
        type: Boolean,
        default: false,
      },
    },

    rideType: {
      type: String,
      enum: ['one-way', 'round-trip'],
      default: 'one-way',
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    returningDate: [
      {
        type: Date,
      },
    ],

    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },

    // Safety & Comfort Preferences (Rule 8)
    preferences: {
      acAvailable: {
        type: Boolean,
        default: false,
      },
      genderPreference: {
        type: String,
        enum: ['any', 'male-only', 'female-only'],
        default: 'any',
      },
      showPassengerDetails: {
        type: Boolean,
        default: true,
      },
      petsAllowed: {
        type: Boolean,
        default: false,
      },
      smokingAllowed: {
        type: Boolean,
        default: false,
      },
    },

    allowedUserTypes: [
      {
        type: String, // e.g., 'student', 'employee', 'public'
      },
    ],
    visibility: {
      type: String,
      enum: ['public', 'college', 'office'],
      default: 'public',
    },

    vehicleDetails: {
      make: String,
      model: String,
      licensePlate: String,
      color: String,
    },

    verification: {
      driverVerified: {
        type: Boolean,
        default: false,
      },
      vehicleVerified: {
        type: Boolean,
        default: false,
      },
    },

    // Optional live-tracking location, only populated once a ride is
    // in-progress (see updateRideLocation). Deliberately does NOT reuse
    // pointSchema's `required: true` subfields - spreading those into a
    // plain nested path would make Mongoose demand currentLocation.address
    // even when the whole field is never set on ride creation.
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
      },
      address: String,
      updatedAt: Date,
      speed: Number,
      heading: Number,
    },

    // Rule 7: Emergency & SOS settings
    emergency: {
      sosEnabled: {
        type: Boolean,
        default: true,
      },
      nearestPoliceStation: {
        name: String,
        phone: String,
      },
    },

    shareToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial 2dsphere indexes for route line and points
rideSchema.index({ 'from.coordinates': '2dsphere' });
rideSchema.index({ 'to.coordinates': '2dsphere' });
rideSchema.index({ 'routeLine': '2dsphere' }); // Enables fast spatial matching along the driving path

module.exports = mongoose.model('Ride', rideSchema);