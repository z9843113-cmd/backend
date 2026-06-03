import { useState, useEffect } from 'react';
import { depositAPI, walletAPI, userAPI } from '../services/api';

const RequestStatusModal = ({ isOpen, onClose, type, requestId, title }) => {
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!isOpen || !requestId) return;

    const checkStatus = async () => {
      try {
        let data;
        if (type === 'DEPOSIT') {
          const res = await depositAPI.getHistory();
          const request = res.data?.find(d => d.id === requestId);
          if (request) setStatus(request.status);
        } else if (type === 'JTOKEN') {
          const res = await walletAPI.getJTokenHistory();
          const request = res.data?.find(d => d.id === requestId);
          if (request) setStatus(request.status);
        } else if (type === 'WITHDRAWAL') {
          const res = await walletAPI.getWithdrawalHistory();
          const request = res.data?.find(w => w.id === requestId);
          if (request) setStatus(request.status);
        } else if (type === 'EXCHANGE') {
          const res = await userAPI.getMyExchangeRequests();
          const request = res.data?.requests?.find(e => e.id === requestId);
          if (request) setStatus(request.status);
        }
      } catch (error) {
        console.error('Error checking status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1500);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => prev > 0 ? prev - 1 : 10);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, [isOpen, requestId, type]);

  useEffect(() => {
    if (status === 'APPROVED' || status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELLED') {
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    }
  }, [status, onClose]);

  if (!isOpen) return null;

  const getStatusColor = () => {
    if (status === 'APPROVED' || status === 'COMPLETED') return 'text-emerald-400';
    if (status === 'REJECTED' || status === 'CANCELLED') return 'text-red-400';
    return 'text-yellow-400';
  };

  const getStatusMessage = () => {
    if (status === 'APPROVED' || status === 'COMPLETED') return '✅ Request Approved!';
    if (status === 'REJECTED' || status === 'CANCELLED') return '❌ Request Rejected';
    if (status === 'WAITING_ADMIN') return '⏳ Wait for Orders';
    if (status === 'READY_TO_PAY') return '💳 Ready to Pay';
    if (status === 'PAYMENT_STARTED') return '🔄 Payment Started';
    if (status === 'PAYMENT_SUBMITTED') return '📤 Payment Submitted';
    return '⏳ Waiting for approval...';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#D4AF37]/30 bg-[#0d0d0d] p-6 text-center">
        <div className="mb-4 flex justify-center">
          {status === 'PENDING' ? (
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent"></div>
          ) : status === 'APPROVED' || status === 'COMPLETED' ? (
            <div className="h-16 w-16 rounded-full bg-emerald-400/20 flex items-center justify-center">
              <svg className="h-10 w-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full bg-red-400/20 flex items-center justify-center">
              <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
        
        <p className={`mb-4 text-lg font-semibold ${getStatusColor()}`}>
          {getStatusMessage()}
        </p>

        {(status === 'PENDING' || status === 'WAITING_ADMIN') && (
          <>
            <p className="mb-4 text-sm text-gray-400">
              {status === 'WAITING_ADMIN' ? 'Admin will assign payment details soon...' : 'Admin will approve your request soon...'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-700">
                <div 
                  className="h-full animate-pulse bg-yellow-400"
                  style={{ width: `${((10 - countdown) / 10) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-500">{countdown}s</span>
            </div>
          </>
        )}

        {status !== 'PENDING' && (
          <p className="text-sm text-gray-400">Page will refresh automatically...</p>
        )}
      </div>
    </div>
  );
};

export default RequestStatusModal;
