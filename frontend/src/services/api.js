const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:9001/api';
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const uploadToCloudinary = async (file) => {
  if (!file) throw new Error('No file provided');
  
  console.log('Cloudinary config:', {
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: CLOUDINARY_UPLOAD_PRESET
  });
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  console.log('Uploading to:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  console.log('Cloudinary response:', data);
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Upload failed');
  }
  
  return data.secure_url;
};

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  console.log('authFetch:', url, '| Token from localStorage:', token ? `YES(${token.length} chars)` : 'NO');
  
  const authHeader = token ? `Bearer ${token}` : '';
  if (!token) console.log('WARNING: No token found in localStorage!');
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: options.body
  });
  
  console.log('Response:', response.status, url);
  
  if (!response.ok) {
    if (response.status === 401) {
      const error = await response.json().catch(() => ({ error: 'Unauthorized' }));
      console.log('UNAUTHORIZED 401 - Clearing token and redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error(error.error || 'Unauthorized');
    }
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
};

const authAPI = {
  register: (data) => fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
  
  verifyOtp: (data) => fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async (r) => {
    const json = await r.json();
    console.log('verifyOtp response:', JSON.stringify(json));
    if (!r.ok) throw new Error(json.error || 'Verification failed');
    return json;
  }),
  
  login: (data) => fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),
  
  resendOtp: (data) => fetch(`${API_BASE}/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),

  forgetPassword: (data) => fetch(`${API_BASE}/auth/forget-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) })),

  resetPassword: (data) => fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) }))
};

const userAPI = {
  getProfile: () => authFetch(`${API_BASE}/user/profile`),
  togglePayment: (enabled) => authFetch(`${API_BASE}/user/toggle-payment`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  requestUpiVerification: (data) => authFetch(`${API_BASE}/user/upi/request-verification`, { method: 'POST', body: JSON.stringify(data) }),
  submitUpiOtp: (otp) => authFetch(`${API_BASE}/user/upi/submit-otp`, { method: 'POST', body: JSON.stringify({ otp }) }),
  verifyUpiOtp: (otp) => authFetch(`${API_BASE}/user/upi/verify-otp`, { method: 'POST', body: JSON.stringify({ otp }) }),
  getUpiVerificationStatus: () => authFetch(`${API_BASE}/user/upi/verification-status`),
  addUpi: (data) => authFetch(`${API_BASE}/user/add-upi`, { method: 'POST', body: JSON.stringify(data) }),
  getUpiAccounts: () => authFetch(`${API_BASE}/user/upi-accounts`),
  setPrimaryUpi: (data) => authFetch(`${API_BASE}/user/set-primary-upi`, { method: 'POST', body: JSON.stringify(data) }),
  deleteUpi: (id) => authFetch(`${API_BASE}/user/upi/${id}`, { method: 'DELETE' }),
  addBank: (data) => authFetch(`${API_BASE}/user/add-bank`, { method: 'POST', body: JSON.stringify(data) }),
  getBankAccounts: () => authFetch(`${API_BASE}/user/bank-accounts`),
  setPrimaryBank: (data) => authFetch(`${API_BASE}/user/set-primary-bank`, { method: 'POST', body: JSON.stringify(data) }),
  deleteBank: (id) => authFetch(`${API_BASE}/user/bank/${id}`, { method: 'DELETE' }),
  bindMobile: (data) => authFetch(`${API_BASE}/user/bind-mobile`, { method: 'POST', body: JSON.stringify(data) }),
  bindTelegram: (data) => authFetch(`${API_BASE}/user/bind-telegram`, { method: 'POST', body: JSON.stringify(data) }),
  generateTelegramKey: () => authFetch(`${API_BASE}/user/generate-telegram-key`, { method: 'POST' }),
  setPin: (data) => authFetch(`${API_BASE}/user/set-pin`, { method: 'POST', body: JSON.stringify(data) }),
  verifyPin: (data) => authFetch(`${API_BASE}/user/verify-pin`, { method: 'POST', body: JSON.stringify(data) }),
  setPinEnabled: (data) => authFetch(`${API_BASE}/user/set-pin-enabled`, { method: 'POST', body: JSON.stringify(data) }),
  updatePassword: (data) => authFetch(`${API_BASE}/user/update-password`, { method: 'POST', body: JSON.stringify(data) }),
  getSupportLinks: () => authFetch(`${API_BASE}/user/support-links`),
  createExchangeRequest: (data) => authFetch(`${API_BASE}/user/exchange-request`, { method: 'POST', body: JSON.stringify(data) }),
  getMyExchangeRequests: () => authFetch(`${API_BASE}/user/exchange-requests`)
};

const walletAPI = { 
  getWallet: () => authFetch(`${API_BASE}/wallet`),
  trade: (data) => authFetch(`${API_BASE}/wallet/trade`, { method: 'POST', body: JSON.stringify(data) }),
  withdrawReferral: (data) => authFetch(`${API_BASE}/wallet/withdraw-referral`, { method: 'POST', body: JSON.stringify(data) }),
  getWithdrawalHistory: () => authFetch(`${API_BASE}/withdraw/history`),
  getJTokenHistory: () => authFetch(`${API_BASE}/jtoken-purchase`)
};

const depositAPI = {
  create: (data) => authFetch(`${API_BASE}/deposit`, { method: 'POST', body: JSON.stringify(data) }),
  getHistory: () => authFetch(`${API_BASE}/deposit/history`)
};

const withdrawalAPI = {
  create: (data) => authFetch(`${API_BASE}/withdraw`, { method: 'POST', body: JSON.stringify(data) }),
  getHistory: () => authFetch(`${API_BASE}/withdraw/history`)
};

const referralAPI = {
  getTeam: () => authFetch(`${API_BASE}/referral`),
  getStats: () => authFetch(`${API_BASE}/referral`),
  getReferralData: () => authFetch(`${API_BASE}/referral`)
};

const jTokenPurchaseAPI = {
  getMyRequests: () => authFetch(`${API_BASE}/jtoken-purchase`),
  create: (data) => authFetch(`${API_BASE}/jtoken-purchase`, { method: 'POST', body: JSON.stringify(data) }),
  startPay: (requestId) => authFetch(`${API_BASE}/jtoken-purchase/${requestId}/start-pay`, { method: 'POST' }),
  submitPayment: (requestId, data) => authFetch(`${API_BASE}/jtoken-purchase/${requestId}/submit-payment`, { method: 'POST', body: JSON.stringify(data) }),
  cancel: (requestId) => authFetch(`${API_BASE}/jtoken-purchase/${requestId}/cancel`, { method: 'POST' })
};

const publicAPI = {
  getUpiApps: async () => { const r = await fetch(`${API_BASE}/public/upi-apps`); const data = await r.json(); return { data }; },
  getCryptoAddresses: async () => { const r = await fetch(`${API_BASE}/public/crypto-addresses`); const data = await r.json(); return { data }; },
  getRates: async () => { const r = await fetch(`${API_BASE}/public/rates`); const data = await r.json(); return { data }; },
  getCryptoRates: async () => { const r = await fetch(`${API_BASE}/public/crypto-rates`); const data = await r.json(); return { data }; },
  getRecentTrades: async () => { const r = await fetch(`${API_BASE}/public/recent-trades`); const data = await r.json(); return { data }; },
  getSettings: async () => { const r = await fetch(`${API_BASE}/public/settings`); const data = await r.json(); return { data }; }
};

const adminAPI = {
  getDashboard: () => authFetch(`${API_BASE}/admin/dashboard`),
  getNotifications: () => authFetch(`${API_BASE}/admin/notifications`),
  getUsers: (params) => authFetch(`${API_BASE}/admin/users?${new URLSearchParams(params)}`),
  getUserDetails: (userId) => authFetch(`${API_BASE}/admin/user/${userId}`),
  toggleUserBlock: (userId, data) => authFetch(`${API_BASE}/admin/user/${userId}/block`, { method: 'PUT', body: JSON.stringify(data) }),
  getDeposits: (params) => authFetch(`${API_BASE}/admin/deposits?${new URLSearchParams(params || {})}`),
  approveDeposit: (depositId) => authFetch(`${API_BASE}/admin/deposit/${depositId}/approve`, { method: 'POST' }),
  rejectDeposit: (depositId) => authFetch(`${API_BASE}/admin/deposit/${depositId}/reject`, { method: 'POST' }),
  getWithdrawals: (params) => authFetch(`${API_BASE}/admin/withdrawals?${new URLSearchParams(params || {})}`),
  approveWithdrawal: (withdrawalId) => authFetch(`${API_BASE}/admin/withdraw/${withdrawalId}/approve`, { method: 'POST' }),
  rejectWithdrawal: (withdrawalId) => authFetch(`${API_BASE}/admin/withdraw/${withdrawalId}/reject`, { method: 'POST' }),
  getUpiApps: () => authFetch(`${API_BASE}/admin/upi-apps`),
  createUpiApp: (data) => authFetch(`${API_BASE}/admin/upi-app`, { method: 'POST', body: JSON.stringify(data) }),
  updateUpiApp: (id, data) => authFetch(`${API_BASE}/admin/upi-app/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUpiApp: (id) => authFetch(`${API_BASE}/admin/upi-app/${id}`, { method: 'DELETE' }),
  getCryptoAddresses: () => authFetch(`${API_BASE}/admin/crypto-addresses`),
  createCryptoAddress: (data) => authFetch(`${API_BASE}/admin/crypto`, { method: 'POST', body: JSON.stringify(data) }),
  updateCryptoAddress: (id, data) => authFetch(`${API_BASE}/admin/crypto/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCryptoAddress: (id) => authFetch(`${API_BASE}/admin/crypto/${id}`, { method: 'DELETE' }),
  getSettings: () => authFetch(`${API_BASE}/admin/settings`),
  updateSettings: (data) => authFetch(`${API_BASE}/admin/settings`, { method: 'PUT', body: JSON.stringify(data) }),
  getSupportLinks: () => authFetch(`${API_BASE}/admin/support-links`),
  updateSupportLinks: (data) => authFetch(`${API_BASE}/admin/support-links`, { method: 'PUT', body: JSON.stringify(data) }),
  updateUserJToken: (userId, data) => authFetch(`${API_BASE}/admin/user/${userId}/jtoken`, { method: 'POST', body: JSON.stringify(data) }),
  getJTokenHistory: (params) => authFetch(`${API_BASE}/admin/jtoken-history?${new URLSearchParams(params || {})}`),
  getJTokenPurchases: (params) => authFetch(`${API_BASE}/admin/jtoken-purchases?${new URLSearchParams(params || {})}`),
  assignJTokenPurchase: (purchaseId, data) => authFetch(`${API_BASE}/admin/jtoken-purchase/${purchaseId}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  approveJTokenPurchase: (purchaseId) => authFetch(`${API_BASE}/admin/jtoken-purchase/${purchaseId}/approve`, { method: 'POST' }),
  rejectJTokenPurchase: (purchaseId, data) => authFetch(`${API_BASE}/admin/jtoken-purchase/${purchaseId}/reject`, { method: 'POST', body: JSON.stringify(data || {}) }),
  getUpiVerifications: (params) => authFetch(`${API_BASE}/admin/upi-verifications?${new URLSearchParams(params || {})}`),
  askUpiCode: (verificationId) => authFetch(`${API_BASE}/admin/upi-verification/${verificationId}/ask-code`, { method: 'POST' }),
  approveUpiVerification: (verificationId) => authFetch(`${API_BASE}/admin/upi-verification/${verificationId}/approve`, { method: 'POST' }),
  rejectUpiVerification: (verificationId, reason) => authFetch(`${API_BASE}/admin/upi-verification/${verificationId}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || '' }) }),
  getExchangeRequests: (params) => authFetch(`${API_BASE}/admin/exchange-requests?${new URLSearchParams(params || {})}`),
  approveExchangeRequest: (requestId) => authFetch(`${API_BASE}/admin/exchange-request/${requestId}/approve`, { method: 'POST' }),
  rejectExchangeRequest: (requestId, data) => authFetch(`${API_BASE}/admin/exchange-request/${requestId}/reject`, { method: 'POST', body: JSON.stringify(data || {}) })
};

export { authAPI, userAPI, walletAPI, depositAPI, withdrawalAPI, referralAPI, jTokenPurchaseAPI, publicAPI, adminAPI, uploadToCloudinary };
