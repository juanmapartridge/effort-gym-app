export type UserRole = 'admin' | 'coach' | 'athlete';

export type SetType = 'warmup' | 'working';

export type ExerciseTier = 'Básico' | 'Secundario' | 'Auxiliar';
export type BodyZone = 'HEMISFERIO SUPERIOR' | 'HEMISFERIO INFERIOR' | 'ZONA MEDIA';

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
  exerciseTier?: ExerciseTier;
  bodyZone?: BodyZone;
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
  exerciseTier?: ExerciseTier;
  bodyZone?: BodyZone;
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
  effectiveReps?: number;
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
  exerciseTier?: ExerciseTier;
  bodyZone?: BodyZone;
  sets: LoggedSet[];
  // Métricas pre-calculadas al guardar para alimentar gráficos sin costo de cómputo
  metrics: {
    totalVolumeKg: number;
    maxWeightKg: number;
    estimated1RM: number;
    averageRpe: number;
    totalEffectiveReps?: number;
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
  // Nuevas variables estadísticas de Effort Gym:
  preWorkoutRecovery?: number; // Escala 1 al 10 registrada antes de iniciar (1 = baja, 10 = alta recuperación)
  sessionRpe?: number;         // Escala 1 al 10 registrada al finalizar (cuán dura resultó la sesión)
  totalEffectiveReps?: number; // Sumatoria de repeticiones efectivas en series de RIR <= 4
  exercises: LoggedExercise[];
}

/**
 * CÁLCULO DE REPETICIONES EFECTIVAS (Regla científica Effort Gym):
 * - Las repeticiones efectivas son siempre con series de RIR 4 o menos.
 * - Si RIR > 4 -> 0 repeticiones efectivas.
 * - RIR 4 -> 1 repetición efectiva.
 * - RIR 3 -> 2 repeticiones efectivas.
 * - RIR 2 -> 3 repeticiones efectivas.
 * - RIR 1 -> 4 repeticiones efectivas.
 * - RIR 0 -> 5 repeticiones efectivas (las últimas 5 antes del fallo).
 */
export function calculateEffectiveReps(reps: number, rir?: number, rpe?: number): number {
  if (reps <= 0) return 0;
  const effectiveRir = rir !== undefined ? rir : (rpe !== undefined ? Math.max(0, 10 - rpe) : 5);
  if (effectiveRir > 4) return 0;
  const theoreticalEffective = 5 - Math.max(0, Math.floor(effectiveRir));
  return Math.min(reps, Math.max(0, theoreticalEffective));
}

/**
 * Infiere o normaliza la zona corporal principal de un ejercicio
 */
export function inferBodyZone(muscleGroup: string): BodyZone {
  const mg = (muscleGroup || '').toUpperCase();
  if (
    mg.includes('SUPERIOR') ||
    mg.includes('PECHO') ||
    mg.includes('ESPALDA') ||
    mg.includes('HOMBRO') ||
    mg.includes('BRAZO') ||
    mg.includes('TRICEPS') ||
    mg.includes('BICEPS')
  ) {
    return 'HEMISFERIO SUPERIOR';
  }
  if (
    mg.includes('INFERIOR') ||
    mg.includes('PIERNA') ||
    mg.includes('CUADRICEPS') ||
    mg.includes('ISQUIO') ||
    mg.includes('GLUTE') ||
    mg.includes('CADERA') ||
    mg.includes('RODILLA') ||
    mg.includes('TOBILLO')
  ) {
    return 'HEMISFERIO INFERIOR';
  }
  return 'ZONA MEDIA';
}

/**
 * Infiere el tipo de ejercicio (Básico, Secundario o Auxiliar)
 */
export function inferExerciseTier(
  name: string,
  muscleGroup: string,
  equipment?: string
): ExerciseTier {
  const n = (name || '').toUpperCase();
  const mg = (muscleGroup || '').toUpperCase();

  // BÁSICOS: Grandes levantamientos multiarticulares
  if (
    n.includes('SQUAT') ||
    n.includes('SENTADILLA') ||
    n.includes('BANCO PLANO') ||
    n.includes('BENCH PRESS') ||
    n.includes('PESO MUERTO') ||
    n.includes('DEADLIFT') ||
    n.includes('DOMINADAS') ||
    n.includes('PRESS MILITAR') ||
    n.includes('MILITARY') ||
    (n.includes('HIP THRUST') && equipment === 'Barra')
  ) {
    return 'Básico';
  }

  // AUXILIARES: Aislamientos, brazos, gemelos, movilidad, core estático
  if (
    mg.startsWith('MOVILIDAD') ||
    n.includes('VUELOS') ||
    n.includes('LATERAL') ||
    n.includes('CURL') ||
    n.includes('TRICEPS') ||
    n.includes('BICEPS') ||
    n.includes('PANTORRILLA') ||
    n.includes('TOBILLERA') ||
    n.includes('ROTATORY') ||
    n.includes('PLANCK') ||
    n.includes('PLANCHA')
  ) {
    return 'Auxiliar';
  }

  // SECUNDARIOS: Ejercicios complementarios multiarticulares / máquinas
  return 'Secundario';
}

/**
 * Fórmula de Variación Porcentual: (Valor Final - Valor Inicial) / Valor Inicial * 100
 */
export function calculatePercentageVariation(
  finalValue: number,
  initialValue: number
): number {
  if (initialValue <= 0) return 0;
  return Math.round(((finalValue - initialValue) / initialValue) * 1000) / 10;
}
