export type UserRole = 'admin' | 'coach' | 'athlete';

export type SetType = 'warmup' | 'working';

export interface GymTenant {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  isActive: boolean;
}

export interface GymUser {
  id: string;
  gymId: string;
  role: UserRole;
  displayName: string;
  email: string;
  activeUserRoutineId?: string;
}

export interface ExerciseCatalogItem {
  id: string;
  originalId?: string;
  gymId: string; // 'GLOBAL' o gymId específico ('gym_effort')
  name: string;
  muscleGroup: string; // Categorías reales de Effort Gym: 'HEMISFERIO SUPERIOR', 'HEMISFERIO INFERIOR', 'ZONA MEDIA', etc.
  equipment: 'Barra' | 'Mancuernas' | 'Máquina' | 'Polea' | 'Peso Corporal';
  videoUrl?: string;
}

export interface PreviousSetSnapshot {
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number;
}

export interface RoutineExerciseItem {
  order: number;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: string; // ej. "6-8"
  targetRpe: number;  // ej. 8
  targetRir?: number; // ej. 2 (RIR = 10 - targetRpe)
  restSeconds: number; // Pausa fijada por los profesores (ej. 90s)
  blockType?: 'warmup' | 'main'; // 'warmup' (Entrada en calor) | 'main' (Bloque principal)
  coachNotes?: string;
  videoUrl?: string;
  // Desnormalizado en user_routines para autocompletado instantáneo (0 lecturas extra)
  lastSessionSets?: PreviousSetSnapshot[];
}

export interface RoutineDay {
  dayId: string;
  name: string; // ej. "Día 1 - Hemisferio Superior + Zona Media"
  exercises: RoutineExerciseItem[];
}

export interface RoutineTemplate {
  id: string;
  gymId: string;
  createdBy: string;
  name: string;
  description: string;
  days: RoutineDay[];
  createdAt: string;
}

/**
 * Instancia / Copia independiente de una plantilla asignada a un atleta.
 * Si el atleta o profesor modifica esta rutina o se actualiza lastSessionSets,
 * la plantilla original (`RoutineTemplate`) permanece intacta.
 */
export interface UserRoutine {
  id: string;
  gymId: string;
  userId: string;
  assignedBy: string;
  sourceTemplateId: string;
  name: string;
  isActive: boolean;
  assignedAt: string;
  days: RoutineDay[];
}

export interface LoggedSet {
  id: string;
  setNumber: number;
  type: SetType;
  weight: number;
  reps: number;
  rpe: number;
  rir?: number;
  completed: boolean;
  // Valores de la sesión anterior para mostrar en columna "SESIÓN ANTERIOR" y autocompletar en 1 tap
  previousWeight?: number;
  previousReps?: number;
  previousRpe?: number;
}

export interface LoggedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  targetReps: string;
  targetRpe: number;
  targetRir?: number;
  restSeconds: number; // Pausa fijada por los profesores
  blockType?: 'warmup' | 'main';
  coachNotes?: string;
  videoUrl?: string;
  sets: LoggedSet[];
  // Métricas pre-calculadas al guardar para alimentar gráficos sin costo de cómputo
  metrics: {
    totalVolumeKg: number;
    maxWeightKg: number;
    estimated1RM: number;
    averageRpe: number;
  };
}

/**
 * OPTIMIZACIÓN LEAN MVP:
 * Consolidamos `workout_sessions` y `workout_logs` en un único documento `WorkoutSession`.
 * Ventaja: 1 sola escritura en Firestore por entrenamiento finalizado = 85% menos costo.
 */
export interface WorkoutSession {
  id: string;
  gymId: string;
  userId: string;
  athleteName: string;
  userRoutineId: string;
  dayId: string;
  dayName: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  totalVolumeKg: number;
  totalCompletedSets: number;
  averageSessionRpe: number;
  exercises: LoggedExercise[];
}
