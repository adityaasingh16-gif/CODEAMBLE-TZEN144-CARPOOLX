const express = require('express');
const router = express.Router();
const {
  createRide,
  searchRides,
  bookRide,
  getRideSafetyDetails,
  getMyRides,
  getRideHistory,
  updateRideStatus,
  updateRideLocation,
  findNearbyDrivers,
  setDriverAvailability,
  calculateAStarRoute,
} = require('../controllers/rideController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createRide);
router.get('/search', protect, searchRides);
router.get('/mine', protect, getMyRides);
router.get('/history', protect, getRideHistory);
router.get('/nearby-drivers', protect, findNearbyDrivers);
router.post('/astar-route', calculateAStarRoute);
router.patch('/availability', protect, setDriverAvailability);
router.post('/:id/book', protect, bookRide);
router.get('/:id/safety-details', protect, getRideSafetyDetails);
router.put('/:id/status', protect, updateRideStatus);
router.patch('/:id/location', protect, updateRideLocation);

module.exports = router;
