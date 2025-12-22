import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPaystackPayment } from '../api';

export default function PaystackCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState<string>('Verifying your payment…');

  const notifyOpener = (payload: any) => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'RAMANICAVE_PAYSTACK_VERIFIED', ...payload }, window.location.origin);
      }
    } catch {
      // ignore
    }
    try {
      window.localStorage.setItem('ramanicave_paystack_verified', JSON.stringify({ ...payload, ts: Date.now() }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference');

    if (!reference) {
      setStatus('error');
      setMessage('Missing payment reference.');
      return;
    }

    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

    const run = async () => {
      // Paystack can be eventually consistent for a few seconds even after "success".
      // Also, the backend may return 202 while waiting for paid_at.
      const delays = [800, 1200, 2000, 3000, 4000];

      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (cancelled) return;
        try {
          setStatus('verifying');
          setMessage(attempt === 0 ? 'Verifying your payment…' : `Finalizing payment… (attempt ${attempt + 1}/${delays.length})`);

          const resp = await verifyPaystackPayment(reference);
          const planId = resp.data?.plan_id;
          if (cancelled) return;

          setStatus('success');
          setMessage('Payment verified. Finishing up…');
          notifyOpener({ reference, planId: planId ? String(planId) : null });
          window.setTimeout(() => {
            try {
              window.close();
            } catch {
              // ignore
            }
            // If the browser blocks close(), provide a sane fallback.
            if (planId) {
              navigate(`/plans/${planId}`);
            } else {
              navigate('/purchases');
            }
          }, 700);
          return;
        } catch (err: any) {
          if (cancelled) return;

          const httpStatus: number | undefined = err?.response?.status;
          const serverMsg: string | undefined = err?.response?.data?.message;

          // If auth expired, send user to login; refresh flow may not be available on callback.
          if (httpStatus === 401) {
            setStatus('error');
            setMessage('Please sign in again to complete verification.');
            window.setTimeout(() => {
              navigate('/login');
            }, 900);
            return;
          }

          // Retry on "not completed yet" (202), rate limiting, or transient server errors.
          const shouldRetry =
            httpStatus === 202 ||
            httpStatus === 429 ||
            (typeof httpStatus === 'number' && httpStatus >= 500);

          if (shouldRetry && attempt < delays.length - 1) {
            setStatus('verifying');
            setMessage(serverMsg || 'Payment is being confirmed…');
            await sleep(delays[attempt]);
            continue;
          }

          setStatus('error');
          setMessage(serverMsg || 'Payment verification failed. If you just paid, please wait a moment and retry.');
          return;
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-teal-50/20 px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-lg w-full">
        <p className="text-xs tracking-[0.35em] uppercase text-gray-500">PAYMENT</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Paystack Callback</h1>
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-700' : 'text-gray-700'}`}>{message}</p>
        {status === 'success' ? (
          <div className="mt-6">
            <p className="text-xs text-gray-500">You can close this tab if it doesn't close automatically.</p>
          </div>
        ) : null}
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
