const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  getSubadmins,
  createSubadmin,
  updateSubadmin,
  deleteSubadmin
} = require('../controllers/subadminController');

// All subadmin routes require authentication and full ADMIN role authorization
router.get('/', auth, authorize('ADMIN'), getSubadmins);
router.post('/', auth, authorize('ADMIN'), createSubadmin);
router.put('/:id', auth, authorize('ADMIN'), updateSubadmin);
router.delete('/:id', auth, authorize('ADMIN'), deleteSubadmin);

module.exports = router;
