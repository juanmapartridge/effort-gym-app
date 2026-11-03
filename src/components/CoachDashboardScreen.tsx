import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useGymStore } from '../store/useGymStore';
import { RoutineDay, RoutineExerciseItem } from '../types/models';
import { AthleteLoadAnalyticsPanel } from './AnalyticsChartsScreen';

const QUICK_REP_OPTIONS = [
  { label: '5-6 (Fuerza)', value: '5-6' },
  { label: '8-10 (Hipertrofia)', value: '8-10' },
  { label: '10-12 (Tono)', value: '10-12' },
  { label: '12-15 (Resistencia)', value: '12-15' },
];

const QUICK_RPE_OPTIONS = [
  { rpe: 7, label: '7 · Fácil', desc: '3 reps en reserva' },
  { rpe: 8, label: '8 · Óptimo', desc: '2 reps en reserva (ideal)' },
  { rpe: 9, label: '9 · Exigente', desc: '1 rep en reserva' },
  { rpe: 10, label: '10 · Al Fallo', desc: 'Esfuerzo máximo' },
];

const QUICK_REST_OPTIONS = [
  { sec: 60, label: '60s' },
  { sec: 90, label: '90s' },
  { sec: 120, label: '120s' },
  { sec: 180, label: '180s' },
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

  // Sub-sección activa del Estudio del Entrenador
  const [coachSection, setCoachSection] = useState<'planner' | 'athletes' | 'catalog'>('planner');

  // Buscador de alumnos
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(
    gymAthletes[0]?.id || ''
  );
  const [showChartsInFicha, setShowChartsInFicha] = useState<boolean>(true);

  // Buscador y filtro del catálogo de 221 ejercicios de Effort Gym
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

  // --- ESTADO DEL PLANIFICADOR DIDÁCTICO DE RUTINAS ---
  const [newTemplateName, setNewTemplateName] = useState('Mesociclo 1: Fuerza y Tren Superior Effort');
  const [newTemplateDesc, setNewTemplateDesc] = useState('Bloque de 4 semanas con sobrecarga progresiva y control de RPE');
  const [templateFocus, setTemplateFocus] = useState<'hipertrofia' | 'fuerza' | 'funcional' | 'postural'>('hipertrofia');
  const [builderDays, setBuilderDays] = useState<RoutineDay[]>([
    {
      dayId: 'day_builder_1',
      name: 'Día 1 - Tren Superior & Tracciones',
      exercises: [
        {
          order: 1,
          exerciseId: 'ex_c1164817',
          exerciseName: 'PRESS BANCO PLANO C/BARRA',
          muscleGroup: 'HEMISFERIO SUPERIOR',
          targetSets: 4,
          targetReps: '6-8',
          targetRpe: 8,
          restSeconds: 120,
          coachNotes: 'Pausa de 1 segundo en el pecho antes de empujar con fuerza.',
        },
        {
          order: 2,
          exerciseId: 'ex_4b57ae32',
          exerciseName: 'REMO 90 POLEA C/MANIJA',
          muscleGroup: 'HEMISFERIO SUPERIOR',
          targetSets: 3,
          targetReps: '8-10',
          targetRpe: 8,
          restSeconds: 90,
          coachNotes: 'Cuidar retracción de escápulas sin tironear con la espalda baja.',
        },
      ],
    },
    {
      dayId: 'day_builder_2',
      name: 'Día 2 - Tren Inferior & Core',
      exercises: [
        {
          order: 1,
          exerciseId: 'ex_032d7308',
          exerciseName: 'HIP THRUST C/BARRA',
          muscleGroup: 'HEMISFERIO INFERIOR',
          targetSets: 4,
          targetReps: '8-10',
          targetRpe: 8,
          restSeconds: 90,
          coachNotes: 'Apretar glúteos 1 segundo arriba y apoyar mentón al pecho.',
        },
        {
          order: 2,
          exerciseId: 'ex_644caa81',
          exerciseName: 'PALLOF PRESS C/BANDA',
          muscleGroup: 'ZONA MEDIA',
          targetSets: 3,
          targetReps: '12-15',
          targetRpe: 7.5,
          restSeconds: 60,
          coachNotes: 'Mantener cadera neutra y respiración controlada.',
        },
      ],
    },
  ]);
  const [activeBuilderDayIdx, setActiveBuilderDayIdx] = useState<number>(0);

  // Alumno seleccionado para asignar directamente en el planificador
  const defaultUnassignedAthlete =
    gymAthletes.find((a) => !userRoutines.some((ur) => ur.userId === a.id && ur.isActive))?.id ||
    gymAthletes[0]?.id ||
    '';
  const [assignToAthleteId, setAssignToAthleteId] = useState<string>(defaultUnassignedAthlete);

  // Edición rápida de ejercicio en ficha individual
  const [editingExerciseKey, setEditingExerciseKey] = useState<string | null>(null);
  const [editSets, setEditSets] = useState('4');
  const [editReps, setEditReps] = useState('6-8');
  const [editNotes, setEditNotes] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');

  const filteredAthletes = gymAthletes.filter(
    (a) =>
      a.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // --- ACCIONES DEL PLANIFICADOR DIDÁCTICO ---
  const addDayToBuilder = () => {
    const nextNum = builderDays.length + 1;
    const newDay: RoutineDay = {
      dayId: `day_builder_${Date.now()}`,
      name: `Día ${nextNum} - Bloque ${nextNum}`,
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
      const newEx: RoutineExerciseItem = {
        order: currentDay.exercises.length + 1,
        exerciseId: catEx.id,
        exerciseName: catEx.name,
        muscleGroup: catEx.muscleGroup,
        targetSets: 3,
        targetReps: '8-10',
        targetRpe: 8,
        restSeconds: 90,
        coachNotes: 'Controlar recorrido y técnica limpia.',
      };
      currentDay.exercises = [...currentDay.exercises, newEx];
    }

    updated[activeBuilderDayIdx] = currentDay;
    setBuilderDays(updated);
  };

  const updateBuilderExerciseField = (
    exIdx: number,
    field: 'targetSets' | 'targetReps' | 'targetRpe' | 'restSeconds' | 'coachNotes',
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
    } else if (field === 'targetReps') {
      target.targetReps = String(val);
    } else if (field === 'restSeconds') {
      target.restSeconds = Math.max(30, parseInt(String(val), 10) || 90);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      {/* 1. CABECERA PRINCIPAL: STUDIO DEL PROFESOR GIAN BOASSO */}
      <View style={styles.coachNavHeader}>
        <View style={styles.coachNavHeaderTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.coachNavEyebrow, { color: primaryColor }]}>
              STUDIO DEL ENTRENADOR · EFFORT GYM
            </Text>
            <Text style={styles.coachNavTitle}>
              Planificación Didáctica y Monitoreo de Alumnos
            </Text>
            <Text style={styles.coachNavDesc}>
              Cargá rutinas paso a paso para tus alumnos, ajustá series y RPE, y auditá la
              evolución semanal de carga usando los {exercisesCatalog.length} ejercicios reales.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.newAthleteQuickBtn}
            onPress={() => setShowNewAthleteForm(!showNewAthleteForm)}
          >
            <Text style={styles.newAthleteQuickBtnText}>
              {showNewAthleteForm ? '✕ Cancelar' : '+ Nuevo Alumno'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. PESTAÑAS PRINCIPALES DEL PANEL DEL PROFESOR */}
        <View style={styles.coachSubTabsRow}>
          <TouchableOpacity
            style={[
              styles.coachSubTabBtn,
              coachSection === 'planner' && {
                borderColor: primaryColor,
                backgroundColor: '#1E293B',
              },
            ]}
            onPress={() => setCoachSection('planner')}
          >
            <Text
              style={[
                styles.coachSubTabBtnText,
                coachSection === 'planner' && { color: '#F8FAFC', fontWeight: '800' },
              ]}
            >
              🛠️ Creador & Asignador de Rutinas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.coachSubTabBtn,
              coachSection === 'athletes' && {
                borderColor: primaryColor,
                backgroundColor: '#1E293B',
              },
            ]}
            onPress={() => setCoachSection('athletes')}
          >
            <Text
              style={[
                styles.coachSubTabBtnText,
                coachSection === 'athletes' && { color: '#F8FAFC', fontWeight: '800' },
              ]}
            >
              👥 Alumnos & Fichas de Carga ({gymAthletes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.coachSubTabBtn,
              coachSection === 'catalog' && {
                borderColor: primaryColor,
                backgroundColor: '#1E293B',
              },
            ]}
            onPress={() => setCoachSection('catalog')}
          >
            <Text
              style={[
                styles.coachSubTabBtnText,
                coachSection === 'catalog' && { color: '#F8FAFC', fontWeight: '800' },
              ]}
            >
              📚 Catálogo de Ejercicios ({exercisesCatalog.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FORMULARIO DE ALTA RÁPIDA DE ALUMNO (SI SE ABRE) */}
      {showNewAthleteForm && (
        <View style={styles.createFormCard}>
          <Text style={styles.sectionTitle}>Dar de Alta Nuevo Alumno en Effort Gym</Text>
          <Text style={styles.sectionSubtitle}>
            Una vez creado, podrás asignarle una rutina o planificarle su primer bloque de
            entrenamiento.
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Nombre y Apellido (ej. Tomás Gómez)"
            placeholderTextColor="#64748B"
            value={newAthleteName}
            onChangeText={setNewAthleteName}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Email del alumno (ej. tomas@gmail.com)"
            placeholderTextColor="#64748B"
            value={newAthleteEmail}
            onChangeText={setNewAthleteEmail}
          />
          <TouchableOpacity
            style={[styles.saveTemplateBtn, { backgroundColor: '#10B981' }]}
            onPress={handleCreateAthlete}
          >
            <Text style={styles.saveTemplateBtnText}>Guardar Alumno en el Gimnasio ✓</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* =========================================================================
          SECCIÓN 1: EL PLANIFICADOR Y CREADOR DIDÁCTICO DE RUTINAS
          ========================================================================= */}
      {coachSection === 'planner' && (
        <View>
          {/* GUÍA DIDÁCTICA SUPERIOR */}
          <View style={styles.didacticBanner}>
            <Text style={[styles.didacticEyebrow, { color: primaryColor }]}>
              PASO A PASO · CÓMO ARMAR Y ASIGNAR UN PLAN
            </Text>
            <View style={styles.stepsRoadmapRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumCircle, { backgroundColor: primaryColor }]}>
                  <Text style={styles.stepNumText}>1</Text>
                </View>
                <Text style={styles.stepTitle}>Datos y Enfoque</Text>
              </View>
              <Text style={styles.stepArrow}>➔</Text>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumCircle, { backgroundColor: primaryColor }]}>
                  <Text style={styles.stepNumText}>2</Text>
                </View>
                <Text style={styles.stepTitle}>Días Semanales</Text>
              </View>
              <Text style={styles.stepArrow}>➔</Text>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumCircle, { backgroundColor: primaryColor }]}>
                  <Text style={styles.stepNumText}>3</Text>
                </View>
                <Text style={styles.stepTitle}>Elegir Ejercicios</Text>
              </View>
              <Text style={styles.stepArrow}>➔</Text>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumCircle, { backgroundColor: primaryColor }]}>
                  <Text style={styles.stepNumText}>4</Text>
                </View>
                <Text style={styles.stepTitle}>Series, Reps & RPE</Text>
              </View>
              <Text style={styles.stepArrow}>➔</Text>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumCircle, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.stepNumText}>5</Text>
                </View>
                <Text style={styles.stepTitle}>Asignar al Alumno</Text>
              </View>
            </View>
          </View>

          {/* PASO 1: DATOS Y ENFOQUE DEL PLAN */}
          <View style={styles.card}>
            <Text style={styles.stepHeaderTag}>PASO 1 DE 5 · DATOS DEL BLOQUE</Text>
            <Text style={styles.sectionTitle}>Nombre y Objetivo del Plan</Text>

            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Nombre de la Rutina:</Text>
              <Text style={styles.inputHint}>Ej: Mesociclo 1 - Fuerza y Torso</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Nombre del plan..."
              placeholderTextColor="#64748B"
              value={newTemplateName}
              onChangeText={setNewTemplateName}
            />

            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Objetivo pedagógico o indicación general:</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: 4 semanas de volumen con foco en sobrecarga y recuperación..."
              placeholderTextColor="#64748B"
              value={newTemplateDesc}
              onChangeText={setNewTemplateDesc}
            />

            <Text style={[styles.inputLabel, { marginTop: 4, marginBottom: 8 }]}>
              Enfoque principal del bloque:
            </Text>
            <View style={styles.focusChipsRow}>
              {[
                { id: 'hipertrofia', label: '💪 Hipertrofia (Volumen)' },
                { id: 'fuerza', label: '🏋️ Fuerza (Carga Máxima)' },
                { id: 'funcional', label: '⚡ Funcional & Movilidad' },
                { id: 'postural', label: '🧘 Salud & Postura' },
              ].map((f) => {
                const active = templateFocus === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.focusChip,
                      active && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setTemplateFocus(f.id as any)}
                  >
                    <Text style={[styles.focusChipText, active && { color: '#FFF' }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* PASO 2: ESTRUCTURA SEMANAL DE DÍAS */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.stepHeaderTag}>PASO 2 DE 5 · DÍAS DE ENTRENAMIENTO</Text>
                <Text style={styles.sectionTitle}>
                  Estructura Semanal ({builderDays.length} Días)
                </Text>
              </View>
              <TouchableOpacity style={styles.addDayActionBtn} onPress={addDayToBuilder}>
                <Text style={[styles.addDayActionText, { color: primaryColor }]}>
                  + Sumar Día
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.builderDaysTabRow}>
              {builderDays.map((d, idx) => {
                const active = idx === activeBuilderDayIdx;
                return (
                  <TouchableOpacity
                    key={d.dayId}
                    style={[
                      styles.builderDayTab,
                      active && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setActiveBuilderDayIdx(idx)}
                  >
                    <Text style={[styles.builderDayTabText, active && { color: '#FFF' }]}>
                      {d.name.split('-')[0].trim()} ({d.exercises.length} ejer.)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Editor del nombre del día activo */}
            <View style={styles.activeDayEditBanner}>
              <View style={styles.dayNameEditRow}>
                <Text style={styles.activeDayEditTitle}>
                  Editando: <Text style={{ color: primaryColor }}>{currentBuilderDay.name}</Text>
                </Text>
                {builderDays.length > 1 && (
                  <TouchableOpacity onPress={() => removeDayFromBuilder(activeBuilderDayIdx)}>
                    <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>
                      🗑 Eliminar este día
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.textInput, { marginBottom: 0 }]}
                value={currentBuilderDay.name}
                onChangeText={(txt) => updateBuilderDayName(activeBuilderDayIdx, txt)}
                placeholder="Nombre del día (ej. Día 1 - Tren Superior)..."
                placeholderTextColor="#64748B"
              />
            </View>
          </View>

          {/* PASO 3 & 4: EJERCICIOS AGREGADOS AL DÍA Y SELECTOR DIDÁCTICO */}
          <View style={styles.card}>
            <Text style={styles.stepHeaderTag}>
              PASO 3 Y 4 · EJERCICIOS DEL DÍA ({currentBuilderDay.exercises.length})
            </Text>
            <Text style={styles.sectionTitle}>
              Ejercicios cargados en "{currentBuilderDay.name}"
            </Text>
            <Text style={styles.sectionSubtitle}>
              Ajustá las series, repeticiones y esfuerzo RPE deseado para cada ejercicio de este
              día.
            </Text>

            {currentBuilderDay.exercises.length === 0 ? (
              <View style={styles.emptyDayHint}>
                <Text style={styles.emptyDayHintIcon}>👇</Text>
                <Text style={styles.emptyDayHintText}>
                  Todavía no sumaste ejercicios a este día. Usá el buscador didáctico de abajo y
                  tocá cualquier ejercicio del catálogo para agregarlo.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12, marginBottom: 16 }}>
                {currentBuilderDay.exercises.map((ex, exIdx) => (
                  <View key={ex.exerciseId} style={styles.didacticExerciseCard}>
                    {/* Header del Ejercicio en el Día */}
                    <View style={styles.didacticExHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.didacticExNumber}>#{ex.order}</Text>
                          <Text style={styles.didacticExTitle}>{ex.exerciseName}</Text>
                        </View>
                        <Text style={[styles.didacticExCat, { color: primaryColor }]}>
                          {ex.muscleGroup}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.didacticRemoveBtn}
                        onPress={() => toggleExerciseInActiveDay(ex.exerciseId)}
                      >
                        <Text style={styles.didacticRemoveText}>🗑 Quitar</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Controles Didácticos de Carga: Series, Reps, RPE y Pausa */}
                    <View style={styles.didacticControlsGrid}>
                      {/* Control 1: Series */}
                      <View style={styles.controlBox}>
                        <Text style={styles.controlLabel}>Series:</Text>
                        <View style={styles.stepperRow}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() =>
                              updateBuilderExerciseField(
                                exIdx,
                                'targetSets',
                                Math.max(1, ex.targetSets - 1)
                              )
                            }
                          >
                            <Text style={styles.stepperBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.stepperValText}>{ex.targetSets}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() =>
                              updateBuilderExerciseField(exIdx, 'targetSets', ex.targetSets + 1)
                            }
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Control 2: Repeticiones con Chips rápidos */}
                      <View style={[styles.controlBox, { flex: 2 }]}>
                        <Text style={styles.controlLabel}>Rango de Repeticiones:</Text>
                        <View style={styles.quickChipsWrap}>
                          {QUICK_REP_OPTIONS.map((opt) => {
                            const isMatch = ex.targetReps === opt.value;
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                style={[
                                  styles.quickChip,
                                  isMatch && { backgroundColor: primaryColor, borderColor: primaryColor },
                                ]}
                                onPress={() =>
                                  updateBuilderExerciseField(exIdx, 'targetReps', opt.value)
                                }
                              >
                                <Text
                                  style={[
                                    styles.quickChipText,
                                    isMatch && { color: '#FFF', fontWeight: '800' },
                                  ]}
                                >
                                  {opt.value}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    {/* Control 3: RPE con Guía Didáctica en Vivo */}
                    <View style={styles.rpeControlSection}>
                      <View style={styles.rpeLabelRow}>
                        <Text style={styles.controlLabel}>
                          Esfuerzo Sugerido (RPE) para el Alumno:
                        </Text>
                        <Text style={styles.rpeCurrentExplain}>
                          RPE {ex.targetRpe} ={' '}
                          {ex.targetRpe === 10
                            ? 'Al fallo muscular (0 reps en reserva)'
                            : ex.targetRpe === 9
                            ? '1 repetición en reserva'
                            : ex.targetRpe === 8
                            ? '2 repeticiones en reserva (Zona óptima de hipertrofia)'
                            : '3 repeticiones en reserva (Moderado)'}
                        </Text>
                      </View>

                      <View style={styles.rpeChipsRow}>
                        {QUICK_RPE_OPTIONS.map((opt) => {
                          const active = ex.targetRpe === opt.rpe;
                          return (
                            <TouchableOpacity
                              key={opt.rpe}
                              style={[
                                styles.rpeChipBtn,
                                active && {
                                  borderColor: primaryColor,
                                  backgroundColor: '#1E293B',
                                },
                              ]}
                              onPress={() => updateBuilderExerciseField(exIdx, 'targetRpe', opt.rpe)}
                            >
                              <Text
                                style={[
                                  styles.rpeChipBtnTitle,
                                  active && { color: primaryColor, fontWeight: '800' },
                                ]}
                              >
                                {opt.label}
                              </Text>
                              <Text style={styles.rpeChipBtnSub}>{opt.desc}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Control 4: Descanso entre series */}
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.controlLabel}>Descanso entre series:</Text>
                      <View style={styles.quickChipsWrap}>
                        {QUICK_REST_OPTIONS.map((r) => {
                          const active = ex.restSeconds === r.sec;
                          return (
                            <TouchableOpacity
                              key={r.sec}
                              style={[
                                styles.quickChip,
                                active && { backgroundColor: '#38BDF8', borderColor: '#38BDF8' },
                              ]}
                              onPress={() =>
                                updateBuilderExerciseField(exIdx, 'restSeconds', r.sec)
                              }
                            >
                              <Text
                                style={[
                                  styles.quickChipText,
                                  active && { color: '#0F172A', fontWeight: '800' },
                                ]}
                              >
                                {r.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Control 5: Nota Técnica del Profesor para este ejercicio */}
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.controlLabel}>
                        Indicación técnica para el alumno en sala:
                      </Text>
                      <TextInput
                        style={styles.coachNoteInput}
                        value={ex.coachNotes}
                        onChangeText={(v) => updateBuilderExerciseField(exIdx, 'coachNotes', v)}
                        placeholder="Ej: Cuidar recorrido completo, bajada lenta en 2s..."
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* BUSCADOR Y CATÁLOGO DIDÁCTICO PARA SUMAR AL DÍA */}
            <View style={styles.catalogSelectorSection}>
              <Text style={styles.subLabel}>
                🔍 Buscador y Catálogo de Effort Gym ({exercisesCatalog.length} ejercicios disponibles) —
                Toca para sumar a "{currentBuilderDay.name}":
              </Text>

              <TextInput
                style={styles.textInput}
                placeholder="Buscar ejercicio (ej: PRESS, SQUAT, REMO, HIP, PALLOF, MOVILIDAD...)"
                placeholderTextColor="#64748B"
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
              />

              {/* Filtro horizontal de Categorías */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
              >
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        active && { backgroundColor: primaryColor, borderColor: primaryColor },
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[styles.catChipText, active && { color: '#FFF' }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Grilla didáctica de Ejercicios */}
              <View style={styles.catalogSelectGrid}>
                {filteredCatalog.slice(0, 18).map((ex) => {
                  const inActiveDay = currentBuilderDay.exercises.some(
                    (e) => e.exerciseId === ex.id
                  );
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      style={[
                        styles.catalogSelectCard,
                        inActiveDay && { borderColor: '#10B981', backgroundColor: '#064E3B' },
                      ]}
                      onPress={() => toggleExerciseInActiveDay(ex.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catalogSelectName}>{ex.name}</Text>
                        <Text style={[styles.catalogSelectCat, { color: primaryColor }]}>
                          {ex.muscleGroup} · {ex.equipment}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.catalogSelectBadge,
                          { color: inActiveDay ? '#A7F3D0' : primaryColor },
                        ]}
                      >
                        {inActiveDay ? '✓ En este día' : '+ Sumar'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* PASO 5: RESUMEN DEL PLAN Y ASIGNACIÓN DIRECTA A ALUMNO */}
          <View style={[styles.card, { borderColor: '#10B981' }]}>
            <Text style={[styles.stepHeaderTag, { color: '#10B981' }]}>
              PASO 5 DE 5 · GUARDAR Y ASIGNAR
            </Text>
            <Text style={styles.sectionTitle}>
              Resumen del Plan: {newTemplateName || 'Sin Nombre'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              Total: {builderDays.length} días configurados · {totalBuilderExercises} ejercicios en
              total.
            </Text>

            <View style={styles.assignToAthleteBox}>
              <Text style={styles.assignToLabel}>
                Selecciona a qué alumno querés asignarle este plan inmediatamente:
              </Text>
              <View style={styles.athletesToAssignRow}>
                {gymAthletes.map((ath) => {
                  const isSelected = assignToAthleteId === ath.id;
                  const hasActiveRoutine = userRoutines.some(
                    (ur) => ur.userId === ath.id && ur.isActive
                  );
                  return (
                    <TouchableOpacity
                      key={ath.id}
                      style={[
                        styles.athleteAssignPill,
                        isSelected && { borderColor: primaryColor, backgroundColor: '#1E293B' },
                      ]}
                      onPress={() => setAssignToAthleteId(ath.id)}
                    >
                      <Text style={styles.athleteAssignName}>{ath.displayName}</Text>
                      <Text
                        style={[
                          styles.athleteAssignStatus,
                          { color: hasActiveRoutine ? '#10B981' : '#F59E0B' },
                        ]}
                      >
                        {hasActiveRoutine ? 'Tiene rutina activa' : '⚠️ Sin rutina'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.finalActionsRow}>
              <TouchableOpacity
                style={[styles.saveAndAssignBtn, { backgroundColor: primaryColor }]}
                onPress={handleSaveAndAssignDirectly}
                disabled={totalBuilderExercises === 0}
              >
                <Text style={styles.saveAndAssignBtnText}>
                  ⚡ Guardar y Asignar a{' '}
                  {gymAthletes.find((a) => a.id === assignToAthleteId)?.displayName.split(' ')[0] ||
                    'Alumno'}{' '}
                  ▶
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveCatalogOnlyBtn}
                onPress={handleSaveOnlyTemplate}
                disabled={totalBuilderExercises === 0}
              >
                <Text style={styles.saveCatalogOnlyText}>
                  💾 Guardar solo en Catálogo de Plantillas
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          SECCIÓN 2: ALUMNOS, ALERTAS DE CARGA Y AUDITORÍA
          ========================================================================= */}
      {coachSection === 'athletes' && (
        <View>
          {/* RADAR DE ALERTAS DE PLANIFICACIÓN */}
          <View style={styles.coachAlertsCard}>
            <View style={styles.coachAlertsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.coachAlertsEyebrow, { color: primaryColor }]}>
                  SEGUIMIENTO DE ALUMNOS EN SALA · EFFORT GYM
                </Text>
                <Text style={styles.coachAlertsTitle}>Alertas de Planificación y Carga</Text>
              </View>
              <View style={styles.liveAuditedBadge}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.liveAuditedText}>3 Alumnos en sala</Text>
              </View>
            </View>

            <View style={styles.alertsGrid}>
              {/* Alerta Martín: Sugerencia de Deload */}
              <View style={[styles.alertItemBox, { borderColor: '#F59E0B' }]}>
                <View style={styles.alertItemHeader}>
                  <View style={styles.alertBadgeRow}>
                    <Text style={styles.alertIcon}>⚠️</Text>
                    <Text
                      style={[
                        styles.alertTag,
                        { color: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.15)' },
                      ]}
                    >
                      Sugerencia de Descarga (Deload)
                    </Text>
                  </View>
                  <Text style={styles.alertAthleteName}>Martín Echeverría</Text>
                </View>
                <Text style={styles.alertText}>
                  Completó <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>4 semanas seguidas</Text>{' '}
                  subiendo cargas (<Text style={{ color: '#10B981', fontWeight: '700' }}>+13.7% en volumen</Text>)
                  con esfuerzo exigente (RPE <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>8.2 promedio</Text>).
                  Su 1RM estimado en Press Banco Plano escaló a 104.5 kg.
                </Text>
                <View style={styles.alertActionRow}>
                  <Text style={styles.alertRecommendation}>
                    💡 Sugerencia del entrenador: Conviene programar 1 semana de descarga para que
                    asimile el estímulo y no acumule fatiga excesiva.
                  </Text>
                  <TouchableOpacity
                    style={[styles.alertActionBtn, { borderColor: primaryColor }]}
                    onPress={() => setSelectedAthleteId('usr_athlete_1')}
                  >
                    <Text style={[styles.alertActionBtnText, { color: primaryColor }]}>
                      Ver Ficha de Martín ▶
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Alerta Sofía: Progresión en Hemisferio Inferior */}
              <View style={[styles.alertItemBox, { borderColor: '#10B981' }]}>
                <View style={styles.alertItemHeader}>
                  <View style={styles.alertBadgeRow}>
                    <Text style={styles.alertIcon}>📈</Text>
                    <Text
                      style={[
                        styles.alertTag,
                        { color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)' },
                      ]}
                    >
                      Excelente Progresión (+20.4%)
                    </Text>
                  </View>
                  <Text style={styles.alertAthleteName}>Sofía Martínez</Text>
                </View>
                <Text style={styles.alertText}>
                  Aumentó un <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>20.4% su volumen en Hemisferio Inferior</Text>{' '}
                  este mes. Marcó su mejor marca en <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>Hip Thrust (82.5 kg × 8 reps)</Text>{' '}
                  manteniendo RPE 8.0.
                </Text>
                <View style={styles.alertActionRow}>
                  <Text style={styles.alertRecommendation}>
                    🎯 Respuesta excelente al entrenamiento: Lista para consolidar la carga o sumar kilos
                    en el próximo bloque.
                  </Text>
                  <TouchableOpacity
                    style={[styles.alertActionBtn, { borderColor: primaryColor }]}
                    onPress={() => setSelectedAthleteId('usr_athlete_2')}
                  >
                    <Text style={[styles.alertActionBtnText, { color: primaryColor }]}>
                      Ver Ficha de Sofía ▶
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Alerta Valentín: Sin rutina */}
              <View style={[styles.alertItemBox, { borderColor: '#6366F1' }]}>
                <View style={styles.alertItemHeader}>
                  <View style={styles.alertBadgeRow}>
                    <Text style={styles.alertIcon}>📋</Text>
                    <Text
                      style={[
                        styles.alertTag,
                        { color: '#818CF8', backgroundColor: 'rgba(99, 102, 241, 0.15)' },
                      ]}
                    >
                      Sin Rutina Asignada
                    </Text>
                  </View>
                  <Text style={styles.alertAthleteName}>Valentín Acosta (Nuevo)</Text>
                </View>
                <Text style={styles.alertText}>
                  Alumno nuevo ingresado a Effort Gym que todavía no tiene su plan de entrenamiento cargado.
                </Text>
                <View style={styles.alertActionRow}>
                  <Text style={styles.alertRecommendation}>
                    📋 Podés armarle una rutina en el Planificador o asignarle una plantilla maestra existente.
                  </Text>
                  <TouchableOpacity
                    style={[styles.alertActionBtnSolid, { backgroundColor: primaryColor }]}
                    onPress={() => {
                      assignTemplateToAthlete('tmpl_effort_4d', 'usr_athlete_3');
                      setSelectedAthleteId('usr_athlete_3');
                    }}
                  >
                    <Text style={styles.alertActionBtnSolidText}>
                      + Asignar Plantilla en 1 Clic
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* SELECTOR DE ALUMNO PARA AUDITAR FICHA */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Selecciona un Alumno para ver su Carga y Ajustar ({gymAthletes.length})
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Buscar alumno..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.athleteRow}>
              {filteredAthletes.map((ath) => {
                const active = activeAthlete?.id === ath.id;
                const currentRoutine = userRoutines.find(
                  (ur) => ur.userId === ath.id && ur.isActive
                );
                return (
                  <TouchableOpacity
                    key={ath.id}
                    style={[
                      styles.athleteCard,
                      active && { borderColor: primaryColor, backgroundColor: '#1E293B' },
                    ]}
                    onPress={() => setSelectedAthleteId(ath.id)}
                  >
                    <View style={styles.athleteTopLine}>
                      <Text style={styles.athleteName}>{ath.displayName}</Text>
                      {active && (
                        <Text style={[styles.selectedPill, { backgroundColor: primaryColor }]}>
                          Activo
                        </Text>
                      )}
                    </View>
                    <Text style={styles.athleteEmail}>{ath.email}</Text>
                    <Text
                      style={[
                        styles.athleteRoutineBadge,
                        { color: currentRoutine ? '#10B981' : '#F59E0B' },
                      ]}
                    >
                      {currentRoutine ? `✓ ${currentRoutine.name}` : '⚠️ Sin rutina asignada'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* FICHA INTEGRAL DEL ALUMNO SELECCIONADO */}
          {activeAthlete && (
            <View style={styles.card}>
              <View style={styles.athleteFichaHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fichaEyebrow}>FICHA DEL ALUMNO</Text>
                  <Text style={styles.fichaTitle}>{activeAthlete.displayName}</Text>
                  <Text style={styles.fichaMeta}>
                    {lastSession
                      ? `Último entrenamiento: ${lastSession.completedAt.slice(0, 10)} (${lastSession.dayName}) · Carga: ${lastSession.totalVolumeKg} kg`
                      : 'Alumno nuevo — Sin sesiones registradas aún'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.toggleFichaChartsBtn, { borderColor: primaryColor }]}
                  onPress={() => setShowChartsInFicha(!showChartsInFicha)}
                >
                  <Text style={[styles.toggleFichaChartsText, { color: primaryColor }]}>
                    {showChartsInFicha
                      ? '▲ Ocultar Gráficos'
                      : '📊 Ver Gráficos de Carga'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* GRÁFICOS EMBEBIDOS */}
              {showChartsInFicha && (
                <View style={{ marginBottom: 14 }}>
                  <AthleteLoadAnalyticsPanel
                    athleteId={activeAthlete.id}
                    primaryColor={primaryColor}
                    compact
                  />
                </View>
              )}

              {/* RUTINA ACTIVA DEL ALUMNO Y PERSONALIZACIÓN INDIVIDUAL */}
              {!activeAthleteRoutine ? (
                <View style={styles.noRoutineAlert}>
                  <Text style={styles.noRoutineAlertText}>
                    {activeAthlete.displayName} aún no tiene una rutina asignada. Podés ir al
                    Planificador arriba para armarle una o asignarle una plantilla maestra de
                    Effort Gym abajo.
                  </Text>
                </View>
              ) : (
                <View style={styles.routineEditorBox}>
                  <Text style={styles.routineEditorTitle}>
                    📋 Planificación Activa de {activeAthlete.displayName}:{' '}
                    {activeAthleteRoutine.name}
                  </Text>
                  <Text style={styles.routineEditorSubtitle}>
                    Podés tocar "✏️ Personalizar" en cualquier ejercicio para ajustar series o notas
                    específicamente para este alumno sin modificar la plantilla original.
                  </Text>

                  {activeAthleteRoutine.days.map((day) => (
                    <View key={day.dayId} style={styles.fichaDayBox}>
                      <Text style={styles.fichaDayTitle}>{day.name}</Text>
                      {day.exercises.map((ex) => {
                        const editKey = `${day.dayId}_${ex.exerciseId}`;
                        const isEditing = editingExerciseKey === editKey;
                        const lastTop = ex.lastSessionSets?.[ex.lastSessionSets.length - 1];

                        return (
                          <View key={ex.exerciseId} style={styles.fichaExRow}>
                            <View style={styles.fichaExMain}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.fichaExName}>
                                  {ex.order}. {ex.exerciseName}{' '}
                                  <Text style={styles.fichaCatBadge}>({ex.muscleGroup})</Text>
                                </Text>
                                <Text style={styles.fichaExSpec}>
                                  {ex.targetSets} series × {ex.targetReps} reps · RPE {ex.targetRpe} ·
                                  Descanso {ex.restSeconds}s
                                </Text>
                                {ex.coachNotes ? (
                                  <Text style={styles.fichaExNote}>📌 Nota: {ex.coachNotes}</Text>
                                ) : null}
                                {lastTop ? (
                                  <Text style={styles.fichaExLast}>
                                    📊 Último peso registrado: {lastTop.weight}kg × {lastTop.reps} reps
                                  </Text>
                                ) : null}
                              </View>

                              <TouchableOpacity
                                style={styles.customizeBtn}
                                onPress={() => {
                                  if (isEditing) {
                                    setEditingExerciseKey(null);
                                  } else {
                                    setEditingExerciseKey(editKey);
                                    setEditSets(String(ex.targetSets));
                                    setEditReps(ex.targetReps);
                                    setEditNotes(ex.coachNotes || '');
                                    setEditVideoUrl(ex.videoUrl || '');
                                  }
                                }}
                              >
                                <Text style={styles.customizeBtnText}>
                                  {isEditing ? 'Cancelar' : '✏️ Personalizar'}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {isEditing && (
                              <View style={styles.inlineCustomizeForm}>
                                <View style={styles.inlineCustomizeInputs}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.miniInputLabel}>Series</Text>
                                    <TextInput
                                      style={styles.miniInput}
                                      keyboardType="numeric"
                                      value={editSets}
                                      onChangeText={setEditSets}
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.miniInputLabel}>Repeticiones</Text>
                                    <TextInput
                                      style={styles.miniInput}
                                      value={editReps}
                                      onChangeText={setEditReps}
                                    />
                                  </View>
                                </View>
                                <Text style={styles.miniInputLabel}>Nota para el alumno:</Text>
                                <TextInput
                                  style={styles.miniInput}
                                  value={editNotes}
                                  onChangeText={setEditNotes}
                                  placeholder="Ej: Subir 2.5kg esta semana..."
                                  placeholderTextColor="#64748B"
                                />
                                <TouchableOpacity
                                  style={[styles.saveCustomBtn, { backgroundColor: '#10B981' }]}
                                  onPress={() => {
                                    updateAthleteRoutineExercise(
                                      activeAthleteRoutine.id,
                                      day.dayId,
                                      ex.exerciseId,
                                      {
                                        targetSets: parseInt(editSets, 10) || ex.targetSets,
                                        targetReps: editReps.trim() || ex.targetReps,
                                        coachNotes: editNotes.trim(),
                                        videoUrl: editVideoUrl.trim() || undefined,
                                      }
                                    );
                                    setEditingExerciseKey(null);
                                  }}
                                >
                                  <Text style={styles.saveCustomBtnText}>
                                    Guardar ajuste en ficha ✓
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* PLANTILLAS MAESTRAS GUARDADAS */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Plantillas Maestras Guardadas ({gymTemplates.length})</Text>
            <Text style={styles.sectionSubtitle}>
              Plantillas generales disponibles para asignar en 1 solo clic:
            </Text>
            {gymTemplates.map((tmpl) => (
              <View key={tmpl.id} style={styles.templateBox}>
                <View style={styles.templateTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateName}>{tmpl.name}</Text>
                    <Text style={styles.templateDesc}>{tmpl.description}</Text>
                  </View>
                  {activeAthlete && (
                    <TouchableOpacity
                      style={[styles.assignBtn, { backgroundColor: primaryColor }]}
                      onPress={() => assignTemplateToAthlete(tmpl.id, activeAthlete.id)}
                    >
                      <Text style={styles.assignBtnText}>
                        Asignar a {activeAthlete.displayName.split(' ')[0]} ▶
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {tmpl.days.map((d) => (
                  <View key={d.dayId} style={styles.templateDayItem}>
                    <Text style={styles.templateDayTitle}>{d.name}</Text>
                    <Text style={styles.templateDayExList}>
                      {d.exercises
                        .map((e) => `${e.exerciseName} (${e.targetSets}×${e.targetReps})`)
                        .join(' · ')}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* =========================================================================
          SECCIÓN 3: CATÁLOGO OFICIAL COMPLETO (221 EJERCICIOS)
          ========================================================================= */}
      {coachSection === 'catalog' && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Base de Datos Oficial Effort Gym ({exercisesCatalog.length} ejercicios)
              </Text>
              <Text style={styles.sectionSubtitle}>
                Catálogo con las 10 categorías biomecánicas oficiales de Effort Gym
              </Text>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Buscar entre los 221 ejercicios..."
              placeholderTextColor="#64748B"
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    active && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.catChipText, active && { color: '#FFF' }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.catalogGrid}>
            {filteredCatalog.slice(0, 48).map((ex) => (
              <View key={ex.id} style={styles.catalogItemCard}>
                <Text style={styles.catalogItemName}>{ex.name}</Text>
                <Text style={[styles.catalogItemCat, { color: primaryColor }]}>
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
    backgroundColor: '#0B0F19',
  },
  contentPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  coachNavHeader: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  coachNavHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  coachNavEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coachNavTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  coachNavDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  newAthleteQuickBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  newAthleteQuickBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  coachSubTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  coachSubTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  coachSubTabBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  didacticBanner: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  didacticEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  stepsRoadmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepNumCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  stepTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  stepArrow: {
    color: '#64748B',
    fontSize: 11,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  stepHeaderTag: {
    color: '#F97316',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  inputHint: {
    color: '#64748B',
    fontSize: 11,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 12,
  },
  focusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  focusChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  addDayActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  addDayActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  builderDaysTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  builderDayTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  builderDayTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  activeDayEditBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  dayNameEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeDayEditTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyDayHint: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#334155',
    marginBottom: 16,
  },
  emptyDayHintIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  emptyDayHintText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 360,
  },
  didacticExerciseCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  didacticExHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  didacticExNumber: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  didacticExTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  didacticExCat: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  didacticRemoveBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  didacticRemoveText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  didacticControlsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  controlBox: {
    flex: 1,
    minWidth: 140,
  },
  controlLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 5,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    backgroundColor: '#1E293B',
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperBtnText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  stepperValText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  rpeControlSection: {
    backgroundColor: '#090D16',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  rpeLabelRow: {
    marginBottom: 6,
  },
  rpeCurrentExplain: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  rpeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rpeChipBtn: {
    flex: 1,
    minWidth: 110,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  rpeChipBtnTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  rpeChipBtnSub: {
    color: '#94A3B8',
    fontSize: 9,
    marginTop: 2,
  },
  coachNoteInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 6,
    color: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
  },
  catalogSelectorSection: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 14,
    marginTop: 4,
  },
  subLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 8,
  },
  catChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  catalogSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catalogSelectCard: {
    width: '48%',
    minWidth: 200,
    flexGrow: 1,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  catalogSelectName: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  catalogSelectCat: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  catalogSelectBadge: {
    fontSize: 11,
    fontWeight: '800',
  },
  assignToAthleteBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  assignToLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  athletesToAssignRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  athleteAssignPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    minWidth: 140,
  },
  athleteAssignName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  athleteAssignStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  finalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  saveAndAssignBtn: {
    flex: 2,
    minWidth: 200,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAndAssignBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  saveCatalogOnlyBtn: {
    flex: 1,
    minWidth: 160,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCatalogOnlyText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  createFormCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  saveTemplateBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  saveTemplateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  coachAlertsCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  coachAlertsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 10,
  },
  coachAlertsEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  coachAlertsTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  liveAuditedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveAuditedText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  alertsGrid: {
    gap: 12,
  },
  alertItemBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  alertItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  alertBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertIcon: {
    fontSize: 13,
  },
  alertTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  alertAthleteName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  alertText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  alertActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  alertRecommendation: {
    color: '#CBD5E1',
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
    minWidth: 200,
  },
  alertActionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  alertActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  alertActionBtnSolid: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  alertActionBtnSolidText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  searchInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
    minWidth: 180,
  },
  athleteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  athleteCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  athleteTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  athleteName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedPill: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  athleteEmail: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 6,
  },
  athleteRoutineBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  athleteFichaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  fichaEyebrow: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  fichaTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  fichaMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  toggleFichaChartsBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleFichaChartsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noRoutineAlert: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  noRoutineAlertText: {
    color: '#FBBF24',
    fontSize: 12,
    lineHeight: 18,
  },
  routineEditorBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 12,
  },
  routineEditorTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  routineEditorSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 16,
  },
  fichaDayBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  fichaDayTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  fichaExRow: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 8,
    marginTop: 6,
  },
  fichaExMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  fichaExName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  fichaCatBadge: {
    color: '#94A3B8',
    fontSize: 10,
  },
  fichaExSpec: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  fichaExNote: {
    color: '#F59E0B',
    fontSize: 11,
    marginTop: 2,
  },
  fichaExLast: {
    color: '#38BDF8',
    fontSize: 11,
    marginTop: 2,
  },
  customizeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  customizeBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineCustomizeForm: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  inlineCustomizeInputs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  miniInputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  miniInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11,
    marginBottom: 6,
  },
  saveCustomBtn: {
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 2,
  },
  saveCustomBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  templateBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  templateTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  templateName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  templateDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  assignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  assignBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  templateDayItem: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 6,
    marginTop: 6,
  },
  templateDayTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  templateDayExList: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catalogItemCard: {
    width: '48%',
    minWidth: 200,
    flexGrow: 1,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  catalogItemName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  catalogItemCat: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
