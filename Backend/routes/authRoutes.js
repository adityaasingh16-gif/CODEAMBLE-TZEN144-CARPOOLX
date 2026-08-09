const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  sendOTP,
  verifyOTP,
  listDriversForReview,
  reviewDriver,
  listAllUsers,
  updateUserStatus,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

router.post('/register', rateLimit({ max: 10 }), registerUser);
router.post('/login', rateLimit({ max: 10, message: 'Too many login attempts. Try again later.' }), loginUser);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.post('/send-otp', protect, rateLimit({ max: 5 }), sendOTP);
router.post('/verify-otp', protect, verifyOTP);

// Admin-only driver document review
router.get('/admin/drivers', protect, adminOnly, listDriversForReview);
router.put('/admin/drivers/:id/review', protect, adminOnly, reviewDriver);

// Admin-only general user management (passengers + drivers)
router.get('/admin/users', protect, adminOnly, listAllUsers);
router.put('/admin/users/:id/status', protect, adminOnly, updateUserStatus);

module.exports = router;