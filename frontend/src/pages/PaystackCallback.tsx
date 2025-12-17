import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPaystackPayment } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function PaystackCallback() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState<string>('Verifying your payment…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || localStorage.getItem('pending_paystack_reference');

    if (!reference) {
      setStatus('error');
      setMessage('Missing payment reference.');
      return;
    }

    // If the user is not logged in, stash the reference and send them to login.
    if (!isAuthenticated) {
      localStorage.setItem('pending_paystack_reference', reference);
      navigate('/login');
      return;
    }

    localStorage.removeItem('pending_paystack_reference');

    const run = async () => {
      try {
        const resp = await verifyPaystackPayment(reference);
        const planId = resp.data?.plan_id;
        setStatus('success');
        setMessage('Payment verified. Redirecting…');
        window.setTimeout(() => {
          if (planId) {
            navigate(`/plans/${planId}`);
          } else {
            navigate('/purchases');
          }
        }, 800);
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Payment verification failed. If you just paid, please wait a moment and refresh.';
        setStatus('error');
        setMessage(msg);
      }
    };

    run();
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-teal-50/20 px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-lg w-full">
        <p className="text-xs tracking-[0.35em] uppercase text-gray-500">PAYMENT</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Paystack Callback</h1>
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-700' : 'text-gray-700'}`}>{message}</p>
        {status === 'error' ? (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate('/purchases')}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
            >
              Go to Purchases
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
