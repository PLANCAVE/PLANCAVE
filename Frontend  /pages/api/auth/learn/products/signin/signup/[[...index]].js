// pages/signup.js
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        textAlign: 'center',
        backgroundColor: 'white',
      }}
    >
      <h1
        style={{
          color: '#010736',
          fontSize: '2.5rem',
          fontFamily: 'Barlow, sans-serif',
          marginBottom: '1rem',
        }}
      >
        Sign Up Here
      </h1>
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/signin" // Redirect to custom Sign In page
        appearance={{
          variables: {
            colorPrimary: '#007BFF',
            colorBackground: '#ffffff',
            colorText: '#020a3b',
            fontFamily: 'Barlow, sans-serif',
            borderRadius: '8px',
            spacingUnit: '12px',
          },
          layout: {
            logoPlacement: 'none',
            showOptionalFields: false,
          },
          elements: {
            card: 'box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); padding: 20px;',
            formFieldInput: 'border: 1px solid #007BFF; padding: 10px;',
            formButtonPrimary: 'background-color: #007BFF; color: white;',
          },
        }}
      />
    </div>
  );
}
