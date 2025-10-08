// Firebase initialization using compat bundle loaded from script tag
// Access firebase from global window object
const firebase = window.firebase;

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCIxAQ9WyFWc6VYSGsEwu10EfRiExu9uFU",
    authDomain: "function-67015.firebaseapp.com",
    projectId: "function-67015",
    storageBucket: "function-67015.firebasestorage.app",
    appId: "1:819816062098:web:5acf3fb43db1d859c71a4a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// Export wrappers to match the modular API expected by newtab.js
export { 
    auth, 
    db, 
    provider
};

// Export functions that wrap compat API to match modular API
export const signInWithPopup = (authInstance, providerInstance) => authInstance.signInWithPopup(providerInstance);
export const signOut = (authInstance) => authInstance.signOut();
export const onAuthStateChanged = (authInstance, callback) => authInstance.onAuthStateChanged(callback);

// Firestore function wrappers
export const collection = (dbInstance, path) => dbInstance.collection(path);
export const doc = (dbInstance, ...pathSegments) => {
    if (typeof dbInstance.collection === 'function') {
        // Called as doc(db, 'collection', 'docId')
        return dbInstance.collection(pathSegments[0]).doc(pathSegments.slice(1).join('/'));
    } else {
        // Called as doc(collectionRef, 'docId')
        return dbInstance.doc(pathSegments.join('/'));
    }
};

export const setDoc = async (docRef, data) => await docRef.set(data);
export const getDoc = async (docRef) => {
    const snapshot = await docRef.get();
    return { 
        exists: () => snapshot.exists,
        data: () => snapshot.data() 
    };
};
export const getDocs = async (collectionRef) => {
    const snapshot = await collectionRef.get();
    return { 
        forEach: (callback) => snapshot.forEach(doc => callback({ data: () => doc.data() }))
    };
};
export const onSnapshot = (ref, callback) => ref.onSnapshot(callback);
export const deleteDoc = async (docRef) => await docRef.delete();
export const query = (collectionRef, ...queryConstraints) => collectionRef;
export const where = (field, operator, value) => ({ field, operator, value });
export const updateDoc = async (docRef, data) => await docRef.update(data);
