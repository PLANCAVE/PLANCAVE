import React from 'react';
import { SignIn, _SignUp } from '@clerk/nextjs';

const Login = () => {
    return (
        <div style={{ display: 'absolute', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <SignIn path="/login" routing="path" signUpUrl="/sign-up" />
        </div>
    );
};

export default Login;
