import React from 'react';
import '../styles/globals.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../styles/Navbar.css';
import '../styles/GridSection.css';
import '../styles/FamilySize.css';
import '../styles/BudgetPlans.css';
import '../styles/TopSellingPlans.css';
import '../styles/BlogSection.css';
import { ClerkProvider } from '@clerk/nextjs';
import '../styles/ContactUs.css';
import '../styles/ProductCard.module.css';
import { AppProvider } from '../context/AppContext';
import { CartProvider } from '../context/CartContext';



function MyApp({ Component, pageProps }) {
  return (
    <ClerkProvider publishableKey="pk_test_dXNhYmxlLW1vbGx1c2stNTQuY2xlcmsuYWNjb3VudHMuZGV2JA">
      <AppProvider>
        <CartProvider>
          <Component {...pageProps} /> 
         
        </CartProvider>
      </AppProvider>
    </ClerkProvider>
  );
}

export default MyApp;