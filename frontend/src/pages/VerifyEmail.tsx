import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }

      setStatus('loading');
      setMessage('Verifying your email...');
      try {
        const resp = await verifyEmail(token);
        setStatus('success');
        setMessage(resp.data?.message || 'Email verified successfully.');
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to verify email.';
        setStatus('error');
        setMessage(msg);
      }
    };

    run();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-2xl font-bold text-center mb-2">Verify Email</h1>
          <p className="text-center text-gray-600 mb-6">{message}</p>

          {status === 'loading' ? (
            <div className="w-full btn-primary opacity-50 cursor-not-allowed text-center">Verifying...</div>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-3">
              <Link to="/login" className="w-full btn-primary block text-center">
                Continue to Login
              </Link>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="space-y-3">
              <Link to="/login" className="w-full btn-primary block text-center">
                Back to Login
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
