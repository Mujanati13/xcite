// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v9-compat and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBBNf5XUzg1P165KkyAOGVUfJMl3Xn7v-0",
  authDomain: "xcite-fca6c.firebaseapp.com",
  projectId: "xcite-fca6c",
  storageBucket: "xcite-fca6c.firebasestorage.app",
  messagingSenderId: "327413887126",
  appId: "1:327413887126:web:7ce46ea028396bbd7a12b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
