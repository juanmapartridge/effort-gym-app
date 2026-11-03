import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  writeBatch,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { RoutineTemplate, UserRoutine, WorkoutSession } from '../types/models';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
  } catch (err) {
    console.warn('Error inicializando Firebase, operando en modo Local/Demo:', err);
  }
}

/**
 * Sincroniza de forma atómica (1 solo Batch de red) la sesión finalizada y
 * actualiza `lastSessionSets` en la rutina del alumno para el próximo entrenamiento.
 */
export async function syncWorkoutCompletionToFirestore(
  session: WorkoutSession,
  updatedUserRoutine: UserRoutine
): Promise<{ synced: boolean; mode: 'firebase' | 'local_demo' }> {
  if (!db || !isFirebaseConfigured) {
    return { synced: true, mode: 'local_demo' };
  }

  try {
    const batch = writeBatch(db);
    const sessionRef = doc(db, 'workout_sessions', session.id);
    const routineRef = doc(db, 'user_routines', updatedUserRoutine.id);

    batch.set(sessionRef, session);
    batch.set(routineRef, updatedUserRoutine, { merge: true });

    await batch.commit();
    return { synced: true, mode: 'firebase' };
  } catch (error) {
    console.warn('Guardado local exitoso; pendiente sincronización Firebase:', error);
    return { synced: false, mode: 'local_demo' };
  }
}

export async function syncUserRoutineToFirestore(userRoutine: UserRoutine): Promise<void> {
  if (!db || !isFirebaseConfigured) return;
  try {
    await setDoc(doc(db, 'user_routines', userRoutine.id), userRoutine, { merge: true });
  } catch (error) {
    console.warn('Error sincronizando user_routine en Firestore:', error);
  }
}

export async function syncTemplateToFirestore(template: RoutineTemplate): Promise<void> {
  if (!db || !isFirebaseConfigured) return;
  try {
    await setDoc(doc(db, 'routine_templates', template.id), template, { merge: true });
  } catch (error) {
    console.warn('Error sincronizando routine_template en Firestore:', error);
  }
}

