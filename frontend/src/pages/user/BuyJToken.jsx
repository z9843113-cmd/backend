import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';
import RequestStatusModal from '../../components/RequestStatusModal';
import { jTokenPurchaseAPI, walletAPI, uploadToCloudinary, publicAPI, userAPI } from '../../services/api';
import { FaArrowLeft, FaClock, FaCoins, FaCopy, FaCreditCard, FaUniversity, FaCheck, FaTimes } from 'react-icons/fa';

const BuyJToken = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [request, setRequest] = useState(null);
  const [history, setHistory] = useState([]);
  const [showActivePopup, setShowActivePopup] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [message, setMessage] = useState('');
  const [showWaitPopup, setShowWaitPopup] = useState(false);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [upiApps, setUpiApps] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [jtokenCommissionPercent, setJtokenCommissionPercent] = useState(4);
  const [tokenRate, setTokenRate] = useState(1);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied!');
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
    const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `A${dateStr}${random}`;
  };

  const JTOKEN_APPS = ['mobiwik', 'mobwik', 'freerecharge'];

  const formatStatus = (status) => {
    const labels = {
      'WAITING_ADMIN': 'Wait for Orders',
      'READY_TO_PAY': 'Ready to Pay',
      'PAYMENT_STARTED': 'Payment Started',
      'PAYMENT_SUBMITTED': 'Payment Submitted',
      'APPROVED': 'Approved',
      'REJECTED': 'Rejected',
      'CANCELLED': 'Cancelled',
      'EXPIRED': 'Expired',
    };
    return labels[status] || status;
  };
  
  const fetchRequestData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [walletRes, requestsRes, upiRes, userUpiRes, settingsRes] = await Promise.all([
        walletAPI.getWallet(),
        jTokenPurchaseAPI.getMyRequests(),
        publicAPI.getUpiApps(),
        userAPI.getUpiAccounts(),
        publicAPI.getSettings()
      ]);
      setWallet(walletRes?.data || walletRes || null);
      const allRequests = requestsRes?.data?.purchases || requestsRes?.purchases || requestsRes?.data || requestsRes || [];
      setHistory(allRequests);
      const req = allRequests.find(r => !['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(r.status));
      if (req) setRequest(req);
      else setRequest(null);

      // Save public settings values
      const settings = settingsRes || {};
      setJtokenCommissionPercent(parseFloat(settings.jtokencommissionpercent ?? 4));
      setTokenRate(parseFloat(settings.tokenrate || 1));
      
      // Use verified/active UPI accounts
      const userUpiAccounts = (userUpiRes?.data || userUpiRes || []).filter(
        u => u.status === 'active' || u.status === 'verified'
      );
      
      const allApps = upiRes?.data || upiRes || [];
      
      // Get UPI IDs from verified accounts
      const userUpiIds = userUpiAccounts
        .map(u => (u.upiid || u.upiId || u.upi_id || '').toLowerCase())
        .filter(Boolean);
      
      // Filter apps set for JToken purchases (case-insensitive flag check)
      let jtokenApps = [];
      const filteredApps = allApps.filter(app => {
        const flag = app.isforjtoken ?? app.isForJToken;
        return flag === true || flag === 'true';
      });

      if (userUpiIds.length > 0) {
        jtokenApps = filteredApps;
      }
      
      setUpiApps(jtokenApps);
      if (jtokenApps.length > 0) {
        setSelectedMethod(prev => {
          if (prev && jtokenApps.some(app => app.id === prev)) return prev;
          return jtokenApps[0].id;
        });
      }
    } catch (e) {
      console.error('Failed to fetch data', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchRequestData(); 
    const interval = setInterval(() => fetchRequestData(true), 1500);
    return () => clearInterval(interval);
  }, [fetchRequestData]);

  useEffect(() => {
    if (request?.status === 'PAYMENT_STARTED') {
      setShowPaymentPopup(true);
    }
  }, [request?.status]);

  const handleCreate = async () => {
    if (!amount || parseFloat(amount) < 10) {
      setMessage('Minimum amount is ₹10');
      return;
    }
    if (!selectedMethod) {
      setMessage('Please select a payment method');
      return;
    }
    setSubmitting(true);
    try {
      const res = await jTokenPurchaseAPI.create({ amount: parseFloat(amount), method: selectedMethod });
      const newRequest = res?.data?.request || res?.request || res?.data || res;
      setRequest(newRequest);
      setPendingRequest({ id: newRequest.id, type: 'JTOKEN', title: 'J Token Purchase' });
      setMessage('');
    } catch (err) {
      setMessage(err?.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartPay = async () => {
    setSubmitting(true);
    try {
      await jTokenPurchaseAPI.startPay(request.id);
      setRequest({ ...request, status: 'PAYMENT_STARTED' });
    } catch (err) {
      setMessage(err?.message || 'Failed to start payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this request?')) return;
    setSubmitting(true);
    try {
      await jTokenPurchaseAPI.cancel(request.id);
      setRequest(null);
      fetchRequestData(true);
    } catch (err) {
      setMessage(err?.message || 'Failed to cancel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScreenshot = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File too large (max 5MB)');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setScreenshot(url);
      setScreenshotPreview(URL.createObjectURL(file));
    } catch {
      setMessage('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!utr.trim()) {
      setMessage('Please enter UTR number');
      return;
    }
    setSubmitting(true);
    try {
      await jTokenPurchaseAPI.submitPayment(request.id, { utr: utr.trim(), screenshot: screenshot });
      setRequest({ ...request, status: 'PAYMENT_SUBMITTED' });
      setShowWaitPopup(true);
    } catch (err) {
      setMessage(err?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="animate-spin w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#151515] pb-24 font-['Ubuntu',sans-serif]">
      <div className="sticky top-0 z-30 bg-gradient-to-r from-[#0d0d0d] via-[#1a1a1a] to-[#0d0d0d] backdrop-blur-2xl border-b border-[#D4AF37]/20">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-[#1a1a1a]"><FaArrowLeft className="text-white" /></button>
            <div>
              <img src="/jexpaylogo.png" alt="Jex Pay" className="h-8 sm:h-10 object-contain" />
              <p className="text-gray-500 text-xs">Buy J Token</p>
            </div>
          </div>
          <div className="text-right bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl px-3 py-2 border border-[#D4AF37]/20">
            <p className="text-[#D4AF37] font-bold text-sm">₹{parseFloat(wallet?.tokenbalance || 0).toFixed(2)}</p>
            <p className="text-gray-500 text-xs">J Token</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        
        {/* Warning Note */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <p className="text-yellow-400 font-bold text-sm mb-2">⚠️ NOTE..</p>
          <p className="text-white text-sm">Cancel the order if the payment details do not match ❗️</p>
          <p className="text-gray-400 text-sm mt-2">अगर पेमेंट डिटेल्स मैच नहीं होती हैं तो ऑर्डर कैंसिल करें ❗️</p>
        </div>

        {/* Active Request Card */}
        {request && (
          <div onClick={() => setShowActivePopup(true)} className="bg-gradient-to-r from-[#D4AF37]/20 to-[#FFD700]/10 border border-[#D4AF37]/30 rounded-2xl p-4 cursor-pointer hover:from-[#D4AF37]/30 hover:to-[#FFD700]/20 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold">Active Request</p>
                <p className="text-gray-400 text-sm">₹{parseFloat(request.amount || 0).toFixed(2)} • {formatStatus(request.status)}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  request.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                  request.status === 'PAYMENT_SUBMITTED' ? 'bg-yellow-500/20 text-yellow-400' :
                  request.status === 'PAYMENT_STARTED' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {formatStatus(request.status)}
                </span>
                <p className="text-[#D4AF37] text-xs mt-1">Tap to view →</p>
              </div>
            </div>
          </div>
        )}

        {!request ? (
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
            <h2 className="text-white font-bold text-lg mb-4">Buy J Token</h2>
            
            {/* Payment Method Selector */}
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-2">Select Payment Method</p>
              {upiApps.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-400 text-sm">JToken payment method not configured. Please contact support.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {upiApps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => setSelectedMethod(app.id)}
                      className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                        selectedMethod === app.id
                          ? 'bg-[#D4AF37] text-black'
                          : 'bg-[#0a0a0a] border border-[#2a2a2a] text-gray-400'
                      }`}
                    >
                      {app.name || app.id}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount (min ₹10)" className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl px-4 py-4 text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none text-lg" />
            
            {amount && parseFloat(amount) > 0 && (
              <div className="mt-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Commission ({jtokenCommissionPercent}%):</span>
                  <span className="text-white font-semibold">+₹{(parseFloat(amount) * jtokenCommissionPercent / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Total:</span>
                  <span className="text-white font-semibold">₹{(parseFloat(amount) + (parseFloat(amount) * jtokenCommissionPercent / 100)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-[#2a2a2a]">
                  <span className="text-gray-400">You will get:</span>
                  <span className="text-[#D4AF37] font-bold">{(parseFloat(amount) / tokenRate).toFixed(0)} JToken</span>
                </div>
              </div>
            )}

            {message && <p className="text-red-400 text-sm mt-3">{message}</p>}
            <button onClick={handleCreate} disabled={submitting} className="w-full mt-5 py-4 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] rounded-2xl font-bold text-black disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Order Details Card */}
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-5 border border-[#D4AF37]/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-lg">Recharge Order</h2>
                <span className="text-yellow-400 text-sm">⚠️ Please give feedback in time!</span>
              </div>
              
              <div className="bg-[#0a0a0a] rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Order Number</span>
                  <span className="text-white font-mono text-sm">{generateOrderNumber()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Payment Method</span>
                  <span className="text-white font-semibold">{request.method === 'BANK' ? 'UPI to Bank A/C' : 'UPI'}</span>
                </div>
              </div>

              {/* Bank Details (if available) */}
              {request.adminnote && request.adminnote.includes('Bank:') && (
                <div className="mt-4 bg-[#0a0a0a] rounded-2xl p-4 space-y-3">
                  <p className="text-[#D4AF37] font-semibold">Receiving Bank Details</p>
                  
                  {request.adminnote.split('\n').filter(line => line.includes(':')).map((line, i) => {
                    const [key, ...valueParts] = line.split(':');
                    const value = valueParts.join(':').trim();
                    if (!value) return null;
                    return (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">{key.trim()}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono">{value}</span>
                          <button onClick={() => copyToClipboard(value)} className="text-[#D4AF37] hover:text-[#FFD700]">
                            <FaCopy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="flex justify-between items-center pt-2 border-t border-[#2a2a2a]">
                    <span className="text-gray-400 text-sm">Receipt Amount</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-bold">₹{parseFloat(request.amount || 0).toFixed(2)}</span>
                      <button onClick={() => copyToClipboard(request.amount)} className="text-[#D4AF37] hover:text-[#FFD700]">
                        <FaCopy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* UPI Details (if available) */}
              {request.paymentupi && (
                <div className="mt-4 bg-[#0a0a0a] rounded-2xl p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">UPI ID</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono">{request.paymentupi}</span>
                      <button onClick={() => copyToClipboard(request.paymentupi)} className="text-[#D4AF37] hover:text-[#FFD700]">
                        <FaCopy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Code */}
              {request.qrimage && (
                <div className="mt-4 bg-white p-3 rounded-2xl">
                  <img src={request.qrimage} alt="QR Code" className="w-full h-48 object-contain" />
                </div>
              )}

              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3">
                <p className="text-yellow-400 text-sm">⚠️ Please pay with PhonePe wallet</p>
              </div>

              {request.status === 'PAYMENT_STARTED' && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex items-center gap-2">
                  <FaClock className="text-red-400" />
                  <span className="text-red-400 text-sm">Order will be canceled in 10:00</span>
                </div>
              )}
            </div>



            {/* Status Messages */}
            {request.status === 'WAITING_ADMIN' && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a] text-center">
                <div className="w-16 h-16 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaClock className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <p className="text-white font-bold text-lg mb-2">Waiting for Admin</p>
                <p className="text-gray-400 text-sm">Admin will assign payment details soon</p>
              </div>
            )}

            {request.status === 'READY_TO_PAY' && (
              <button onClick={handleStartPay} disabled={submitting} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl font-bold text-white disabled:opacity-50">
                {submitting ? 'Loading...' : 'Pay Now'}
              </button>
            )}

            {request.status === 'PAYMENT_SUBMITTED' && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#D4AF37]/30 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaCheck className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-[#D4AF37] font-bold text-lg mb-2">Submitted Successfully!</p>
                <p className="text-gray-400 text-sm">Please wait 3-5 minutes for admin verification</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showWaitPopup && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowWaitPopup(false)}>
          <div className="bg-[#1a1a1a] rounded-3xl p-6 max-w-sm w-full text-center border border-[#D4AF37]/30">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaClock className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-white font-bold text-lg mb-2">Waiting for Verification</p>
            <p className="text-gray-400 text-sm">Your payment is being verified by admin</p>
            <button onClick={() => setShowWaitPopup(false)} className="mt-5 w-full py-3 bg-[#D4AF37] rounded-xl font-bold text-black">OK</button>
          </div>
        </div>
      )}

      {/* Payment Popup */}
      {showPaymentPopup && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-3xl p-6 max-w-md w-full border border-[#D4AF37]/30">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">UTR Input</h3>
              <button onClick={() => setShowPaymentPopup(false)} className="text-gray-400">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                <p className="text-yellow-400 text-sm">Please pay ₹{parseFloat(request?.amount || 0).toFixed(2)} and enter UTR</p>
              </div>
              
              <input 
                type="text" 
                value={utr} 
                onChange={(e) => setUtr(e.target.value)} 
                placeholder="Enter UTR number" 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl px-4 py-4 text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none" 
              />
              
              <div>
                <p className="text-gray-400 text-sm mb-2">Payment Screenshot</p>
                <label className="block">
                  <div className="border-2 border-dashed border-[#2a2a2a] rounded-2xl p-6 text-center cursor-pointer hover:border-[#D4AF37]/50 transition-colors">
                    {screenshotPreview ? (
                      <img src={screenshotPreview} alt="Preview" className="w-full h-32 object-contain rounded-xl" />
                    ) : (
                      <p className="text-gray-500">+ (Add file)</p>
                    )}
                  </div>
                  <input type="file" accept="image/*,video/*" onChange={handleScreenshot} className="hidden" />
                </label>
                {uploading && <p className="text-[#D4AF37] text-sm mt-2">Uploading...</p>}
              </div>

              {message && <p className="text-red-400 text-sm">{message}</p>}

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { handleSubmitPayment(); setShowPaymentPopup(false); }} 
                  disabled={submitting || !utr.trim()} 
                  className="py-4 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] rounded-2xl font-bold text-black disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button 
                  onClick={() => { handleCancel(); setShowPaymentPopup(false); }} 
                  disabled={submitting} 
                  className="py-4 bg-[#1a1a1a] rounded-2xl font-bold text-white disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div className="px-4 py-5 max-w-2xl mx-auto space-y-3">
          <h3 className="text-white font-bold text-lg mb-3">History</h3>
          {history.slice(0, 5).map((item, i) => (
            <div key={i} className="bg-[#1a1a1a] rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-white font-semibold">₹{parseFloat(item.amount || 0).toFixed(2)}</p>
                <p className="text-gray-500 text-xs">{item.createdat ? new Date(item.createdat).toLocaleDateString() : ''}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                item.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                item.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                item.status === 'CANCELLED' ? 'bg-gray-500/20 text-gray-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Active Request Popup */}
      {showActivePopup && request && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowActivePopup(false)}>
          <div className="bg-[#1a1a1a] rounded-3xl p-6 max-w-md w-full border border-[#D4AF37]/30" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Active Request</h3>
              <button onClick={() => setShowActivePopup(false)} className="text-gray-400">✕</button>
            </div>
            <div className="space-y-3">
              <div className="bg-[#0a0a0a] rounded-xl p-4">
                <p className="text-gray-400 text-sm">Amount</p>
                <p className="text-white font-bold text-xl">₹{parseFloat(request.amount || 0).toFixed(2)}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-xl p-4">
                <p className="text-gray-400 text-sm">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                  request.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                  request.status === 'PAYMENT_SUBMITTED' ? 'bg-yellow-500/20 text-yellow-400' :
                  request.status === 'WAITING_ADMIN' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {formatStatus(request.status)}
                </span>
              </div>
              {request.paymentupi && (
                <div className="bg-[#0a0a0a] rounded-xl p-4">
                  <p className="text-gray-400 text-sm">UPI ID</p>
                  <p className="text-white font-mono">{request.paymentupi}</p>
                </div>
              )}
              {request.adminnote && (
                <div className="bg-[#0a0a0a] rounded-xl p-4">
                  <p className="text-gray-400 text-sm">Note</p>
                  <p className="text-white text-sm">{request.adminnote}</p>
                </div>
              )}
              <p className="text-gray-500 text-xs">{request.createdat ? `Created: ${new Date(request.createdat).toLocaleString()}` : ''}</p>
            </div>
          </div>
        </div>
      )}

      <BottomNav />

      <RequestStatusModal 
        isOpen={!!pendingRequest}
        onClose={() => setPendingRequest(null)}
        type={pendingRequest?.type}
        requestId={pendingRequest?.id}
        title={pendingRequest?.title}
      />
    </div>
  );
};

export default BuyJToken;
