const express = require('express');
const router = express.Router();
const { auth } = require('../controllers/userController');
const authorize = require('../middleware/authorize');
const {
  getAllUsers,
  getAdminNotifications,
  toggleUserBlock,
  getAllDeposits,
  approveDeposit,
  rejectDeposit,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  createUpiApp,
  updateUpiApp,
  deleteUpiApp,
  getAllUpiApps,
  createCryptoAddress,
  updateCryptoAddress,
  deleteCryptoAddress,
  getAllCryptoAddresses,
  getSettings,
  updateSettings,
  getDashboardStats,
  updateSupportLinks,
  getSupportLinksAdmin,
  getUserDetails,
  updateUserJToken,
  getJTokenHistory,
  getAllJTokenPurchases,
  assignJTokenPurchaseDetails,
  approveJTokenPurchase,
  rejectJTokenPurchase,
  getAllUpiVerifications,
  askUpiOtp,
  approveUpiVerification,
  rejectUpiVerification,
  getAllExchangeRequests,
  approveExchangeRequest,
  rejectExchangeRequest,
  cleanupDatabase,
  resetDatabase,
  getAllMobileVerifications,
  askMobileOtp,
  reverifyMobileOtp,
  approveMobileVerification,
  rejectMobileVerification,
  reconcileJTokenWallets,
  adminToggleUserPayment
} = require('../controllers/adminController');

router.get('/dashboard', auth, authorize('ADMIN', 'SUBADMIN'), getDashboardStats);
router.get('/stats', auth, authorize('ADMIN', 'SUBADMIN'), getDashboardStats);
router.get('/notifications', auth, authorize('ADMIN', 'SUBADMIN'), getAdminNotifications);
router.get('/users', auth, authorize('ADMIN', 'SUBADMIN'), getAllUsers);
router.get('/user/:userId', auth, authorize('ADMIN', 'SUBADMIN'), getUserDetails);
router.post('/user/:userId/jtoken', auth, authorize('ADMIN'), updateUserJToken);
router.post('/user/:userId/toggle-payment', auth, authorize('ADMIN', 'SUBADMIN'), adminToggleUserPayment);
router.put('/user/:userId/payment-toggle', auth, authorize('ADMIN', 'SUBADMIN'), adminToggleUserPayment);
router.put('/user/:userId/block', auth, authorize('ADMIN'), toggleUserBlock);
router.get('/deposits', auth, authorize('ADMIN', 'SUBADMIN'), getAllDeposits);
router.post('/deposit/:depositId/approve', auth, authorize('ADMIN', 'SUBADMIN'), approveDeposit);
router.post('/deposit/:depositId/reject', auth, authorize('ADMIN', 'SUBADMIN'), rejectDeposit);
router.get('/withdrawals', auth, authorize('ADMIN', 'SUBADMIN'), getAllWithdrawals);
router.post('/withdraw/:withdrawalId/approve', auth, authorize('ADMIN', 'SUBADMIN'), approveWithdrawal);
router.post('/withdraw/:withdrawalId/reject', auth, authorize('ADMIN', 'SUBADMIN'), rejectWithdrawal);
router.get('/upi-apps', auth, authorize('ADMIN', 'SUBADMIN'), getAllUpiApps);
router.post('/upi-app', auth, authorize('ADMIN'), createUpiApp);
router.put('/upi-app/:id', auth, authorize('ADMIN'), updateUpiApp);
router.delete('/upi-app/:id', auth, authorize('ADMIN'), deleteUpiApp);
router.get('/crypto-addresses', auth, authorize('ADMIN', 'SUBADMIN'), getAllCryptoAddresses);
router.post('/crypto', auth, authorize('ADMIN'), createCryptoAddress);
router.put('/crypto/:id', auth, authorize('ADMIN'), updateCryptoAddress);
router.delete('/crypto/:id', auth, authorize('ADMIN'), deleteCryptoAddress);
router.get('/settings', auth, authorize('ADMIN', 'SUBADMIN'), getSettings);
router.put('/settings', auth, authorize('ADMIN'), updateSettings);
router.get('/support-links', auth, authorize('ADMIN', 'SUBADMIN'), getSupportLinksAdmin);
router.put('/support-links', auth, authorize('ADMIN'), updateSupportLinks);
router.get('/jtoken-history', auth, authorize('ADMIN', 'SUBADMIN'), getJTokenHistory);
router.get('/jtoken-purchases', auth, authorize('ADMIN', 'SUBADMIN'), getAllJTokenPurchases);
router.post('/jtoken-purchase/:purchaseId/assign', auth, authorize('ADMIN', 'SUBADMIN'), assignJTokenPurchaseDetails);
router.post('/jtoken-purchase/:purchaseId/approve', auth, authorize('ADMIN', 'SUBADMIN'), approveJTokenPurchase);
router.post('/jtoken-purchase/:purchaseId/reject', auth, authorize('ADMIN', 'SUBADMIN'), rejectJTokenPurchase);
router.get('/upi-verifications', auth, authorize('ADMIN', 'SUBADMIN'), getAllUpiVerifications);
router.post('/upi-verification/:verificationId/ask-code', auth, authorize('ADMIN', 'SUBADMIN'), askUpiOtp);
router.post('/upi-verification/:verificationId/approve', auth, authorize('ADMIN', 'SUBADMIN'), approveUpiVerification);
router.post('/upi-verification/:verificationId/reject', auth, authorize('ADMIN', 'SUBADMIN'), rejectUpiVerification);

router.get('/mobile-verifications', auth, authorize('ADMIN', 'SUBADMIN'), getAllMobileVerifications);
router.post('/mobile-verification/:id/ask-otp', auth, authorize('ADMIN', 'SUBADMIN'), askMobileOtp);
router.post('/mobile-verification/:id/reverify', auth, authorize('ADMIN', 'SUBADMIN'), reverifyMobileOtp);
router.post('/mobile-verification/:id/approve', auth, authorize('ADMIN', 'SUBADMIN'), approveMobileVerification);
router.post('/mobile-verification/:id/reject', auth, authorize('ADMIN', 'SUBADMIN'), rejectMobileVerification);

router.get('/exchange-requests', auth, authorize('ADMIN', 'SUBADMIN'), getAllExchangeRequests);
router.post('/exchange-request/:requestId/approve', auth, authorize('ADMIN', 'SUBADMIN'), approveExchangeRequest);
router.post('/exchange-request/:requestId/reject', auth, authorize('ADMIN', 'SUBADMIN'), rejectExchangeRequest);
router.post('/cleanup', auth, authorize('ADMIN'), cleanupDatabase);
router.post('/reset-non-admins', auth, authorize('ADMIN'), resetDatabase);
router.post('/reconcile-jtoken-wallets', auth, authorize('ADMIN'), reconcileJTokenWallets);

module.exports = router;
