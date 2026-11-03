import React, { useEffect, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { useGymStore, calculateEstimated1RM } from '../store/useGymStore';
import { LoggedExercise, LoggedSet, RoutineDay, UserRoutine } from '../types/models';

export interface RpeTrafficItem {
  value: number;
  rir: number;
  short: string;
  desc: string;
  color: string;
  badgeBg: string;
  textColor: string;
  band: 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO';
  levelName: string;
}

export const RPE_TRAFFIC_LIGHT: RpeTrafficItem[] = [
  // Verde: Intensidad Ligera / Entrada en Calor / RIR 3-4+
  {
    value: 6,
    rir: 4,
    short: '6 · RIR 4',
    desc: 'Muy liviano (podía hacer 4 reps más)',
    color: '#10B981',
    badgeBg: '#052E16',
    textColor: '#34D399',
    band: 'VERDE',
    levelName: 'Leve / Entrada en Calor',
  },
  {
    value: 7,
    rir: 3,
    short: '7 · RIR 3',
    desc: 'Ligero / Entrada en calor (sobraban 3 reps)',
    color: '#10B981',
    badgeBg: '#052E16',
    textColor: '#34D399',
    band: 'VERDE',
    levelName: 'Leve / Entrada en Calor',
  },
  // Amarillo: Moderado / Hipertrofia Óptima / RIR 2
  {
    value: 7.5,
    rir: 2.5,
    short: '7.5 · RIR 2.5',
    desc: 'Moderado (2 a 3 reps en recámara)',
    color: '#EAB308',
    badgeBg: '#451A03',
    textColor: '#FDE047',
    band: 'AMARILLO',
    levelName: 'Moderado / Hipertrofia',
  },
  {
    value: 8,
    rir: 2,
    short: '8 · RIR 2',
    desc: 'Hipertrofia Óptima (quedaban 2 reps)',
    color: '#EAB308',
    badgeBg: '#451A03',
    textColor: '#FDE047',
    band: 'AMARILLO',
    levelName: 'Moderado / Hipertrofia',
  },
  // Naranja Effort: Pesado / Exigente / RIR 1
  {
    value: 8.5,
    rir: 1.5,
    short: '8.5 · RIR 1.5',
    desc: 'Pesado Effort (1 a 2 reps más)',
    color: '#F97316',
    badgeBg: '#431407',
    textColor: '#FB923C',
    band: 'NARANJA',
    levelName: 'Pesado / Exigente Effort',
  },
  {
    value: 9,
    rir: 1,
    short: '9 · RIR 1',
    desc: 'Exigente (solo me quedaba 1 rep más)',
    color: '#F97316',
    badgeBg: '#431407',
    textColor: '#FB923C',
    band: 'NARANJA',
    levelName: 'Pesado / Exigente Effort',
  },
  // Rojo: Fallo Muscular / Máximo Esfuerzo / RIR 0
  {
    value: 9.5,
    rir: 0.5,
    short: '9.5 · RIR 0.5',
    desc: 'Casi al límite (no salía otra con buena técnica)',
    color: '#EF4444',
    badgeBg: '#450A0A',
    textColor: '#F87171',
    band: 'ROJO',
    levelName: 'Fallo / Máximo Esfuerzo',
  },
  {
    value: 10,
    rir: 0,
    short: '10 · RIR 0',
    desc: 'Al Fallo Total (esfuerzo 100% absoluto)',
    color: '#EF4444',
    badgeBg: '#450A0A',
    textColor: '#F87171',
    band: 'ROJO',
    levelName: 'Fallo / Máximo Esfuerzo',
  },
];

export function getRpeTraffic(rpe: number): RpeTrafficItem {
  const found = RPE_TRAFFIC_LIGHT.find((x) => x.value === rpe);
  if (found) return found;
  if (rpe <= 7) return RPE_TRAFFIC_LIGHT[1];
  if (rpe <= 8) return RPE_TRAFFIC_LIGHT[3];
  if (rpe <= 9) return RPE_TRAFFIC_LIGHT[5];
  return RPE_TRAFFIC_LIGHT[7];
}

interface VideoModalState {
  visible: boolean;
  exerciseName: string;
  muscleGroup: string;
  coachNotes?: string;
  videoUrl?: string;
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Cronómetro aislado para evitar re-renderizar las tarjetas de ejercicios cada segundo.
 */
const ElapsedTimerBadge = memo(({ startedAtMs }: { startedAtMs: number }) => {
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAtMs]);

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <View style={styles.timerBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.timerText}>Tiempo: {formatted}</Text>
    </View>
  );
});

/**
 * Barra flotante de descanso automático al marcar una serie completada.
 */
const FloatingRestTimerBar = memo(
  ({
    restTimerEndMs,
    totalDurationSec,
    primaryColor,
    onAdjust,
    onSkip,
  }: {
    restTimerEndMs: number | null;
    totalDurationSec: number;
    primaryColor: string;
    onAdjust: (delta: number) => void;
    onSkip: () => void;
  }) => {
    const [remainingSec, setRemainingSec] = useState(0);

    useEffect(() => {
      if (!restTimerEndMs) {
        setRemainingSec(0);
        return;
      }
      const update = () => {
        const left = Math.ceil((restTimerEndMs - Date.now()) / 1000);
        if (left <= 0) {
          setRemainingSec(0);
          onSkip();
        } else {
          setRemainingSec(left);
        }
      };
      update();
      const timer = setInterval(update, 500);
      return () => clearInterval(timer);
    }, [restTimerEndMs, onSkip]);

    if (!restTimerEndMs || remainingSec <= 0) return null;

    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const progressPct = Math.min(
      100,
      Math.max(5, (remainingSec / Math.max(1, totalDurationSec)) * 100)
    );

    return (
      <View style={styles.restBarContainer}>
        <View style={styles.restBarTopRow}>
          <View>
            <Text style={styles.restLabel}>⏱️ PAUSA ENTRE SERIES (EFFORT GYM)</Text>
            <Text style={styles.restCountdown}>
              {mins}:{String(secs).padStart(2, '0')}
            </Text>
          </View>
          <View style={styles.restActions}>
            <TouchableOpacity style={styles.restBtn} onPress={() => onAdjust(-15)}>
              <Text style={styles.restBtnText}>-15s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.restBtn} onPress={() => onAdjust(30)}>
              <Text style={styles.restBtnText}>+30s</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.restSkipBtn, { backgroundColor: primaryColor }]}
              onPress={onSkip}
            >
              <Text style={styles.restSkipText}>Listo, seguir ▶</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPct}%`, backgroundColor: primaryColor },
            ]}
          />
        </View>
      </View>
    );
  }
);

/**
 * Fila individual de una Serie (Memoizada para máxima fluidez).
 */
const SetRow = memo(
  ({
    exerciseIndex,
    setIndex,
    item,
    primaryColor,
  }: {
    exerciseIndex: number;
    setIndex: number;
    item: LoggedSet;
    primaryColor: string;
  }) => {
    const updateSetField = useGymStore((s) => s.updateSetField);
    const toggleSetType = useGymStore((s) => s.toggleSetType);
    const toggleCompleteSet = useGymStore((s) => s.toggleCompleteSet);
    const applyPreviousToSet = useGymStore((s) => s.applyPreviousToSet);
    const removeSetFromExercise = useGymStore((s) => s.removeSetFromExercise);

    const [showRpePicker, setShowRpePicker] = useState(false);

    const traffic = getRpeTraffic(item.rpe);

    const handleWeightChange = (txt: string) => {
      const parsed = parseFloat(txt.replace(',', '.'));
      updateSetField(exerciseIndex, setIndex, 'weight', isNaN(parsed) ? 0 : parsed);
    };

    const handleRepsChange = (txt: string) => {
      const parsed = parseInt(txt, 10);
      updateSetField(exerciseIndex, setIndex, 'reps', isNaN(parsed) ? 0 : parsed);
    };

    return (
      <View
        style={[
          styles.setRowWrapper,
          item.completed && styles.setRowCompleted,
        ]}
      >
        <View style={styles.setRowMain}>
          {/* 1. Número o Tipo de Serie (C = Calentamiento) */}
          <TouchableOpacity
            style={[
              styles.setNumberBadge,
              item.type === 'warmup' && styles.warmupBadge,
            ]}
            onPress={() => toggleSetType(exerciseIndex, setIndex)}
          >
            <Text
              style={[
                styles.setNumberText,
                item.type === 'warmup' && styles.warmupBadgeText,
              ]}
            >
              {item.type === 'warmup' ? 'C' : item.setNumber}
            </Text>
          </TouchableOpacity>

          {/* 2. Botón Ghost "VEZ ANTERIOR" (1 tap restaura/copia marca previa) */}
          <TouchableOpacity
            style={styles.previousCol}
            onPress={() => applyPreviousToSet(exerciseIndex, setIndex)}
            disabled={item.previousWeight === undefined}
          >
            {item.previousWeight !== undefined ? (
              <>
                <Text style={styles.prevMainText}>
                  {item.previousWeight}kg × {item.previousReps}
                </Text>
                <Text style={styles.prevSubText}>
                  RPE {item.previousRpe ?? 8} (Tocar copia)
                </Text>
              </>
            ) : (
              <Text style={styles.prevEmptyText}>1ra vez</Text>
            )}
          </TouchableOpacity>

          {/* 3. Input de Peso (KG) con steppers rápidos */}
          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={styles.microStepBtn}
              onPress={() =>
                updateSetField(exerciseIndex, setIndex, 'weight', item.weight - 2.5)
              }
            >
              <Text style={styles.microStepText}>-</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.numericInput}
              keyboardType="numeric"
              selectTextOnFocus
              value={String(item.weight)}
              onChangeText={handleWeightChange}
            />
            <TouchableOpacity
              style={styles.microStepBtn}
              onPress={() =>
                updateSetField(exerciseIndex, setIndex, 'weight', item.weight + 2.5)
              }
            >
              <Text style={styles.microStepText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Input de Repeticiones */}
          <View style={styles.inputGroupSmall}>
            <TextInput
              style={styles.numericInput}
              keyboardType="numeric"
              selectTextOnFocus
              value={String(item.reps)}
              onChangeText={handleRepsChange}
            />
          </View>

          {/* 5. Selector táctil de Esfuerzo (RPE y RIR tipo semáforo) */}
          <TouchableOpacity
            style={[
              styles.rpePillButton,
              {
                borderColor: traffic.color,
                backgroundColor: traffic.badgeBg,
              },
            ]}
            onPress={() => setShowRpePicker(!showRpePicker)}
          >
            <View style={[styles.semaforoDot, { backgroundColor: traffic.color }]} />
            <Text style={[styles.rpePillText, { color: traffic.textColor }]}>
              {item.rpe}
            </Text>
          </TouchableOpacity>

          {/* 6. Checkbox de Confirmación en 1-Tap */}
          <TouchableOpacity
            style={[
              styles.checkButton,
              item.completed && { backgroundColor: '#10B981', borderColor: '#10B981' },
            ]}
            onPress={() => toggleCompleteSet(exerciseIndex, setIndex)}
          >
            <Text
              style={[
                styles.checkIcon,
                item.completed && styles.checkIconCompleted,
              ]}
            >
              ✓
            </Text>
          </TouchableOpacity>
        </View>

        {/* Barra desplegable semáforo para elegir el Esfuerzo (RPE / RIR) */}
        {showRpePicker && (
          <View style={styles.inlineRpeBar}>
            <View style={styles.inlineRpeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inlineRpeLabel}>
                  🚦 Semáforo de Intensidad (RPE / RIR Effort Gym):
                </Text>
                <Text style={styles.inlineRpeSub}>
                  🟢 Verde (Leve) · 🟡 Amarillo (Óptimo) · 🟠 Naranja (Pesado) · 🔴 Rojo (Fallo)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteSetBtn}
                onPress={() => removeSetFromExercise(exerciseIndex, setIndex)}
              >
                <Text style={styles.deleteSetText}>🗑 Quitar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inlineRpeOptions}>
              {RPE_TRAFFIC_LIGHT.map((opt) => {
                const selected = item.rpe === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.rpeOptionChip,
                      { borderColor: opt.color },
                      selected
                        ? { backgroundColor: opt.color }
                        : { backgroundColor: opt.badgeBg },
                    ]}
                    onPress={() => {
                      updateSetField(exerciseIndex, setIndex, 'rpe', opt.value);
                      setShowRpePicker(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View
                        style={[
                          styles.semaforoDot,
                          { backgroundColor: selected ? '#FFFFFF' : opt.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.rpeOptionText,
                          selected ? { color: '#FFFFFF' } : { color: opt.textColor },
                        ]}
                      >
                        {opt.short}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rpeOptionSub,
                        selected ? { color: '#F1F5F9' } : { color: '#94A3B8' },
                      ]}
                    >
                      {opt.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  }
);

/**
 * Tarjeta de Ejercicio dentro del Workout Logger
 */
const ExerciseCard = memo(
  ({
    exercise,
    exerciseIndex,
    primaryColor,
    onOpenVideo,
    onOpenSubstitute,
  }: {
    exercise: LoggedExercise;
    exerciseIndex: number;
    primaryColor: string;
    onOpenVideo: (ex: {
      exerciseName: string;
      muscleGroup: string;
      coachNotes?: string;
      videoUrl?: string;
    }) => void;
    onOpenSubstitute: (idx: number, ex: LoggedExercise) => void;
  }) => {
    const addSetToExercise = useGymStore((s) => s.addSetToExercise);

    const liveBest1RM = exercise.sets.reduce((best, s) => {
      if (!s.completed || s.type !== 'working') return best;
      const e1rm = calculateEstimated1RM(s.weight, s.reps);
      return e1rm > best ? e1rm : best;
    }, 0);

    const completedCount = exercise.sets.filter((s) => s.completed).length;

    const isWarmup =
      exercise.blockType === 'warmup' ||
      exercise.muscleGroup.toUpperCase().startsWith('MOVILIDAD') ||
      exercise.muscleGroup.toUpperCase().includes('LUMBOPELVICA');

    const targetTraffic = getRpeTraffic(exercise.targetRpe);

    return (
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.muscleTagRow}>
              {isWarmup ? (
                <View style={styles.warmupBadgeTag}>
                  <Text style={styles.warmupBadgeTagText}>🔥 ENTRADA EN CALOR</Text>
                </View>
              ) : (
                <Text style={[styles.muscleTag, { color: primaryColor }]}>
                  {exercise.muscleGroup.toUpperCase()}
                </Text>
              )}
              <View style={styles.targetMetaPill}>
                <Text style={styles.targetMetaText}>
                  ⏱️ Pausa: <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{exercise.restSeconds}s</Text> · 🎯 Objetivo Profe:{' '}
                  <Text style={{ color: targetTraffic.textColor, fontWeight: '800' }}>
                    RIR {exercise.targetRir ?? Math.max(0, 10 - exercise.targetRpe)} (RPE {exercise.targetRpe})
                  </Text>
                </Text>
              </View>
            </View>
            <Text style={styles.exerciseTitle}>{exercise.exerciseName}</Text>
            {exercise.coachNotes ? (
              <View style={styles.coachNoteBox}>
                <Text style={styles.coachNotesText}>
                  📌 Indicación del Profesor: {exercise.coachNotes}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardHeaderRightCol}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={styles.videoButton}
                onPress={() =>
                  onOpenVideo({
                    exerciseName: exercise.exerciseName,
                    muscleGroup: exercise.muscleGroup,
                    coachNotes: exercise.coachNotes,
                    videoUrl: exercise.videoUrl,
                  })
                }
              >
                <Text style={styles.videoButtonText}>🎥 Técnica</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.substituteButton}
                onPress={() => onOpenSubstitute(exerciseIndex, exercise)}
              >
                <Text style={styles.substituteButtonText}>🔄 Cambiar</Text>
              </TouchableOpacity>
            </View>

            {liveBest1RM > 0 && (
              <View style={styles.e1rmBadge}>
                <Text style={styles.e1rmLabel}>Fuerza Máx (1RM)</Text>
                <Text style={styles.e1rmValue}>{liveBest1RM} kg</Text>
              </View>
            )}
          </View>
        </View>

        {/* Encabezado de Columnas claro para el alumno */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colHeader, { width: 32 }]}>N°</Text>
          <Text style={[styles.colHeader, { flex: 1.2 }]}>SESIÓN ANTERIOR</Text>
          <Text style={[styles.colHeader, { width: 102, textAlign: 'center' }]}>PESO (KG)</Text>
          <Text style={[styles.colHeader, { width: 52, textAlign: 'center' }]}>REPS</Text>
          <Text style={[styles.colHeader, { width: 50, textAlign: 'center' }]}>RPE/RIR</Text>
          <Text style={[styles.colHeader, { width: 38, textAlign: 'center' }]}>LISTO</Text>
        </View>

        {/* Lista de Series */}
        {exercise.sets.map((s, sIdx) => (
          <SetRow
            key={s.id}
            exerciseIndex={exerciseIndex}
            setIndex={sIdx}
            item={s}
            primaryColor={primaryColor}
          />
        ))}

        {/* Pie de tarjeta: Volumen acumulado + Botón agregar serie */}
        <View style={styles.cardFooter}>
          <Text style={styles.volumeSummaryText}>
            Completadas: {completedCount}/{exercise.sets.length} · Carga total:{' '}
            <Text style={styles.volumeHighlight}>{exercise.metrics.totalVolumeKg} kg</Text>
          </Text>
          <TouchableOpacity
            style={styles.addSetButton}
            onPress={() => addSetToExercise(exerciseIndex)}
          >
            <Text style={[styles.addSetButtonText, { color: primaryColor }]}>
              + Sumar otra serie
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

export function WorkoutLoggerScreen({
  primaryColor,
  onWorkoutFinished,
}: {
  primaryColor: string;
  onWorkoutFinished: () => void;
}) {
  const activeGymId = useGymStore((s) => s.activeGymId);
  const currentUserId = useGymStore((s) => s.currentUserId);
  const users = useGymStore((s) => s.users);
  const userRoutines = useGymStore((s) => s.userRoutines);
  const activeWorkout = useGymStore((s) => s.activeWorkout);
  const exercisesCatalog = useGymStore((s) => s.exercisesCatalog);
  const startWorkoutDay = useGymStore((s) => s.startWorkoutDay);
  const finishActiveWorkout = useGymStore((s) => s.finishActiveWorkout);
  const discardActiveWorkout = useGymStore((s) => s.discardActiveWorkout);
  const adjustRestTimer = useGymStore((s) => s.adjustRestTimer);
  const skipRestTimer = useGymStore((s) => s.skipRestTimer);
  const substituteExerciseInActiveWorkout = useGymStore(
    (s) => s.substituteExerciseInActiveWorkout
  );

  const [videoModal, setVideoModal] = useState<VideoModalState>({
    visible: false,
    exerciseName: '',
    muscleGroup: '',
  });

  const [substituteModal, setSubstituteModal] = useState<{
    visible: boolean;
    exerciseIndex: number;
    currentExercise: LoggedExercise | null;
    search: string;
  }>({
    visible: false,
    exerciseIndex: 0,
    currentExercise: null,
    search: '',
  });

  const [finishedSummaryModal, setFinishedSummaryModal] = useState<{
    visible: boolean;
    session: any | null;
    copied: boolean;
  }>({
    visible: false,
    session: null,
    copied: false,
  });

  const currentUser = users.find((u) => u.id === currentUserId);

  // Filtrar rutina activa del alumno dentro de su gimnasio
  const myRoutine: UserRoutine | undefined = userRoutines.find(
    (ur) => ur.gymId === activeGymId && ur.userId === currentUserId && ur.isActive
  );

  const openVideoGuide = (ex: {
    exerciseName: string;
    muscleGroup: string;
    coachNotes?: string;
    videoUrl?: string;
  }) => {
    setVideoModal({
      visible: true,
      exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      coachNotes: ex.coachNotes,
      videoUrl:
        ex.videoUrl ||
        `https://www.youtube.com/results?search_query=${encodeURIComponent(
          ex.exerciseName + ' tecnica ejercicio gimnasio'
        )}`,
    });
  };

  // Modal compartido de Video / Técnica
  const renderVideoModal = () => {
    const ytId = extractYouTubeId(videoModal.videoUrl);

    return (
      <Modal
        visible={videoModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVideoModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalCategoryTag, { color: primaryColor }]}>
                🎥 TÉCNICA · {videoModal.muscleGroup}
              </Text>
              <TouchableOpacity
                onPress={() => setVideoModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>{videoModal.exerciseName}</Text>

            {/* Reproductor de Video de Técnica (YouTube) */}
            {ytId ? (
              <View style={styles.videoPlayerContainer}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#000',
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={videoModal.exerciseName}
                />
              </View>
            ) : (
              <View style={styles.videoPreviewPlaceholder}>
                <View style={[styles.playCircle, { backgroundColor: primaryColor }]}>
                  <Text style={styles.playIconText}>▶</Text>
                </View>
                <Text style={styles.videoPreviewText}>
                  Video demostrativo de ejecución técnica
                </Text>
              </View>
            )}

            <View style={styles.videoPlaceholderNote}>
              <Text style={styles.videoPlaceholderNoteText}>
                💡 En el canal de YouTube de Effort Gym (@effortgym) los profesores graban y actualizan las técnicas oficiales y las entradas en calor específicas.
              </Text>
            </View>

            {videoModal.coachNotes ? (
              <View style={styles.modalCoachBox}>
                <Text style={styles.modalCoachLabel}>📌 Indicación del Profesor:</Text>
                <Text style={styles.modalCoachText}>{videoModal.coachNotes}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.modalEffortChannelBtn}
              onPress={() => Linking.openURL('https://www.youtube.com/@effortgym')}
            >
              <Text style={styles.modalEffortChannelText}>
                📺 Ir al Canal Oficial @effortgym en YouTube
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setVideoModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.modalCancelText}>Volver al entreno</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalYoutubeBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => {
                  if (videoModal.videoUrl) {
                    Linking.openURL(videoModal.videoUrl);
                  } else {
                    Linking.openURL('https://www.youtube.com/@effortgym');
                  }
                }}
              >
                <Text style={styles.modalYoutubeBtnText}>▶ Ver Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const openSubstituteModal = (idx: number, ex: LoggedExercise) => {
    setSubstituteModal({
      visible: true,
      exerciseIndex: idx,
      currentExercise: ex,
      search: '',
    });
  };

  const renderSubstituteModal = () => {
    if (!substituteModal.visible || !substituteModal.currentExercise) return null;
    const currentEx = substituteModal.currentExercise;
    const alternatives = exercisesCatalog.filter((e) => {
      if (e.id === currentEx.exerciseId) return false;
      if (substituteModal.search.trim()) {
        return (
          e.name.toLowerCase().includes(substituteModal.search.toLowerCase()) ||
          e.muscleGroup.toLowerCase().includes(substituteModal.search.toLowerCase())
        );
      }
      return e.muscleGroup === currentEx.muscleGroup;
    });

    return (
      <Modal
        visible={substituteModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSubstituteModal((prev) => ({ ...prev, visible: false }))
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '82%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalCategoryTag, { color: primaryColor }]}>
                🔄 SUSTITUIR EN SALA · {currentEx.muscleGroup}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setSubstituteModal((prev) => ({ ...prev, visible: false }))
                }
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Reemplazar: {currentEx.exerciseName}</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
              ¿Máquina o barra ocupada en la sala? Elige una variante directa del catálogo de Effort Gym:
            </Text>

            <TextInput
              style={styles.modalSearchInput}
              placeholder="🔍 Buscar ejercicio alternativo..."
              placeholderTextColor="#64748B"
              value={substituteModal.search}
              onChangeText={(txt) =>
                setSubstituteModal((prev) => ({ ...prev, search: txt }))
              }
            />

            <ScrollView style={{ maxHeight: 280, marginVertical: 8 }}>
              {alternatives.slice(0, 30).map((alt) => (
                <TouchableOpacity
                  key={alt.id}
                  style={styles.substituteItem}
                  onPress={() => {
                    substituteExerciseInActiveWorkout(
                      substituteModal.exerciseIndex,
                      alt.id
                    );
                    setSubstituteModal((prev) => ({ ...prev, visible: false }));
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.substituteItemName}>{alt.name}</Text>
                    <Text style={styles.substituteItemMeta}>
                      {alt.muscleGroup} · {alt.equipment}
                    </Text>
                  </View>
                  <Text style={[styles.selectAltText, { color: primaryColor }]}>
                    Cambiar ▶
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderFinishedSummaryModal = () => {
    if (!finishedSummaryModal.visible || !finishedSummaryModal.session) return null;
    const session = finishedSummaryModal.session;

    const bestExercise = session.exercises.reduce((prev: any, curr: any) =>
      (curr.metrics?.maxWeightKg || 0) > (prev?.metrics?.maxWeightKg || 0)
        ? curr
        : prev
    , session.exercises[0]);

    const handleShare = () => {
      const bestText =
        bestExercise && bestExercise.metrics?.maxWeightKg > 0
          ? `\n🔥 Top Lift: ${bestExercise.exerciseName} (${bestExercise.metrics.maxWeightKg} kg · 1RM: ${bestExercise.metrics.estimated1RM} kg)`
          : '';
      const message = `🏋️‍♂️ ¡Entrenamiento completado en Effort Gym!\n📅 Sesión: ${session.dayName}\n📊 Volumen movido: ${session.totalVolumeKg} kg en ${session.totalCompletedSets} series\n⏱️ Tiempo: ${Math.round(session.durationSeconds / 60)} min${bestText}\n💪 Monitoreo de Carga y Entrenamiento`;

      Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`);
      setFinishedSummaryModal((prev) => ({ ...prev, copied: true }));
      setTimeout(() => {
        setFinishedSummaryModal((prev) => ({ ...prev, copied: false }));
      }, 3000);
    };

    return (
      <Modal visible={finishedSummaryModal.visible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 500 }]}>
            <View style={styles.celebrationHeader}>
              <Text style={styles.celebrationEmoji}>🏆</Text>
              <Text style={styles.celebrationTitle}>¡SESIÓN COMPLETADA!</Text>
              <Text style={styles.celebrationSubtitle}>
                Effort Gym · {session.dayName}
              </Text>
            </View>

            {/* Grid de Métricas */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>CARGA TOTAL</Text>
                <Text style={[styles.summaryGridValue, { color: primaryColor }]}>
                  {session.totalVolumeKg} kg
                </Text>
                <Text style={styles.summaryGridSub}>Volumen movido</Text>
              </View>

              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>SERIES EFECTIVAS</Text>
                <Text style={styles.summaryGridValue}>
                  {session.totalCompletedSets}
                </Text>
                <Text style={styles.summaryGridSub}>Completadas hoy</Text>
              </View>

              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>DURACIÓN</Text>
                <Text style={styles.summaryGridValue}>
                  {Math.round(session.durationSeconds / 60)} min
                </Text>
                <Text style={styles.summaryGridSub}>Tiempo en sala</Text>
              </View>

              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>ESFUERZO</Text>
                <Text style={[styles.summaryGridValue, { color: '#FBBF24' }]}>
                  {session.averageSessionRpe}
                </Text>
                <Text style={styles.summaryGridSub}>RPE Promedio</Text>
              </View>
            </View>

            {/* Insignia de Récord Personal / Top Set */}
            {bestExercise && bestExercise.metrics?.maxWeightKg > 0 && (
              <View style={styles.prBox}>
                <View style={styles.prBadge}>
                  <Text style={styles.prBadgeText}>🔥 TOP LIFT / RÉCORD DE LA SESIÓN</Text>
                </View>
                <Text style={styles.prExerciseTitle}>{bestExercise.exerciseName}</Text>
                <Text style={styles.prStats}>
                  Levantaste <Text style={{ color: '#38BDF8', fontWeight: '800' }}>{bestExercise.metrics.maxWeightKg} kg</Text> · 1RM Estimado: <Text style={{ color: '#10B981', fontWeight: '800' }}>{bestExercise.metrics.estimated1RM} kg</Text>
                </Text>
              </View>
            )}

            <View style={styles.summaryActionsRow}>
              <TouchableOpacity
                style={styles.summaryShareBtn}
                onPress={handleShare}
              >
                <Text style={styles.summaryShareBtnText}>
                  {finishedSummaryModal.copied ? '✅ ¡Copiado!' : '📲 Compartir Resumen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.summaryDoneBtn, { backgroundColor: primaryColor }]}
                onPress={() => {
                  setFinishedSummaryModal({ visible: false, session: null, copied: false });
                  onWorkoutFinished();
                }}
              >
                <Text style={styles.summaryDoneBtnText}>Ver Mis Gráficos 📊</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Si aún no hay un entrenamiento en curso, mostramos la portada clara de "Mi Rutina"
  if (!activeWorkout) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        {renderVideoModal()}
        <View style={styles.heroBanner}>
          <Text style={[styles.heroSubtitle, { color: primaryColor }]}>
            HOLA, {currentUser?.displayName.toUpperCase()} 👋
          </Text>
          <Text style={styles.heroTitle}>
            {myRoutine ? myRoutine.name : 'Selecciona un perfil de Alumno arriba'}
          </Text>
          <Text style={styles.heroDescription}>
            Elige qué día te toca entrenar hoy. Tus pesos y repeticiones de la última vez ya
            vienen cargados para que solo tengas que tocar el botón verde (✓) al terminar cada
            serie.
          </Text>
        </View>

        {!myRoutine ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              Si estás viendo el perfil de Profesor (Gian Boasso), toca arriba en "🏃 Alumno:
              Martín Echeverría" para simular cómo entrena un alumno en su celular, o ve a "📋
              Panel Profesor" para gestionar sus rutinas.
            </Text>
          </View>
        ) : (
          myRoutine.days.map((day: RoutineDay) => (
            <View key={day.dayId} style={styles.dayPreviewCard}>
              <View style={styles.dayPreviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayPreviewTitle}>{day.name}</Text>
                  <Text style={styles.dayPreviewCount}>
                    {day.exercises.length} ejercicios en este día
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.startDayButton, { backgroundColor: primaryColor }]}
                  onPress={() => startWorkoutDay(myRoutine, day)}
                >
                  <Text style={styles.startDayButtonText}>Comenzar Día ▶</Text>
                </TouchableOpacity>
              </View>

              {/* Agrupación en Entrada en Calor vs Bloque Principal */}
              {day.exercises.some((e) => e.blockType === 'warmup') && (
                <View style={styles.previewSectionTag}>
                  <Text style={styles.previewSectionTagText}>🔥 BLOQUE 1: ENTRADA EN CALOR & MOVILIDAD</Text>
                </View>
              )}
              {day.exercises
                .filter((e) => e.blockType === 'warmup')
                .map((ex) => {
                  const lastTopSet = ex.lastSessionSets?.[ex.lastSessionSets.length - 1];
                  return (
                    <View key={ex.exerciseId} style={styles.dayExItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayExName}>
                          {ex.order}. {ex.exerciseName}
                        </Text>
                        <Text style={styles.dayExPrescription}>
                          {ex.targetSets} series de {ex.targetReps} reps · Pausa {ex.restSeconds}s
                        </Text>
                        {ex.coachNotes ? (
                          <Text style={styles.dayExNotes}>📌 {ex.coachNotes}</Text>
                        ) : null}
                      </View>

                      <View style={styles.previewRightActions}>
                        <TouchableOpacity
                          style={styles.miniVideoBtn}
                          onPress={() => openVideoGuide(ex)}
                        >
                          <Text style={styles.miniVideoBtnText}>🎥 Técnica</Text>
                        </TouchableOpacity>

                        {lastTopSet ? (
                          <View style={styles.lastPerfTag}>
                            <Text style={styles.lastPerfLabel}>Última marca</Text>
                            <Text style={styles.lastPerfValue}>
                              {lastTopSet.weight}kg × {lastTopSet.reps}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.lastPerfTag}>
                            <Text style={styles.lastPerfLabel}>Nuevo</Text>
                            <Text style={styles.lastPerfValue}>Estreno</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}

              {day.exercises.some((e) => e.blockType !== 'warmup') && (
                <View style={[styles.previewSectionTag, { marginTop: 14 }]}>
                  <Text style={[styles.previewSectionTagText, { color: primaryColor }]}>
                    ⚡ BLOQUE 2: CARGA PRINCIPAL & FUERZA
                  </Text>
                </View>
              )}
              {day.exercises
                .filter((e) => e.blockType !== 'warmup')
                .map((ex) => {
                  const lastTopSet = ex.lastSessionSets?.[ex.lastSessionSets.length - 1];
                  const traffic = getRpeTraffic(ex.targetRpe);
                  return (
                    <View key={ex.exerciseId} style={styles.dayExItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayExName}>
                          {ex.order}. {ex.exerciseName}
                        </Text>
                        <Text style={styles.dayExPrescription}>
                          {ex.targetSets} series de {ex.targetReps} reps · Pausa {ex.restSeconds}s · Objetivo:{' '}
                          <Text style={{ color: traffic.textColor, fontWeight: '800' }}>
                            RIR {ex.targetRir ?? Math.max(0, 10 - ex.targetRpe)} (RPE {ex.targetRpe})
                          </Text>
                        </Text>
                        {ex.coachNotes ? (
                          <Text style={styles.dayExNotes}>📌 {ex.coachNotes}</Text>
                        ) : null}
                      </View>

                      <View style={styles.previewRightActions}>
                        <TouchableOpacity
                          style={styles.miniVideoBtn}
                          onPress={() => openVideoGuide(ex)}
                        >
                          <Text style={styles.miniVideoBtnText}>🎥 Técnica</Text>
                        </TouchableOpacity>

                        {lastTopSet ? (
                          <View style={styles.lastPerfTag}>
                            <Text style={styles.lastPerfLabel}>Última marca</Text>
                            <Text style={styles.lastPerfValue}>
                              {lastTopSet.weight}kg × {lastTopSet.reps}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.lastPerfTag}>
                            <Text style={styles.lastPerfLabel}>Nuevo</Text>
                            <Text style={styles.lastPerfValue}>Estreno</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  // Calcular métricas globales en vivo de la sesión activa
  const liveTotalVolume = activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.metrics.totalVolumeKg,
    0
  );
  const completedSetsCount = activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  );
  const totalSetsCount = activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.sets.length,
    0
  );
  const completionPct = Math.round(
    (completedSetsCount / Math.max(1, totalSetsCount)) * 100
  );

  const handleFinish = async () => {
    const session = await finishActiveWorkout();
    if (session) {
      setFinishedSummaryModal({
        visible: true,
        session,
        copied: false,
      });
    } else {
      onWorkoutFinished();
    }
  };

  return (
    <View style={styles.container}>
      {renderVideoModal()}
      {renderSubstituteModal()}
      {renderFinishedSummaryModal()}

      {/* Barra superior pegajosa del Workout Logger */}
      <View style={styles.loggerStickyHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.activeDayName} numberOfLines={1}>
            {activeWorkout.dayName}
          </Text>
          <View style={styles.liveStatsRow}>
            <ElapsedTimerBadge startedAtMs={activeWorkout.startedAtMs} />
            <Text style={styles.liveStatPill}>
              Avance:{' '}
              <Text style={styles.liveStatBold}>
                {completedSetsCount}/{totalSetsCount} series ({completionPct}%)
              </Text>
            </Text>
            <Text style={styles.liveStatPill}>
              Carga: <Text style={styles.liveStatBold}>{liveTotalVolume} kg</Text>
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.discardBtn} onPress={discardActiveWorkout}>
            <Text style={styles.discardBtnText}>Salir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: '#10B981' }]}
            onPress={handleFinish}
          >
            <Text style={styles.finishBtnText}>Guardar Entreno ✓</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Ejercicios y Series */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentPadding, { paddingBottom: 140 }]}
      >
        <View style={styles.zeroFrictionTip}>
          <Text style={styles.zeroFrictionTipText}>
            💡 <Text style={{ fontWeight: '800' }}>¿Cómo registrar rápido?</Text> Tus pesos de la
            semana pasada ya están puestos. Si repetiste el peso, solo toca{' '}
            <Text style={{ fontWeight: '800' }}>✓</Text>. Si una máquina está ocupada, toca{' '}
            <Text style={{ fontWeight: '800' }}>🔄 Cambiar</Text> para elegir una alternativa.
          </Text>
        </View>

        {/* Banner de canal oficial de YouTube de Effort Gym */}
        <TouchableOpacity
          style={styles.youtubeChannelBanner}
          onPress={() => Linking.openURL('https://www.youtube.com/@effortgym')}
        >
          <View style={styles.ytBannerLeft}>
            <Text style={styles.ytBannerTitle}>📺 CANAL OFICIAL EFFORT GYM EN YOUTUBE</Text>
            <Text style={styles.ytBannerSub}>
              Mirá las técnicas y entradas en calor grabadas por los profesores en @effortgym
            </Text>
          </View>
          <View style={styles.ytBannerBtn}>
            <Text style={styles.ytBannerBtnText}>Ver Canal ▶</Text>
          </View>
        </TouchableOpacity>

        {/* 1. Bloque de Entrada en Calor & Movilidad (si existe en la rutina) */}
        {activeWorkout.exercises.some((e) => e.blockType === 'warmup') && (
          <View style={styles.blockSectionHeader}>
            <View style={styles.blockIconWarmup}>
              <Text style={styles.blockSectionEmoji}>🔥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockSectionTitle}>BLOQUE 1: ENTRADA EN CALOR & MOVILIDAD</Text>
              <Text style={styles.blockSectionSubtitle}>
                Activación y movilidad articular previa indicada por los profesores
              </Text>
            </View>
          </View>
        )}

        {activeWorkout.exercises.map((ex, idx) => {
          if (ex.blockType !== 'warmup') return null;
          return (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              exerciseIndex={idx}
              primaryColor={primaryColor}
              onOpenVideo={openVideoGuide}
              onOpenSubstitute={openSubstituteModal}
            />
          );
        })}

        {/* 2. Bloque Principal de Carga y Fuerza */}
        {activeWorkout.exercises.some((e) => e.blockType !== 'warmup') && (
          <View style={[styles.blockSectionHeader, { marginTop: 24 }]}>
            <View style={[styles.blockIconWarmup, { backgroundColor: primaryColor }]}>
              <Text style={styles.blockSectionEmoji}>⚡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockSectionTitle}>BLOQUE 2: CARGA PRINCIPAL & FUERZA</Text>
              <Text style={styles.blockSectionSubtitle}>
                Series efectivas · Registra tus marcas y califica el esfuerzo con el semáforo RPE
              </Text>
            </View>
          </View>
        )}

        {activeWorkout.exercises.map((ex, idx) => {
          if (ex.blockType === 'warmup') return null;
          return (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              exerciseIndex={idx}
              primaryColor={primaryColor}
              onOpenVideo={openVideoGuide}
              onOpenSubstitute={openSubstituteModal}
            />
          );
        })}
      </ScrollView>

      {/* Temporizador de Descanso Flotante */}
      <FloatingRestTimerBar
        restTimerEndMs={activeWorkout.restTimerEndMs}
        totalDurationSec={activeWorkout.activeRestDurationSec}
        primaryColor={primaryColor}
        onAdjust={adjustRestTimer}
        onSkip={skipRestTimer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  contentPadding: {
    padding: 16,
  },
  heroBanner: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroDescription: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyCardText: {
    color: '#D1D5DB',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  dayPreviewCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  dayPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    gap: 10,
  },
  dayPreviewTitle: {
    color: '#F9FAFB',
    fontSize: 17,
    fontWeight: '800',
  },
  dayPreviewCount: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  startDayButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  startDayButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  dayExItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#161F30',
    gap: 8,
  },
  dayExName: {
    color: '#F3F4F6',
    fontSize: 14,
    fontWeight: '700',
  },
  dayExPrescription: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  dayExNotes: {
    color: '#FBBF24',
    fontSize: 11,
    marginTop: 3,
  },
  previewRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniVideoBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniVideoBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  lastPerfTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  lastPerfLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  lastPerfValue: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  loggerStickyHeader: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  activeDayName: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  liveStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  timerText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
  },
  liveStatPill: {
    color: '#9CA3AF',
    fontSize: 12,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveStatBold: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discardBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  discardBtnText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  finishBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  finishBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 13,
  },
  zeroFrictionTip: {
    backgroundColor: '#172554',
    borderColor: '#1E40AF',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  zeroFrictionTipText: {
    color: '#DBEAFE',
    fontSize: 12,
    lineHeight: 18,
  },
  exerciseCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  muscleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  muscleTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  targetMetaText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  exerciseTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
  },
  coachNoteBox: {
    marginTop: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FBBF24',
  },
  coachNotesText: {
    color: '#FDE68A',
    fontSize: 12,
  },
  cardHeaderRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  videoButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  videoButtonText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  e1rmBadge: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  e1rmLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  e1rmValue: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    marginBottom: 6,
    gap: 6,
  },
  colHeader: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  setRowWrapper: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  setRowCompleted: {
    backgroundColor: '#06281E',
    borderColor: '#059669',
  },
  setRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupBadge: {
    backgroundColor: '#78350F',
  },
  setNumberText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 12,
  },
  warmupBadgeText: {
    color: '#FDE68A',
  },
  previousCol: {
    flex: 1.2,
    justifyContent: 'center',
  },
  prevMainText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  prevSubText: {
    color: '#64748B',
    fontSize: 10,
  },
  prevEmptyText: {
    color: '#475569',
    fontSize: 11,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 102,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    overflow: 'hidden',
  },
  microStepBtn: {
    width: 24,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  microStepText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  numericInput: {
    flex: 1,
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 4,
    minWidth: 40,
  },
  inputGroupSmall: {
    width: 52,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
  },
  rpePillButton: {
    width: 46,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeHighPill: {
    borderColor: '#F97316',
    backgroundColor: '#431407',
  },
  rpePillText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 12,
  },
  checkButton: {
    width: 38,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '900',
  },
  checkIconCompleted: {
    color: '#052E16',
  },
  inlineRpeBar: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 8,
  },
  inlineRpeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineRpeLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineRpeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rpeOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rpeOptionText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  rpeOptionSub: {
    color: '#94A3B8',
    fontSize: 9,
    marginTop: 1,
  },
  rpeOptionTextActive: {
    color: '#FFFFFF',
  },
  deleteSetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteSetText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeSummaryText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  volumeHighlight: {
    color: '#F9FAFB',
    fontWeight: '800',
  },
  addSetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  addSetButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  restBarContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  restBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  restLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  restCountdown: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
  },
  restActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  restBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  restSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  restSkipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalCategoryTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalCloseIcon: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '800',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 14,
  },
  videoPlayerContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 10,
  },
  videoPlaceholderNote: {
    backgroundColor: '#090D14',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  videoPlaceholderNoteText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  videoPreviewPlaceholder: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  playIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginLeft: 3,
  },
  videoPreviewText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  videoPreviewSub: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  modalCoachBox: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FBBF24',
  },
  modalCoachLabel: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalCoachText: {
    color: '#F8FAFC',
    fontSize: 12,
    lineHeight: 18,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  modalYoutubeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalYoutubeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  substituteButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  substituteButtonText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  modalSearchInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  substituteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    gap: 8,
  },
  substituteItemName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  substituteItemMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  selectAltText: {
    fontSize: 12,
    fontWeight: '800',
  },
  celebrationHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  celebrationEmoji: {
    fontSize: 44,
    marginBottom: 6,
  },
  celebrationTitle: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  celebrationSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  summaryGridItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  summaryGridLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  summaryGridValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 3,
  },
  summaryGridSub: {
    color: '#64748B',
    fontSize: 10,
  },
  prBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  prBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7C2D12',
    borderColor: '#EA580C',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  prBadgeText: {
    color: '#FED7AA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  prExerciseTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  prStats: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  summaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryShareBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryShareBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryDoneBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  summaryDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  semaforoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
  },
  inlineRpeSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  warmupBadgeTag: {
    backgroundColor: '#78350F',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warmupBadgeTagText: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  targetMetaPill: {
    backgroundColor: '#0D131F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  modalEffortChannelBtn: {
    backgroundColor: '#7C2D12',
    borderColor: '#EA580C',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalEffortChannelText: {
    color: '#FED7AA',
    fontSize: 12,
    fontWeight: '800',
  },
  previewSectionTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
  },
  previewSectionTagText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  youtubeChannelBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  ytBannerLeft: {
    flex: 1,
  },
  ytBannerTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ytBannerSub: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  ytBannerBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ytBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  blockSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  blockIconWarmup: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockSectionEmoji: {
    fontSize: 15,
  },
  blockSectionTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  blockSectionSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
});
