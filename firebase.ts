import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "",
  authDomain: "dcart-a994e.firebaseapp.com",
  projectId: "dcart-a994e",
  storageBucket: "dcart-a994e.appspot.com",
  messagingSenderId: "",
  appId: "",
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
