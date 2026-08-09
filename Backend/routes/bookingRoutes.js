const express = require('express');
const router = express.Router();
const {
  getMyBookings,
  getBookingById,
  cancelBooking,
  updatePaymentStatus,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.get('/my-bookings', protect, getMyBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/pay', protect, updatePaymentStatus);

module.exports = router;