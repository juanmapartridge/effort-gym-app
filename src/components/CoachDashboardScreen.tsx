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

export function CoachDashboardScreen({ primaryColor }: { primaryColor: string }) {
  const activeGymId = useGymStore((s) => s.activeGymId);
  const templates = useGymStore((s) => s.templates);
  const users = useGymStore((s) => s.users);
  const userRoutines = useGymStore((s) => s.userRoutines);
  const workoutSessions = useGymStore((s) => s.workoutSessions);
  const exercisesCatalog = useGymStore((s) => s.exercisesCatalog);

  const assignTemplateToAthlete = useGymStore((s) => s.assignTemplateToAthlete);
  const createMultiDayTemplate = useGymStore((s) => s.createMultiDayTemplate);
  const updateAthleteRoutineExercise = useGymStore((s) => s.updateAthleteRoutineExercise);
  const createAthleteInGym = useGymStore((s) => s.createAthleteInGym);

  // Aislamiento Multi-tenant: Solo plantillas y alumnos del gimnasio actual
  const gymTemplates = templates.filter((t) => t.gymId === activeGymId);
  const gymAthletes = users.filter(
    (u) => u.gymId === activeGymId && u.role === 'athlete'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(
    gymAthletes[0]?.id || ''
  );
  const [showChartsInFicha, setShowChartsInFicha] = useState<boolean>(true);

  // Buscador y filtro del catálogo de 221 ejercicios reales de Effort Gym
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

  // --- CONSTRUCTOR DE PLANTILLAS MULTI-DÍA ---
  const [showCreateTemplateForm, setShowCreateTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [builderDays, setBuilderDays] = useState<RoutineDay[]>([
    {
      dayId: 'day_builder_1',
      name: 'Día 1 - Hemisferio Superior & Core',
      exercises: [],
    },
    {
      dayId: 'day_builder_2',
      name: 'Día 2 - Hemisferio Inferior & Movilidad',
      exercises: [],
    },
  ]);
  const [activeBuilderDayIdx, setActiveBuilderDayIdx] = useState<number>(0);

  // Estado para edición rápida de un ejercicio en la rutina individual del alumno
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

  // Funciones del Constructor Multi-Día
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
        coachNotes: 'Controlar técnica y recorrido completo.',
      };
      currentDay.exercises = [...currentDay.exercises, newEx];
    }

    updated[activeBuilderDayIdx] = currentDay;
    setBuilderDays(updated);
  };

  const updateBuilderExerciseSpec = (
    exIdx: number,
    field: 'targetSets' | 'targetReps' | 'targetRpe' | 'coachNotes',
    val: string
  ) => {
    const updated = [...builderDays];
    const currentDay = { ...updated[activeBuilderDayIdx] };
    const exList = [...currentDay.exercises];
    const target = { ...exList[exIdx] };

    if (field === 'targetSets') {
      target.targetSets = Math.max(1, parseInt(val, 10) || 1);
    } else if (field === 'targetRpe') {
      target.targetRpe = Math.min(10, Math.max(5, parseFloat(val) || 8));
    } else if (field === 'targetReps') {
      target.targetReps = val;
    } else if (field === 'coachNotes') {
      target.coachNotes = val;
    }

    exList[exIdx] = target;
    currentDay.exercises = exList;
    updated[activeBuilderDayIdx] = currentDay;
    setBuilderDays(updated);
  };

  const handleSaveMultiDayTemplate = () => {
    const created = createMultiDayTemplate(
      newTemplateName || 'Plan Personalizado Effort',
      newTemplateDesc,
      builderDays
    );
    if (created) {
      setNewTemplateName('');
      setNewTemplateDesc('');
      setShowCreateTemplateForm(false);
    }
  };

  const handleCreateAthlete = () => {
    if (!newAthleteName.trim()) return;
    const created = createAthleteInGym(newAthleteName, newAthleteEmail);
    if (created) {
      setSelectedAthleteId(created.id);
      setNewAthleteName('');
      setNewAthleteEmail('');
      setShowNewAthleteForm(false);
    }
  };

  const currentBuilderDay = builderDays[activeBuilderDayIdx] || builderDays[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      {/* ENCABEZADO DEL PANEL DEL PROFESOR (GIAN BOASSO - EFFORT GYM) */}
      <View style={styles.headerBanner}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerEyebrow, { color: primaryColor }]}>
            PANEL DE PLANIFICACIÓN Y MONITOREO DE CARGA · GIAN BOASSO
          </Text>
          <Text style={styles.headerTitle}>
            Estadísticas por Alumno y Constructor de Rutinas
          </Text>
          <Text style={styles.headerDesc}>
            Visualiza la evolución semanal/mensual, curvas de fuerza y distribución de categorías
            (Gráfico de Torta) de cada alumno para planificar su próximo bloque con los{' '}
            {exercisesCatalog.length} ejercicios reales de Effort Gym.
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={() => setShowNewAthleteForm(!showNewAthleteForm)}
          >
            <Text style={styles.secondaryActionBtnText}>
              {showNewAthleteForm ? 'Cerrar' : '+ Nuevo Alumno'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.newTemplateBtn, { backgroundColor: primaryColor }]}
            onPress={() => setShowCreateTemplateForm(!showCreateTemplateForm)}
          >
            <Text style={styles.newTemplateBtnText}>
              {showCreateTemplateForm
                ? 'Cerrar Constructor'
                : '🛠️ Constructor de Plantillas Multi-Día'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FORMULARIO: ALTA RÁPIDA DE ALUMNO */}
      {showNewAthleteForm && (
        <View style={styles.createFormCard}>
          <Text style={styles.sectionTitle}>Dar de Alta Nuevo Alumno en Effort Gym</Text>
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
            <Text style={styles.saveTemplateBtnText}>Guardar Alumno</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CONSTRUCTOR DE PLANTILLAS MULTI-DÍA CON BUSCADOR DE LOS 221 EJERCICIOS */}
      {showCreateTemplateForm && (
        <View style={styles.createFormCard}>
          <Text style={styles.sectionTitle}>
            🛠️ Constructor de Plantillas Multi-Día (Planificación)
          </Text>
          <Text style={styles.sectionSubtitle}>
            Arma bloques de 1, 2, 3 o 4+ días combinando ejercicios de Movilidad, Zona Media,
            Hemisferio Inferior y Superior.
          </Text>

          <View style={styles.builderMetaRow}>
            <TextInput
              style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Nombre de la Plantilla (ej. Mesociclo Fuerza Effort 3 Días)"
              placeholderTextColor="#64748B"
              value={newTemplateName}
              onChangeText={setNewTemplateName}
            />
            <TextInput
              style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Descripción / Objetivo del mesociclo"
              placeholderTextColor="#64748B"
              value={newTemplateDesc}
              onChangeText={setNewTemplateDesc}
            />
          </View>

          {/* Pestañas de Días del Constructor */}
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
                    {d.name} ({d.exercises.length})
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.addDayTabBtn} onPress={addDayToBuilder}>
              <Text style={[styles.addDayTabText, { color: primaryColor }]}>
                + Sumar Otro Día
              </Text>
            </TouchableOpacity>
          </View>

          {/* Editor del Día Activo */}
          <View style={styles.activeDayBuilderBox}>
            <View style={styles.dayNameEditRow}>
              <Text style={styles.subLabel}>Nombre del día seleccionado:</Text>
              {builderDays.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeDayFromBuilder(activeBuilderDayIdx)}
                >
                  <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>
                    🗑 Eliminar este día
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.textInput}
              value={currentBuilderDay.name}
              onChangeText={(txt) => updateBuilderDayName(activeBuilderDayIdx, txt)}
            />

            {/* Lista de Ejercicios ya agregados a este día */}
            {currentBuilderDay.exercises.length === 0 ? (
              <View style={styles.emptyDayHint}>
                <Text style={styles.emptyDayHintText}>
                  Todavía no agregaste ejercicios a "{currentBuilderDay.name}". Usa el buscador de
                  abajo y toca los ejercicios para sumarlos.
                </Text>
              </View>
            ) : (
              <View style={styles.builderExList}>
                {currentBuilderDay.exercises.map((ex, exIdx) => (
                  <View key={ex.exerciseId} style={styles.builderExRow}>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.builderExTitle}>
                        {ex.order}. {ex.exerciseName}
                      </Text>
                      <Text style={[styles.builderExCat, { color: primaryColor }]}>
                        {ex.muscleGroup}
                      </Text>
                    </View>

                    <View style={styles.builderMiniInputCol}>
                      <Text style={styles.builderMiniLabel}>Series</Text>
                      <TextInput
                        style={styles.builderMiniInput}
                        keyboardType="numeric"
                        value={String(ex.targetSets)}
                        onChangeText={(v) =>
                          updateBuilderExerciseSpec(exIdx, 'targetSets', v)
                        }
                      />
                    </View>

                    <View style={styles.builderMiniInputCol}>
                      <Text style={styles.builderMiniLabel}>Reps</Text>
                      <TextInput
                        style={styles.builderMiniInput}
                        value={ex.targetReps}
                        onChangeText={(v) =>
                          updateBuilderExerciseSpec(exIdx, 'targetReps', v)
                        }
                      />
                    </View>

                    <View style={styles.builderMiniInputCol}>
                      <Text style={styles.builderMiniLabel}>RPE</Text>
                      <TextInput
                        style={styles.builderMiniInput}
                        keyboardType="numeric"
                        value={String(ex.targetRpe)}
                        onChangeText={(v) =>
                          updateBuilderExerciseSpec(exIdx, 'targetRpe', v)
                        }
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.removeExBtn}
                      onPress={() => toggleExerciseInActiveDay(ex.exerciseId)}
                    >
                      <Text style={styles.removeExBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Buscador Ágil de los 221 Ejercicios para agregar al Día Activo */}
            <Text style={[styles.subLabel, { marginTop: 12 }]}>
              Buscador Ágil ({exercisesCatalog.length} ejercicios Effort Gym) — Toca para agregar a
              "{currentBuilderDay.name}":
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="🔍 Buscar ejercicio (ej: SQUAT, PRESS, REMO, HIP, PUENTE, MOVILIDAD...)"
              placeholderTextColor="#64748B"
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
            />

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
                    <Text style={[styles.catChipText, active && { color: '#FFF' }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.exChipsContainer}>
              {filteredCatalog.slice(0, 24).map((ex) => {
                const selected = currentBuilderDay.exercises.some(
                  (e) => e.exerciseId === ex.id
                );
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.exChip,
                      selected && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => toggleExerciseInActiveDay(ex.id)}
                  >
                    <Text style={[styles.exChipText, selected && { color: '#FFF' }]}>
                      {selected ? '✓ ' : '+ '}
                      {ex.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveTemplateBtn, { backgroundColor: '#10B981', marginTop: 12 }]}
            onPress={handleSaveMultiDayTemplate}
          >
            <Text style={styles.saveTemplateBtnText}>
              Guardar Plantilla Multi-Día en el Catálogo ✓
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ALERTAS INTELIGENTES Y MONITOREO DE SOBRECARGA / DESCARGA (PARA DECISIONES DE GIAN) */}
      <View style={styles.coachAlertsCard}>
        <View style={styles.coachAlertsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.coachAlertsEyebrow, { color: primaryColor }]}>
              SEGUIMIENTO DE ALUMNOS EN SALA · EFFORT GYM
            </Text>
            <Text style={styles.coachAlertsTitle}>
              Alertas de Planificación y Carga
            </Text>
          </View>
          <View style={styles.liveAuditedBadge}>
            <View style={styles.liveGreenDot} />
            <Text style={styles.liveAuditedText}>3 Alumnos en sala</Text>
          </View>
        </View>

        <View style={styles.alertsGrid}>
          {/* Alerta Martín: Sobrecarga sostenida y recomendación de Deload */}
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
              Completó <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>4 semanas seguidas</Text> subiendo cargas (<Text style={{ color: '#10B981', fontWeight: '700' }}>+13.7% en volumen</Text>) con esfuerzo exigente (RPE <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>8.2 promedio</Text>). Su 1RM estimado en Press Banco Plano escaló a 104.5 kg.
            </Text>
            <View style={styles.alertActionRow}>
              <Text style={styles.alertRecommendation}>
                💡 Sugerencia del entrenador: Conviene programar 1 semana de descarga para que asimile el estímulo y no acumule fatiga excesiva.
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

          {/* Alerta Sofía: Pico de Fuerza y Crecimiento en Hemisferio Inferior */}
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
              Aumentó un <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>20.4% su volumen en Hemisferio Inferior</Text> este mes. Marcó su mejor marca en <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>Hip Thrust (82.5 kg × 8 reps)</Text> manteniendo RPE 8.0.
            </Text>
            <View style={styles.alertActionRow}>
              <Text style={styles.alertRecommendation}>
                🎯 Respuesta excelente al entrenamiento: Lista para consolidar la carga o sumar kilos en el próximo bloque.
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

          {/* Alerta Valentín: Alumno nuevo sin rutina */}
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
                📋 Sugerencia: Asignarle la rutina 'Fuerza e Hipertrofia 3 Días' en 1 clic para que empiece a anotar hoy mismo.
              </Text>
              <TouchableOpacity
                style={[styles.alertActionBtnSolid, { backgroundColor: primaryColor }]}
                onPress={() => {
                  assignTemplateToAthlete('tmpl_effort_4d', 'usr_athlete_3');
                  setSelectedAthleteId('usr_athlete_3');
                }}
              >
                <Text style={styles.alertActionBtnSolidText}>
                  + Asignar Rutina en 1 Clic
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* PASO 1: BUSCADOR Y SELECTOR DE ALUMNO */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            1. Selecciona un Alumno para ver su Carga y Planificar ({gymAthletes.length})
          </Text>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Buscar alumno por nombre o correo..."
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

      {/* PASO 2: FICHA INTEGRAL DEL ALUMNO (ESTADÍSTICAS DE CARGA + PERSONALIZACIÓN DE RUTINA) */}
      {activeAthlete && (
        <View style={styles.card}>
          <View style={styles.athleteFichaHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fichaEyebrow}>
                FICHA DE MONITOREO Y PLANIFICACIÓN DEL ALUMNO
              </Text>
              <Text style={styles.fichaTitle}>{activeAthlete.displayName}</Text>
              <Text style={styles.fichaMeta}>
                {lastSession
                  ? `Último entrenamiento: ${lastSession.completedAt.slice(0, 10)} (${lastSession.dayName}) · Carga Total: ${lastSession.totalVolumeKg} kg`
                  : 'Alumno nuevo — Todavía no registra sesiones completadas'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.toggleFichaChartsBtn,
                { borderColor: primaryColor },
              ]}
              onPress={() => setShowChartsInFicha(!showChartsInFicha)}
            >
              <Text style={[styles.toggleFichaChartsText, { color: primaryColor }]}>
                {showChartsInFicha
                  ? '▲ Ocultar Gráficos del Alumno'
                  : '📊 Ver Gráficos de Carga del Alumno'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* GRÁFICOS EMBEBIDOS EN LA FICHA DEL ALUMNO PARA QUE EL PROFE PLANIFIQUE */}
          {showChartsInFicha && (
            <View style={{ marginBottom: 14 }}>
              <AthleteLoadAnalyticsPanel
                athleteId={activeAthlete.id}
                primaryColor={primaryColor}
                compact
              />
            </View>
          )}

          {/* RUTINA ACTIVA Y PERSONALIZACIÓN INDIVIDUAL */}
          {!activeAthleteRoutine ? (
            <View style={styles.noRoutineAlert}>
              <Text style={styles.noRoutineAlertText}>
                {activeAthlete.displayName} aún no tiene una rutina asignada. Elige una de las
                Plantillas Maestras en el Paso 3 aquí abajo y presiona "Asignar a{' '}
                {activeAthlete.displayName.split(' ')[0]}".
              </Text>
            </View>
          ) : (
            <View style={styles.routineEditorBox}>
              <Text style={styles.routineEditorTitle}>
                📋 Planificación Activa de {activeAthlete.displayName}: {activeAthleteRoutine.name}
              </Text>
              <Text style={styles.routineEditorSubtitle}>
                Según lo que ves en los gráficos de arriba, puedes tocar "✏️ Personalizar" en
                cualquier ejercicio para ajustar series, repeticiones, link de video o notas solo
                para este alumno (la plantilla maestra no se modifica).
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
                                📊 Último peso levantado: {lastTop.weight}kg × {lastTop.reps} reps
                                (RPE {lastTop.rpe})
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
                            <Text style={styles.miniInputLabel}>
                              Nota del profesor para {activeAthlete.displayName}:
                            </Text>
                            <TextInput
                              style={styles.miniInput}
                              value={editNotes}
                              onChangeText={setEditNotes}
                              placeholder="Ej: Subir 2.5kg esta semana, cuidar pausa..."
                              placeholderTextColor="#64748B"
                            />
                            <Text style={styles.miniInputLabel}>
                              Link de Video Técnica (YouTube):
                            </Text>
                            <TextInput
                              style={styles.miniInput}
                              value={editVideoUrl}
                              onChangeText={setEditVideoUrl}
                              placeholder="https://www.youtube.com/watch?v=..."
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
                                Guardar ajuste en la ficha del alumno ✓
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

      {/* PASO 3: CATÁLOGO DE PLANTILLAS MAESTRAS DEL GIMNASIO */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          3. Plantillas Maestras de Effort Gym
        </Text>
        <Text style={styles.sectionSubtitle}>
          Asigna cualquiera de estas plantillas al alumno seleccionado arriba en 1 solo clic:
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

      {/* PASO 4: EXPLORADOR DEL CATÁLOGO REAL DE 221 EJERCICIOS DE EFFORT GYM */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>
              4. Base de Datos Oficial de Ejercicios Effort Gym ({exercisesCatalog.length} cargados)
            </Text>
            <Text style={styles.sectionSubtitle}>
              Catálogo oficial con las 10 categorías biomecánicas de Effort Gym
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
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

        <View style={styles.catalogGrid}>
          {filteredCatalog.slice(0, 36).map((ex) => (
            <View key={ex.id} style={styles.catalogItemCard}>
              <Text style={styles.catalogItemName}>{ex.name}</Text>
              <Text style={[styles.catalogItemCat, { color: primaryColor }]}>
                {ex.muscleGroup} · {ex.equipment}
              </Text>
            </View>
          ))}
        </View>
        {filteredCatalog.length > 36 && (
          <Text style={styles.moreCatalogNote}>
            Mostrando 36 de {filteredCatalog.length} ejercicios que coinciden con el filtro. Usa el
            buscador para encontrar cualquier ejercicio específico.
          </Text>
        )}
      </View>
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
  headerBanner: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
  },
  headerDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryActionBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  newTemplateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newTemplateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  createFormCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  builderMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  builderDaysTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  builderDayTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  builderDayTabText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
  },
  addDayTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#475569',
  },
  addDayTabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  activeDayBuilderBox: {
    backgroundColor: '#0B0F19',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  dayNameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  emptyDayHint: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyDayHintText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  builderExList: {
    gap: 8,
  },
  builderExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  builderExTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  builderExCat: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  builderMiniInputCol: {
    alignItems: 'center',
  },
  builderMiniLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  builderMiniInput: {
    width: 48,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 4,
  },
  removeExBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeExBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  subLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  exChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  exChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  saveTemplateBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveTemplateBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  searchInput: {
    minWidth: 240,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
  },
  athleteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  athleteCard: {
    flex: 1,
    minWidth: 210,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  athleteTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  athleteName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedPill: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  athleteEmail: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  athleteRoutineBadge: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  athleteFichaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    paddingBottom: 12,
    marginBottom: 14,
  },
  fichaEyebrow: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  fichaTitle: {
    color: '#F9FAFB',
    fontSize: 19,
    fontWeight: '900',
    marginVertical: 2,
  },
  fichaMeta: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleFichaChartsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
  },
  toggleFichaChartsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  noRoutineAlert: {
    backgroundColor: '#451A03',
    borderColor: '#B45309',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  noRoutineAlertText: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 18,
  },
  routineEditorBox: {
    gap: 10,
  },
  routineEditorTitle: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '800',
  },
  routineEditorSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  fichaDayBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 8,
  },
  fichaDayTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  fichaExRow: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 10,
  },
  fichaExMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  fichaExName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  fichaCatBadge: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  fichaExSpec: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  fichaExNote: {
    color: '#FBBF24',
    fontSize: 11,
    marginTop: 3,
  },
  fichaExLast: {
    color: '#38BDF8',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  customizeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customizeBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineCustomizeForm: {
    marginTop: 10,
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  inlineCustomizeInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  miniInputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  miniInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  saveCustomBtn: {
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  saveCustomBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 12,
  },
  templateBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  templateTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  templateName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  templateDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  assignBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  templateDayItem: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  templateDayTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  templateDayExList: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
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
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catalogItemCard: {
    width: '48%',
    minWidth: 220,
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
    marginTop: 3,
  },
  moreCatalogNote: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
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
});
