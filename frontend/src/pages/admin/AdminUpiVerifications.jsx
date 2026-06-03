import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import AdminNotificationBell from '../../components/AdminNotificationBell';

const AdminUpiVerifications = () => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [, setLoadingUser] = useState(false);
  const navigate = useNavigate();

  const fetchVerifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.getUpiVerifications({ page, limit: 20, status });
      setVerifications(res.verifications || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err?.message || 'Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVerifications(); }, [page, status]);

  const fetchUserDetails = async (userId) => {
    setLoadingUser(true);
    try {
      const res = await adminAPI.getUserDetails(userId);
      setUserDetails(res);
      setShowUserPopup(true);
    } catch {
      alert('Failed to load user details');
    } finally {
      setLoadingUser(false);
    }
  };

  const handleAskCode = async (id) => {
    if (!confirm('Ask user to enter OTP?')) return;
    setProcessingId(id);
    try {
      await adminAPI.askUpiCode(id);
      fetchVerifications();
    } catch (err) {
      alert(err?.message || 'Failed to ask for code');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (id) => {
    if (!confirm('Approve this UPI?')) return;
    setProcessingId(id);
    try {
      await adminAPI.approveUpiVerification(id);
      fetchVerifications();
    } catch (err) {
      alert(err?.message || 'Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    setProcessingId(id);
    try {
      await adminAPI.rejectUpiVerification(id, reason);
      fetchVerifications();
    } catch (err) {
      alert(err?.message || 'Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-amber-500/20 text-amber-400',
      OTP_REQUESTED: 'bg-blue-500/20 text-blue-400',
      OTP_SUBMITTED: 'bg-purple-500/20 text-purple-400',
      APPROVED: 'bg-emerald-500/20 text-emerald-400',
      REJECTED: 'bg-red-500/20 text-red-400',
      EXPIRED: 'bg-gray-500/20 text-gray-400'
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/80 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      <div className="sticky top-0 z-30 border-b border-[#1a1a1a] bg-[#0d0d0d]/95 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="rounded-2xl bg-[#1a1a1a] px-4 py-2 text-white hover:bg-[#252525]">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-white">UPI Verifications</h1>
          </div>
          <AdminNotificationBell />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-xl bg-[#1a1a1a] px-3 sm:px-4 py-2 text-white text-sm sm:text-base">
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="OTP_REQUESTED">Awaiting OTP</option>
            <option value="OTP_SUBMITTED">OTP Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-500/20 p-4 text-red-400">{error}</div>}

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-[#1a1a1a]" />)}
          </div>
        ) : verifications.length === 0 ? (
          <div className="rounded-xl bg-[#1a1a1a] p-8 text-center text-gray-400">No verification requests</div>
        ) : (
          <>
            <div className="space-y-3">
              {verifications.map((v) => (
                <div key={v.id} className="rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37]">
                        <span className="text-sm sm:text-lg font-bold">U</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm sm:text-base truncate">{v.email}</p>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">Phone: {v.phone}</p>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">UPI: {v.upiid}</p>
                        <p className="text-xs text-gray-500">{new Date(v.createdat).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium w-fit ${getStatusBadge(v.status)}`}>{v.status}</span>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => fetchUserDetails(v.userid)} className="rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs sm:text-sm text-white hover:bg-[#252525]">View</button>
                        {v.status === 'PENDING' && (
                          <button onClick={() => handleAskCode(v.id)} disabled={processingId === v.id} className="rounded-xl bg-blue-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                            {processingId === v.id ? '...' : 'Ask Code'}
                          </button>
                        )}
                        {v.status === 'OTP_SUBMITTED' && (
                          <>
                            <div className="rounded-xl bg-purple-500/20 px-3 py-2 text-xs sm:text-sm text-purple-400">OTP: {v.otp || 'Sent'}</div>
                            <button onClick={() => handleApprove(v.id)} disabled={processingId === v.id} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                              {processingId === v.id ? '...' : 'Approve'}
                            </button>
                          </>
                        )}
                        {['PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED'].includes(v.status) && (
                          <button onClick={() => handleReject(v.id)} disabled={processingId === v.id} className="rounded-xl bg-red-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {total > 20 && (
              <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl bg-[#1a1a1a] px-3 sm:px-4 py-2 text-xs sm:text-sm text-white disabled:opacity-50">Prev</button>
                <span className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-400">Page {page} of {Math.ceil(total / 20)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="rounded-xl bg-[#1a1a1a] px-3 sm:px-4 py-2 text-xs sm:text-sm text-white disabled:opacity-50">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {showUserPopup && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowUserPopup(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#121212] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">User Details</h3>
            
            {/* Basic Info */}
            <div className="mb-4 rounded-xl bg-[#1a1a1a] p-4">
              <h4 className="mb-3 text-sm font-semibold text-[#D4AF37]">Basic Information</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-white font-medium">{userDetails.user?.email || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-white font-medium">{userDetails.user?.name || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Mobile</p>
                  <p className="text-white font-medium">{userDetails.user?.mobile || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Referral Code</p>
                  <p className="text-[#D4AF37] font-mono font-bold">{userDetails.user?.referralcode}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Telegram Name</p>
                  <p className="text-white font-medium">{userDetails.user?.telegramname || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Telegram Username</p>
                  <p className="text-white font-medium">@{userDetails.user?.telegramusername || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Telegram Chat ID</p>
                  <p className="text-white font-mono text-xs">{userDetails.user?.telegramchatid || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3">
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-block rounded-lg px-2 py-1 text-xs ${userDetails.user?.isblocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {userDetails.user?.isblocked ? 'Blocked' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* UPI Accounts */}
            <div className="mb-4 rounded-xl bg-[#1a1a1a] p-4">
              <h4 className="mb-3 text-sm font-semibold text-[#D4AF37]">UPI Accounts ({userDetails.upiAccounts?.length || 0})</h4>
              {userDetails.upiAccounts?.length > 0 ? (
                <div className="space-y-2">
                  {userDetails.upiAccounts?.map((upi, i) => (
                    <div key={i} className="rounded-lg bg-[#0a0a0a] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium">{upi.upiid}</p>
                        <div className="flex gap-2">
                          <span className={`rounded-lg px-2 py-1 text-xs ${upi.isprimary ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {upi.isprimary ? 'Primary' : 'Secondary'}
                          </span>
                          <span className={`rounded-lg px-2 py-1 text-xs ${upi.isactive || upi.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {upi.isactive || upi.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-gray-500">No UPI accounts linked</p>
              )}
            </div>

            {/* UPI Verifications (Pending) */}
            <div className="mb-4 rounded-xl bg-[#1a1a1a] p-4">
              <h4 className="mb-3 text-sm font-semibold text-[#D4AF37]">UPI Verifications ({userDetails.upiVerifications?.length || 0})</h4>
              {userDetails.upiVerifications?.length > 0 ? (
                <div className="space-y-2">
                  {userDetails.upiVerifications?.map((v, i) => (
                    <div key={i} className="rounded-lg bg-[#0a0a0a] p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{v.upiid}</p>
                          <p className="text-xs text-gray-500">{v.createdat ? new Date(v.createdat).toLocaleDateString() : ''}</p>
                        </div>
                        <span className={`rounded-lg px-2 py-1 text-xs ${
                          v.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400' : 
                          v.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' : 
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {v.status || 'PENDING'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-gray-500">No pending verifications</p>
              )}
            </div>

            {/* Bank Accounts */}
            <div className="mb-4 rounded-xl bg-[#1a1a1a] p-4">
              <h4 className="mb-3 text-sm font-semibold text-[#D4AF37]">Bank Accounts ({userDetails.bankAccounts?.length || 0})</h4>
              {userDetails.bankAccounts?.length > 0 ? (
                <div className="space-y-2">
                  {userDetails.bankAccounts?.map((bank, i) => (
                    <div key={i} className="rounded-lg bg-[#0a0a0a] p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{bank.holdername}</p>
                          <p className="text-xs text-gray-400">{bank.bankname} - ****{bank.accountnumber?.slice(-4)}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`rounded-lg px-2 py-1 text-xs ${bank.isprimary ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {bank.isprimary ? 'Primary' : 'Secondary'}
                          </span>
                          <span className={`rounded-lg px-2 py-1 text-xs ${bank.isactive || bank.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {bank.isactive || bank.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-gray-500">No bank accounts linked</p>
              )}
            </div>

            {/* Wallet */}
            <div className="rounded-xl bg-[#1a1a1a] p-4">
              <h4 className="mb-3 text-sm font-semibold text-[#D4AF37]">Wallet Balance</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-[#0a0a0a] p-3 text-center">
                  <p className="text-xs text-gray-500">INR</p>
                  <p className="text-lg font-bold text-green-400">₹{parseFloat(userDetails.wallet?.inrbalance || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3 text-center">
                  <p className="text-xs text-gray-500">USDT</p>
                  <p className="text-lg font-bold text-blue-400">${parseFloat(userDetails.wallet?.usdtbalance || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-[#0a0a0a] p-3 text-center">
                  <p className="text-xs text-gray-500">Token</p>
                  <p className="text-lg font-bold text-purple-400">{parseFloat(userDetails.wallet?.tokenbalance || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <button onClick={() => setShowUserPopup(false)} className="mt-4 w-full rounded-xl bg-[#1a1a1a] py-3 text-white hover:bg-[#252525]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUpiVerifications;
