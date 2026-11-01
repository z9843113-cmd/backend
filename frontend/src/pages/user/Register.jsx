import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get('ref');

    if (refCode) {
      setReferralCode(refCode);
    }
  }, [searchParams]);

  const validateForm = () => {
    if (!name.trim()) return 'Please enter your name';
    if (!email.trim()) return 'Please enter your email';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email';
    }

    if (!password) return 'Please enter a password';

    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (loading) return;

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        password,
        referralcode: referralCode.trim()
      };

      const response = await authAPI.register(payload);

      console.log('REGISTER RESPONSE:', response);

      // Support both direct response and { data: response } format
      const result = response?.data || response;

      const token = result?.token;
      const user = result?.user;

      if (!token) {
        throw new Error(
          result?.message ||
          'Registration completed, but server did not return a login token.'
        );
      }

      // Save authentication data
      localStorage.setItem('token', token);

      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }

      // Update global authentication store
      setToken(token);

      if (user) {
        setUser(user);
      }

      setSuccess('Account created successfully! Redirecting...');

      // Redirect directly to Home
      navigate('/home', { replace: true });

    } catch (err) {
      console.error('REGISTER ERROR:', err);
      console.error('REGISTER ERROR RESPONSE:', err?.response?.data);

      const data = err?.response?.data;

      let message =
        data?.detail ||
        data?.error ||
        data?.message ||
        err?.message;

      // Handle validation errors returned as arrays
      if (Array.isArray(message)) {
        message = message
          .map((item) => item?.msg || item?.message || String(item))
          .join(', ');
      }

      // Handle object-shaped errors
      if (message && typeof message === 'object') {
        message = JSON.stringify(message);
      }

      setError(
        message ||
        'Registration failed. Please check your details and try again.'
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-['Ubuntu',sans-serif] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">

        <div className="relative overflow-hidden rounded-[28px] border border-[#3a3020] bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.18),_transparent_35%),linear-gradient(135deg,#171717_0%,#101010_60%,#090909_100%)] p-6 sm:p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">

          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#D4AF37]/10 blur-3xl"></div>

          <div className="relative text-center mb-6 sm:mb-8">
            <img
              src="/jexpaylogo.png"
              alt="Jex Pay"
              className="h-16 sm:h-20 md:h-24 mx-auto object-contain mb-2"
            />

            <h1
              className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#FFD700] bg-clip-text text-transparent"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              𝙅𝙀𝙓 𝙋𝘼𝙔
            </h1>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-5 sm:mb-6">
            Create Account
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-4 font-medium text-sm break-words">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-xl mb-4 font-medium text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleRegister}>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2 ml-1">
                Full Name *
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Enter your full name"
                autoComplete="name"
                required
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2 ml-1">
                Email *
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Enter your email"
                autoComplete="email"
                required
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2 ml-1">
                Mobile Number
              </label>

              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setError('');
                }}
                placeholder="Enter mobile number (optional)"
                autoComplete="tel"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2 ml-1">
                Password *
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Create a password"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2 ml-1">
                Referral Code (Optional)
              </label>

              <input
                type="text"
                value={referralCode}
                onChange={(e) => {
                  setReferralCode(e.target.value);
                  setError('');
                }}
                placeholder="Enter referral code"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold py-3.5 sm:py-4 rounded-xl hover:shadow-lg hover:shadow-yellow-500/30 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

          </form>

          <p className="text-gray-400 text-center mt-5 text-sm">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-yellow-400 hover:text-yellow-300 font-medium"
            >
              Login
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};

export default Register;
