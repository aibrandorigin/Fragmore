import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let resolvedProjectId: string = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '';
let resolvedDatabaseId: string = process.env.FIREBASE_DATABASE_ID || '';

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!resolvedProjectId) resolvedProjectId = raw.projectId || '';
    if (!resolvedDatabaseId) resolvedDatabaseId = raw.firestoreDatabaseId || '';
  }
} catch {
  // ignore
}

if (!getApps().length) {
  initializeApp({
    projectId: resolvedProjectId || undefined,
  });
}

export const adminAuth = getAuth();
export const adminDb: Firestore = resolvedDatabaseId
  ? getFirestore(getApps()[0], resolvedDatabaseId)
  : getFirestore(getApps()[0]);
export const FIREBASE_PROJECT_ID = resolvedProjectId;
export const FIRESTORE_DATABASE_ID = resolvedDatabaseId || '(default)';

