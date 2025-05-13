
import React from 'react';
import Dashboard from '../components/admin/Dashboard';

export default function AdminPage() {
  return <Dashboard />;
}

// Server-side authentication check
export async function getServerSideProps(context) {
  // Parse cookies (manual parsing, no dependency)
  const cookies = context.req.headers.cookie
    ?.split(';')
    .map(v => v.split('='))
    .reduce((acc, [key, val]) => {
      acc[key.trim()] = decodeURIComponent(val);
      return acc;
    }, {}) || {};
  const token = cookies.token;

  // If no token, redirect to adminLogin with callback
  if (!token) {
    return {
      redirect: {
        destination: `/adminLogin?callbackUrl=/admin`,
        permanent: false,
      },
    };
  }

  // Optionally, verify the token and check for admin role here

  return { props: {} };
}
