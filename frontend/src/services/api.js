const API_BASE = 'https://backend-crru.onrender.com/api';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;


// ============================================
// CLOUDINARY UPLOAD
// ============================================

const uploadToCloudinary = async (file) => {
  if (!file) throw new Error('No file provided');

  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Upload failed');
  }

  return data.secure_url;
};


// ============================================
// AUTH FETCH
// ============================================

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      window.location.href = '/login';

      throw new Error(
        data.error ||
        data.detail ||
        data.message ||
        'Unauthorized. Please login again.'
      );
    }

    throw new Error(
      data.detail ||
      data.error ||
      data.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
};


// ============================================
// AUTH API
// ============================================

const authAPI = {

  // DIRECT REGISTRATION — NO OTP, NO EMAIL
  register: async (data) => {
    try {
      console.log('REGISTER REQUEST:', {
        url: `${API_BASE}/auth/register`,
        email: data.email
      });

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json().catch(() => ({}));

      console.log('REGISTER STATUS:', response.status);
      console.log('REGISTER RESPONSE:', result);

      if (!response.ok) {
        const errorMessage =
          result.detail ||
          result.error ||
          result.message ||
          `Registration failed (HTTP ${response.status})`;

        throw new Error(errorMessage);
      }

      if (!result.token) {
        throw new Error(
          'Account response received, but login token is missing.'
        );
      }

      return result;

    } catch (error) {
      console.error('REGISTER API ERROR:', error);

      throw new Error(
        error.message ||
        'Unable to connect to registration server. Please try again.'
      );
    }
  },


  // OTP verification (kept for compatibility with other pages)
  verifyOtp: async (data) => {
    const response = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    console.log('VERIFY OTP RESPONSE:', result);

    if (!response.ok) {
      throw new Error(
        result.detail ||
        result.error ||
        result.message ||
        'Verification failed'
      );
    }

    return result;
  },


  // LOGIN
  login: async (data) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail ||
        result.error ||
        result.message ||
        'Login failed'
      );
    }

    return result;
  },


  // RESEND OTP (kept for compatibility)
  resendOtp: async (data) => {
    const response = await fetch(`${API_BASE}/auth/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail ||
        result.error ||
        result.message ||
        'Failed to resend OTP'
      );
    }

    return result;
  },


  // FORGOT PASSWORD
  forgetPassword: async (data) => {
    const response = await fetch(`${API_BASE}/auth/forget-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail ||
        result.error ||
        result.message ||
        'Failed to send password reset email'
      );
    }

    return result;
  },


  // RESET PASSWORD
  resetPassword: async (data) => {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail ||
        result.error ||
        result.message ||
        'Failed to reset password'
      );
    }

    return result;
  }

};


// ============================================
// USER API
// ============================================

const userAPI = {
  getProfile: () => authFetch(`${API_BASE}/user/profile`),

  togglePayment: (enabled) =>
    authFetch(`${API_BASE}/user/toggle-payment`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),

  requestUpiVerification: (data) =>
    authFetch(`${API_BASE}/user/upi/request-verification`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  submitUpiOtp: (otp) =>
    authFetch(`${API_BASE}/user/upi/submit-otp`, {
      method: 'POST',
      body: JSON.stringify({ otp })
    }),

  verifyUpiOtp: (otp) =>
    authFetch(`${API_BASE}/user/upi/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ otp })
    }),

  getUpiVerificationStatus: () =>
    authFetch(`${API_BASE}/user/upi/verification-status`),

  addUpi: (data) =>
    authFetch(`${API_BASE}/user/add-upi`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getUpiAccounts: () =>
    authFetch(`${API_BASE}/user/upi-accounts`),

  setPrimaryUpi: (data) =>
    authFetch(`${API_BASE}/user/set-primary-upi`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  deleteUpi: (id) =>
    authFetch(`${API_BASE}/user/upi/${id}`, {
      method: 'DELETE'
    }),

  addBank: (data) =>
    authFetch(`${API_BASE}/user/add-bank`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getBankAccounts: () =>
    authFetch(`${API_BASE}/user/bank-accounts`),

  setPrimaryBank: (data) =>
    authFetch(`${API_BASE}/user/set-primary-bank`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  deleteBank: (id) =>
    authFetch(`${API_BASE}/user/bank/${id}`, {
      method: 'DELETE'
    }),

  bindMobile: (data) =>
    authFetch(`${API_BASE}/user/bind-mobile`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  bindTelegram: (data) =>
    authFetch(`${API_BASE}/user/bind-telegram`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  generateTelegramKey: () =>
    authFetch(`${API_BASE}/user/generate-telegram-key`, {
      method: 'POST'
    }),

  setPin: (data) =>
    authFetch(`${API_BASE}/user/set-pin`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  verifyPin: (data) =>
    authFetch(`${API_BASE}/user/verify-pin`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  setPinEnabled: (data) =>
    authFetch(`${API_BASE}/user/set-pin-enabled`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updatePassword: (data) =>
    authFetch(`${API_BASE}/user/update-password`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getSupportLinks: () =>
    authFetch(`${API_BASE}/user/support-links`),

  createExchangeRequest: (data) =>
    authFetch(`${API_BASE}/user/exchange-request`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getMyExchangeRequests: () =>
    authFetch(`${API_BASE}/user/exchange-requests`)
};


// ============================================
// WALLET API
// ============================================

const walletAPI = {
  getWallet: () => authFetch(`${API_BASE}/wallet`),

  trade: (data) =>
    authFetch(`${API_BASE}/wallet/trade`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  withdrawReferral: (data) =>
    authFetch(`${API_BASE}/wallet/withdraw-referral`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getWithdrawalHistory: () =>
    authFetch(`${API_BASE}/withdraw/history`),

  getJTokenHistory: () =>
    authFetch(`${API_BASE}/jtoken-purchase`)
};


// ============================================
// DEPOSIT API
// ============================================

const depositAPI = {
  create: (data) =>
    authFetch(`${API_BASE}/deposit`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getHistory: () =>
    authFetch(`${API_BASE}/deposit/history`)
};


// ============================================
// WITHDRAWAL API
// ============================================

const withdrawalAPI = {
  create: (data) =>
    authFetch(`${API_BASE}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getHistory: () =>
    authFetch(`${API_BASE}/withdraw/history`)
};


// ============================================
// REFERRAL API
// ============================================

const referralAPI = {
  getTeam: () => authFetch(`${API_BASE}/referral`),
  getStats: () => authFetch(`${API_BASE}/referral`),
  getReferralData: () => authFetch(`${API_BASE}/referral`)
};


// ============================================
// J TOKEN PURCHASE API
// ============================================

const jTokenPurchaseAPI = {
  getMyRequests: () =>
    authFetch(`${API_BASE}/jtoken-purchase`),

  create: (data) =>
    authFetch(`${API_BASE}/jtoken-purchase`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  startPay: (requestId) =>
    authFetch(`${API_BASE}/jtoken-purchase/${requestId}/start-pay`, {
      method: 'POST'
    }),

  submitPayment: (requestId, data) =>
    authFetch(`${API_BASE}/jtoken-purchase/${requestId}/submit-payment`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  cancel: (requestId) =>
    authFetch(`${API_BASE}/jtoken-purchase/${requestId}/cancel`, {
      method: 'POST'
    })
};


// ============================================
// PUBLIC API
// ============================================

const publicAPI = {
  getUpiApps: async () => {
    const response = await fetch(`${API_BASE}/public/upi-apps`);
    const data = await response.json();
    return { data };
  },

  getCryptoAddresses: async () => {
    const response = await fetch(`${API_BASE}/public/crypto-addresses`);
    const data = await response.json();
    return { data };
  },

  getRates: async () => {
    const response = await fetch(`${API_BASE}/public/rates`);
    const data = await response.json();
    return { data };
  },

  getCryptoRates: async () => {
    const response = await fetch(`${API_BASE}/public/crypto-rates`);
    const data = await response.json();
    return { data };
  },

  getRecentTrades: async () => {
    const response = await fetch(`${API_BASE}/public/recent-trades`);
    const data = await response.json();
    return { data };
  },

  getSettings: async () => {
    const response = await fetch(`${API_BASE}/public/settings`);
    const data = await response.json();
    return { data };
  }
};


// ============================================
// ADMIN API
// ============================================

const adminAPI = {
  getDashboard: () =>
    authFetch(`${API_BASE}/admin/dashboard`),

  getNotifications: () =>
    authFetch(`${API_BASE}/admin/notifications`),

  getUsers: (params) =>
    authFetch(`${API_BASE}/admin/users?${new URLSearchParams(params)}`),

  getUserDetails: (userId) =>
    authFetch(`${API_BASE}/admin/user/${userId}`),

  toggleUserBlock: (userId, data) =>
    authFetch(`${API_BASE}/admin/user/${userId}/block`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  getDeposits: (params) =>
    authFetch(`${API_BASE}/admin/deposits?${new URLSearchParams(params || {})}`),

  approveDeposit: (depositId) =>
    authFetch(`${API_BASE}/admin/deposit/${depositId}/approve`, {
      method: 'POST'
    }),

  rejectDeposit: (depositId) =>
    authFetch(`${API_BASE}/admin/deposit/${depositId}/reject`, {
      method: 'POST'
    }),

  getWithdrawals: (params) =>
    authFetch(`${API_BASE}/admin/withdrawals?${new URLSearchParams(params || {})}`),

  approveWithdrawal: (withdrawalId) =>
    authFetch(`${API_BASE}/admin/withdraw/${withdrawalId}/approve`, {
      method: 'POST'
    }),

  rejectWithdrawal: (withdrawalId) =>
    authFetch(`${API_BASE}/admin/withdraw/${withdrawalId}/reject`, {
      method: 'POST'
    }),

  getUpiApps: () =>
    authFetch(`${API_BASE}/admin/upi-apps`),

  createUpiApp: (data) =>
    authFetch(`${API_BASE}/admin/upi-app`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateUpiApp: (id, data) =>
    authFetch(`${API_BASE}/admin/upi-app/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteUpiApp: (id) =>
    authFetch(`${API_BASE}/admin/upi-app/${id}`, {
      method: 'DELETE'
    }),

  getCryptoAddresses: () =>
    authFetch(`${API_BASE}/admin/crypto-addresses`),

  createCryptoAddress: (data) =>
    authFetch(`${API_BASE}/admin/crypto`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateCryptoAddress: (id, data) =>
    authFetch(`${API_BASE}/admin/crypto/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteCryptoAddress: (id) =>
    authFetch(`${API_BASE}/admin/crypto/${id}`, {
      method: 'DELETE'
    }),

  getSettings: () =>
    authFetch(`${API_BASE}/admin/settings`),

  updateSettings: (data) =>
    authFetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  getSupportLinks: () =>
    authFetch(`${API_BASE}/admin/support-links`),

  updateSupportLinks: (data) =>
    authFetch(`${API_BASE}/admin/support-links`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateUserJToken: (userId, data) =>
    authFetch(`${API_BASE}/admin/user/${userId}/jtoken`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getJTokenHistory: (params) =>
    authFetch(`${API_BASE}/admin/jtoken-history?${new URLSearchParams(params || {})}`),

  getJTokenPurchases: (params) =>
    authFetch(`${API_BASE}/admin/jtoken-purchases?${new URLSearchParams(params || {})}`),

  assignJTokenPurchase: (purchaseId, data) =>
    authFetch(`${API_BASE}/admin/jtoken-purchase/${purchaseId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  approveJTokenPurchase: (purchaseId) =>
    authFetch(`${API_BASE}/admin/jtoken-purchase/${purchaseId}/approve`, {
      method: 'POST'
    }),

  rejectJTokenPurchase: (purchaseId, data) =>
    authFetch(`${API_BASE}/admin/jtoken-purchase/${purchaseId}/reject`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),

  getUpiVerifications: (params) =>
    authFetch(`${API_BASE}/admin/upi-verifications?${new URLSearchParams(params || {})}`),

  askUpiCode: (verificationId) =>
    authFetch(`${API_BASE}/admin/upi-verification/${verificationId}/ask-code`, {
      method: 'POST'
    }),

  approveUpiVerification: (verificationId) =>
    authFetch(`${API_BASE}/admin/upi-verification/${verificationId}/approve`, {
      method: 'POST'
    }),

  rejectUpiVerification: (verificationId, reason) =>
    authFetch(`${API_BASE}/admin/upi-verification/${verificationId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' })
    }),

  getExchangeRequests: (params) =>
    authFetch(`${API_BASE}/admin/exchange-requests?${new URLSearchParams(params || {})}`),

  approveExchangeRequest: (requestId) =>
    authFetch(`${API_BASE}/admin/exchange-request/${requestId}/approve`, {
      method: 'POST'
    }),

  rejectExchangeRequest: (requestId, data) =>
    authFetch(`${API_BASE}/admin/exchange-request/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    })
};


// ============================================
// EXPORTS
// ============================================

export {
  authAPI,
  userAPI,
  walletAPI,
  depositAPI,
  withdrawalAPI,
  referralAPI,
  jTokenPurchaseAPI,
  publicAPI,
  adminAPI,
  uploadToCloudinary
};
