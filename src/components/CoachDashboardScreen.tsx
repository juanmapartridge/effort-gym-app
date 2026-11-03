import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import { useGymStore } from '../store/useGymStore';
import { RoutineDay, RoutineExerciseItem } from '../types/models';
import { AthleteLoadAnalyticsPanel } from './AnalyticsChartsScreen';

const REP_PRESETS = ['6-8', '8-10', '10-12', '12-15'];
const REST_PRESETS = [45, 60, 90, 120, 150];

const RIR_TRAFFIC_PRESETS = [
  { rir: 3, rpe: 7, label: 'RIR 3', sub: 'Leve (RPE 7)', color: '#10B981', bg: '#052E16' },
  { rir: 2, rpe: 8, label: 'RIR 2', sub: 'Óptimo (RPE 8)', color: '#EAB308', bg: '#451A03' },
  { rir: 1, rpe: 9, label: 'RIR 1', sub: 'Pesado (RPE 9)', color: '#F97316', bg: '#431407' },
  { rir: 0, rpe: 10, label: 'RIR 0', sub: 'Fallo (RPE 10)', color: '#EF4444', bg: '#450A0A' },
];

export function CoachDashboardScreen({ primaryColor }: { primaryColor: string }) {
  const activeGymId = useGymStore((s) => s.activeGymId);
  const templates = useGymStore((s) => s.templates);
  const users = useGymStore((s) => s.users);
  const userRoutines = useGymStore((s) => s.userRoutines);
  const workoutSessions = useGymStore((s) => s.workoutSessions);
  const exercisesCatalog = useGymStore((s) => s.exercisesCatalog);

  const assignTemplateToAthlete = useGymStore((s) => s.assignTemplateToAthlete);
  const createMultiDayTemplate = useGymStore((s) => s.createMultiDayTemplate);
  const createAndAssignMultiDayTemplate = useGymStore((s) => s.createAndAssignMultiDayTemplate);
  const updateAthleteRoutineExercise = useGymStore((s) => s.updateAthleteRoutineExercise);
  const createAthleteInGym = useGymStore((s) => s.createAthleteInGym);

  const gymTemplates = templates.filter((t) => t.gymId === activeGymId);
  const gymAthletes = users.filter(
    (u) => u.gymId === activeGymId && u.role === 'athlete'
  );

  // Sub-sección activa: Por defecto iniciamos en Alumnos para que Gian vea a sus alumnos de inmediato
  const [coachSection, setCoachSection] = useState<'athletes' | 'planner' | 'catalog'>('athletes');

  // Alumno seleccionado para auditar
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(
    gymAthletes[0]?.id || ''
  );
  const [showChartsInFicha, setShowChartsInFicha] = useState<boolean>(true);

  // Buscador de ejercicios
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

  const categories = useMemo(() => {
    const unique = Array.from(new Set(exercisesCatalog.map((e) => e.muscleGroup)));
    return ['TODAS', ...unique];
  }, [exercisesCatalog]);

  const filteredCatalog = useMemo(() => {
    return exercisesCatalog.filter((ex) => {
      const matchesCat =
        selectedCategory === 'TODAS' || ex.muscleGroup === selectedCategory;
      const matchesText =
        !exerciseSearch.trim() ||
        ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        ex.muscleGroup.toLowerCase().includes(exerciseSearch.toLowerCase());
      return matchesCat && matchesText;
    });
  }, [exercisesCatalog, selectedCategory, exerciseSearch]);

  // Alta rápida de alumno
  const [showNewAthleteForm, setShowNewAthleteForm] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState('');
  const [newAthleteEmail, setNewAthleteEmail] = useState('');

  // --- ESTADO DEL PLANIFICADOR DE RUTINAS ---
  const [newTemplateName, setNewTemplateName] = useState('Mesociclo 1: Fuerza y Tren Superior');
  const [newTemplateDesc, setNewTemplateDesc] = useState('Bloque de 4 semanas con sobrecarga progresiva');
  const [builderDays, setBuilderDays] = useState<RoutineDay[]>([
    {
      dayId: 'day_builder_1',
      name: 'Día 1 - Tren Superior & Movilidad',
      exercises: [
        {
          order: 1,
          exerciseId: 'ex_2841cf7b',
          exerciseName: 'CHEST ROTATORY CUADRUPEDIA',
          muscleGroup: 'MOVILIDAD TORACICA',
          blockType: 'warmup',
          targetSets: 2,
          targetReps: '10',
          targetRpe: 7,
          targetRir: 3,
          restSeconds: 45,
          coachNotes: 'Entrada en calor: rotación fluida abriendo el pecho sin compensar.',
        },
        {
          order: 2,
          exerciseId: 'ex_c1164817',
          exerciseName: 'PRESS BANCO PLANO C/BARRA',
          muscleGroup: 'HEMISFERIO SUPERIOR',
          blockType: 'main',
          targetSets: 4,
          targetReps: '6-8',
          targetRpe: 8,
          targetRir: 2,
          restSeconds: 120,
          coachNotes: 'Pausa de 1 segundo en el pecho antes de empujar.',
        },
        {
          order: 3,
          exerciseId: 'ex_4b57ae32',
          exerciseName: 'REMO 90 POLEA C/MANIJA',
          muscleGroup: 'HEMISFERIO SUPERIOR',
          blockType: 'main',
          targetSets: 3,
          targetReps: '8-10',
          targetRpe: 8,
          targetRir: 2,
          restSeconds: 90,
          coachNotes: 'Cuidar retracción de escápulas.',
        },
      ],
    },
    {
      dayId: 'day_builder_2',
      name: 'Día 2 - Tren Inferior & Core',
      exercises: [
        {
          order: 1,
          exerciseId: 'ex_2c0ae273',
          exerciseName: 'HIP 90 - 90',
          muscleGroup: 'MOVILIDAD CADERA',
          blockType: 'warmup',
          targetSets: 2,
          targetReps: '10',
          targetRpe: 7,
          targetRir: 3,
          restSeconds: 45,
          coachNotes: 'Entrada en calor: movilidad articular de cadera previa a la carga.',
        },
        {
          order: 2,
          exerciseId: 'ex_032d7308',
          exerciseName: 'HIP THRUST C/BARRA',
          muscleGroup: 'HEMISFERIO INFERIOR',
          blockType: 'main',
          targetSets: 4,
          targetReps: '8-10',
          targetRpe: 8,
          targetRir: 2,
          restSeconds: 90,
          coachNotes: 'Apretar glúteos 1 segundo arriba.',
        },
      ],
    },
  ]);
  const [activeBuilderDayIdx, setActiveBuilderDayIdx] = useState<number>(0);

  // Alumno seleccionado para asignar
  const defaultUnassignedAthlete =
    gymAthletes.find((a) => !userRoutines.some((ur) => ur.userId === a.id && ur.isActive))?.id ||
    gymAthletes[0]?.id ||
    '';
  const [assignToAthleteId, setAssignToAthleteId] = useState<string>(defaultUnassignedAthlete);

  // Edición rápida en ficha individual
  const [editingExerciseKey, setEditingExerciseKey] = useState<string | null>(null);
  const [editSets, setEditSets] = useState('4');
  const [editReps, setEditReps] = useState('6-8');
  const [editRest, setEditRest] = useState('90');
  const [editRir, setEditRir] = useState('2');
  const [editNotes, setEditNotes] = useState('');

  const activeAthlete =
    gymAthletes.find((a) => a.id === selectedAthleteId) || gymAthletes[0];

  const activeAthleteRoutine = userRoutines.find(
    (ur) =>
      ur.gymId === activeGymId &&
      ur.userId === activeAthlete?.id &&
      ur.isActive
  );

  const athleteSessions = workoutSessions.filter(
    (s) => s.gymId === activeGymId && s.userId === activeAthlete?.id
  );
  const lastSession = athleteSessions[athleteSessions.length - 1];

  // Métodos del Armador de Rutinas
  const addDayToBuilder = () => {
    const nextNum = builderDays.length + 1;
    const newDay: RoutineDay = {
      dayId: `day_builder_${Date.now()}`,
      name: `Día ${nextNum}`,
      exercises: [],
    };
    setBuilderDays([...builderDays, newDay]);
    setActiveBuilderDayIdx(builderDays.length);
  };

  const removeDayFromBuilder = (idx: number) => {
    if (builderDays.length <= 1) return;
    const updated = builderDays.filter((_, i) => i !== idx);
    setBuilderDays(updated);
    setActiveBuilderDayIdx(Math.max(0, activeBuilderDayIdx - 1));
  };

  const updateBuilderDayName = (idx: number, name: string) => {
    const updated = [...builderDays];
    updated[idx] = { ...updated[idx], name };
    setBuilderDays(updated);
  };

  const toggleExerciseInActiveDay = (exerciseId: string) => {
    const catEx = exercisesCatalog.find((e) => e.id === exerciseId);
    if (!catEx) return;

    const updated = [...builderDays];
    const currentDay = { ...updated[activeBuilderDayIdx] };
    const exists = currentDay.exercises.some((e) => e.exerciseId === exerciseId);

    if (exists) {
      currentDay.exercises = currentDay.exercises
        .filter((e) => e.exerciseId !== exerciseId)
        .map((e, i) => ({ ...e, order: i + 1 }));
    } else {
      const isWarmup =
        catEx.muscleGroup.toUpperCase().startsWith('MOVILIDAD') ||
        catEx.muscleGroup.toUpperCase().includes('LUMBOPELVICA');

      const newEx: RoutineExerciseItem = {
        order: currentDay.exercises.length + 1,
        exerciseId: catEx.id,
        exerciseName: catEx.name,
        muscleGroup: catEx.muscleGroup,
        blockType: isWarmup ? 'warmup' : 'main',
        targetSets: isWarmup ? 2 : 3,
        targetReps: isWarmup ? '10-12' : '8-10',
        targetRpe: isWarmup ? 7 : 8,
        targetRir: isWarmup ? 3 : 2,
        restSeconds: isWarmup ? 45 : 90,
        coachNotes: isWarmup ? 'Entrada en calor: activación y movilidad articular.' : '',
      };
      currentDay.exercises = [...currentDay.exercises, newEx];
    }

    updated[activeBuilderDayIdx] = currentDay;
    setBuilderDays(updated);
  };

  const updateBuilderExerciseField = (
    exIdx: number,
    field: 'targetSets' | 'targetReps' | 'targetRpe' | 'targetRir' | 'restSeconds' | 'blockType' | 'coachNotes',
    val: any
  ) => {
    const updated = [...builderDays];
    const currentDay = { ...updated[activeBuilderDayIdx] };
    const exList = [...currentDay.exercises];
    const target = { ...exList[exIdx] };

    if (field === 'targetSets') {
      target.targetSets = Math.max(1, parseInt(String(val), 10) || 1);
    } else if (field === 'targetRpe') {
      target.targetRpe = Math.min(10, Math.max(5, parseFloat(String(val)) || 8));
      target.targetRir = Math.max(0, 10 - target.targetRpe);
    } else if (field === 'targetRir') {
      const rirNum = Math.max(0, parseInt(String(val), 10) || 0);
      target.targetRir = rirNum;
      target.targetRpe = Math.max(6, 10 - rirNum);
    } else if (field === 'targetReps') {
      target.targetReps = String(val);
    } else if (field === 'restSeconds') {
      target.restSeconds = Math.max(15, parseInt(String(val), 10) || 90);
    } else if (field === 'blockType') {
      target.blockType = val;
    } else if (field === 'coachNotes') {
      target.coachNotes = String(val);
    }

    exList[exIdx] = target;
    currentDay.exercises = exList;
    updated[activeBuilderDayIdx] = currentDay;
    setBuilderDays(updated);
  };

  const handleSaveOnlyTemplate = () => {
    const created = createMultiDayTemplate(
      newTemplateName || 'Plan Personalizado Effort',
      newTemplateDesc,
      builderDays
    );
    if (created) {
      setCoachSection('athletes');
    }
  };

  const handleSaveAndAssignDirectly = () => {
    if (!assignToAthleteId) return;
    const assigned = createAndAssignMultiDayTemplate(
      newTemplateName || 'Plan Personalizado Effort',
      newTemplateDesc,
      builderDays,
      assignToAthleteId
    );
    if (assigned) {
      setSelectedAthleteId(assignToAthleteId);
      setCoachSection('athletes');
    }
  };

  const handleCreateAthlete = () => {
    if (!newAthleteName.trim()) return;
    const created = createAthleteInGym(newAthleteName, newAthleteEmail);
    if (created) {
      setSelectedAthleteId(created.id);
      setAssignToAthleteId(created.id);
      setNewAthleteName('');
      setNewAthleteEmail('');
      setShowNewAthleteForm(false);
      setCoachSection('athletes');
    }
  };

  const currentBuilderDay = builderDays[activeBuilderDayIdx] || builderDays[0];
  const totalBuilderExercises = builderDays.reduce((acc, d) => acc + d.exercises.length, 0);

  const renderBuilderExerciseCard = (ex: RoutineExerciseItem, exIdx: number) => (
    <View key={ex.exerciseId} style={styles.builderExerciseCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.builderExTitle}>
            {ex.order}. {ex.exerciseName}
          </Text>
          <Text style={styles.builderExCat}>{ex.muscleGroup}</Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleExerciseInActiveDay(ex.exerciseId)}
          style={styles.deleteExBtn}
        >
          <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>✕ Quitar</Text>
        </TouchableOpacity>
      </View>

      {/* Selector de Tipo de Bloque: Entrada en Calor vs Carga */}
      <View style={styles.blockTypeToggleRow}>
        <TouchableOpacity
          style={[
            styles.blockTypeBtn,
            ex.blockType === 'warmup' && styles.blockTypeBtnWarmupActive,
          ]}
          onPress={() => updateBuilderExerciseField(exIdx, 'blockType', 'warmup')}
        >
          <Text
            style={[
              styles.blockTypeBtnText,
              ex.blockType === 'warmup' && styles.blockTypeBtnTextWarmupActive,
            ]}
          >
            🔥 Entrada en Calor / Movilidad
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.blockTypeBtn,
            ex.blockType !== 'warmup' && {
              backgroundColor: '#431407',
              borderColor: primaryColor,
            },
          ]}
          onPress={() => updateBuilderExerciseField(exIdx, 'blockType', 'main')}
        >
          <Text
            style={[
              styles.blockTypeBtnText,
              ex.blockType !== 'warmup' && { color: primaryColor, fontWeight: '800' },
            ]}
          >
            ⚡ Bloque Principal de Carga
          </Text>
        </TouchableOpacity>
      </View>

      {/* Fila 1: Series & Repeticiones */}
      <View style={styles.controlsRowClean}>
        {/* Series */}
        <View style={styles.controlCol}>
          <Text style={styles.controlMiniLabel}>Series</Text>
          <View style={styles.stepperClean}>
            <TouchableOpacity
              style={styles.stepperActionBtn}
              onPress={() =>
                updateBuilderExerciseField(
                  exIdx,
                  'targetSets',
                  Math.max(1, ex.targetSets - 1)
                )
              }
            >
              <Text style={styles.stepperActionText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.stepperNumberText}>{ex.targetSets}</Text>
            <TouchableOpacity
              style={styles.stepperActionBtn}
              onPress={() =>
                updateBuilderExerciseField(exIdx, 'targetSets', ex.targetSets + 1)
              }
            >
              <Text style={styles.stepperActionText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Repeticiones */}
        <View style={[styles.controlCol, { flex: 1.5 }]}>
          <Text style={styles.controlMiniLabel}>Reps objetivo</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {REP_PRESETS.map((p) => {
              const match = ex.targetReps === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.presetChip,
                    match && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                  onPress={() => updateBuilderExerciseField(exIdx, 'targetReps', p)}
                >
                  <Text style={[styles.presetChipText, match && { color: '#FFF', fontWeight: '800' }]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Fila 2: Pausa (Descanso fijado por los profesores) */}
      <View style={{ marginTop: 10 }}>
        <Text style={styles.controlMiniLabel}>⏱️ Pausa entre series (Descanso fijado por el profesor):</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {REST_PRESETS.map((sec) => {
            const isSelected = ex.restSeconds === sec;
            return (
              <TouchableOpacity
                key={sec}
                style={[
                  styles.restPresetChip,
                  isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
                ]}
                onPress={() => updateBuilderExerciseField(exIdx, 'restSeconds', sec)}
              >
                <Text
                  style={[
                    styles.restPresetChipText,
                    isSelected && { color: '#FFF', fontWeight: '800' },
                  ]}
                >
                  {sec}s
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Fila 3: Intensidad / RIR Objetivo (Semáforo de Colores) */}
      <View style={{ marginTop: 10 }}>
        <Text style={styles.controlMiniLabel}>🚦 Intensidad / RIR Objetivo (Semáforo Effort Gym):</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {RIR_TRAFFIC_PRESETS.map((p) => {
            const currentRir = ex.targetRir ?? Math.max(0, 10 - ex.targetRpe);
            const isMatch = currentRir === p.rir;
            return (
              <TouchableOpacity
                key={p.rir}
                style={[
                  styles.rirTrafficChip,
                  { borderColor: p.color },
                  isMatch ? { backgroundColor: p.color } : { backgroundColor: p.bg },
                ]}
                onPress={() => updateBuilderExerciseField(exIdx, 'targetRir', p.rir)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View
                    style={[
                      styles.semaforoDotSmall,
                      { backgroundColor: isMatch ? '#FFF' : p.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.rirTrafficChipText,
                      isMatch ? { color: '#FFF' } : { color: p.color },
                    ]}
                  >
                    {p.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rirTrafficChipSub,
                    isMatch ? { color: '#F8FAFC' } : { color: '#94A3B8' },
                  ]}
                >
                  {p.sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Nota técnica opcional */}
      <TextInput
        style={[styles.cleanInput, { fontSize: 11, paddingVertical: 6, marginTop: 10, marginBottom: 0 }]}
        value={ex.coachNotes}
        onChangeText={(txt) => updateBuilderExerciseField(exIdx, 'coachNotes', txt)}
        placeholder="Indicación técnica o de entrada en calor para el alumno..."
        placeholderTextColor="#64748B"
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      {/* 1. ENCABEZADO MINIMALISTA Y LIMPIO */}
      <View style={styles.headerBlock}>
        <View style={styles.headerTopLine}>
          <View>
            <Text style={styles.headerGreeting}>Panel del Entrenador</Text>
            <Text style={styles.headerSubtitle}>
              Effort Gym · Gian Boasso
            </Text>
          </View>
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => setShowNewAthleteForm(!showNewAthleteForm)}
          >
            <Text style={styles.ghostBtnText}>
              {showNewAthleteForm ? '✕ Cerrar' : '+ Nuevo Alumno'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* NAVEGACIÓN SIMPLE (3 SECCIONES CLARAS) */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              coachSection === 'athletes' && styles.tabBtnActive,
            ]}
            onPress={() => setCoachSection('athletes')}
          >
            <Text
              style={[
                styles.tabBtnText,
                coachSection === 'athletes' && styles.tabBtnTextActive,
              ]}
            >
              Mis Alumnos ({gymAthletes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              coachSection === 'planner' && styles.tabBtnActive,
            ]}
            onPress={() => setCoachSection('planner')}
          >
            <Text
              style={[
                styles.tabBtnText,
                coachSection === 'planner' && styles.tabBtnTextActive,
              ]}
            >
              Armar Rutina
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              coachSection === 'catalog' && styles.tabBtnActive,
            ]}
            onPress={() => setCoachSection('catalog')}
          >
            <Text
              style={[
                styles.tabBtnText,
                coachSection === 'catalog' && styles.tabBtnTextActive,
              ]}
            >
              Ejercicios ({exercisesCatalog.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL / FORMULARIO RÁPIDO DE ALUMNO NUEVO */}
      {showNewAthleteForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Registrar nuevo alumno</Text>
          <TextInput
            style={styles.cleanInput}
            placeholder="Nombre y apellido..."
            placeholderTextColor="#64748B"
            value={newAthleteName}
            onChangeText={setNewAthleteName}
          />
          <TextInput
            style={styles.cleanInput}
            placeholder="Correo electrónico..."
            placeholderTextColor="#64748B"
            value={newAthleteEmail}
            onChangeText={setNewAthleteEmail}
          />
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: primaryColor }]}
            onPress={handleCreateAthlete}
          >
            <Text style={styles.primaryActionBtnText}>Guardar Alumno</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* =========================================================================
          VISTA 1: MIS ALUMNOS Y MONITOR DE CARGA (LIMPIO, ESPACIADO, INTUITIVO)
          ========================================================================= */}
      {coachSection === 'athletes' && (
        <View style={{ gap: 20 }}>
          {/* TARJETA DE RESUMEN Y RECOMENDACIONES CLAVE */}
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>ESTADO EN SALA</Text>
            <Text style={styles.cardTitle}>Alertas de Carga y Planificación</Text>

            <View style={{ gap: 12, marginTop: 12 }}>
              {/* Alerta Martín */}
              <View style={styles.alertRow}>
                <View style={styles.alertIndicatorAmber} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertAthleteTitle}>
                    Martín Echeverría · <Text style={{ color: '#F59E0B' }}>Sugerencia de Descarga</Text>
                  </Text>
                  <Text style={styles.alertBodyText}>
                    Lleva 4 semanas seguidas subiendo cargas (+13.7%) con esfuerzo exigente (RPE 8.2 promedio). Conviene programar 1 semana de descarga para asimilar el trabajo.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallOutlineBtn}
                  onPress={() => setSelectedAthleteId('usr_athlete_1')}
                >
                  <Text style={styles.smallOutlineBtnText}>Ver Ficha</Text>
                </TouchableOpacity>
              </View>

              {/* Alerta Sofía */}
              <View style={styles.alertRow}>
                <View style={styles.alertIndicatorGreen} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertAthleteTitle}>
                    Sofía Martínez · <Text style={{ color: '#10B981' }}>Progreso Destacado</Text>
                  </Text>
                  <Text style={styles.alertBodyText}>
                    Aumentó 20.4% su volumen de tren inferior este mes. Récord personal en Hip Thrust (82.5 kg).
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallOutlineBtn}
                  onPress={() => setSelectedAthleteId('usr_athlete_2')}
                >
                  <Text style={styles.smallOutlineBtnText}>Ver Ficha</Text>
                </TouchableOpacity>
              </View>

              {/* Alerta Valentín */}
              <View style={styles.alertRow}>
                <View style={styles.alertIndicatorGray} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertAthleteTitle}>
                    Valentín Acosta · <Text style={{ color: '#94A3B8' }}>Sin Rutina Asignada</Text>
                  </Text>
                  <Text style={styles.alertBodyText}>
                    Alumno nuevo listo para recibir su primer plan de entrenamiento.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.smallSolidBtn, { backgroundColor: primaryColor }]}
                  onPress={() => {
                    assignTemplateToAthlete('tmpl_effort_4d', 'usr_athlete_3');
                    setSelectedAthleteId('usr_athlete_3');
                  }}
                >
                  <Text style={styles.smallSolidBtnText}>+ Asignar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* LISTA DE ALUMNOS (TARJETAS ESPACIOSAS) */}
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>ALUMNOS</Text>
            <Text style={styles.cardTitle}>Selecciona un alumno para auditar su carga</Text>

            <View style={styles.athleteGrid}>
              {gymAthletes.map((ath) => {
                const isSelected = activeAthlete?.id === ath.id;
                const currentRoutine = userRoutines.find(
                  (ur) => ur.userId === ath.id && ur.isActive
                );
                return (
                  <TouchableOpacity
                    key={ath.id}
                    style={[
                      styles.athleteCardClean,
                      isSelected && { borderColor: primaryColor, backgroundColor: '#1A2333' },
                    ]}
                    onPress={() => setSelectedAthleteId(ath.id)}
                  >
                    <View style={styles.athleteCardHeader}>
                      <Text style={styles.athleteNameClean}>{ath.displayName}</Text>
                      {isSelected && (
                        <View style={[styles.activeDot, { backgroundColor: primaryColor }]} />
                      )}
                    </View>
                    <Text style={styles.athleteEmailClean}>{ath.email}</Text>
                    <Text
                      style={[
                        styles.athleteRoutineStatus,
                        { color: currentRoutine ? '#10B981' : '#F59E0B' },
                      ]}
                    >
                      {currentRoutine ? `✓ ${currentRoutine.name}` : '⚠️ Sin rutina'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* FICHA DEL ALUMNO SELECCIONADO */}
          {activeAthlete && (
            <View style={styles.card}>
              <View style={styles.fichaHeaderRow}>
                <View>
                  <Text style={styles.cardEyebrow}>FICHA INDIVIDUAL</Text>
                  <Text style={styles.fichaAthleteName}>{activeAthlete.displayName}</Text>
                  <Text style={styles.fichaAthleteMeta}>
                    {lastSession
                      ? `Último entrenamiento: ${lastSession.completedAt.slice(0, 10)} · Volumen: ${lastSession.totalVolumeKg} kg`
                      : 'Alumno nuevo — Sin sesiones registradas'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.ghostPillBtn}
                  onPress={() => setShowChartsInFicha(!showChartsInFicha)}
                >
                  <Text style={styles.ghostPillText}>
                    {showChartsInFicha ? '▲ Ocultar Gráficos' : '📊 Ver Gráficos'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* GRÁFICOS EMBEBIDOS DE CARGA */}
              {showChartsInFicha && (
                <View style={{ marginTop: 16 }}>
                  <AthleteLoadAnalyticsPanel
                    athleteId={activeAthlete.id}
                    primaryColor={primaryColor}
                    compact
                  />
                </View>
              )}

              {/* RUTINA DEL ALUMNO Y PERSONALIZACIÓN */}
              <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1F293D' }}>
                <Text style={styles.subCardTitle}>
                  Plan Activo: {activeAthleteRoutine ? activeAthleteRoutine.name : 'Sin plan asignado'}
                </Text>

                {!activeAthleteRoutine ? (
                  <View style={styles.emptyNotice}>
                    <Text style={styles.emptyNoticeText}>
                      Este alumno todavía no tiene rutina. Podés ir a la pestaña "Armar Rutina" para crearle una en 1 minuto.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 12, marginTop: 10 }}>
                    {activeAthleteRoutine.days.map((day) => (
                      <View key={day.dayId} style={styles.dayBoxClean}>
                        <Text style={styles.dayBoxCleanTitle}>{day.name}</Text>

                        {/* 1. APARTADO 1: ENTRADA EN CALOR & MOVILIDAD */}
                        {day.exercises.some((e) => e.blockType === 'warmup') && (
                          <View style={styles.coachSegmentBoxWarmup}>
                            <View style={styles.coachSegmentHeader}>
                              <View style={styles.coachSegmentBadgeWarmup}>
                                <Text style={styles.coachSegmentBadgeWarmupText}>APARTADO 1</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.coachSegmentTitleWarmup}>
                                  🔥 ENTRADA EN CALOR & MOVILIDAD
                                </Text>
                                <Text style={styles.coachSegmentSub}>
                                  Movilidad articular y activación neuromotriz previa
                                </Text>
                              </View>
                            </View>
                            <View style={styles.coachSegmentDividerLineWarmup} />

                            {day.exercises
                              .filter((e) => e.blockType === 'warmup')
                              .map((ex) => {
                                const editKey = `${day.dayId}_${ex.exerciseId}`;
                                const isEditing = editingExerciseKey === editKey;

                                return (
                                  <View key={ex.exerciseId} style={styles.exerciseRowClean}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.exerciseRowCleanName}>
                                        {ex.order}. {ex.exerciseName}{' '}
                                        <Text style={{ color: '#F59E0B', fontSize: 11 }}>[Movilidad]</Text>
                                      </Text>
                                      <Text style={styles.exerciseRowCleanSpec}>
                                        {ex.targetSets} series × {ex.targetReps} reps · Pausa {ex.restSeconds}s
                                      </Text>
                                      {ex.coachNotes ? (
                                        <Text style={styles.exerciseRowCleanNote}>
                                          📌 {ex.coachNotes}
                                        </Text>
                                      ) : null}
                                    </View>

                                    <TouchableOpacity
                                      style={styles.cleanSmallBtn}
                                      onPress={() => {
                                        if (isEditing) {
                                          setEditingExerciseKey(null);
                                        } else {
                                          setEditingExerciseKey(editKey);
                                          setEditSets(String(ex.targetSets));
                                          setEditReps(ex.targetReps);
                                          setEditRest(String(ex.restSeconds || 45));
                                          setEditRir(String(ex.targetRir ?? 3));
                                          setEditNotes(ex.coachNotes || '');
                                        }
                                      }}
                                    >
                                      <Text style={styles.cleanSmallBtnText}>
                                        {isEditing ? 'Cerrar' : 'Ajustar'}
                                      </Text>
                                    </TouchableOpacity>

                                    {isEditing && (
                                      <View style={styles.editFormInline}>
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.miniLabel}>Series:</Text>
                                            <TextInput
                                              style={styles.cleanInput}
                                              keyboardType="numeric"
                                              value={editSets}
                                              onChangeText={setEditSets}
                                            />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.miniLabel}>Reps:</Text>
                                            <TextInput
                                              style={styles.cleanInput}
                                              value={editReps}
                                              onChangeText={setEditReps}
                                            />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.miniLabel}>Pausa (s):</Text>
                                            <TextInput
                                              style={styles.cleanInput}
                                              keyboardType="numeric"
                                              value={editRest}
                                              onChangeText={setEditRest}
                                            />
                                          </View>
                                        </View>
                                        <Text style={styles.miniLabel}>Nota para el alumno:</Text>
                                        <TextInput
                                          style={styles.cleanInput}
                                          value={editNotes}
                                          onChangeText={setEditNotes}
                                          placeholder="Ej: Movilidad articular previa..."
                                          placeholderTextColor="#64748B"
                                        />
                                        <TouchableOpacity
                                          style={[styles.primaryActionBtn, { backgroundColor: '#10B981', marginTop: 4 }]}
                                          onPress={() => {
                                            updateAthleteRoutineExercise(
                                              activeAthleteRoutine.id,
                                              day.dayId,
                                              ex.exerciseId,
                                              {
                                                targetSets: parseInt(editSets, 10) || ex.targetSets,
                                                targetReps: editReps.trim() || ex.targetReps,
                                                restSeconds: parseInt(editRest, 10) || ex.restSeconds,
                                                coachNotes: editNotes.trim(),
                                              }
                                            );
                                            setEditingExerciseKey(null);
                                          }}
                                        >
                                          <Text style={styles.primaryActionBtnText}>Guardar Ajuste</Text>
                                        </TouchableOpacity>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                          </View>
                        )}

                        {/* LÍNEA DIVISORIA DE APARTADOS */}
                        {day.exercises.some((e) => e.blockType === 'warmup') &&
                          day.exercises.some((e) => e.blockType !== 'warmup') && (
                            <View style={styles.coachDividerRow}>
                              <View style={styles.coachDividerLine} />
                              <View style={styles.coachDividerPill}>
                                <Text style={styles.coachDividerPillText}>⚡ TRANSICIÓN A CARGA PRINCIPAL</Text>
                              </View>
                              <View style={styles.coachDividerLine} />
                            </View>
                          )}

                        {/* 2. APARTADO 2: BLOQUE PRINCIPAL DE CARGA */}
                        {day.exercises.some((e) => e.blockType !== 'warmup') && (
                          <View style={[styles.coachSegmentBoxMain, { borderLeftColor: primaryColor }]}>
                            <View style={styles.coachSegmentHeader}>
                              <View style={[styles.coachSegmentBadgeWarmup, { backgroundColor: '#431407', borderColor: primaryColor }]}>
                                <Text style={[styles.coachSegmentBadgeWarmupText, { color: primaryColor }]}>APARTADO 2</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.coachSegmentTitleWarmup, { color: primaryColor }]}>
                                  ⚡ BLOQUE PRINCIPAL DE CARGA
                                </Text>
                                <Text style={styles.coachSegmentSub}>
                                  Fuerza, hipertrofia y control de esfuerzo con semáforo RIR/RPE
                                </Text>
                              </View>
                            </View>
                            <View style={[styles.coachSegmentDividerLineWarmup, { backgroundColor: primaryColor }]} />

                            {day.exercises
                              .filter((e) => e.blockType !== 'warmup')
                              .map((ex) => {
                                const editKey = `${day.dayId}_${ex.exerciseId}`;
                                const isEditing = editingExerciseKey === editKey;
                                const rirVal = ex.targetRir ?? Math.max(0, 10 - ex.targetRpe);

                                return (
                                  <View key={ex.exerciseId} style={styles.exerciseRowClean}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.exerciseRowCleanName}>
                                        {ex.order}. {ex.exerciseName}{' '}
                                        <Text style={{ color: '#64748B', fontSize: 11 }}>({ex.muscleGroup})</Text>
                                      </Text>
                                      <Text style={styles.exerciseRowCleanSpec}>
                                        {ex.targetSets} series × {ex.targetReps} reps · Pausa {ex.restSeconds}s · Objetivo:{' '}
                                        <Text style={{ color: primaryColor, fontWeight: '800' }}>
                                          RIR {rirVal} (RPE {ex.targetRpe})
                                        </Text>
                                      </Text>
                                      {ex.coachNotes ? (
                                        <Text style={styles.exerciseRowCleanNote}>
                                          📌 {ex.coachNotes}
                                        </Text>
                                      ) : null}
                                    </View>

                                    <TouchableOpacity
                                      style={styles.cleanSmallBtn}
                                      onPress={() => {
                                        if (isEditing) {
                                          setEditingExerciseKey(null);
                                        } else {
                                          setEditingExerciseKey(editKey);
                                          setEditSets(String(ex.targetSets));
                                          setEditReps(ex.targetReps);
                                          setEditRest(String(ex.restSeconds || 90));
                                          setEditRir(String(rirVal));
                                          setEditNotes(ex.coachNotes || '');
                                        }
                                      }}
                                    >
                                      <Text style={styles.cleanSmallBtnText}>
                                        {isEditing ? 'Cerrar' : 'Ajustar'}
                                      </Text>
                                    </TouchableOpacity>

                                    {isEditing && (
                                      <View style={styles.editFormInline}>
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.miniLabel}>Series:</Text>
                                            <TextInput
                                              style={styles.cleanInput}
                                              keyboardType="numeric"
                                              value={editSets}
                                              onChangeText={setEditSets}
                                            />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.miniLabel}>Repeticiones:</Text>
                                            <TextInput
                                              style={styles.cleanInput}
                                              value={editReps}
                                              onChangeText={setEditReps}
                                            />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.miniLabel}>Pausa (s):</Text>
                                            <TextInput
                                              style={styles.cleanInput}
                                              keyboardType="numeric"
                                              value={editRest}
                                              onChangeText={setEditRest}
                                            />
                                          </View>
                                        </View>
                                        <View style={{ marginBottom: 10 }}>
                                          <Text style={styles.miniLabel}>RIR Objetivo (Reps en recámara):</Text>
                                          <View style={{ flexDirection: 'row', gap: 6 }}>
                                            {RIR_TRAFFIC_PRESETS.map((p) => {
                                              const selected = editRir === String(p.rir);
                                              return (
                                                <TouchableOpacity
                                                  key={p.rir}
                                                  style={[
                                                    styles.rirChipMini,
                                                    { borderColor: p.color },
                                                    selected && { backgroundColor: p.color },
                                                  ]}
                                                  onPress={() => setEditRir(String(p.rir))}
                                                >
                                                  <Text
                                                    style={[
                                                      styles.rirChipMiniText,
                                                      selected
                                                        ? { color: '#FFF' }
                                                        : { color: p.color },
                                                    ]}
                                                  >
                                                    {p.label}
                                                  </Text>
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>
                                        </View>
                                        <Text style={styles.miniLabel}>Nota para el alumno:</Text>
                                        <TextInput
                                          style={styles.cleanInput}
                                          value={editNotes}
                                          onChangeText={setEditNotes}
                                          placeholder="Ej: Cuidar técnica..."
                                          placeholderTextColor="#64748B"
                                        />
                                        <TouchableOpacity
                                          style={[styles.primaryActionBtn, { backgroundColor: '#10B981', marginTop: 4 }]}
                                          onPress={() => {
                                            const rirNum = parseInt(editRir, 10) || 2;
                                            updateAthleteRoutineExercise(
                                              activeAthleteRoutine.id,
                                              day.dayId,
                                              ex.exerciseId,
                                              {
                                                targetSets: parseInt(editSets, 10) || ex.targetSets,
                                                targetReps: editReps.trim() || ex.targetReps,
                                                restSeconds: parseInt(editRest, 10) || ex.restSeconds,
                                                targetRir: rirNum,
                                                targetRpe: Math.max(6, 10 - rirNum),
                                                coachNotes: editNotes.trim(),
                                              }
                                            );
                                            setEditingExerciseKey(null);
                                          }}
                                        >
                                          <Text style={styles.primaryActionBtnText}>Guardar Ajuste</Text>
                                        </TouchableOpacity>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* =========================================================================
          VISTA 2: ARMAR RUTINA (SIMPLE, LIMPIO, PASO A PASO TRANQUILO)
          ========================================================================= */}
      {coachSection === 'planner' && (
        <View style={{ gap: 20 }}>
          {/* PASO 1: NOMBRE DEL PLAN */}
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>PASO 1</Text>
            <Text style={styles.cardTitle}>Nombre de la Rutina</Text>
            <TextInput
              style={styles.cleanInput}
              value={newTemplateName}
              onChangeText={setNewTemplateName}
              placeholder="Ej: Mesociclo 1 - Fuerza y Torso..."
              placeholderTextColor="#64748B"
            />
            <TextInput
              style={[styles.cleanInput, { marginBottom: 0 }]}
              value={newTemplateDesc}
              onChangeText={setNewTemplateDesc}
              placeholder="Objetivo o descripción corta..."
              placeholderTextColor="#64748B"
            />
          </View>

          {/* PASO 2: DÍAS Y EJERCICIOS */}
          <View style={styles.card}>
            <View style={styles.headerTopLine}>
              <View>
                <Text style={styles.cardEyebrow}>PASO 2</Text>
                <Text style={styles.cardTitle}>Días de Entrenamiento</Text>
              </View>
              <TouchableOpacity style={styles.ghostBtn} onPress={addDayToBuilder}>
                <Text style={[styles.ghostBtnText, { color: primaryColor }]}>+ Sumar Día</Text>
              </TouchableOpacity>
            </View>

            {/* Pestañas de días */}
            <View style={styles.dayTabsRowClean}>
              {builderDays.map((d, idx) => {
                const active = idx === activeBuilderDayIdx;
                return (
                  <TouchableOpacity
                    key={d.dayId}
                    style={[
                      styles.dayTabClean,
                      active && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setActiveBuilderDayIdx(idx)}
                  >
                    <Text style={[styles.dayTabCleanText, active && { color: '#FFF' }]}>
                      {d.name} ({d.exercises.length})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Editor del nombre del día */}
            <View style={styles.activeDayBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.activeDayLabel}>Nombre de este día:</Text>
                {builderDays.length > 1 && (
                  <TouchableOpacity onPress={() => removeDayFromBuilder(activeBuilderDayIdx)}>
                    <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>
                      Eliminar este día
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.cleanInput}
                value={currentBuilderDay.name}
                onChangeText={(txt) => updateBuilderDayName(activeBuilderDayIdx, txt)}
              />

              {/* LISTA DE EJERCICIOS DEL DÍA ORGANIZADA POR APARTADOS VISUALES */}
              <Text style={[styles.cardEyebrow, { marginTop: 12 }]}>
                ESTRUCTURA DE {currentBuilderDay.name.toUpperCase()} ({currentBuilderDay.exercises.length} EJERCICIOS)
              </Text>

              {currentBuilderDay.exercises.length === 0 ? (
                <View style={styles.emptyDayBox}>
                  <Text style={styles.emptyDayText}>
                    Todavía no agregaste ejercicios a este día. Usa el buscador de abajo para sumar.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 16, marginTop: 8 }}>
                  {/* APARTADO 1: ENTRADA EN CALOR & MOVILIDAD */}
                  <View style={styles.builderSegmentBoxWarmup}>
                    <View style={styles.builderSegmentHeaderRow}>
                      <View style={styles.builderSegmentBadgeWarmup}>
                        <Text style={styles.builderSegmentBadgeWarmupText}>APARTADO 1</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.builderSegmentTitleWarmup}>
                          🔥 ENTRADA EN CALOR & MOVILIDAD ({currentBuilderDay.exercises.filter((e) => e.blockType === 'warmup').length})
                        </Text>
                        <Text style={styles.builderSegmentSub}>
                          Ejercicios de activación y movilidad articular para este día
                        </Text>
                      </View>
                    </View>
                    <View style={styles.builderSegmentDividerLineWarmup} />

                    {currentBuilderDay.exercises.filter((e) => e.blockType === 'warmup').length === 0 ? (
                      <View style={styles.emptySegmentNotice}>
                        <Text style={styles.emptySegmentNoticeText}>
                          Sin ejercicios de entrada en calor todavía. (Filtrá por categorías de MOVILIDAD abajo para sumar)
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {currentBuilderDay.exercises.map((ex, exIdx) => {
                          if (ex.blockType !== 'warmup') return null;
                          return renderBuilderExerciseCard(ex, exIdx);
                        })}
                      </View>
                    )}
                  </View>

                  {/* LÍNEA DIVISORIA ESTRUCTURAL DE APARTADOS */}
                  <View style={styles.structuralDividerRowBuilder}>
                    <View style={styles.structuralDividerLine} />
                    <View style={styles.structuralDividerPillBuilder}>
                      <Text style={styles.structuralDividerTextBuilder}>
                        ⚡ SEPARACIÓN DE BLOQUES: ENTRADA EN CALOR ➔ CARGA PRINCIPAL
                      </Text>
                    </View>
                    <View style={styles.structuralDividerLine} />
                  </View>

                  {/* APARTADO 2: BLOQUE PRINCIPAL DE CARGA */}
                  <View style={[styles.builderSegmentBoxMain, { borderLeftColor: primaryColor }]}>
                    <View style={styles.builderSegmentHeaderRow}>
                      <View style={[styles.builderSegmentBadgeWarmup, { backgroundColor: '#431407', borderColor: primaryColor }]}>
                        <Text style={[styles.builderSegmentBadgeWarmupText, { color: primaryColor }]}>APARTADO 2</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.builderSegmentTitleWarmup, { color: primaryColor }]}>
                          ⚡ BLOQUE PRINCIPAL DE CARGA ({currentBuilderDay.exercises.filter((e) => e.blockType !== 'warmup').length})
                        </Text>
                        <Text style={styles.builderSegmentSub}>
                          Fuerza, hipertrofia y sobrecarga progresiva con semáforo RIR/RPE
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.builderSegmentDividerLineWarmup, { backgroundColor: primaryColor }]} />

                    {currentBuilderDay.exercises.filter((e) => e.blockType !== 'warmup').length === 0 ? (
                      <View style={styles.emptySegmentNotice}>
                        <Text style={styles.emptySegmentNoticeText}>
                          Sin ejercicios de fuerza principal aún. Usa el buscador de abajo para sumar.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {currentBuilderDay.exercises.map((ex, exIdx) => {
                          if (ex.blockType === 'warmup') return null;
                          return renderBuilderExerciseCard(ex, exIdx);
                        })}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* BUSCADOR DE EJERCICIOS PARA SUMAR */}
            <View style={{ marginTop: 16 }}>
              <Text style={styles.cardEyebrow}>BUSCADOR DE EJERCICIOS EFFORT (221)</Text>
              <TextInput
                style={styles.cleanInput}
                placeholder="🔍 Escribe para buscar (ej. banco, sentadilla, remo, hip, polea)..."
                placeholderTextColor="#64748B"
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
              />

              {/* Categorías limpias */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catFilterChip,
                        active && { backgroundColor: primaryColor, borderColor: primaryColor },
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[styles.catFilterText, active && { color: '#FFF' }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Lista limpia de ejercicios */}
              <View style={{ gap: 6 }}>
                {filteredCatalog.slice(0, 10).map((ex) => {
                  const inDay = currentBuilderDay.exercises.some((e) => e.exerciseId === ex.id);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      style={[
                        styles.catalogRowClean,
                        inDay && { borderColor: '#10B981', backgroundColor: '#0F231C' },
                      ]}
                      onPress={() => toggleExerciseInActiveDay(ex.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catalogRowName}>{ex.name}</Text>
                        <Text style={styles.catalogRowCat}>
                          {ex.muscleGroup} · {ex.equipment}
                        </Text>
                      </View>
                      <Text style={[styles.catalogRowAddText, inDay && { color: '#10B981' }]}>
                        {inDay ? '✓ Agregado' : '+ Agregar'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* PASO 3: ASIGNAR Y GUARDAR */}
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>PASO 3</Text>
            <Text style={styles.cardTitle}>Guardar y Asignar</Text>
            <Text style={styles.sectionSubtitle}>
              Total: {builderDays.length} días · {totalBuilderExercises} ejercicios.
            </Text>

            <Text style={[styles.miniLabel, { marginBottom: 8 }]}>Selecciona al alumno:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {gymAthletes.map((ath) => {
                const isSelected = assignToAthleteId === ath.id;
                const hasRoutine = userRoutines.some((ur) => ur.userId === ath.id && ur.isActive);
                return (
                  <TouchableOpacity
                    key={ath.id}
                    style={[
                      styles.assignAthletePill,
                      isSelected && { borderColor: primaryColor, backgroundColor: '#1A2333' },
                    ]}
                    onPress={() => setAssignToAthleteId(ath.id)}
                  >
                    <Text style={styles.assignAthletePillName}>{ath.displayName}</Text>
                    <Text style={{ fontSize: 10, color: hasRoutine ? '#10B981' : '#F59E0B' }}>
                      {hasRoutine ? 'Con rutina' : '⚠️ Sin rutina'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: primaryColor, flex: 2 }]}
                onPress={handleSaveAndAssignDirectly}
                disabled={totalBuilderExercises === 0}
              >
                <Text style={styles.primaryActionBtnText}>
                  Guardar y Asignar a{' '}
                  {gymAthletes.find((a) => a.id === assignToAthleteId)?.displayName.split(' ')[0] ||
                    'Alumno'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtnClean}
                onPress={handleSaveOnlyTemplate}
                disabled={totalBuilderExercises === 0}
              >
                <Text style={styles.secondaryActionBtnCleanText}>Solo Guardar Plantilla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          VISTA 3: CATÁLOGO DE EJERCICIOS (BIBLIOTECA COMPLETA)
          ========================================================================= */}
      {coachSection === 'catalog' && (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>BIBLIOTECA</Text>
          <Text style={styles.cardTitle}>Catálogo Effort Gym ({exercisesCatalog.length} ejercicios)</Text>

          {/* Banner Canal Oficial YouTube Effort Gym */}
          <TouchableOpacity
            style={styles.youtubeCoachBanner}
            onPress={() => Linking.openURL('https://www.youtube.com/@effortgym')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.youtubeCoachTitle}>📺 CANAL OFICIAL EFFORT GYM EN YOUTUBE</Text>
              <Text style={styles.youtubeCoachSub}>
                Videos técnicos y de movilidad articular grabados por los profesores: https://www.youtube.com/@effortgym
              </Text>
            </View>
            <View style={[styles.youtubeCoachBtn, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.youtubeCoachBtnText}>Ver Canal ▶</Text>
            </View>
          </TouchableOpacity>

          <TextInput
            style={[styles.cleanInput, { marginTop: 12 }]}
            placeholder="🔍 Buscar ejercicio por nombre o categoría..."
            placeholderTextColor="#64748B"
            value={exerciseSearch}
            onChangeText={setExerciseSearch}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catFilterChip,
                    active && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.catFilterText, active && { color: '#FFF' }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ gap: 6 }}>
            {filteredCatalog.slice(0, 30).map((ex) => (
              <View key={ex.id} style={styles.catalogItemRow}>
                <Text style={styles.catalogItemNameText}>{ex.name}</Text>
                <Text style={styles.catalogItemMetaText}>
                  {ex.muscleGroup} · {ex.equipment}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D14',
  },
  contentPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 20,
  },
  headerTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerGreeting: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
    backgroundColor: '#131A26',
  },
  ghostBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#131A26',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  tabBtnActive: {
    backgroundColor: '#1E293D',
    borderColor: '#334155',
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#F8FAFC',
  },
  formCard: {
    backgroundColor: '#131A26',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293D',
    marginBottom: 20,
  },
  formTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  cleanInput: {
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 10,
  },
  primaryActionBtn: {
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#131A26',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  cardEyebrow: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A2333',
  },
  alertIndicatorAmber: {
    width: 6,
    height: 36,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  alertIndicatorGreen: {
    width: 6,
    height: 36,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  alertIndicatorGray: {
    width: 6,
    height: 36,
    borderRadius: 3,
    backgroundColor: '#64748B',
  },
  alertAthleteTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  alertBodyText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  smallOutlineBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  smallOutlineBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  smallSolidBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallSolidBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  athleteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  athleteCardClean: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#0D131F',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  athleteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  athleteNameClean: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  athleteEmailClean: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  athleteRoutineStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  fichaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  fichaAthleteName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  fichaAthleteMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  ghostPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  ghostPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  subCardTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyNotice: {
    backgroundColor: '#0D131F',
    borderRadius: 8,
    padding: 12,
  },
  emptyNoticeText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  dayBoxClean: {
    backgroundColor: '#0D131F',
    borderRadius: 8,
    padding: 12,
  },
  dayBoxCleanTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  exerciseRowClean: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A2333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseRowCleanName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseRowCleanSpec: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  exerciseRowCleanNote: {
    color: '#F59E0B',
    fontSize: 11,
    marginTop: 2,
  },
  cleanSmallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1E293D',
  },
  cleanSmallBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  editFormInline: {
    width: '100%',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293D',
  },
  miniLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  dayTabsRowClean: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  dayTabClean: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  dayTabCleanText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  activeDayBox: {
    backgroundColor: '#0D131F',
    borderRadius: 10,
    padding: 12,
  },
  activeDayLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyDayBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#131A26',
    borderRadius: 8,
    marginTop: 8,
  },
  emptyDayText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
  builderExerciseCard: {
    backgroundColor: '#131A26',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  builderExTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  builderExCat: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  deleteExBtn: {
    padding: 4,
  },
  controlsRowClean: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  controlCol: {
    gap: 4,
  },
  controlMiniLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  stepperClean: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D131F',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  stepperActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperActionText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800',
  },
  stepperNumberText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  presetChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  catFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
    marginRight: 6,
  },
  catFilterText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  catalogRowClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0D131F',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  catalogRowName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  catalogRowCat: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  catalogRowAddText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
  },
  assignAthletePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
    minWidth: 130,
  },
  assignAthletePillName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryActionBtnClean: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#1E293D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnCleanText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  catalogItemRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293D',
  },
  catalogItemNameText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  catalogItemMetaText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  routineSectionSubHeader: {
    backgroundColor: '#0D131F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  routineSectionSubHeaderText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  rirChipMini: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#0D131F',
  },
  rirChipMiniText: {
    fontSize: 11,
    fontWeight: '800',
  },
  blockTypeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  blockTypeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
    backgroundColor: '#0D131F',
  },
  blockTypeBtnWarmupActive: {
    backgroundColor: '#451A03',
    borderColor: '#EAB308',
  },
  blockTypeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  blockTypeBtnTextWarmupActive: {
    color: '#FDE047',
    fontWeight: '800',
  },
  restPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
    backgroundColor: '#0D131F',
  },
  restPresetChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  rirTrafficChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 70,
  },
  rirTrafficChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rirTrafficChipSub: {
    fontSize: 9,
    marginTop: 1,
  },
  semaforoDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  youtubeCoachBanner: {
    backgroundColor: '#0D131F',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
    gap: 10,
  },
  youtubeCoachTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  youtubeCoachSub: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  youtubeCoachBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  youtubeCoachBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  // APARTADOS Y LÍNEAS DIVISORIAS EN FICHA DEL ALUMNO
  coachSegmentBoxWarmup: {
    backgroundColor: '#0F1622',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  coachSegmentBoxMain: {
    backgroundColor: '#0F1622',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  coachSegmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  coachSegmentBadgeWarmup: {
    backgroundColor: '#451A03',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  coachSegmentBadgeWarmupText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  coachSegmentTitleWarmup: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  coachSegmentSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  coachSegmentDividerLineWarmup: {
    height: 1,
    backgroundColor: '#1E293D',
    marginVertical: 8,
  },
  coachDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  coachDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E293D',
  },
  coachDividerPill: {
    backgroundColor: '#131A26',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  coachDividerPillText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // APARTADOS Y LÍNEAS DIVISORIAS EN PLANIFICADOR (BUILDER)
  builderSegmentBoxWarmup: {
    backgroundColor: '#0F1622',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  builderSegmentBoxMain: {
    backgroundColor: '#0F1622',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
    padding: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  builderSegmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  builderSegmentBadgeWarmup: {
    backgroundColor: '#451A03',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  builderSegmentBadgeWarmupText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  builderSegmentTitleWarmup: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  builderSegmentSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  builderSegmentDividerLineWarmup: {
    height: 1,
    backgroundColor: '#1E293D',
    marginVertical: 8,
  },
  emptySegmentNotice: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#131A26',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  emptySegmentNoticeText: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  structuralDividerRowBuilder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  structuralDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E293D',
  },
  structuralDividerPillBuilder: {
    backgroundColor: '#131A26',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  structuralDividerTextBuilder: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
