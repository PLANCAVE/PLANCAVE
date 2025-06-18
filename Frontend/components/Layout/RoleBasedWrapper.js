"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';

const RoleBasedWrapper = ({ children, allowedRoles = ['customer', 'admin'] }) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Check if user is authenticated
        const session = await getSession();
        
        if (!session || !session.user) {
          router.push('/login');
          return;
        }

        // Get user role from session or make API call
        let role = session.user.role;
        
        // If role is not in session, fetch from API
        if (!role) {
          const token = localStorage.getItem('token') || session.accessToken;
          const response = await fetch('/api/user/profile', {
            headers: { 
              Authorization: `Bearer ${token}` 
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            role = userData.role;
          }
        }

        setUserRole(role);

        // Check if user role is in allowed roles
        if (allowedRoles.includes(role)) {
          setIsAuthorized(true);
        } else {
          // Redirect based on role
          if (role === 'admin') {
            router.push('/dashboard/admin');
          } else if (role === 'customer') {
            router.push('/dashboard/customer');
          } else {
            router.push('/unauthorized');
          }
        }
      } catch (error) {
        console.error('Access check error:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [router, allowedRoles]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Clone children and pass userRole as prop
  return typeof children === 'function' 
    ? children(userRole) 
    : children;
};

export default RoleBasedWrapper;