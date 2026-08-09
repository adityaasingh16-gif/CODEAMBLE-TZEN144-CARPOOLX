const express = require('express');
const router = express.Router();
const {
  triggerSOS,
  getSOSDetails,
  resolveSOS,
} = require('../controllers/sosController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

router.post('/trigger', protect, triggerSOS);
router.get('/:id', optionalProtect, getSOSDetails);
router.put('/:id/resolve', protect, resolveSOS);

module.exports = router;