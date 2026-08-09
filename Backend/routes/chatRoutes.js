const express = require('express');
const router = express.Router();
const {
  getRideMessages,
  sendMessage,
  markAsRead,
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.get('/ride/:rideId', protect, getRideMessages);
router.post('/send', protect, sendMessage);
router.put('/read/:rideId', protect, markAsRead);

module.exports = router;