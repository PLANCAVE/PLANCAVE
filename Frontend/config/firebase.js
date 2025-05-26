// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
// Only import analytics for client-side
let analytics = null;

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAD3HqDFrpGKPOAb_urWcC5_TFUWRxld5I",
  authDomain: "the-plan-cave-c6137.firebaseapp.com",
  projectId: "the-plan-cave-c6137",
  storageBucket: "the-plan-cave-c6137.firebasestorage.app",
  messagingSenderId: "950400976009",
  appId: "1:950400976009:web:a9ab45fb9f98f728453258",
  measurementId: "G-CY1L5WM4WN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const storage = getStorage(app);

// Initialize analytics only on client side
if (typeof window !== 'undefined') {
  // Import analytics dynamically to avoid server-side issues
  import('firebase/analytics').then(({ getAnalytics }) => {
    analytics = getAnalytics(app);
  }).catch(error => {
    console.error('Analytics failed to load:', error);
  });
}

export { app, storage, analytics };