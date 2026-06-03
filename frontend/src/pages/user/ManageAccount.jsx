import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI, publicAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import BottomNav from '../../components/BottomNav';

const ManageAccount = () => {
  useAuthStore();
  const [upiAccounts, setUpiAccounts] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [upiApps, setUpiApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingBank, setAddingBank] = useState(false);
  const [newUpi, setNewUpi] = useState('');
  const [upiPhone, setUpiPhone] = useState('');
  const [upiOtp, setUpiOtp] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState('');
  const [newBank, setNewBank] = useState({ bankName: '', accountNumber: '', ifsc: '', holderName: '', accountType: 'SAVINGS' });
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);
  const [activeTab, setActiveTab] = useState('upi');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      userAPI.getUpiVerificationStatus().then(statusRes => {
        const status = statusRes?.verification || statusRes?.data?.verification || null;
        if (status && ['PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED'].includes(status.status)) {
          setPendingVerifications([status]);
          setShowVerifyPopup(true);
        } else if (pendingVerifications.length > 0) {
          setPendingVerifications([]);
          setShowVerifyPopup(false);
          fetchData();
        }
      }).catch(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [upi, bank, apps, statusRes] = await Promise.all([
        userAPI.getUpiAccounts(),
        userAPI.getBankAccounts(),
        publicAPI.getUpiApps(),
        userAPI.getUpiVerificationStatus()
      ]);
      setUpiAccounts(upi?.data || upi || []);
      setBankAccounts(bank?.data || bank || []);
      setUpiApps(apps?.data || apps || []);
      const activeApps = (apps?.data || apps || []).filter(a => a.isActive || a.isactive);
      if (activeApps.length > 0) setSelectedUpiApp(activeApps[0].id);
      const status = statusRes?.verification || statusRes?.data?.verification || null;
      if (status && ['PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED'].includes(status.status)) {
        setPendingVerifications([status]);
        setShowVerifyPopup(true);
      } else {
        setPendingVerifications([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!selectedUpiApp) {
      setMessage('Please select UPI app');
      return;
    }
    if (!upiPhone.trim()) {
      setMessage('Please enter phone number');
      return;
    }
    if (!newUpi.trim()) {
      setMessage('Please enter UPI ID');
      return;
    }
    const upiRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/;
    if (!upiRegex.test(newUpi.trim())) {
      setMessage('Invalid UPI ID format');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await userAPI.requestUpiVerification({ phone: upiPhone.trim(), upiId: newUpi.trim(), appId: selectedUpiApp });
      setMessage('Request submitted. Wait for admin to ask for code.');
      fetchData();
    } catch (err) {
      setMessage(err?.message || err?.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!upiOtp.trim()) {
      setMessage('Please enter OTP');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await userAPI.submitUpiOtp(upiOtp.trim());
      setMessage('OTP submitted. Wait for admin approval.');
      fetchData();
    } catch (err) {
      setMessage(err?.message || err?.response?.data?.error || 'Failed to submit OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelUpiVerification = async () => {
    setSubmitting(true);
    setMessage('');
    try {
      await userAPI.cancelUpiVerification();
      setMessage('UPI Verification request cancelled.');
      setPendingVerifications([]);
      setShowVerifyPopup(false);
      fetchData();
    } catch (err) {
      setMessage(err?.message || err?.response?.data?.error || 'Failed to cancel verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPrimaryUpi = async (upiId) => {
    try { 
      await userAPI.setPrimaryUpi({ upiId }); 
      setMessage('Primary UPI set successfully!'); 
      const res = await userAPI.getUpiAccounts(); 
      setUpiAccounts(res?.data || res || []); 
    }
    catch (err) { setMessage(err.response?.data?.error || 'Failed to set primary UPI'); }
  };

  const handleDeleteUpi = async (upiId) => { 
    try { 
      await userAPI.deleteUpi(upiId); 
      const res = await userAPI.getUpiAccounts(); 
      setUpiAccounts(res?.data || res || []); 
    } catch (err) { setMessage(err.response?.data?.error || 'Failed to delete UPI'); } 
  };

  const handleAddBank = async (e) => {
    e.preventDefault();
    if (!newBank.accountNumber || !newBank.ifsc || !newBank.holderName) return;
    setAddingBank(true);
    setMessage('');
    try { 
      await userAPI.addBank(newBank); 
      setMessage('Bank account added successfully!'); 
      setNewBank({ bankName: '', accountNumber: '', ifsc: '', holderName: '', accountType: 'SAVINGS' }); 
      const res = await userAPI.getBankAccounts(); 
      setBankAccounts(res?.data || res || []); 
    }
    catch (err) { setMessage(err.response?.data?.error || 'Failed to add bank'); }
    finally { setAddingBank(false); }
  };

  const handleSetPrimaryBank = async (bankAccountId) => {
    try { 
      await userAPI.setPrimaryBank({ bankAccountId }); 
      setMessage('Primary bank set successfully!'); 
      const res = await userAPI.getBankAccounts(); 
      setBankAccounts(res?.data || res || []); 
    }
    catch (err) { setMessage(err.response?.data?.error || 'Failed to set primary bank'); }
  };

  const handleDeleteBank = async (bankId) => { 
    try { 
      await userAPI.deleteBank(bankId); 
      const res = await userAPI.getBankAccounts(); 
      setBankAccounts(res?.data || res || []); 
    } catch (err) { setMessage(err.response?.data?.error || 'Failed to delete bank'); } 
  };

  const menuItems = [
    { icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', label: 'Home', path: '/home' },
    { icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', label: 'Exchange', path: '/exchange' },
    { icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', label: 'Account', path: '/manage-account' },
    { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', label: 'Team', path: '/team' },
    { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Profile', path: '/profile' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-5 font-['Ubuntu',sans-serif]">
        <div className="animate-pulse space-y-5">
          <div className="h-12 w-32 bg-[#1a1a1a] rounded-2xl"></div>
          <div className="h-64 bg-[#1a1a1a] rounded-3xl"></div>
          <div className="h-48 bg-[#1a1a1a] rounded-3xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24 lg:pb-8 font-['Ubuntu',sans-serif]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`fixed top-0 left-0 h-full w-80 bg-[#0d0d0d] z-50 transform transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div>
              <img src="/jexpaylogo.png" alt="Jex Pay" className="h-10 sm:h-12 object-contain" />
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] transition-colors">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {menuItems.map((item, index) => (
            <button key={index} onClick={() => { navigate(item.path); setSidebarOpen(false); }} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#1a1a1a]/50 hover:bg-[#D4AF37]/10 text-left transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] group-hover:bg-[#D4AF37]/20 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <span className="text-white font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sticky top-0 z-30 bg-[#0d0d0d]/80 backdrop-blur-2xl border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-5 py-4">
          <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl bg-[#1a1a1a] hover:bg-[#252525] transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Manage Account</h1>
          <div className="w-12"></div>
        </div>
      </div>

      <div className="p-5 space-y-5 max-w-2xl mx-auto">
        {message && (
          <div className={`px-5 py-3 rounded-2xl ${message.includes('success') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {message}
          </div>
        )}

        <div className="flex gap-2 bg-[#1a1a1a] rounded-2xl p-1">
          <button 
            onClick={() => setActiveTab('upi')} 
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${activeTab === 'upi' ? 'bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black' : 'text-gray-400'}`}
          >
            UPI
          </button>
          <button 
            onClick={() => setActiveTab('bank')} 
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${activeTab === 'bank' ? 'bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black' : 'text-gray-400'}`}
          >
            Bank
          </button>
        </div>

        {activeTab === 'upi' && (
          <>
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Add UPI ID</h3>
              </div>
              
              {pendingVerifications.length > 0 ? (
                <div className="space-y-4">
                  {pendingVerifications.map((v, i) => (
                    <div key={i} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <p className="text-amber-400 font-semibold mb-2">Pending Verification</p>
                      <p className="text-gray-400 text-sm">Phone: {v.phone}</p>
                      <p className="text-gray-400 text-sm">UPI: {v.upiid}</p>
                      <p className="text-gray-500 text-xs mt-2">Status: {v.status}</p>
                      {v.status === 'OTP_REQUESTED' && (
                        <div className="mt-4 space-y-3">
                          <input
                            type="text"
                            value={upiOtp}
                            onChange={(e) => setUpiOtp(e.target.value)}
                            placeholder="Enter OTP"
                            className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500"
                          />
                          <button onClick={handleSubmitOtp} disabled={submitting} className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold rounded-2xl disabled:opacity-50">
                            {submitting ? 'Submitting...' : 'Submit OTP'}
                          </button>
                        </div>
                      )}
                      {['PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED'].includes(v.status) && (
                        <button onClick={handleCancelUpiVerification} disabled={submitting} className="w-full py-3 mt-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold rounded-2xl transition-colors">
                          Cancel Verification Request
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
  
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Select UPI App</label>
                    <select
                      value={selectedUpiApp}
                      onChange={(e) => setSelectedUpiApp(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none"
                    >
                      <option value="">Select app...</option>
                      {upiApps.filter(app => app.isActive || app.isactive).map((app) => (
                        <option key={app.id} value={app.id}>{app.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Phone Number (Registered with UPI)</label>
                    <input
                      type="tel"
                      value={upiPhone}
                      onChange={(e) => setUpiPhone(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Your UPI ID</label>
                    <input
                      type="text"
                      value={newUpi}
                      onChange={(e) => setNewUpi(e.target.value)}
                      placeholder="e.g., yourname@okhdfcbank"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                  <button onClick={handleSendOtp} disabled={submitting || !selectedUpiApp} className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold rounded-2xl disabled:opacity-50">
                    {submitting ? 'Submitting...' : 'Send OTP'}
                  </button>
                </div>
              )}
            </div>

            {(upiApps?.length > 0) && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
                <h3 className="text-lg font-bold text-white mb-4">Supported UPI Apps</h3>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {upiApps.filter(app => app.isActive || app.isactive).map((app) => (
                    <div key={app.id} className="p-3 md:p-4 bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a] flex items-center gap-2 md:gap-3">
                      <div className="w-8 md:w-10 h-8 md:h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 md:w-5 h-4 md:h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-white font-medium text-sm md:text-base truncate">{app.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(upiAccounts?.length > 0) && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-4 md:p-6 border border-[#2a2a2a]">
                <h3 className="text-lg font-bold text-white mb-4">My UPI Accounts</h3>
                <div className="space-y-3">
                  {upiAccounts.map((upi) => {
                    const getAppName = (upiAccount) => {
                      const appId = upiAccount.appid || upiAccount.appId;
                      const upiId = (upiAccount.upiid || upiAccount.upiId || '').toLowerCase();
                      if (upiId.includes('mobwik') || upiId.includes('mobiwik')) return 'MobiKwik';
                      if (upiId.includes('freerecharge')) return 'FreeCharge';
                      if (upiId.includes('paytm')) return 'Paytm';
                      if (upiId.includes('phonepe')) return 'PhonePe';
                      if (upiId.includes('google') || upiId.includes('gpay')) return 'Google Pay';
                      if (upiId.includes('bhim')) return 'BHIM';
                      if (upiId.includes('amazon')) return 'Amazon Pay';
                      const found = upiApps?.find(app => app.id?.toLowerCase() === appId?.toLowerCase() || app.name?.toLowerCase() === appId?.toLowerCase());
                      return found?.name || 'Unknown App';
                    };
                    const appName = getAppName(upi);
                    return (
                      <div key={upi.id} className="bg-gradient-to-r from-[#0a0a0a] to-[#151515] rounded-2xl border border-[#2a2a2a] hover:border-[#D4AF37]/50 transition-all overflow-hidden">
                        <div className="p-3 md:p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#FFD700] flex items-center justify-center flex-shrink-0">
                              <span className="text-black font-bold text-sm md:text-lg">{appName.charAt(0)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-semibold text-sm md:text-base truncate">{upi.upiId || upi.upiid}</p>
                              <p className="text-gray-400 text-xs md:text-sm">{appName}</p>
                            </div>
                          </div>
                        </div>
                        {(upi.isPrimary || upi.isprimary) && (
                          <div className="px-3 pb-3">
                            <span className="inline-block px-2 py-1 bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-medium rounded-full">Primary</span>
                          </div>
                        )}
                        {!(upi.isPrimary || upi.isprimary) && (
                          <div className="flex border-t border-[#2a2a2a]">
                            <button onClick={() => handleSetPrimaryUpi(upi.id)} className="flex-1 py-3 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-semibold text-sm hover:opacity-90 transition-opacity">
                              Set Primary
                            </button>
                            <button onClick={() => handleDeleteUpi(upi.id)} className="flex-1 py-3 bg-red-500/10 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors border-l border-[#2a2a2a]">
                              Delete
                            </button>
                          </div>
                        )}
                        {(upi.isPrimary || upi.isprimary) && (
                          <div className="flex border-t border-[#2a2a2a]">
                            <button onClick={() => handleDeleteUpi(upi.id)} className="flex-1 py-3 bg-red-500/10 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors">
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(activeTab === 'upi' && (!upiAccounts || upiAccounts.length === 0)) && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a] text-center">
                <p className="text-gray-400">No UPI accounts added yet</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'bank' && (
          <>
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Add Bank Account</h3>
              </div>
              <form onSubmit={handleAddBank} className="space-y-3 md:space-y-4">
                <input
                  type="text"
                  value={newBank.bankName}
                  onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                  placeholder="Bank Name"
                  className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none text-sm sm:text-base"
                />
                <input
                  type="text"
                  value={newBank.accountNumber}
                  onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                  placeholder="Account Number"
                  className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none text-sm sm:text-base"
                />
                <input
                  type="text"
                  value={newBank.ifsc}
                  onChange={(e) => setNewBank({ ...newBank, ifsc: e.target.value })}
                  placeholder="IFSC Code"
                  className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none text-sm sm:text-base"
                />
                <input
                  type="text"
                  value={newBank.holderName}
                  onChange={(e) => setNewBank({ ...newBank, holderName: e.target.value })}
                  placeholder="Holder Name"
                  className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none text-sm sm:text-base"
                />
                <select
                  value={newBank.accountType}
                  onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value })}
                  className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none text-sm sm:text-base"
                >
                  <option value="SAVINGS">Savings Account</option>
                  <option value="CURRENT">Current Account</option>
                </select>
                <button type="submit" disabled={addingBank} className="w-full py-3 sm:py-4 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold rounded-2xl disabled:opacity-50">
                  {addingBank ? 'Adding...' : 'Add Bank Account'}
                </button>
              </form>
            </div>

            {(bankAccounts?.length > 0) && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-4 md:p-6 border border-[#2a2a2a]">
                <h3 className="text-lg font-bold text-white mb-4">My Bank Accounts</h3>
                <div className="space-y-3">
                  {bankAccounts.map((bank) => (
                    <div key={bank.id} className="bg-gradient-to-r from-[#0a0a0a] to-[#151515] rounded-2xl border border-[#2a2a2a] hover:border-cyan-500/50 transition-all overflow-hidden">
                      <div className="p-3 md:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-semibold text-sm md:text-base truncate">{bank.holderName || bank.holdername}</p>
                            <p className="text-gray-400 text-xs md:text-sm truncate">{(bank.bankName || bank.bankname)} • {bank.accountNumber || bank.accountnumber}</p>
                          </div>
                        </div>
                      </div>
                      {(bank.isPrimary || bank.isprimary) && (
                        <div className="px-3 pb-3">
                          <span className="inline-block px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded-full">Primary</span>
                        </div>
                      )}
                      {!(bank.isPrimary || bank.isprimary) && (
                        <div className="flex border-t border-[#2a2a2a]">
                          <button onClick={() => handleSetPrimaryBank(bank.id)} className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                            Set Primary
                          </button>
                          <button onClick={() => handleDeleteBank(bank.id)} className="flex-1 py-3 bg-red-500/10 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors border-l border-[#2a2a2a]">
                            Delete
                          </button>
                        </div>
                      )}
                      {(bank.isPrimary || bank.isprimary) && (
                        <div className="flex border-t border-[#2a2a2a]">
                          <button onClick={() => handleDeleteBank(bank.id)} className="flex-1 py-3 bg-red-500/10 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors">
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              )}
            </>
        )}
      </div>

      {/* Verification Popup */}
      {showVerifyPopup && pendingVerifications.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-3xl p-6 max-w-md w-full border border-amber-500/30">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">UPI Verification</h3>
              <button onClick={() => { setShowVerifyPopup(false); fetchData(); }} className="text-gray-400">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <p className="text-amber-400 font-semibold text-center">Pending Verification</p>
              </div>
              
              <div className="bg-[#0a0a0a] rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">App</span>
                  <span className="text-white text-sm">{pendingVerifications[0]?.appid || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Phone</span>
                  <span className="text-white text-sm">{pendingVerifications[0]?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">UPI ID</span>
                  <span className="text-white text-sm">{pendingVerifications[0]?.upiid || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Status</span>
                  <span className="text-amber-400 text-sm">{pendingVerifications[0]?.status || 'PENDING'}</span>
                </div>
              </div>

              {pendingVerifications[0]?.status === 'OTP_REQUESTED' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={upiOtp}
                    onChange={(e) => setUpiOtp(e.target.value)}
                    placeholder="Enter OTP"
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white placeholder-gray-500"
                  />
                  <button onClick={handleSubmitOtp} disabled={submitting} className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold rounded-2xl disabled:opacity-50">
                    {submitting ? 'Submitting...' : 'Submit OTP'}
                  </button>
                </div>
              )}

              {pendingVerifications[0]?.status === 'PENDING' && (
                <p className="text-gray-400 text-sm text-center">Waiting for verification...</p>
              )}

              {['PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED'].includes(pendingVerifications[0]?.status) && (
                <button onClick={handleCancelUpiVerification} disabled={submitting} className="w-full py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold rounded-2xl transition-colors mb-2">
                  Cancel Verification Request
                </button>
              )}

              <button onClick={() => { setShowVerifyPopup(false); fetchData(); }} className="w-full py-3 bg-[#1a1a1a] rounded-2xl font-bold text-gray-400">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default ManageAccount;
