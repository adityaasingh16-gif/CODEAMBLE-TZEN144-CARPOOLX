const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: String,
    },
    alertReason: {
      type: String,
      default: 'SOS Triggered',
    },
    contactsNotified: [
      {
        name: String,
        phone: String,
        relationship: String,
      },
    ],
    policeStationNotified: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED', 'FALSE_ALARM'],
      default: 'ACTIVE',
    },
    resolvedAt: Date,
    statusNote: String,
    shareToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

sosSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SOS', sosSchema);