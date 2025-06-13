// hooks/session.js
import { useEffect, useState } from 'react';

// Synchronous session check (for non-React code)
export const getSession = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) return { user: null, token: null };

  try {
    // Decode token to get basic user info without API call
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      user: {
        id: payload.sub,
        username: payload.username,
        email: payload.email,
        role: payload.role
      },
      token
    };
  } catch (error) {
    localStorage.removeItem('accessToken');
    return { user: null, token: null };
  }
};

// React hook for components that need reactive session updates
export const useSession = () => {
  const [session, setSession] = useState(() => getSession());
  const [loading, setLoading] = useState(!!session.token);

  useEffect(() => {
    // Only verify with backend if we have a token
    if (!session.token) return;

    fetch('/me', {
      headers: { Authorization: `Bearer ${session.token}` },
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(user => {
        setSession({ user, token: session.token });
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        setSession({ user: null, token: null });
        setLoading(false);
      });
  }, [session.token]);

  return { ...session, loading };
};