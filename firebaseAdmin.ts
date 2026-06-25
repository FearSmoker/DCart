import admin from "firebase-admin";
import { getApps } from "firebase-admin/app";
import fs from "fs";

let serviceAccount: Record<string, unknown> | null = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    // If it looks like a file path, read the file
    if (raw.trim().startsWith("/") || raw.trim().startsWith(".")) {
      const fileContent = fs.readFileSync(raw.trim(), "utf-8");
      serviceAccount = JSON.parse(fileContent);
    } else {
      // Otherwise treat it as a raw JSON string
      serviceAccount = JSON.parse(raw);
    }
  }
} catch (error) {
  console.warn("Could not load FIREBASE_SERVICE_ACCOUNT_KEY:", error);
}

if (serviceAccount && !getApps().length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "dcart-a994e.appspot.com",
  });
}

let adminDB: admin.firestore.Firestore;
if (getApps().length) {
  adminDB = admin.firestore();
} else {
  adminDB = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => ({}) }),
        set: async () => {},
        update: async () => {},
        collection: () => ({
          doc: () => ({
            get: async () => ({ exists: false, data: () => ({}) }),
            set: async () => {},
          }),
          where: () => ({
            get: async () => ({ docs: [] }),
          }),
        }),
      }),
      get: async () => ({ docs: [] }),
    }),
  } as unknown as admin.firestore.Firestore;
}

export { adminDB };
