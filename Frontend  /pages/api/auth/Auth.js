import React from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';
import { useRouter } from 'next/router';

const AuthPage = () => {
  const router = useRouter();
  const { auth } = router.query; // Get the catch-all parameter

  // Determine which form to render based on the URL
  const isSignIn = auth?.[0] === 'signin';
  const isSignUp = auth?.[0] === 'signup';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
      }}
    >
      {isSignIn && (
        <>
          <h1
            style={{
              color: '#333',
              fontSize: '2.5rem',
              fontFamily: 'Arial, sans-serif',
              marginBottom: '1rem',
            }}
          >
            Sign In Here
          </h1>
          <SignIn
            routing="path"
            path="/auth/signin"
            signUpUrl="/auth/signup" // Redirect to Sign Up page
            appearance={{
              variables: {
                colorPrimary: '#007BFF',
                fontFamily: 'Arial, sans-serif',
              },
            }}
          />
        </>
      )}
      {isSignUp && (
        <>
          <h1
            style={{
              color: '#333',
              fontSize: '2.5rem',
              fontFamily: 'Arial, sans-serif',
              marginBottom: '1rem',
            }}
          >
            Sign Up Here
          </h1>
          <SignUp
            routing="path"
            path="/auth/signup"
            signInUrl="/auth/signin" // Redirect to Sign In page
            appearance={{
              variables: {
                colorPrimary: '#007BFF',
                fontFamily: 'Arial, sans-serif',
              },
            }}
          />
        </>
      )}
    </div>
  );
};

export default AuthPage;
