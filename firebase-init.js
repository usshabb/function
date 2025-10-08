// Firebase initialization and configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, deleteDoc, query, where, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration using actual values from Replit secrets
const firebaseConfig = {
    apiKey: "AIzaSyCIxAQ9WyFWc6VYSGsEwu10EfRiExu9uFU",
    authDomain: "function-67015.firebaseapp.com",
    projectId: "function-67015",
    storageBucket: "function-67015.firebasestorage.app",
    appId: "1:819816062098:web:5acf3fb43db1d859c71a4a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, onSnapshot, deleteDoc, query, where, updateDoc };
