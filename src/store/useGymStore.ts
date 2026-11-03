import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ExerciseCatalogItem,
  GymTenant,
  GymUser,
  LoggedExercise,
  LoggedSet,
  RoutineDay,
  RoutineExerciseItem,
  RoutineTemplate,
  UserRoutine,
  WorkoutSession,
} from '../types/models';
import {
  SEED_EXERCISES,
  SEED_GYMS,
  SEED_TEMPLATES,
  SEED_USERS,
  SEED_USER_ROUTINES,
  SEED_WORKOUT_SESSIONS,
} from '../data/seedData';
import {
  syncTemplateToFirestore,
  syncUserRoutineToFirestore,
  syncWorkoutCompletionToFirestore,
} from '../services/firebase';

export interface ActiveWorkoutDraft {
  userRoutineId: string;
  dayId: string;
  dayName: string;
  startedAtMs: number;
  exercises: LoggedExercise[];
  restTimerEndMs: number | null;
  activeRestDurationSec: number;
}

interface GymStoreState {
  // Datos Multi-tenant
  gyms: GymTenant[];
  users: GymUser[];
  exercisesCatalog: ExerciseCatalogItem[];
  templates: RoutineTemplate[];
  userRoutines: UserRoutine[];
  workoutSessions: WorkoutSession[];

  // Sesión / Tenant activo
  activeGymId: string;
  currentUserId: string;

  // Estado del Workout Logger en curso (Offline-First)
  activeWorkout: ActiveWorkoutDraft | null;
  lastSavedBanner: string | null;

  // Selectores Multi-tenant (Aislamiento estricto por gymId)
  setActiveTenantAndUser: (gymId: string, userId: string) => void;
  clearSavedBanner: () => void;

  // Acciones del Workout Logger ("Zero-Friction")
  startWorkoutDay: (userRoutine: UserRoutine, day: RoutineDay) => void;
  updateSetField: (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps' | 'rpe',
    value: number
  ) => void;
  toggleSetType: (exerciseIndex: number, setIndex: number) => void;
  toggleCompleteSet: (exerciseIndex: number, setIndex: number) => void;
  applyPreviousToSet: (exerciseIndex: number, setIndex: number) => void;
  addSetToExercise: (exerciseIndex: number) => void;
  removeSetFromExercise: (exerciseIndex: number, setIndex: number) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  skipRestTimer: () => void;
  finishActiveWorkout: () => Promise<WorkoutSession | null>;
  discardActiveWorkout: () => void;
  substituteExerciseInActiveWorkout: (exerciseIndex: number, newExerciseId: string) => void;

  // Acciones del Profesor / Coach (Planificación y Monitoreo)
  assignTemplateToAthlete: (templateId: string, athleteId: string) => UserRoutine | null;
  createMultiDayTemplate: (
    name: string,
    description: string,
    days: RoutineDay[]
  ) => RoutineTemplate | null;
  createAndAssignMultiDayTemplate: (
    name: string,
    description: string,
    days: RoutineDay[],
    athleteId: string
  ) => UserRoutine | null;
  updateAthleteRoutineExercise: (
    userRoutineId: string,
    dayId: string,
    exerciseId: string,
    updates: Partial<RoutineExerciseItem>
  ) => void;
  createAthleteInGym: (displayName: string, email: string) => GymUser | null;
  resetDemoData: () => void;
}

/**
 * Fórmula de Epley para estimar 1RM: Peso * (1 + Reps / 30)
 */
export function calculateEstimated1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function computeExerciseMetrics(sets: LoggedSet[]) {
  const completedWorkingSets = sets.filter((s) => s.completed && s.type === 'working');
  if (completedWorkingSets.length === 0) {
    return { totalVolumeKg: 0, maxWeightKg: 0, estimated1RM: 0, averageRpe: 0 };
  }

  let totalVolumeKg = 0;
  let maxWeightKg = 0;
  let best1RM = 0;
  let rpeSum = 0;

  for (const s of completedWorkingSets) {
    totalVolumeKg += s.weight * s.reps;
    if (s.weight > maxWeightKg) maxWeightKg = s.weight;
    const e1rm = calculateEstimated1RM(s.weight, s.reps);
    if (e1rm > best1RM) best1RM = e1rm;
    rpeSum += s.rpe;
  }

  return {
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    maxWeightKg,
    estimated1RM: best1RM,
    averageRpe: Math.round((rpeSum / completedWorkingSets.length) * 10) / 10,
  };
}

export const useGymStore = create<GymStoreState>()(
  persist(
    (set, get) => ({
      gyms: SEED_GYMS,
      users: SEED_USERS,
      exercisesCatalog: SEED_EXERCISES,
      templates: SEED_TEMPLATES,
      userRoutines: SEED_USER_ROUTINES,
      workoutSessions: SEED_WORKOUT_SESSIONS,

      activeGymId: 'gym_effort',
      currentUserId: 'usr_coach_1',
      activeWorkout: null,
      lastSavedBanner: null,

      setActiveTenantAndUser: (gymId, userId) => {
        set({ activeGymId: gymId, currentUserId: userId, lastSavedBanner: null });
      },

      clearSavedBanner: () => set({ lastSavedBanner: null }),

      startWorkoutDay: (userRoutine, day) => {
        const loggedExercises: LoggedExercise[] = day.exercises.map((ex) => {
          const defaultReps = parseInt(ex.targetReps.split('-')[0], 10) || 8;
          const sets: LoggedSet[] = Array.from({ length: ex.targetSets }).map((_, idx) => {
            const prev = ex.lastSessionSets?.[idx];
            const setRpe = prev ? prev.rpe : ex.targetRpe;
            return {
              id: `set_${ex.exerciseId}_${idx + 1}_${Date.now()}`,
              setNumber: idx + 1,
              type: 'working',
              // Zero-Friction: Autocompletamos con el peso y reps de la sesión anterior
              weight: prev ? prev.weight : 60,
              reps: prev ? prev.reps : defaultReps,
              rpe: setRpe,
              rir: Math.max(0, 10 - setRpe),
              completed: false,
              previousWeight: prev?.weight,
              previousReps: prev?.reps,
              previousRpe: prev?.rpe,
            };
          });

          const isWarmup =
            ex.blockType === 'warmup' ||
            ex.muscleGroup.toUpperCase().startsWith('MOVILIDAD') ||
            ex.muscleGroup.toUpperCase().includes('LUMBOPELVICA');

          return {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            targetReps: ex.targetReps,
            targetRpe: ex.targetRpe,
            targetRir: ex.targetRir ?? Math.max(0, 10 - ex.targetRpe),
            restSeconds: ex.restSeconds || 90,
            blockType: ex.blockType || (isWarmup ? 'warmup' : 'main'),
            coachNotes: ex.coachNotes,
            videoUrl: ex.videoUrl,
            sets,
            metrics: { totalVolumeKg: 0, maxWeightKg: 0, estimated1RM: 0, averageRpe: 0 },
          };
        });

        set({
          activeWorkout: {
            userRoutineId: userRoutine.id,
            dayId: day.dayId,
            dayName: day.name,
            startedAtMs: Date.now(),
            exercises: loggedExercises,
            restTimerEndMs: null,
            activeRestDurationSec: loggedExercises[0]?.restSeconds || 90,
          },
          lastSavedBanner: null,
        });
      },

      updateSetField: (exerciseIndex, setIndex, field, value) => {
        const current = get().activeWorkout;
        if (!current) return;

        const exercises = [...current.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        const updatedVal = Math.max(0, value);
        const targetSet = { ...sets[setIndex], [field]: updatedVal };
        if (field === 'rpe') {
          targetSet.rir = Math.max(0, 10 - updatedVal);
        }
        sets[setIndex] = targetSet;
        ex.sets = sets;
        ex.metrics = computeExerciseMetrics(sets);
        exercises[exerciseIndex] = ex;

        set({ activeWorkout: { ...current, exercises } });
      },

      toggleSetType: (exerciseIndex, setIndex) => {
        const current = get().activeWorkout;
        if (!current) return;

        const exercises = [...current.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        const currentType = sets[setIndex].type;
        sets[setIndex] = {
          ...sets[setIndex],
          type: currentType === 'working' ? 'warmup' : 'working',
        };
        ex.sets = sets;
        ex.metrics = computeExerciseMetrics(sets);
        exercises[exerciseIndex] = ex;

        set({ activeWorkout: { ...current, exercises } });
      },

      toggleCompleteSet: (exerciseIndex, setIndex) => {
        const current = get().activeWorkout;
        if (!current) return;

        const exercises = [...current.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        const willComplete = !sets[setIndex].completed;

        sets[setIndex] = {
          ...sets[setIndex],
          completed: willComplete,
        };
        ex.sets = sets;
        ex.metrics = computeExerciseMetrics(sets);
        exercises[exerciseIndex] = ex;

        const restSeconds = ex.restSeconds || 90;
        const restTimerEndMs = willComplete
          ? Date.now() + restSeconds * 1000
          : current.restTimerEndMs;

        set({
          activeWorkout: {
            ...current,
            exercises,
            restTimerEndMs,
            activeRestDurationSec: willComplete ? restSeconds : current.activeRestDurationSec,
          },
        });
      },

      applyPreviousToSet: (exerciseIndex, setIndex) => {
        const current = get().activeWorkout;
        if (!current) return;

        const exercises = [...current.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        const target = sets[setIndex];

        if (target.previousWeight !== undefined && target.previousReps !== undefined) {
          sets[setIndex] = {
            ...target,
            weight: target.previousWeight,
            reps: target.previousReps,
            rpe: target.previousRpe ?? ex.targetRpe,
          };
          ex.sets = sets;
          ex.metrics = computeExerciseMetrics(sets);
          exercises[exerciseIndex] = ex;
          set({ activeWorkout: { ...current, exercises } });
        }
      },

      addSetToExercise: (exerciseIndex) => {
        const current = get().activeWorkout;
        if (!current) return;

        const exercises = [...current.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const lastSet = ex.sets[ex.sets.length - 1];
        const nextSetNumber = ex.sets.length + 1;

        const newSet: LoggedSet = {
          id: `set_${ex.exerciseId}_${nextSetNumber}_${Date.now()}`,
          setNumber: nextSetNumber,
          type: 'working',
          weight: lastSet ? lastSet.weight : 60,
          reps: lastSet ? lastSet.reps : 8,
          rpe: lastSet ? lastSet.rpe : ex.targetRpe,
          completed: false,
          previousWeight: lastSet?.previousWeight,
          previousReps: lastSet?.previousReps,
          previousRpe: lastSet?.previousRpe,
        };

        ex.sets = [...ex.sets, newSet];
        exercises[exerciseIndex] = ex;

        set({ activeWorkout: { ...current, exercises } });
      },

      removeSetFromExercise: (exerciseIndex, setIndex) => {
        const current = get().activeWorkout;
        if (!current) return;

        const exercises = [...current.exercises];
        const ex = { ...exercises[exerciseIndex] };
        if (ex.sets.length <= 1) return;

        const filtered = ex.sets
          .filter((_, idx) => idx !== setIndex)
          .map((s, idx) => ({ ...s, setNumber: idx + 1 }));

        ex.sets = filtered;
        ex.metrics = computeExerciseMetrics(filtered);
        exercises[exerciseIndex] = ex;

        set({ activeWorkout: { ...current, exercises } });
      },

      adjustRestTimer: (deltaSeconds) => {
        const current = get().activeWorkout;
        if (!current || !current.restTimerEndMs) return;
        const newEnd = Math.max(Date.now() + 5000, current.restTimerEndMs + deltaSeconds * 1000);
        set({
          activeWorkout: {
            ...current,
            restTimerEndMs: newEnd,
          },
        });
      },

      skipRestTimer: () => {
        const current = get().activeWorkout;
        if (!current) return;
        set({ activeWorkout: { ...current, restTimerEndMs: null } });
      },

      substituteExerciseInActiveWorkout: (exerciseIndex, newExerciseId) => {
        const current = get().activeWorkout;
        if (!current) return;
        const catalogEx = get().exercisesCatalog.find((e) => e.id === newExerciseId);
        if (!catalogEx) return;

        const exercises = [...current.exercises];
        const oldEx = exercises[exerciseIndex];
        exercises[exerciseIndex] = {
          ...oldEx,
          exerciseId: catalogEx.id,
          exerciseName: catalogEx.name,
          muscleGroup: catalogEx.muscleGroup,
          videoUrl: catalogEx.videoUrl,
          coachNotes: oldEx.coachNotes ? `${oldEx.coachNotes} · [Reemplazo]` : undefined,
          sets: oldEx.sets.map((s) => ({
            ...s,
            previousWeight: undefined,
            previousReps: undefined,
            previousRpe: undefined,
          })),
        };

        set({
          activeWorkout: { ...current, exercises },
          lastSavedBanner: `Ejercicio reemplazado por "${catalogEx.name}" en tu sesión de hoy.`,
        });
      },

      finishActiveWorkout: async () => {
        const state = get();
        const draft = state.activeWorkout;
        if (!draft) return null;

        const currentUser = state.users.find((u) => u.id === state.currentUserId);
        if (!currentUser) return null;

        const finalizedExercises: LoggedExercise[] = draft.exercises.map((ex) => ({
          ...ex,
          metrics: computeExerciseMetrics(ex.sets),
        }));

        const totalVolumeKg = finalizedExercises.reduce(
          (acc, ex) => acc + ex.metrics.totalVolumeKg,
          0
        );

        const completedSets = finalizedExercises.flatMap((ex) =>
          ex.sets.filter((s) => s.completed)
        );

        const avgSessionRpe =
          completedSets.length > 0
            ? Math.round(
                (completedSets.reduce((acc, s) => acc + s.rpe, 0) / completedSets.length) * 10
              ) / 10
            : 0;

        const nowIso = new Date().toISOString();
        const durationSeconds = Math.max(
          60,
          Math.round((Date.now() - draft.startedAtMs) / 1000)
        );

        const newSession: WorkoutSession = {
          id: `sess_${Date.now()}`,
          gymId: state.activeGymId,
          userId: currentUser.id,
          athleteName: currentUser.displayName,
          userRoutineId: draft.userRoutineId,
          dayId: draft.dayId,
          dayName: draft.dayName,
          startedAt: new Date(draft.startedAtMs).toISOString(),
          completedAt: nowIso,
          durationSeconds,
          totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
          totalCompletedSets: completedSets.length,
          averageSessionRpe: avgSessionRpe,
          exercises: finalizedExercises,
        };

        let updatedRoutineForSync: UserRoutine | null = null;
        const updatedUserRoutines = state.userRoutines.map((ur) => {
          if (ur.id !== draft.userRoutineId) return ur;

          const updatedDays = ur.days.map((d) => {
            if (d.dayId !== draft.dayId) return d;

            const updatedExercises = d.exercises.map((routineEx) => {
              const loggedMatch = finalizedExercises.find(
                (le) => le.exerciseId === routineEx.exerciseId
              );
              const completedWorking =
                loggedMatch?.sets.filter((s) => s.completed && s.type === 'working') || [];

              if (completedWorking.length === 0) return routineEx;

              return {
                ...routineEx,
                lastSessionSets: completedWorking.map((s, idx) => ({
                  setNumber: idx + 1,
                  weight: s.weight,
                  reps: s.reps,
                  rpe: s.rpe,
                })),
              };
            });

            return { ...d, exercises: updatedExercises };
          });

          updatedRoutineForSync = { ...ur, days: updatedDays };
          return updatedRoutineForSync;
        });

        set({
          workoutSessions: [...state.workoutSessions, newSession],
          userRoutines: updatedUserRoutines,
          activeWorkout: null,
          lastSavedBanner: `¡Entrenamiento guardado! Moviste ${newSession.totalVolumeKg} kg en ${newSession.totalCompletedSets} series. Los gráficos de evolución y tus marcas previas ya se actualizaron.`,
        });

        if (updatedRoutineForSync) {
          await syncWorkoutCompletionToFirestore(newSession, updatedRoutineForSync);
        }

        return newSession;
      },

      discardActiveWorkout: () => {
        set({ activeWorkout: null });
      },

      assignTemplateToAthlete: (templateId, athleteId) => {
        const state = get();
        const template = state.templates.find(
          (t) => t.id === templateId && t.gymId === state.activeGymId
        );
        const athlete = state.users.find(
          (u) => u.id === athleteId && u.gymId === state.activeGymId
        );
        if (!template || !athlete) return null;

        const clonedDays: RoutineDay[] = JSON.parse(JSON.stringify(template.days));

        const newInstance: UserRoutine = {
          id: `urout_${athlete.id}_${Date.now()}`,
          gymId: state.activeGymId,
          userId: athlete.id,
          assignedBy: state.currentUserId,
          sourceTemplateId: template.id,
          name: `${template.name} (${athlete.displayName.split(' ')[0]})`,
          isActive: true,
          assignedAt: new Date().toISOString(),
          days: clonedDays,
        };

        const updatedUsers = state.users.map((u) =>
          u.id === athlete.id ? { ...u, activeUserRoutineId: newInstance.id } : u
        );

        set({
          userRoutines: [
            ...state.userRoutines.map((ur) =>
              ur.userId === athlete.id ? { ...ur, isActive: false } : ur
            ),
            newInstance,
          ],
          users: updatedUsers,
          lastSavedBanner: `Plantilla "${template.name}" asignada a ${athlete.displayName}. Ya puedes personalizarle series o notas en su ficha individual.`,
        });

        syncUserRoutineToFirestore(newInstance);
        return newInstance;
      },

      createMultiDayTemplate: (name, description, days) => {
        const state = get();
        const validDays = days.filter((d) => d.exercises.length > 0);
        if (!name.trim() || validDays.length === 0) return null;

        const newTemplate: RoutineTemplate = {
          id: `tmpl_${Date.now()}`,
          gymId: state.activeGymId,
          createdBy: state.currentUserId,
          name: name.trim(),
          description: description.trim() || 'Bloque de planificación personalizada',
          createdAt: new Date().toISOString(),
          days: validDays,
        };

        set({
          templates: [newTemplate, ...state.templates],
          lastSavedBanner: `Plantilla "${newTemplate.name}" (${validDays.length} días) guardada en el catálogo del gimnasio.`,
        });

        syncTemplateToFirestore(newTemplate);
        return newTemplate;
      },

      createAndAssignMultiDayTemplate: (name, description, days, athleteId) => {
        const created = get().createMultiDayTemplate(name, description, days);
        if (!created) return null;
        return get().assignTemplateToAthlete(created.id, athleteId);
      },

      updateAthleteRoutineExercise: (userRoutineId, dayId, exerciseId, updates) => {
        const state = get();
        let updatedTarget: UserRoutine | null = null;

        const updatedRoutines = state.userRoutines.map((ur) => {
          if (ur.id !== userRoutineId) return ur;
          const newDays = ur.days.map((d) => {
            if (d.dayId !== dayId) return d;
            return {
              ...d,
              exercises: d.exercises.map((ex) =>
                ex.exerciseId === exerciseId ? { ...ex, ...updates } : ex
              ),
            };
          });
          updatedTarget = { ...ur, days: newDays };
          return updatedTarget;
        });

        set({
          userRoutines: updatedRoutines,
          lastSavedBanner:
            'Ajuste individual guardado en la ficha del alumno (la plantilla maestra permanece intacta).',
        });

        if (updatedTarget) {
          syncUserRoutineToFirestore(updatedTarget);
        }
      },

      createAthleteInGym: (displayName, email) => {
        const state = get();
        if (!displayName.trim()) return null;

        const newAthlete: GymUser = {
          id: `usr_${Date.now()}`,
          gymId: state.activeGymId,
          role: 'athlete',
          displayName: displayName.trim(),
          email: email.trim() || `${displayName.toLowerCase().replace(/\s+/g, '')}@effortgym.com`,
        };

        set({
          users: [...state.users, newAthlete],
          lastSavedBanner: `Alumno "${newAthlete.displayName}" dado de alta en el gimnasio.`,
        });
        return newAthlete;
      },

      resetDemoData: () => {
        set({
          gyms: SEED_GYMS,
          users: SEED_USERS,
          exercisesCatalog: SEED_EXERCISES,
          templates: SEED_TEMPLATES,
          userRoutines: SEED_USER_ROUTINES,
          workoutSessions: SEED_WORKOUT_SESSIONS,
          activeGymId: 'gym_effort',
          currentUserId: 'usr_coach_1',
          activeWorkout: null,
          lastSavedBanner: 'Datos de prueba de Effort Gym restaurados.',
        });
      },
    }),
    {
      name: 'effort-gym-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
