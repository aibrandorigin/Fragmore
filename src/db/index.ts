import 'dotenv/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';
import { createFirestoreDrizzleDb, invalidateFirestoreCollectionCache } from './firestoreDrizzle.ts';
import { FIRESTORE_DATABASE_ID, FIREBASE_PROJECT_ID } from '../lib/firebase-admin.ts';

export const CLOUD_SQL_DISABLED = true;
export const ACTIVE_DATABASE_PROVIDER = 'Firebase Firestore';
export const ACTIVE_FIREBASE_PROJECT = FIREBASE_PROJECT_ID;
export const ACTIVE_FIRESTORE_DATABASE = FIRESTORE_DATABASE_ID;

declare global {
  var _firestoreDrizzleDb: NodePgDatabase<typeof schema> | undefined;
}

if (!global._firestoreDrizzleDb) {
  global._firestoreDrizzleDb = createFirestoreDrizzleDb(schema) as unknown as NodePgDatabase<typeof schema>;
}

export const db: NodePgDatabase<typeof schema> = global._firestoreDrizzleDb;
export { invalidateFirestoreCollectionCache };


