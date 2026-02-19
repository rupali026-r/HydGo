import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDaM4czCTbuGcOxCcTuMQQgv2xI9DbWHR0",
  authDomain: "hydgo-3c94d.firebaseapp.com",
  projectId: "hydgo-3c94d",
  storageBucket: "hydgo-3c94d.firebasestorage.app",
  messagingSenderId: "14857040441",
  appId: "1:14857040441:web:1f1d95632b62f9b3f293e8",
  measurementId: "G-1ZVYPX9TR7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
