import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { useGymStore } from '../store/useGymStore';
import {
  WorkoutSession,
  calculateEffectiveReps,
  calculateEpley1RM,
  calculatePercentageVariation,
  inferBodyZone,
  inferExerciseTier,
  inferSpecificMuscleGroup,
  inferMovementPattern,
  ALL_SPECIFIC_MUSCLE_GROUPS,
  ALL_MOVEMENT_PATTERNS,
  BodyZone,
  ExerciseTier,
  SpecificMuscleGroup,
  MovementPattern,
} from '../types/models';
import { getRecoveryColor, getRpeTraffic } from './WorkoutLoggerScreen';

type AnalyticsTabKey = 'cargas' | 'barras' | 'tortas' | 'efectivas';
type BarVariableKey = 'kg' | 'rpe' | 'recovery';

const ZONE_COLORS: Record<BodyZone, string> = {
  'HEMISFERIO SUPERIOR': '#38BDF8',
  'HEMISFERIO INFERIOR': '#F97316',
  'ZONA MEDIA': '#10B981',
};

const TIER_COLORS: Record<ExerciseTier, string> = {
  'Básico': '#EF4444',
  'Secundario': '#F59E0B',
  'Auxiliar': '#8B5CF6',
};

const PATTERN_COLORS: Record<MovementPattern, string> = {
  'Dominante de Rodilla': '#F97316',
  'Dominante de Cadera': '#EC4899',
  'Empuje': '#38BDF8',
  'Tracción': '#10B981',
};

const MUSCLE_COLORS: Record<SpecificMuscleGroup, string> = {
  'Cuádriceps': '#F97316',
  'Glúteos': '#EC4899',
  'Isquiotibiales': '#A855F7',
  'Gemelos': '#FB923C',
  'Aductores': '#F43F5E',
  'Pectorales': '#38BDF8',
  'Espalda': '#10B981',
  'Hombros': '#06B6D4',
  'Bíceps': '#34D399',
  'Tríceps': '#60A5FA',
};

function formatMonthName(ym: string): string {
  if (ym === '2026-09') return 'Septiembre';
  if (ym === '2026-10') return 'Octubre';
  if (ym === '2026-11') return 'Noviembre';
  if (ym === '2026-12') return 'Diciembre';
  return ym;
}

function formatMonthShort(ym: string): string {
  if (ym === '2026-09') return 'Sept';
  if (ym === '2026-10') return 'Oct';
  if (ym === '2026-11') return 'Nov';
  if (ym === '2026-12') return 'Dic';
  return ym;
}

/**
 * Panel completo de Analítica y Auditoría Científica para Effort Gym (Panel Profe & Panel Alumno):
 * 1. Registro semanal y mensual de KG de cada ejercicio en Gráfico de Barras.
 * 2. Registro semanal y mensual de RPE y Recuperación en Gráfico de Barras (promedio semanal y mensual).
 * 3. Tabla de RM de cada ejercicio en una sesión con Fórmula Epley + RIR:
 *    Carga KG (Utilizados en la serie) x (Repeticiones + RIR) x 0.0333 + Carga KG.
 * 4. Gráfico de dispersión de la evolución de RM de cada ejercicio en KG semanalmente (Semana 1, 2, etc.)
 *    y mensualmente (tomando el valor máximo o más alto de RM del mes).
 * 5. Variación porcentual (%) de los KG de cada ejercicio semanal y mensualmente en tabla y gráfico:
 *    ((Valor Final - Valor Inicial) / Valor Inicial) x 100.
 * 6. Gráfico de torta semanal y mensual por Zonas (Hemisferio Superior, Hemisferio Inferior, Zona Media).
 * 7. Gráfico de torta semanal y mensual por Tipos de Ejercicio (Básicos, Secundarios, Auxiliares).
 * 8. Repeticiones efectivas (RIR <= 4) por Grupo Muscular (10 músculos: cuádriceps, glúteos, isquiotibiales,
 *    gemelos, aductores, pectorales, espalda, hombros, bíceps, tríceps) o Patrón de Movimiento (dominante rodilla,
 *    dominante cadera, empuje, tracción) por sesión (día) y por semana de entrenamiento en gráfico de barras y tabla.
 */
export function AthleteLoadAnalyticsPanel({
  athleteId,
  primaryColor,
  compact = false,
}: {
  athleteId: string;
  primaryColor: string;
  compact?: boolean;
}) {
  const activeGymId = useGymStore((s) => s.activeGymId);
  const workoutSessions = useGymStore((s) => s.workoutSessions);

  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>('cargas');

  // Estados Pestaña 1 (KG, RM, Dispersión y % Variación por ejercicio)
  const [exBarScope, setExBarScope] = useState<'weekly' | 'monthly'>('weekly');
  const [exBarMetric, setExBarMetric] = useState<'kg' | 'rpe'>('kg');
  const [rmScatterScope, setRmScatterScope] = useState<'weekly' | 'monthly'>('weekly');

  // Estados Pestaña 2 (Gráficos de Barras de KG, RPE y Recuperación Semanal y Mensual)
  const [barVariable, setBarVariable] = useState<BarVariableKey>('kg');
  const [barExerciseId, setBarExerciseId] = useState<string>('');
  const [timeScope, setTimeScope] = useState<'weekly' | 'monthly'>('weekly');

  // Estados Pestaña 3 (Gráficos de Torta Semanal y Mensual: Zonas y Tipos)
  const [pieMode, setPieMode] = useState<'zones' | 'tiers'>('zones');
  const [pieTimeFilter, setPieTimeFilter] = useState<'weekly' | 'monthly' | 'all'>('weekly');
  const [selectedPieMonth, setSelectedPieMonth] = useState<string>('ALL');
  const [selectedPieWeekIdx, setSelectedPieWeekIdx] = useState<number>(-1); // -1 = última semana

  // Estados Pestaña 4 (Repeticiones Efectivas por 10 Músculos o 4 Patrones)
  const [effectiveDimension, setEffectiveDimension] = useState<'muscle' | 'pattern'>('muscle');
  const [effectiveScope, setEffectiveScope] = useState<'session' | 'weekly'>('weekly');
  const [selectedEffectiveWeekIdx, setSelectedEffectiveWeekIdx] = useState<number>(-1); // -1 = todas las semanas / acumulado, >=0 = bloque semanal

  // Sesiones del atleta ordenadas cronológicamente
  const athleteSessions = useMemo(() => {
    return workoutSessions
      .filter((s) => s.gymId === activeGymId && s.userId === athleteId)
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  }, [workoutSessions, activeGymId, athleteId]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    athleteSessions[athleteSessions.length - 1]?.id || null
  );

  // Meses disponibles en el historial del atleta
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    athleteSessions.forEach((s) => set.add(s.completedAt.slice(0, 7)));
    return Array.from(set).sort();
  }, [athleteSessions]);

  // Agrupación en Semanas de Entrenamiento (bloques semanales)
  const trainingWeeks = useMemo(() => {
    // Agrupamos sesiones por semana calendario o de a pares/sesiones semanales
    const weeks: { weekNumber: number; label: string; shortLabel: string; sessions: WorkoutSession[] }[] = [];
    athleteSessions.forEach((sess, idx) => {
      weeks.push({
        weekNumber: idx + 1,
        label: `Semana ${idx + 1} (${sess.completedAt.slice(5, 10)})`,
        shortLabel: `Sem ${idx + 1}`,
        sessions: [sess],
      });
    });
    return weeks;
  }, [athleteSessions]);

  // Lista de ejercicios registrados por el atleta
  const loggedExercises = useMemo(() => {
    const map = new Map<string, { id: string; name: string; muscleGroup: string }>();
    for (const sess of athleteSessions) {
      for (const ex of sess.exercises) {
        if (!map.has(ex.exerciseId)) {
          map.set(ex.exerciseId, {
            id: ex.exerciseId,
            name: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [athleteSessions]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    loggedExercises[0]?.id || 'ex_c1164817'
  );

  const activeExercise =
    loggedExercises.find((e) => e.id === selectedExerciseId) || loggedExercises[0];

  const effectiveBarExId =
    barExerciseId && (barExerciseId === 'all' || loggedExercises.some((e) => e.id === barExerciseId))
      ? barExerciseId
      : activeExercise?.id || 'all';

  // =========================================================================
  // 1. ANÁLISIS COMPLETO POR EJERCICIO: KG, RPE, 1RM (EPLEY+RIR) Y % VARIACIÓN
  // =========================================================================
  const exerciseHistory = useMemo(() => {
    if (!activeExercise) {
      return {
        records: [],
        weeklyVariations: [],
        variationPct: 0,
        firstVal: 0,
        lastVal: 0,
        avgRpeOverall: 0,
        max1RMOverall: 0,
      };
    }

    interface ExRecord {
      sessionId: string;
      date: string;
      sessionName: string;
      weekNumber: number;
      weekLabel: string;
      shortWeek: string;
      monthLabel: string;
      maxWeightKg: number;
      avgWeightKg: number;
      totalVolumeKg: number;
      averageRpe: number;
      best1RM: number;
      bestSetWeight: number;
      bestSetReps: number;
      bestSetRir: number;
      effectiveReps: number;
      completedWorkingSets: number;
      prevWeightKg: number | null;
      weeklyChangePct: number | null;
    }

    const records: ExRecord[] = [];
    let runningExWeek = 0;

    athleteSessions.forEach((sess) => {
      const exMatch = sess.exercises.find((e) => e.exerciseId === activeExercise.id);
      if (!exMatch) return;

      const workingSets = exMatch.sets.filter((s) => s.completed && s.type === 'working');
      if (workingSets.length === 0) return;

      runningExWeek += 1;

      const totalVol = workingSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const totalReps = workingSets.reduce((sum, s) => sum + s.reps, 0);
      const avgWeight = totalReps > 0 ? Math.round((totalVol / totalReps) * 10) / 10 : 0;
      const maxWeight = Math.max(...workingSets.map((s) => s.weight));
      const avgRpe =
        Math.round(
          (workingSets.reduce((sum, s) => sum + s.rpe, 0) / workingSets.length) * 10
        ) / 10;

      // Calcular el mejor RM de la sesión usando la Fórmula Epley con RIR de Gian:
      // Carga KG x (Repeticiones + RIR) x 0.0333 + Carga KG
      let best1RM = 0;
      let bestSetWeight = workingSets[0].weight;
      let bestSetReps = workingSets[0].reps;
      let bestSetRir =
        workingSets[0].rir !== undefined
          ? workingSets[0].rir
          : Math.max(0, 10 - workingSets[0].rpe);

      workingSets.forEach((s) => {
        const rirVal = s.rir !== undefined ? s.rir : Math.max(0, 10 - s.rpe);
        const rm = calculateEpley1RM(s.weight, s.reps, rirVal, s.rpe);
        if (rm > best1RM) {
          best1RM = rm;
          bestSetWeight = s.weight;
          bestSetReps = s.reps;
          bestSetRir = rirVal;
        }
      });

      const totalEff = workingSets.reduce(
        (sum, s) => sum + (s.effectiveReps ?? calculateEffectiveReps(s.reps, s.rir, s.rpe)),
        0
      );

      const prevRec = records.length > 0 ? records[records.length - 1] : null;
      const prevWeightKg = prevRec ? prevRec.maxWeightKg : null;
      const weeklyChangePct =
        prevWeightKg !== null && prevWeightKg > 0
          ? calculatePercentageVariation(maxWeight, prevWeightKg)
          : null;

      records.push({
        sessionId: sess.id,
        date: sess.completedAt.slice(0, 10),
        sessionName: sess.dayName,
        weekNumber: runningExWeek,
        weekLabel: `Semana ${runningExWeek} (${sess.completedAt.slice(5, 10)})`,
        shortWeek: `Sem ${runningExWeek}`,
        monthLabel: sess.completedAt.slice(0, 7),
        maxWeightKg: maxWeight,
        avgWeightKg: avgWeight,
        totalVolumeKg: Math.round(totalVol),
        averageRpe: avgRpe,
        best1RM,
        bestSetWeight,
        bestSetReps,
        bestSetRir,
        effectiveReps: totalEff,
        completedWorkingSets: workingSets.length,
        prevWeightKg,
        weeklyChangePct,
      });
    });

    let variationPct = 0;
    let firstVal = 0;
    let lastVal = 0;
    if (records.length >= 2) {
      firstVal = records[0].maxWeightKg;
      lastVal = records[records.length - 1].maxWeightKg;
      variationPct = calculatePercentageVariation(lastVal, firstVal);
    } else if (records.length === 1) {
      firstVal = records[0].maxWeightKg;
      lastVal = records[0].maxWeightKg;
    }

    const avgRpeOverall =
      records.length > 0
        ? Math.round(
            (records.reduce((sum, r) => sum + r.averageRpe, 0) / records.length) * 10
          ) / 10
        : 0;

    const max1RMOverall =
      records.length > 0 ? Math.max(...records.map((r) => r.best1RM)) : 0;

    const weeklyVariations = records
      .filter((r) => r.weeklyChangePct !== null)
      .map((r, idx) => ({
        fromToLabel: `Sem ${idx + 1} ➔ Sem ${idx + 2}`,
        month: formatMonthShort(r.monthLabel),
        initialKg: r.prevWeightKg || 0,
        finalKg: r.maxWeightKg,
        variationPct: r.weeklyChangePct || 0,
      }));

    return {
      records,
      weeklyVariations,
      variationPct,
      firstVal,
      lastVal,
      avgRpeOverall,
      max1RMOverall,
    };
  }, [athleteSessions, activeExercise]);

  // Agrupado Mensual del ejercicio (KG promedio/máximo, RPE promedio, RM Máximo del mes y % Variación mensual)
  const exerciseMonthlyRecords = useMemo(() => {
    const map = new Map<
      string,
      {
        maxWeight: number;
        firstWeight: number;
        lastWeight: number;
        sumWeight: number;
        count: number;
        sumRpe: number;
        max1RM: number;
      }
    >();

    exerciseHistory.records.forEach((r) => {
      const prev = map.get(r.monthLabel);
      if (!prev) {
        map.set(r.monthLabel, {
          maxWeight: r.maxWeightKg,
          firstWeight: r.maxWeightKg,
          lastWeight: r.maxWeightKg,
          sumWeight: r.maxWeightKg,
          count: 1,
          sumRpe: r.averageRpe,
          max1RM: r.best1RM,
        });
      } else {
        map.set(r.monthLabel, {
          maxWeight: Math.max(prev.maxWeight, r.maxWeightKg),
          firstWeight: prev.firstWeight,
          lastWeight: r.maxWeightKg,
          sumWeight: prev.sumWeight + r.maxWeightKg,
          count: prev.count + 1,
          sumRpe: prev.sumRpe + r.averageRpe,
          max1RM: Math.max(prev.max1RM, r.best1RM),
        });
      }
    });

    const entries = Array.from(map.entries());
    const list = entries.map(([month, data], idx) => {
      const prevMonthMax = idx > 0 ? entries[idx - 1][1].maxWeight : data.firstWeight;
      const variationVsPrevMonth =
        idx > 0
          ? calculatePercentageVariation(data.maxWeight, prevMonthMax)
          : calculatePercentageVariation(data.lastWeight, data.firstWeight);

      return {
        month,
        monthName: formatMonthName(month),
        monthShort: formatMonthShort(month),
        maxWeightKg: data.maxWeight,
        firstWeightKg: idx > 0 ? prevMonthMax : data.firstWeight,
        lastWeightKg: data.maxWeight,
        avgWeightKg: Math.round((data.sumWeight / Math.max(1, data.count)) * 10) / 10,
        avgRpe: Math.round((data.sumRpe / Math.max(1, data.count)) * 10) / 10,
        max1RM: data.max1RM, // Valor máximo o más alto de RM para que figure como dato del mes
        variationPct: variationVsPrevMonth,
      };
    });

    let monthVariationPct = 0;
    if (list.length >= 2) {
      const first = list[0].maxWeightKg;
      const last = list[list.length - 1].maxWeightKg;
      monthVariationPct = calculatePercentageVariation(last, first);
    }

    return { list, monthVariationPct };
  }, [exerciseHistory]);

  // Datos de Gráfico de Barras por Ejercicio (Semanal y Mensual - KG o RPE)
  const perExerciseBarData = useMemo(() => {
    if (exBarScope === 'weekly') {
      return exerciseHistory.records.map((r) => {
        const val = exBarMetric === 'kg' ? r.maxWeightKg : r.averageRpe;
        const color =
          exBarMetric === 'kg' ? primaryColor : getRpeTraffic(r.averageRpe).color;
        return {
          value: val,
          label: `${r.shortWeek}\n(${r.date.slice(5)})`,
          frontColor: color,
          topLabelComponent: () => (
            <Text style={styles.barTopLabel}>
              {exBarMetric === 'kg' ? `${val}kg` : `RPE ${val}`}
            </Text>
          ),
        };
      });
    } else {
      return exerciseMonthlyRecords.list.map((m) => {
        const val = exBarMetric === 'kg' ? m.maxWeightKg : m.avgRpe;
        const color =
          exBarMetric === 'kg' ? primaryColor : getRpeTraffic(m.avgRpe).color;
        return {
          value: val,
          label: m.monthShort,
          frontColor: color,
          topLabelComponent: () => (
            <Text style={styles.barTopLabel}>
              {exBarMetric === 'kg' ? `${val}kg` : `RPE ${val}`}
            </Text>
          ),
        };
      });
    }
  }, [exerciseHistory, exerciseMonthlyRecords, exBarScope, exBarMetric, primaryColor]);

  // Datos del Gráfico de Dispersión de Evolución de RM (Semanal vs Mensual tomando el Máximo RM del mes)
  const rmScatterData = useMemo(() => {
    if (rmScatterScope === 'weekly') {
      return exerciseHistory.records.map((r) => ({
        value: r.best1RM,
        label: r.shortWeek,
        dataPointText: `${r.best1RM}kg`,
        customDataPoint: () => (
          <View style={[styles.scatterPointLarge, { borderColor: '#10B981' }]}>
            <View style={[styles.scatterPointInnerLarge, { backgroundColor: '#10B981' }]} />
          </View>
        ),
      }));
    } else {
      // Mensual: tomando el valor máximo o más alto de RM para que figure como dato del mes
      return exerciseMonthlyRecords.list.map((m) => ({
        value: m.max1RM,
        label: m.monthShort,
        dataPointText: `${m.max1RM}kg`,
        customDataPoint: () => (
          <View style={[styles.scatterPointLarge, { borderColor: primaryColor }]}>
            <View style={[styles.scatterPointInnerLarge, { backgroundColor: primaryColor }]} />
          </View>
        ),
      }));
    }
  }, [exerciseHistory, exerciseMonthlyRecords, rmScatterScope, primaryColor]);

  // Tabla Resumen de Variación Porcentual de TODOS los ejercicios del atleta
  const allExercisesVariationSummary = useMemo(() => {
    return loggedExercises.map((ex) => {
      const weights: { date: string; month: string; maxKg: number; best1RM: number }[] = [];
      athleteSessions.forEach((sess) => {
        const found = sess.exercises.find((e) => e.exerciseId === ex.id);
        if (!found) return;
        const working = found.sets.filter((s) => s.completed && s.type === 'working');
        if (working.length === 0) return;
        const maxKg = Math.max(...working.map((s) => s.weight));
        let maxRm = 0;
        working.forEach((s) => {
          const rirVal = s.rir !== undefined ? s.rir : Math.max(0, 10 - s.rpe);
          const rm = calculateEpley1RM(s.weight, s.reps, rirVal, s.rpe);
          if (rm > maxRm) maxRm = rm;
        });
        weights.push({
          date: sess.completedAt.slice(0, 10),
          month: sess.completedAt.slice(0, 7),
          maxKg,
          best1RM: maxRm,
        });
      });

      const initialKg = weights.length > 0 ? weights[0].maxKg : 0;
      const finalKg = weights.length > 0 ? weights[weights.length - 1].maxKg : 0;
      const varPct =
        weights.length >= 2 ? calculatePercentageVariation(finalKg, initialKg) : 0;
      const peak1RM = weights.length > 0 ? Math.max(...weights.map((w) => w.best1RM)) : 0;

      return {
        id: ex.id,
        name: ex.name,
        sessionsCount: weights.length,
        initialKg,
        finalKg,
        varPct,
        peak1RM,
      };
    });
  }, [loggedExercises, athleteSessions]);

  // =========================================================================
  // 2. DATOS PARA PESTAÑA BARRAS (KG POR EJERCICIO, RPE Y RECUPERACIÓN)
  // =========================================================================
  const barChartData = useMemo(() => {
    if (timeScope === 'weekly') {
      return athleteSessions.map((sess, idx) => {
        let value = 0;
        let topText = '';
        let frontColor = primaryColor;

        if (barVariable === 'kg') {
          if (effectiveBarExId === 'all') {
            value = Math.round(sess.totalVolumeKg);
            topText = `${value} kg`;
          } else {
            const exInSession = sess.exercises.find((e) => e.exerciseId === effectiveBarExId);
            if (exInSession) {
              const working = exInSession.sets.filter((s) => s.completed && s.type === 'working');
              value = Math.round(
                exInSession.metrics.maxWeightKg ||
                  (working.length > 0 ? Math.max(...working.map((s) => s.weight)) : 0)
              );
              topText = `${value} kg`;
            } else {
              value = 0;
              topText = '-';
            }
          }
          frontColor = primaryColor;
        } else if (barVariable === 'rpe') {
          if (effectiveBarExId !== 'all') {
            const exInSession = sess.exercises.find((e) => e.exerciseId === effectiveBarExId);
            if (exInSession) {
              value = exInSession.metrics.averageRpe;
              topText = `${value}`;
            } else {
              value = 0;
              topText = '-';
            }
          } else {
            value = sess.sessionRpe ?? sess.averageSessionRpe;
            topText = `${value}`;
          }
          frontColor = value > 0 ? getRpeTraffic(value).color : '#334155';
        } else {
          // recovery
          value = sess.preWorkoutRecovery ?? 8;
          topText = `${value}/10`;
          frontColor = getRecoveryColor(value).border;
        }

        const isSelected = selectedSessionId === sess.id;

        return {
          value,
          label: `Sem ${idx + 1}\n(${sess.completedAt.slice(5, 10)})`,
          frontColor: isSelected ? '#FFFFFF' : frontColor,
          topLabelComponent: () => (
            <Text style={[styles.barTopLabel, isSelected && { color: primaryColor, fontWeight: '900' }]}>
              {topText}
            </Text>
          ),
          onPress: () => setSelectedSessionId(sess.id),
        };
      });
    } else {
      // Agrupado mensual
      const byMonth = new Map<
        string,
        { sumKg: number; maxExKg: number; sumRpe: number; sumRec: number; countKg: number; countRpe: number; countRec: number }
      >();

      athleteSessions.forEach((s) => {
        const m = s.completedAt.slice(0, 7);
        const prev = byMonth.get(m) || {
          sumKg: 0,
          maxExKg: 0,
          sumRpe: 0,
          sumRec: 0,
          countKg: 0,
          countRpe: 0,
          countRec: 0,
        };

        const sRec = s.preWorkoutRecovery ?? 8;
        let kgVal = s.totalVolumeKg;
        let hasKg = true;

        if (effectiveBarExId !== 'all') {
          const exInSession = s.exercises.find((e) => e.exerciseId === effectiveBarExId);
          if (exInSession) {
            kgVal = exInSession.metrics.maxWeightKg || 0;
          } else {
            kgVal = 0;
            hasKg = false;
          }
        }

        let rpeVal = s.sessionRpe ?? s.averageSessionRpe;
        let hasRpe = true;
        if (barVariable === 'rpe' && effectiveBarExId !== 'all') {
          const exInSession = s.exercises.find((e) => e.exerciseId === effectiveBarExId);
          if (exInSession && exInSession.metrics.averageRpe > 0) {
            rpeVal = exInSession.metrics.averageRpe;
          } else {
            rpeVal = 0;
            hasRpe = false;
          }
        }

        byMonth.set(m, {
          sumKg: prev.sumKg + kgVal,
          maxExKg: Math.max(prev.maxExKg, kgVal),
          sumRpe: prev.sumRpe + rpeVal,
          sumRec: prev.sumRec + sRec,
          countKg: prev.countKg + (hasKg ? 1 : 0),
          countRpe: prev.countRpe + (hasRpe ? 1 : 0),
          countRec: prev.countRec + 1,
        });
      });

      return Array.from(byMonth.entries()).map(([month, data]) => {
        let value = 0;
        let topText = '';
        let frontColor = primaryColor;
        const label = formatMonthShort(month);

        if (barVariable === 'kg') {
          value =
            effectiveBarExId === 'all'
              ? Math.round(data.sumKg / Math.max(1, data.countKg))
              : Math.round((data.sumKg / Math.max(1, data.countKg)) * 10) / 10;
          topText = effectiveBarExId === 'all' ? `${value} kg/s` : `${value} kg`;
          frontColor = primaryColor;
        } else if (barVariable === 'rpe') {
          value =
            data.countRpe > 0
              ? Math.round((data.sumRpe / data.countRpe) * 10) / 10
              : 0;
          topText = `${value} RPE`;
          frontColor = getRpeTraffic(value).color;
        } else {
          value = Math.round((data.sumRec / Math.max(1, data.countRec)) * 10) / 10;
          topText = `${value}/10`;
          frontColor = getRecoveryColor(value).border;
        }

        return {
          value,
          label,
          frontColor,
          topLabelComponent: () => <Text style={styles.barTopLabel}>{topText}</Text>,
        };
      });
    }
  }, [athleteSessions, timeScope, barVariable, effectiveBarExId, selectedSessionId, primaryColor]);

  // Promedios Semanales y Mensuales de RPE y Recuperación para tabla y gráfico dedicado
  const rpeAndRecoverySummary = useMemo(() => {
    const weeklyList = athleteSessions.map((s, idx) => ({
      label: `Semana ${idx + 1} (${s.completedAt.slice(5, 10)})`,
      shortLabel: `Sem ${idx + 1}`,
      rpe: s.sessionRpe ?? s.averageSessionRpe,
      recovery: s.preWorkoutRecovery ?? 8,
    }));

    const monthMap = new Map<string, { rpeSum: number; recSum: number; count: number }>();
    athleteSessions.forEach((s) => {
      const m = s.completedAt.slice(0, 7);
      const prev = monthMap.get(m) || { rpeSum: 0, recSum: 0, count: 0 };
      monthMap.set(m, {
        rpeSum: prev.rpeSum + (s.sessionRpe ?? s.averageSessionRpe),
        recSum: prev.recSum + (s.preWorkoutRecovery ?? 8),
        count: prev.count + 1,
      });
    });

    const monthlyList = Array.from(monthMap.entries()).map(([m, d]) => ({
      month: m,
      label: formatMonthName(m),
      shortLabel: formatMonthShort(m),
      avgRpe: Math.round((d.rpeSum / Math.max(1, d.count)) * 10) / 10,
      avgRecovery: Math.round((d.recSum / Math.max(1, d.count)) * 10) / 10,
      sessionsCount: d.count,
    }));

    return { weeklyList, monthlyList };
  }, [athleteSessions]);

  // Promedios generales de KPIs
  const overallAverages = useMemo(() => {
    if (athleteSessions.length === 0) {
      return { avgKg: 0, avgRpe: 0, avgRecovery: 0, maxExKg: 0, exRepsEff: 0, exRpeAvg: 0 };
    }
    const totalKg = athleteSessions.reduce((sum, s) => sum + s.totalVolumeKg, 0);
    const totalRpe = athleteSessions.reduce((sum, s) => sum + (s.sessionRpe ?? s.averageSessionRpe), 0);
    const totalRec = athleteSessions.reduce((sum, s) => sum + (s.preWorkoutRecovery ?? 8), 0);
    const n = athleteSessions.length;

    let maxExKg = 0;
    let exRepsEff = 0;
    let exRpeSum = 0;
    let exRpeCount = 0;

    if (effectiveBarExId !== 'all') {
      athleteSessions.forEach((s) => {
        const ex = s.exercises.find((e) => e.exerciseId === effectiveBarExId);
        if (ex) {
          if (ex.metrics.maxWeightKg > maxExKg) maxExKg = ex.metrics.maxWeightKg;
          exRepsEff += ex.metrics.totalEffectiveReps || 0;
          if (ex.metrics.averageRpe > 0) {
            exRpeSum += ex.metrics.averageRpe;
            exRpeCount += 1;
          }
        }
      });
    }

    return {
      avgKg: Math.round(totalKg / n),
      avgRpe: Math.round((totalRpe / n) * 10) / 10,
      avgRecovery: Math.round((totalRec / n) * 10) / 10,
      maxExKg,
      exRepsEff,
      exRpeAvg: exRpeCount > 0 ? Math.round((exRpeSum / exRpeCount) * 10) / 10 : 0,
    };
  }, [athleteSessions, effectiveBarExId]);

  // =========================================================================
  // 3. GRÁFICOS DE TORTA SEMANAL Y MENSUAL (ZONAS CORPORALES & TIPOS)
  // =========================================================================
  const pieDistribution = useMemo(() => {
    let sessionsToAnalyze = athleteSessions;
    let periodDescription = 'Todo el Historial';

    if (pieTimeFilter === 'weekly' && athleteSessions.length > 0) {
      const targetIdx =
        selectedPieWeekIdx >= 0 && selectedPieWeekIdx < athleteSessions.length
          ? selectedPieWeekIdx
          : athleteSessions.length - 1;
      sessionsToAnalyze = [athleteSessions[targetIdx]];
      periodDescription = `Semana ${targetIdx + 1} (${athleteSessions[targetIdx].completedAt.slice(0, 10)})`;
    } else if (pieTimeFilter === 'monthly' && athleteSessions.length > 0) {
      const targetMonth =
        selectedPieMonth !== 'ALL' && availableMonths.includes(selectedPieMonth)
          ? selectedPieMonth
          : availableMonths[availableMonths.length - 1];
      sessionsToAnalyze = athleteSessions.filter((s) => s.completedAt.slice(0, 7) === targetMonth);
      periodDescription = `Mes: ${formatMonthName(targetMonth)}`;
    }

    if (pieMode === 'zones') {
      const counts: Record<BodyZone, { sets: number; volume: number }> = {
        'HEMISFERIO SUPERIOR': { sets: 0, volume: 0 },
        'HEMISFERIO INFERIOR': { sets: 0, volume: 0 },
        'ZONA MEDIA': { sets: 0, volume: 0 },
      };

      let totalSets = 0;

      for (const sess of sessionsToAnalyze) {
        for (const ex of sess.exercises) {
          const completedWorking = ex.sets.filter((s) => s.completed && s.type === 'working');
          if (completedWorking.length === 0) continue;
          const zone = ex.bodyZone || inferBodyZone(ex.muscleGroup);
          counts[zone].sets += completedWorking.length;
          counts[zone].volume += ex.metrics.totalVolumeKg;
          totalSets += completedWorking.length;
        }
      }

      const items = (Object.keys(counts) as BodyZone[]).map((zone) => {
        const data = counts[zone];
        const pct = totalSets > 0 ? Math.round((data.sets / totalSets) * 100) : 0;
        return {
          title: zone,
          sets: data.sets,
          volume: Math.round(data.volume),
          pct,
          value: Math.max(0.1, data.sets),
          color: ZONE_COLORS[zone],
          text: `${pct}%`,
        };
      });

      return { items, totalSets, periodDescription };
    } else {
      const counts: Record<ExerciseTier, { sets: number; volume: number }> = {
        'Básico': { sets: 0, volume: 0 },
        'Secundario': { sets: 0, volume: 0 },
        'Auxiliar': { sets: 0, volume: 0 },
      };

      let totalSets = 0;

      for (const sess of sessionsToAnalyze) {
        for (const ex of sess.exercises) {
          const completedWorking = ex.sets.filter((s) => s.completed && s.type === 'working');
          if (completedWorking.length === 0) continue;
          const tier = ex.exerciseTier || inferExerciseTier(ex.exerciseName, ex.muscleGroup);
          counts[tier].sets += completedWorking.length;
          counts[tier].volume += ex.metrics.totalVolumeKg;
          totalSets += completedWorking.length;
        }
      }

      const items = (Object.keys(counts) as ExerciseTier[]).map((tier) => {
        const data = counts[tier];
        const pct = totalSets > 0 ? Math.round((data.sets / totalSets) * 100) : 0;
        return {
          title: tier,
          sets: data.sets,
          volume: Math.round(data.volume),
          pct,
          value: Math.max(0.1, data.sets),
          color: TIER_COLORS[tier],
          text: `${pct}%`,
        };
      });

      return { items, totalSets, periodDescription };
    }
  }, [athleteSessions, pieMode, pieTimeFilter, selectedPieMonth, selectedPieWeekIdx, availableMonths]);

  // =========================================================================
  // 4. REPETICIONES EFECTIVAS POR 10 GRUPOS MUSCULARES O 4 PATRONES DE MOVIMIENTO
  //    (EN UNA SESIÓN O A LO LARGO DE CADA SEMANA DE ENTRENAMIENTO)
  // =========================================================================
  const effectiveRepsAnalysis = useMemo(() => {
    let sessionsToCount = athleteSessions;
    let scopeTitle = 'Acumulado Semanal';

    if (effectiveScope === 'session' && athleteSessions.length > 0) {
      const targetSess =
        athleteSessions.find((s) => s.id === selectedSessionId) ||
        athleteSessions[athleteSessions.length - 1];
      sessionsToCount = [targetSess];
      scopeTitle = `Sesión del ${targetSess.completedAt.slice(0, 10)} (${targetSess.dayName})`;
    } else if (effectiveScope === 'weekly' && athleteSessions.length > 0) {
      if (selectedEffectiveWeekIdx >= 0 && selectedEffectiveWeekIdx < trainingWeeks.length) {
        sessionsToCount = trainingWeeks[selectedEffectiveWeekIdx].sessions;
        scopeTitle = trainingWeeks[selectedEffectiveWeekIdx].label;
      } else {
        sessionsToCount = athleteSessions;
        scopeTitle = `Todas las Semanas (${athleteSessions.length} sesiones)`;
      }
    }

    const categories: string[] =
      effectiveDimension === 'muscle'
        ? [...ALL_SPECIFIC_MUSCLE_GROUPS]
        : [...ALL_MOVEMENT_PATTERNS];

    const dataMap = new Map<
      string,
      {
        category: string;
        sets: number;
        effectiveReps: number;
        rirSum: number;
        repsSum: number;
        exercisesNames: Set<string>;
      }
    >();

    categories.forEach((cat) => {
      dataMap.set(cat, {
        category: cat,
        sets: 0,
        effectiveReps: 0,
        rirSum: 0,
        repsSum: 0,
        exercisesNames: new Set<string>(),
      });
    });

    let grandTotalEffective = 0;

    for (const sess of sessionsToCount) {
      for (const ex of sess.exercises) {
        const key =
          effectiveDimension === 'muscle'
            ? inferSpecificMuscleGroup(ex.exerciseName, ex.muscleGroup)
            : inferMovementPattern(ex.exerciseName, ex.muscleGroup);

        const entry = dataMap.get(key) || {
          category: key,
          sets: 0,
          effectiveReps: 0,
          rirSum: 0,
          repsSum: 0,
          exercisesNames: new Set<string>(),
        };

        for (const s of ex.sets) {
          if (!s.completed || s.type !== 'working') continue;
          const rirVal = s.rir !== undefined ? s.rir : Math.max(0, 10 - s.rpe);
          const eff =
            s.effectiveReps !== undefined
              ? s.effectiveReps
              : calculateEffectiveReps(s.reps, rirVal, s.rpe);
          entry.sets += 1;
          entry.effectiveReps += eff;
          entry.rirSum += rirVal;
          entry.repsSum += s.reps;
          entry.exercisesNames.add(ex.exerciseName);
          grandTotalEffective += eff;
        }

        dataMap.set(key, entry);
      }
    }

    const list = Array.from(dataMap.values()).map((item) => {
      const color =
        effectiveDimension === 'muscle'
          ? MUSCLE_COLORS[item.category as SpecificMuscleGroup] || primaryColor
          : PATTERN_COLORS[item.category as MovementPattern] || primaryColor;

      return {
        category: item.category,
        sets: item.sets,
        effectiveReps: item.effectiveReps,
        avgRir: item.sets > 0 ? Math.round((item.rirSum / item.sets) * 10) / 10 : 0,
        totalReps: item.repsSum,
        exercisesList: Array.from(item.exercisesNames).join(', '),
        color,
      };
    });

    const barData = list.map((item) => ({
      value: item.effectiveReps,
      label:
        item.category === 'Dominante de Rodilla'
          ? 'Dom. Rodilla'
          : item.category === 'Dominante de Cadera'
          ? 'Dom. Cadera'
          : item.category === 'Isquiotibiales'
          ? 'Isquios'
          : item.category === 'Cuádriceps'
          ? 'Cuádriceps'
          : item.category,
      frontColor: item.effectiveReps > 0 ? item.color : '#1E293B',
      topLabelComponent: () => (
        <Text style={[styles.barTopLabel, { color: item.effectiveReps > 0 ? '#F8FAFC' : '#64748B' }]}>
          {item.effectiveReps}
        </Text>
      ),
    }));

    return { list, grandTotalEffective, barData, scopeTitle };
  }, [
    athleteSessions,
    effectiveDimension,
    effectiveScope,
    selectedSessionId,
    selectedEffectiveWeekIdx,
    trainingWeeks,
    primaryColor,
  ]);

  // Sesión inspeccionada para la Tabla de RM por Sesión y Auditoría
  const inspectedSession: WorkoutSession | undefined =
    athleteSessions.find((s) => s.id === selectedSessionId) ||
    athleteSessions[athleteSessions.length - 1];

  // Tabla de RM de cada ejercicio en la sesión seleccionada (Fórmula Epley + RIR)
  const sessionRmTable = useMemo(() => {
    if (!inspectedSession) return [];
    return inspectedSession.exercises.map((ex) => {
      const workingSets = ex.sets.filter((s) => s.completed && s.type === 'working');
      let bestSet = workingSets[0];
      let bestRm = 0;

      workingSets.forEach((s) => {
        const rirVal = s.rir !== undefined ? s.rir : Math.max(0, 10 - s.rpe);
        const rm = calculateEpley1RM(s.weight, s.reps, rirVal, s.rpe);
        if (rm > bestRm) {
          bestRm = rm;
          bestSet = s;
        }
      });

      const weight = bestSet ? bestSet.weight : 0;
      const reps = bestSet ? bestSet.reps : 0;
      const rir = bestSet
        ? bestSet.rir !== undefined
          ? bestSet.rir
          : Math.max(0, 10 - bestSet.rpe)
        : 0;
      const formulaText =
        weight > 0
          ? `${weight} kg × (${reps} + ${rir} RIR) × 0.0333 + ${weight} kg`
          : 'Sin carga externa';

      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        specificMuscle: inferSpecificMuscleGroup(ex.exerciseName, ex.muscleGroup),
        movementPattern: inferMovementPattern(ex.exerciseName, ex.muscleGroup),
        weight,
        reps,
        rir,
        formulaText,
        estimated1RM: bestRm,
        averageRpe: ex.metrics.averageRpe,
      };
    });
  }, [inspectedSession]);

  if (athleteSessions.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyCardTitle}>Sin sesiones de entrenamiento aún</Text>
        <Text style={styles.emptyCardSub}>
          En cuanto el alumno complete su primer entrenamiento en el Workout Logger, aquí
          se generará automáticamente su analítica de KG, RM (Epley + RIR), RPE, recuperación y repeticiones efectivas.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.panelContainer}>
      {/* 4 SUB-PESTAÑAS DIDÁCTICAS SUPERIORES */}
      <View style={styles.topTabsBar}>
        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'cargas' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('cargas')}
        >
          <Text
            style={[
              styles.topTabBtnText,
              activeTab === 'cargas' && { color: primaryColor, fontWeight: '800' },
            ]}
          >
            🏋️ KG, RM & % Var
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'barras' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('barras')}
        >
          <Text
            style={[
              styles.topTabBtnText,
              activeTab === 'barras' && { color: primaryColor, fontWeight: '800' },
            ]}
          >
            📊 Barras & RPE/Rec
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'tortas' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('tortas')}
        >
          <Text
            style={[
              styles.topTabBtnText,
              activeTab === 'tortas' && { color: primaryColor, fontWeight: '800' },
            ]}
          >
            🥧 Zonas & Tipos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'efectivas' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('efectivas')}
        >
          <Text
            style={[
              styles.topTabBtnText,
              activeTab === 'efectivas' && { color: primaryColor, fontWeight: '800' },
            ]}
          >
            ⚡ Reps Efectivas
          </Text>
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          PESTAÑA 1: KG POR EJERCICIO (BARRAS SEMANAL/MENSUAL), TABLA RM (EPLEY+RIR),
          GRÁFICO DE DISPERSIÓN DE RM (SEMANAL Y MÁXIMO MENSUAL) Y % DE VARIACIÓN
          ========================================================================= */}
      {activeTab === 'cargas' && (
        <View style={styles.tabContent}>
          {/* 1A. SELECTOR DE EJERCICIO Y GRÁFICO DE BARRAS SEMANAL / MENSUAL DE KG Y RPE */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>
                  1. REGISTRO SEMANAL Y MENSUAL POR EJERCICIO
                </Text>
                <Text style={styles.cardTitle}>
                  Gráfico de Barras de KG y RPE por Ejercicio
                </Text>
                <Text style={styles.cardSub}>
                  Selecciona un ejercicio para auditar sus KG y RPE en cada semana y mes del año
                </Text>
              </View>
            </View>

            {/* Selector de Ejercicio */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
              {loggedExercises.map((ex) => {
                const isSelected = ex.id === activeExercise?.id;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.exChip,
                      isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => {
                      setSelectedExerciseId(ex.id);
                      setBarExerciseId(ex.id);
                    }}
                  >
                    <Text style={[styles.exChipText, isSelected && { color: '#FFF', fontWeight: '800' }]}>
                      {ex.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Controles: Variable (KG vs RPE del ejercicio) y Alcance (Semanal vs Mensual) */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[
                  styles.scopeBtn,
                  exBarMetric === 'kg' && { backgroundColor: primaryColor, borderColor: primaryColor },
                ]}
                onPress={() => setExBarMetric('kg')}
              >
                <Text style={[styles.scopeBtnText, exBarMetric === 'kg' && { color: '#FFF', fontWeight: '800' }]}>
                  🏋️ Barras de KG ({activeExercise?.name})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.scopeBtn,
                  exBarMetric === 'rpe' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                ]}
                onPress={() => setExBarMetric('rpe')}
              >
                <Text style={[styles.scopeBtnText, exBarMetric === 'rpe' && { color: '#000', fontWeight: '800' }]}>
                  🚦 Barras de RPE del Ejercicio
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, exBarScope === 'weekly' && styles.scopeBtnActive]}
                onPress={() => setExBarScope('weekly')}
              >
                <Text style={[styles.scopeBtnText, exBarScope === 'weekly' && styles.scopeBtnTextActive]}>
                  📅 Registro Semanal (Sem 1, Sem 2...)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, exBarScope === 'monthly' && styles.scopeBtnActive]}
                onPress={() => setExBarScope('monthly')}
              >
                <Text style={[styles.scopeBtnText, exBarScope === 'monthly' && styles.scopeBtnTextActive]}>
                  📆 Registro Mensual (Por Mes)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Gráfico de Barras para el Ejercicio Seleccionado */}
            <View style={styles.chartWrapper}>
              <Text style={styles.chartTitle}>
                {exBarMetric === 'kg'
                  ? `Carga Máxima Utilizada (KG) en ${activeExercise?.name} · Vista ${exBarScope === 'weekly' ? 'Semanal' : 'Mensual'}`
                  : `RPE Promedio de Series en ${activeExercise?.name} · Vista ${exBarScope === 'weekly' ? 'Semanal' : 'Mensual'}`}
              </Text>
              <BarChart
                data={perExerciseBarData}
                height={180}
                barWidth={exBarScope === 'weekly' ? 36 : 48}
                spacing={exBarScope === 'weekly' ? 22 : 34}
                roundedTop
                roundedBottom
                hideRules={false}
                rulesColor="#1E293B"
                yAxisColor="#1E293B"
                xAxisColor="#1E293B"
                yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                noOfSections={4}
              />
            </View>

            {/* KPIs Rápidos del Ejercicio */}
            <View style={styles.threeKpiRow}>
              <View style={styles.miniKpiCard}>
                <Text style={styles.miniKpiLabel}>VARIACIÓN % KG</Text>
                <Text
                  style={[
                    styles.miniKpiValue,
                    { color: exerciseHistory.variationPct >= 0 ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {exerciseHistory.variationPct >= 0 ? '+' : ''}
                  {exerciseHistory.variationPct}%
                </Text>
                <Text style={styles.miniKpiSub}>
                  {exerciseHistory.firstVal}kg ➔ {exerciseHistory.lastVal}kg
                </Text>
              </View>

              <View style={styles.miniKpiCard}>
                <Text style={styles.miniKpiLabel}>MEJOR RM (EPLEY)</Text>
                <Text style={[styles.miniKpiValue, { color: '#38BDF8' }]}>
                  {exerciseHistory.max1RMOverall} kg
                </Text>
                <Text style={styles.miniKpiSub}>1RM estimado c/RIR</Text>
              </View>

              <View style={styles.miniKpiCard}>
                <Text style={styles.miniKpiLabel}>RPE PROMEDIO</Text>
                <Text style={[styles.miniKpiValue, { color: '#FBBF24' }]}>
                  {exerciseHistory.avgRpeOverall}
                </Text>
                <Text style={styles.miniKpiSub}>Escala 1 al 10</Text>
              </View>
            </View>
          </View>

          {/* 1B. GRÁFICO DE DISPERSIÓN DE EVOLUCIÓN DE RM (SEMANAL Y MÁXIMO MENSUAL) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>
                  2. GRÁFICO DE DISPERSIÓN · EVOLUCIÓN DE RM EN KG
                </Text>
                <Text style={styles.cardTitle}>
                  Evolución Semanal y Mensual de RM ({activeExercise?.name})
                </Text>
                <Text style={styles.cardSub}>
                  Visualiza cuál fue el RM de la Semana 1, Semana 2, etc., o véelo Mensualmente tomando el valor máximo o más alto de RM del mes
                </Text>
              </View>
            </View>

            {/* Switch Semanal vs Mensual (Máximo RM del Mes) */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, rmScatterScope === 'weekly' && styles.scopeBtnActive]}
                onPress={() => setRmScatterScope('weekly')}
              >
                <Text style={[styles.scopeBtnText, rmScatterScope === 'weekly' && styles.scopeBtnTextActive]}>
                  📅 RM Semanal (Sem 1, Sem 2...)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, rmScatterScope === 'monthly' && styles.scopeBtnActive]}
                onPress={() => setRmScatterScope('monthly')}
              >
                <Text style={[styles.scopeBtnText, rmScatterScope === 'monthly' && styles.scopeBtnTextActive]}>
                  📆 RM Mensual (Máximo RM del Mes)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chartWrapper}>
              <Text style={styles.chartTitle}>
                {rmScatterScope === 'weekly'
                  ? `Dispersión de RM (KG) Semana a Semana · ${activeExercise?.name}`
                  : `Dispersión de RM Máximo de cada Mes (KG) · ${activeExercise?.name}`}
              </Text>
              <LineChart
                data={rmScatterData}
                color={rmScatterScope === 'weekly' ? '#10B981' : primaryColor}
                thickness={2}
                dataPointsColor={rmScatterScope === 'weekly' ? '#10B981' : primaryColor}
                dataPointsRadius={6}
                textShiftY={-10}
                textShiftX={-8}
                textColor="#F8FAFC"
                textFontSize={10}
                height={180}
                spacing={rmScatterScope === 'weekly' ? 58 : 85}
                initialSpacing={24}
                yAxisColor="#1E293B"
                xAxisColor="#1E293B"
                rulesColor="#1E293B"
                yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                noOfSections={4}
              />
            </View>

            {/* Puntos de dispersión listados claramente debajo */}
            <View style={styles.scatterSummaryGrid}>
              {rmScatterScope === 'weekly'
                ? exerciseHistory.records.map((r, i) => (
                    <View key={i} style={styles.scatterSummaryPill}>
                      <Text style={styles.scatterSummaryLabel}>{r.shortWeek}</Text>
                      <Text style={[styles.scatterSummaryVal, { color: '#10B981' }]}>
                        {r.best1RM} kg
                      </Text>
                      <Text style={styles.scatterSummaryMeta}>
                        {r.bestSetWeight}kg × {r.bestSetReps}+{r.bestSetRir} RIR
                      </Text>
                    </View>
                  ))
                : exerciseMonthlyRecords.list.map((m, i) => (
                    <View key={i} style={styles.scatterSummaryPill}>
                      <Text style={styles.scatterSummaryLabel}>{m.monthName} (Máx)</Text>
                      <Text style={[styles.scatterSummaryVal, { color: primaryColor }]}>
                        {m.max1RM} kg
                      </Text>
                      <Text style={styles.scatterSummaryMeta}>
                        Top carga: {m.maxWeightKg} kg
                      </Text>
                    </View>
                  ))}
            </View>
          </View>

          {/* 1C. TABLA DE RM DE CADA EJERCICIO EN UNA SESIÓN (FÓRMULA EPLEY + RIR) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>
                  3. TABLA DE RM POR EJERCICIO EN UNA SESIÓN
                </Text>
                <Text style={styles.cardTitle}>
                  RM Estimado de cada Ejercicio en la Sesión
                </Text>
                <Text style={styles.cardSub}>
                  Selecciona cualquier sesión para ver la tabla de RM calculada con la fórmula oficial Epley + RIR
                </Text>
              </View>
            </View>

            {/* Banner con la Fórmula Epley exacta solicitada */}
            <View style={styles.formulaBanner}>
              <Text style={styles.formulaTitle}>
                📐 Cálculo · Fórmula Epley: Carga KG (Utilizados en la serie) × (Repeticiones + RIR) × 0.0333 + Carga KG
              </Text>
              <Text style={styles.formulaBody}>
                Incluye las repeticiones realizadas más el RIR (repeticiones en recámara) multiplicado por 0.0333 más los KG utilizados.
              </Text>
            </View>

            {/* Selector de Sesión a Auditar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {athleteSessions.map((sess, idx) => {
                const active = inspectedSession?.id === sess.id;
                return (
                  <TouchableOpacity
                    key={sess.id}
                    style={[
                      styles.exChip,
                      active && { backgroundColor: '#10B981', borderColor: '#10B981' },
                    ]}
                    onPress={() => setSelectedSessionId(sess.id)}
                  >
                    <Text style={[styles.exChipText, active && { color: '#000', fontWeight: '900' }]}>
                      Sem {idx + 1} · {sess.completedAt.slice(5, 10)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 1.8, textAlign: 'left' }]}>Ejercicio en Sesión</Text>
                <Text style={[styles.thCell, { flex: 1.3 }]}>Mejor Serie</Text>
                <Text style={[styles.thCell, { flex: 2 }]}>Fórmula Epley + RIR</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>RM (KG)</Text>
              </View>
              {sessionRmTable.map((row, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={{ flex: 1.8 }}>
                    <Text style={styles.tdMainText}>{row.exerciseName}</Text>
                    <Text style={styles.tdSubText}>
                      {row.specificMuscle} · {row.movementPattern}
                    </Text>
                  </View>
                  <Text style={[styles.tdCell, { flex: 1.3, fontWeight: '700' }]}>
                    {row.weight}kg × {row.reps} (RIR {row.rir})
                  </Text>
                  <Text style={[styles.tdCell, { flex: 2, fontSize: 10, color: '#94A3B8' }]}>
                    {row.formulaText}
                  </Text>
                  <Text style={[styles.tdCell, { flex: 1, color: '#10B981', fontWeight: '900' }]}>
                    {row.estimated1RM} kg
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* 1D. VARIACIÓN PORCENTUAL (%) DE LOS KG EN CADA EJERCICIO (SEMANAL Y MENSUAL) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>
                  4. VARIACIÓN PORCENTUAL (%) DE KG SEMANAL Y MENSUAL
                </Text>
                <Text style={styles.cardTitle}>
                  Porcentaje de Cambio de KG ({activeExercise?.name})
                </Text>
                <Text style={styles.cardSub}>
                  Variación de los KG utilizados semana a semana y a lo largo de cada mes
                </Text>
              </View>
            </View>

            <View style={styles.formulaBanner}>
              <Text style={styles.formulaTitle}>
                📐 Fórmula de Variación %: ((Valor Final – Valor Inicial) / Valor Inicial) × 100
              </Text>
              <Text style={styles.formulaBody}>
                {activeExercise?.name}: Valor Inicial {exerciseHistory.firstVal} kg ➔ Valor Final {exerciseHistory.lastVal} kg ={' '}
                {exerciseHistory.variationPct >= 0 ? '+' : ''}
                {exerciseHistory.variationPct}% de progreso acumulado.
              </Text>
            </View>

            {/* Tabla de Variación Semana a Semana */}
            <Text style={styles.sectionHeading}>
              📅 Variación Porcentual Semana a Semana ({activeExercise?.name}):
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 1.6, textAlign: 'left' }]}>Semana / Fecha</Text>
                <Text style={styles.thCell}>KG Inicial</Text>
                <Text style={styles.thCell}>KG Final</Text>
                <Text style={styles.thCell}>% Cambio Semanal</Text>
              </View>
              {exerciseHistory.records.map((rec, i) => (
                <View key={i} style={styles.tableRow}>
                  <View style={{ flex: 1.6 }}>
                    <Text style={styles.tdMainText}>{rec.weekLabel}</Text>
                    <Text style={styles.tdSubText}>RM: {rec.best1RM} kg · RPE {rec.averageRpe}</Text>
                  </View>
                  <Text style={styles.tdCell}>
                    {rec.prevWeightKg !== null ? `${rec.prevWeightKg} kg` : `${rec.maxWeightKg} kg`}
                  </Text>
                  <Text style={[styles.tdCell, { color: primaryColor, fontWeight: '800' }]}>
                    {rec.maxWeightKg} kg
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      {
                        fontWeight: '900',
                        color:
                          rec.weeklyChangePct === null
                            ? '#94A3B8'
                            : rec.weeklyChangePct >= 0
                            ? '#10B981'
                            : '#EF4444',
                      },
                    ]}
                  >
                    {rec.weeklyChangePct === null
                      ? 'Base (0%)'
                      : `${rec.weeklyChangePct >= 0 ? '+' : ''}${rec.weeklyChangePct}%`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Tabla de Variación Mensual */}
            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>
              📆 Variación Porcentual Mes a Mes ({activeExercise?.name}):
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'left' }]}>Mes</Text>
                <Text style={styles.thCell}>KG Inicial</Text>
                <Text style={styles.thCell}>KG Final / Máx</Text>
                <Text style={styles.thCell}>RM Máx Mes</Text>
                <Text style={styles.thCell}>% Cambio Mes</Text>
              </View>
              {exerciseMonthlyRecords.list.map((m, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tdMainText, { flex: 1.5 }]}>{m.monthName}</Text>
                  <Text style={styles.tdCell}>{m.firstWeightKg} kg</Text>
                  <Text style={[styles.tdCell, { color: primaryColor, fontWeight: '800' }]}>
                    {m.maxWeightKg} kg
                  </Text>
                  <Text style={[styles.tdCell, { color: '#38BDF8', fontWeight: '800' }]}>
                    {m.max1RM} kg
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      {
                        fontWeight: '900',
                        color: m.variationPct >= 0 ? '#10B981' : '#EF4444',
                      },
                    ]}
                  >
                    {m.variationPct >= 0 ? '+' : ''}
                    {m.variationPct}%
                  </Text>
                </View>
              ))}
            </View>

            {/* Tabla Comparativa de Variación % de TODOS los Ejercicios */}
            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>
              🏋️ Resumen de Variación % de Todos los Ejercicios:
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'left' }]}>Ejercicio</Text>
                <Text style={styles.thCell}>Inicial</Text>
                <Text style={styles.thCell}>Final</Text>
                <Text style={styles.thCell}>RM Máx</Text>
                <Text style={styles.thCell}>Variación %</Text>
              </View>
              {allExercisesVariationSummary.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.tableRow}
                  onPress={() => setSelectedExerciseId(item.id)}
                >
                  <Text style={[styles.tdMainText, { flex: 2 }]}>{item.name}</Text>
                  <Text style={styles.tdCell}>{item.initialKg} kg</Text>
                  <Text style={[styles.tdCell, { color: primaryColor, fontWeight: '800' }]}>
                    {item.finalKg} kg
                  </Text>
                  <Text style={[styles.tdCell, { color: '#38BDF8', fontWeight: '700' }]}>
                    {item.peak1RM} kg
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      {
                        fontWeight: '900',
                        color: item.varPct >= 0 ? '#10B981' : '#EF4444',
                      },
                    ]}
                  >
                    {item.varPct >= 0 ? '+' : ''}
                    {item.varPct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          PESTAÑA 2: GRÁFICOS DE BARRAS (KG POR EJERCICIO, RPE Y RECUPERACIÓN - SEMANAL O MENSUAL)
          ========================================================================= */}
      {activeTab === 'barras' && (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>GRÁFICO DE BARRAS COMPARATIVO</Text>
                <Text style={styles.cardTitle}>
                  Registro Semanal y Mensual de KG, RPE y Recuperación
                </Text>
                <Text style={styles.cardSub}>
                  Visualiza en barras los KG de cada ejercicio, el RPE promedio y la Recuperación previa en cada semana y mes
                </Text>
              </View>
            </View>

            {/* Selector de Variable a graficar */}
            <View style={styles.filterPillGroup}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  barVariable === 'kg' && { backgroundColor: primaryColor, borderColor: primaryColor },
                ]}
                onPress={() => setBarVariable('kg')}
              >
                <Text style={[styles.filterPillText, barVariable === 'kg' && { color: '#FFF' }]}>
                  🏋️ KG por Ejercicio
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  barVariable === 'rpe' && { backgroundColor: '#FBBF24', borderColor: '#FBBF24' },
                ]}
                onPress={() => setBarVariable('rpe')}
              >
                <Text style={[styles.filterPillText, barVariable === 'rpe' && { color: '#000' }]}>
                  🚦 RPE Promedio (1-10)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  barVariable === 'recovery' && { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
                ]}
                onPress={() => setBarVariable('recovery')}
              >
                <Text style={[styles.filterPillText, barVariable === 'recovery' && { color: '#FFF' }]}>
                  🔋 Recuperación (1-10)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Selector de Ejercicio para KG y RPE */}
            {(barVariable === 'kg' || barVariable === 'rpe') && (
              <View style={styles.barExSelectorContainer}>
                <View style={styles.barExSelectorHeader}>
                  <Text style={styles.barExSelectorLabel}>
                    🎯 SELECCIONA EL EJERCICIO A GRAFICAR EN BARRAS:
                  </Text>
                  {effectiveBarExId !== 'all' && (
                    <TouchableOpacity onPress={() => setBarExerciseId('all')}>
                      <Text style={[styles.barExResetText, { color: primaryColor }]}>
                        Ver Promedio Global Sesión
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {loggedExercises.map((ex) => {
                    const isSelected = effectiveBarExId === ex.id;
                    return (
                      <TouchableOpacity
                        key={ex.id}
                        style={[
                          styles.exChip,
                          isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
                        ]}
                        onPress={() => setBarExerciseId(ex.id)}
                      >
                        <Text
                          style={[
                            styles.exChipText,
                            isSelected && { color: '#FFF', fontWeight: '800' },
                          ]}
                        >
                          {ex.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.exChip,
                      effectiveBarExId === 'all' && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setBarExerciseId('all')}
                  >
                    <Text
                      style={[
                        styles.exChipText,
                        effectiveBarExId === 'all' && { color: '#FFF', fontWeight: '800' },
                      ]}
                    >
                      🌐 Global Sesión
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {/* Switch Semanal vs Mensual */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, timeScope === 'weekly' && styles.scopeBtnActive]}
                onPress={() => setTimeScope('weekly')}
              >
                <Text style={[styles.scopeBtnText, timeScope === 'weekly' && styles.scopeBtnTextActive]}>
                  📅 Vista Semanal (Sem 1, Sem 2...)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, timeScope === 'monthly' && styles.scopeBtnActive]}
                onPress={() => setTimeScope('monthly')}
              >
                <Text style={[styles.scopeBtnText, timeScope === 'monthly' && styles.scopeBtnTextActive]}>
                  📆 Vista Mensual (Por Mes)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Gráfico de Barras Principal */}
            <View style={styles.chartWrapper}>
              <BarChart
                data={barChartData}
                height={200}
                barWidth={timeScope === 'weekly' ? 34 : 50}
                spacing={timeScope === 'weekly' ? 22 : 36}
                roundedTop
                roundedBottom
                hideRules={false}
                rulesColor="#1E293B"
                yAxisColor="#1E293B"
                xAxisColor="#1E293B"
                yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                noOfSections={4}
              />
            </View>

            {/* Tarjetas de Promedios Generales o de Ejercicio Específico */}
            {barVariable === 'kg' && effectiveBarExId !== 'all' ? (
              <View style={styles.threeKpiRow}>
                <View style={styles.miniKpiCard}>
                  <Text style={styles.miniKpiLabel}>CARGA MÁXIMA</Text>
                  <Text style={[styles.miniKpiValue, { color: primaryColor }]}>{overallAverages.maxExKg} kg</Text>
                  <Text style={styles.miniKpiSub} numberOfLines={1}>
                    {loggedExercises.find((e) => e.id === effectiveBarExId)?.name || 'Ejercicio'}
                  </Text>
                </View>

                <View style={styles.miniKpiCard}>
                  <Text style={styles.miniKpiLabel}>RPE PROM. EJERCICIO</Text>
                  <Text style={[styles.miniKpiValue, { color: '#FBBF24' }]}>{overallAverages.exRpeAvg}</Text>
                  <Text style={styles.miniKpiSub}>Intensidad media</Text>
                </View>

                <View style={styles.miniKpiCard}>
                  <Text style={styles.miniKpiLabel}>REPS EFECTIVAS</Text>
                  <Text style={[styles.miniKpiValue, { color: '#10B981' }]}>{overallAverages.exRepsEff}</Text>
                  <Text style={styles.miniKpiSub}>Total RIR ≤ 4</Text>
                </View>
              </View>
            ) : (
              <View style={styles.threeKpiRow}>
                <View style={styles.miniKpiCard}>
                  <Text style={styles.miniKpiLabel}>CARGA PROM/SESIÓN</Text>
                  <Text style={[styles.miniKpiValue, { color: primaryColor }]}>{overallAverages.avgKg} kg</Text>
                  <Text style={styles.miniKpiSub}>Volumen promedio</Text>
                </View>

                <View style={styles.miniKpiCard}>
                  <Text style={styles.miniKpiLabel}>RPE PROMEDIO</Text>
                  <Text style={[styles.miniKpiValue, { color: '#FBBF24' }]}>{overallAverages.avgRpe}/10</Text>
                  <Text style={styles.miniKpiSub}>Esfuerzo promedio</Text>
                </View>

                <View style={styles.miniKpiCard}>
                  <Text style={styles.miniKpiLabel}>RECUPERACIÓN PROM.</Text>
                  <Text style={[styles.miniKpiValue, { color: '#06B6D4' }]}>{overallAverages.avgRecovery}/10</Text>
                  <Text style={styles.miniKpiSub}>Promedio pre-entreno</Text>
                </View>
              </View>
            )}
          </View>

          {/* TABLA COMPARATIVA DE PROMEDIOS SEMANALES Y MENSUALES DE RPE Y RECUPERACIÓN */}
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>AUDITORÍA DE FATIGA Y RECUPERACIÓN</Text>
            <Text style={styles.cardTitle}>
              Promedio Semanal y Mensual de RPE y Recuperación (1-10)
            </Text>
            <Text style={styles.cardSub}>
              Comparativa directa entre cuán recuperado inicia el alumno y cuán dura resulta la sesión
            </Text>

            <Text style={[styles.sectionHeading, { marginTop: 12 }]}>
              📆 Promedios Mensuales de RPE y Recuperación:
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'left' }]}>Mes</Text>
                <Text style={styles.thCell}>Sesiones</Text>
                <Text style={styles.thCell}>🔋 Recup. Promedio</Text>
                <Text style={styles.thCell}>🚦 RPE Promedio</Text>
              </View>
              {rpeAndRecoverySummary.monthlyList.map((m, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tdMainText, { flex: 1.5 }]}>{m.label}</Text>
                  <Text style={styles.tdCell}>{m.sessionsCount}</Text>
                  <Text style={[styles.tdCell, { color: '#06B6D4', fontWeight: '800' }]}>
                    {m.avgRecovery} / 10
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      { color: getRpeTraffic(m.avgRpe).color, fontWeight: '800' },
                    ]}
                  >
                    RPE {m.avgRpe}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>
              📅 Registro Semanal de RPE y Recuperación:
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 1.8, textAlign: 'left' }]}>Semana</Text>
                <Text style={styles.thCell}>🔋 Recuperación Previa</Text>
                <Text style={styles.thCell}>🚦 RPE de Sesión</Text>
              </View>
              {rpeAndRecoverySummary.weeklyList.map((w, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tdMainText, { flex: 1.8 }]}>{w.label}</Text>
                  <Text style={[styles.tdCell, { color: '#06B6D4', fontWeight: '800' }]}>
                    {w.recovery} / 10
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      { color: getRpeTraffic(w.rpe).color, fontWeight: '800' },
                    ]}
                  >
                    RPE {w.rpe}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          PESTAÑA 3: GRÁFICO DE TORTA SEMANAL Y MENSUAL (% ZONAS & % TIPOS DE EJERCICIO)
          ========================================================================= */}
      {activeTab === 'tortas' && (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>DISTRIBUCIÓN EN GRÁFICO DE TORTA (SEMANAL Y MENSUAL)</Text>
                <Text style={styles.cardTitle}>Porcentaje por Zona y Tipo de Ejercicio</Text>
                <Text style={styles.cardSub}>
                  Visualiza semanal y mensualmente qué porcentaje del entrenamiento corresponde a Hemisferio Superior, Inferior y Zona Media, o a Básicos, Secundarios y Auxiliares
                </Text>
              </View>
            </View>

            {/* Switch de Modo de Torta (Zonas vs Tipos) */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, pieMode === 'zones' && styles.scopeBtnActive]}
                onPress={() => setPieMode('zones')}
              >
                <Text style={[styles.scopeBtnText, pieMode === 'zones' && styles.scopeBtnTextActive]}>
                  🥋 Zonas (Superior / Inferior / Media)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, pieMode === 'tiers' && styles.scopeBtnActive]}
                onPress={() => setPieMode('tiers')}
              >
                <Text style={[styles.scopeBtnText, pieMode === 'tiers' && styles.scopeBtnTextActive]}>
                  🏋️ Tipos (Básicos / Secundarios / Auxiliares)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filtro Temporal (Semanal / Mensual / Todo) */}
            <View style={[styles.filterPillGroup, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.filterPill, pieTimeFilter === 'weekly' && styles.filterPillActive]}
                onPress={() => setPieTimeFilter('weekly')}
              >
                <Text style={[styles.filterPillText, pieTimeFilter === 'weekly' && { color: '#FFF' }]}>
                  📅 Vista Semanal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, pieTimeFilter === 'monthly' && styles.filterPillActive]}
                onPress={() => setPieTimeFilter('monthly')}
              >
                <Text style={[styles.filterPillText, pieTimeFilter === 'monthly' && { color: '#FFF' }]}>
                  📆 Vista Mensual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, pieTimeFilter === 'all' && styles.filterPillActive]}
                onPress={() => setPieTimeFilter('all')}
              >
                <Text style={[styles.filterPillText, pieTimeFilter === 'all' && { color: '#FFF' }]}>
                  🌐 Todo el Historial
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sub-selector de Semana o Mes específico */}
            {pieTimeFilter === 'weekly' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {athleteSessions.map((s, idx) => {
                  const isActive =
                    (selectedPieWeekIdx === -1 && idx === athleteSessions.length - 1) ||
                    selectedPieWeekIdx === idx;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.exChip,
                        isActive && { backgroundColor: primaryColor, borderColor: primaryColor },
                      ]}
                      onPress={() => setSelectedPieWeekIdx(idx)}
                    >
                      <Text style={[styles.exChipText, isActive && { color: '#FFF', fontWeight: '800' }]}>
                        Semana {idx + 1} ({s.completedAt.slice(5, 10)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {pieTimeFilter === 'monthly' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {availableMonths.map((m, idx) => {
                  const isActive =
                    (selectedPieMonth === 'ALL' && idx === availableMonths.length - 1) ||
                    selectedPieMonth === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.exChip,
                        isActive && { backgroundColor: primaryColor, borderColor: primaryColor },
                      ]}
                      onPress={() => setSelectedPieMonth(m)}
                    >
                      <Text style={[styles.exChipText, isActive && { color: '#FFF', fontWeight: '800' }]}>
                        {formatMonthName(m)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={[styles.chartTitle, { marginTop: 6, textAlign: 'center' }]}>
              Período analizado: {pieDistribution.periodDescription}
            </Text>

            {/* Gráfico de Torta */}
            <View style={styles.pieContainer}>
              <PieChart
                data={pieDistribution.items}
                donut
                sectionAutoFocus
                radius={85}
                innerRadius={50}
                innerCircleColor="#090D14"
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>
                      {pieDistribution.totalSets}
                    </Text>
                    <Text style={{ color: '#64748B', fontSize: 10 }}>series</Text>
                  </View>
                )}
              />

              {/* Leyenda Detallada */}
              <View style={styles.pieLegendList}>
                {pieDistribution.items.map((item, idx) => (
                  <View key={idx} style={styles.pieLegendRow}>
                    <View style={[styles.pieColorBox, { backgroundColor: item.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pieLegendCat}>{item.title}</Text>
                      <Text style={styles.pieLegendMeta}>
                        {item.sets} series efectivas · {item.volume} kg movilizados
                      </Text>
                    </View>
                    <Text style={[styles.pieLegendPct, { color: item.color }]}>{item.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          PESTAÑA 4: REPETICIONES EFECTIVAS POR GRUPO MUSCULAR (10 MÚSCULOS)
          O PATRÓN DE MOVIMIENTO (4 PATRONES) POR SESIÓN Y SEMANA
          ========================================================================= */}
      {activeTab === 'efectivas' && (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>
                  CIENCIA DEL ENTRENAMIENTO · REPETICIONES EFECTIVAS (RIR ≤ 4)
                </Text>
                <Text style={styles.cardTitle}>
                  Repeticiones Efectivas por Músculo o Patrón de Movimiento
                </Text>
                <Text style={styles.cardSub}>
                  Sumatoria del total del día (sesión) o de la semana por cada uno de los 10 grupos musculares o 4 patrones de movimiento
                </Text>
              </View>
            </View>

            {/* Cuadro Explicativo de la Regla Científica */}
            <View style={styles.effectiveRuleCard}>
              <Text style={styles.effectiveRuleTitle}>
                ⚡ Regla Científica de Repeticiones Efectivas (Effort Gym):
              </Text>
              <Text style={styles.effectiveRuleBody}>
                • RIR 0 = 5 reps efectivas · RIR 1 = 4 reps · RIR 2 = 3 reps · RIR 3 = 2 reps · RIR 4 = 1 rep{'\n'}
                • Si el RIR es mayor a 4, las repeticiones efectivas son 0 (las últimas 5 antes del fallo son las efectivas).
              </Text>
            </View>

            {/* Selector 1: Grupo Muscular (10) vs Patrón de Movimiento (4) */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[
                  styles.scopeBtn,
                  effectiveDimension === 'muscle' && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
                onPress={() => setEffectiveDimension('muscle')}
              >
                <Text
                  style={[
                    styles.scopeBtnText,
                    effectiveDimension === 'muscle' && { color: '#FFF', fontWeight: '800' },
                  ]}
                >
                  💪 Por Grupo Muscular (10 Músculos)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.scopeBtn,
                  effectiveDimension === 'pattern' && {
                    backgroundColor: '#10B981',
                    borderColor: '#10B981',
                  },
                ]}
                onPress={() => setEffectiveDimension('pattern')}
              >
                <Text
                  style={[
                    styles.scopeBtnText,
                    effectiveDimension === 'pattern' && { color: '#000', fontWeight: '800' },
                  ]}
                >
                  🔄 Por Patrón de Movimiento (4)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Selector 2: Por Sesión (Total del Día) vs Por Semana de Entrenamiento */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, effectiveScope === 'session' && styles.scopeBtnActive]}
                onPress={() => setEffectiveScope('session')}
              >
                <Text style={[styles.scopeBtnText, effectiveScope === 'session' && styles.scopeBtnTextActive]}>
                  🏋️ En una Sesión (Total del Día)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, effectiveScope === 'weekly' && styles.scopeBtnActive]}
                onPress={() => setEffectiveScope('weekly')}
              >
                <Text style={[styles.scopeBtnText, effectiveScope === 'weekly' && styles.scopeBtnTextActive]}>
                  📅 Por Semana de Entrenamiento
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sub-selector de Sesión o Semana */}
            {effectiveScope === 'session' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {athleteSessions.map((sess, idx) => {
                  const active = inspectedSession?.id === sess.id;
                  return (
                    <TouchableOpacity
                      key={sess.id}
                      style={[
                        styles.exChip,
                        active && { backgroundColor: primaryColor, borderColor: primaryColor },
                      ]}
                      onPress={() => setSelectedSessionId(sess.id)}
                    >
                      <Text style={[styles.exChipText, active && { color: '#FFF', fontWeight: '800' }]}>
                        Día / Sem {idx + 1} ({sess.completedAt.slice(5, 10)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                <TouchableOpacity
                  style={[
                    styles.exChip,
                    selectedEffectiveWeekIdx === -1 && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                  ]}
                  onPress={() => setSelectedEffectiveWeekIdx(-1)}
                >
                  <Text
                    style={[
                      styles.exChipText,
                      selectedEffectiveWeekIdx === -1 && { color: '#FFF', fontWeight: '800' },
                    ]}
                  >
                    🌐 Acumulado Todas las Semanas
                  </Text>
                </TouchableOpacity>
                {trainingWeeks.map((w, idx) => {
                  const active = selectedEffectiveWeekIdx === idx;
                  return (
                    <TouchableOpacity
                      key={w.weekNumber}
                      style={[
                        styles.exChip,
                        active && { backgroundColor: primaryColor, borderColor: primaryColor },
                      ]}
                      onPress={() => setSelectedEffectiveWeekIdx(idx)}
                    >
                      <Text style={[styles.exChipText, active && { color: '#FFF', fontWeight: '800' }]}>
                        {w.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Total General */}
            <View style={[styles.kpiCard, { marginVertical: 10 }]}>
              <Text style={styles.kpiLabel}>
                SUMATORIA DE REPETICIONES EFECTIVAS · {effectiveRepsAnalysis.scopeTitle.toUpperCase()}
              </Text>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                ⚡ {effectiveRepsAnalysis.grandTotalEffective} repeticiones efectivas
              </Text>
              <Text style={styles.kpiSub}>
                {effectiveDimension === 'muscle'
                  ? 'Desglosado en: Cuádriceps, Glúteos, Isquiotibiales, Gemelos, Aductores, Pectorales, Espalda, Hombros, Bíceps y Tríceps'
                  : 'Desglosado en: Dominante de Rodilla, Dominante de Cadera, Empuje y Tracción'}
              </Text>
            </View>

            {/* Gráfico de Barras de Repeticiones Efectivas */}
            <View style={styles.chartWrapper}>
              <Text style={styles.chartTitle}>
                Gráfico de Barras: Repeticiones Efectivas por{' '}
                {effectiveDimension === 'muscle' ? 'Grupo Muscular (10)' : 'Patrón de Movimiento (4)'}
              </Text>
              <BarChart
                data={effectiveRepsAnalysis.barData}
                height={190}
                barWidth={effectiveDimension === 'muscle' ? 24 : 46}
                spacing={effectiveDimension === 'muscle' ? 16 : 34}
                roundedTop
                yAxisColor="#1E293B"
                xAxisColor="#1E293B"
                rulesColor="#1E293B"
                yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 9 }}
                noOfSections={4}
              />
            </View>

            {/* Tabla Desglosada por cada Músculo o Patrón de Movimiento */}
            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>
              Tabla de Repeticiones Efectivas por{' '}
              {effectiveDimension === 'muscle' ? 'Grupo Muscular' : 'Patrón de Movimiento'}:
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'left' }]}>
                  {effectiveDimension === 'muscle' ? 'Grupo Muscular' : 'Patrón de Movimiento'}
                </Text>
                <Text style={styles.thCell}>Series</Text>
                <Text style={styles.thCell}>RIR Prom</Text>
                <Text style={styles.thCell}>Reps Efectivas</Text>
              </View>
              {effectiveRepsAnalysis.list.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.semaforoDotMini, { backgroundColor: item.color }]} />
                      <Text style={styles.tdMainText}>{item.category}</Text>
                    </View>
                    {item.exercisesList ? (
                      <Text style={styles.tdSubText} numberOfLines={1}>
                        {item.exercisesList}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.tdCell}>{item.sets}</Text>
                  <Text style={styles.tdCell}>
                    {item.sets > 0 ? `RIR ${item.avgRir}` : '-'}
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      {
                        color: item.effectiveReps > 0 ? '#10B981' : '#64748B',
                        fontWeight: '900',
                      },
                    ]}
                  >
                    ⚡ {item.effectiveReps}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          BLOQUE INFERIOR: AUDITORÍA DE SESIÓN INDIVIDUAL
          ========================================================================= */}
      {inspectedSession && !compact && (
        <View style={styles.sessionAuditCard}>
          <Text style={styles.cardEyebrow}>AUDITORÍA DE SESIÓN DETALLADA</Text>
          <Text style={styles.cardTitle}>{inspectedSession.dayName}</Text>
          <Text style={styles.sessionMetaLine}>
            Completada: {inspectedSession.completedAt.slice(0, 10)} · Duración: {Math.round(inspectedSession.durationSeconds / 60)} min
          </Text>

          <View style={styles.auditMetricsRow}>
            <View style={styles.auditPill}>
              <Text style={styles.auditPillLabel}>CARGA</Text>
              <Text style={[styles.auditPillValue, { color: primaryColor }]}>{inspectedSession.totalVolumeKg} kg</Text>
            </View>
            <View style={styles.auditPill}>
              <Text style={styles.auditPillLabel}>REPS EFECTIVAS</Text>
              <Text style={[styles.auditPillValue, { color: '#10B981' }]}>
                ⚡ {inspectedSession.totalEffectiveReps ?? 0}
              </Text>
            </View>
            <View style={styles.auditPill}>
              <Text style={styles.auditPillLabel}>RECUPERACIÓN</Text>
              <Text style={[styles.auditPillValue, { color: '#06B6D4' }]}>
                {inspectedSession.preWorkoutRecovery ?? 8}/10
              </Text>
            </View>
            <View style={styles.auditPill}>
              <Text style={styles.auditPillLabel}>RPE SESIÓN</Text>
              <Text style={[styles.auditPillValue, { color: '#FBBF24' }]}>
                {inspectedSession.sessionRpe ?? inspectedSession.averageSessionRpe}/10
              </Text>
            </View>
          </View>

          {inspectedSession.exercises.map((ex) => (
            <View key={ex.exerciseId} style={styles.sessionExBox}>
              <View style={styles.sessionExHeader}>
                <Text style={styles.sessionExTitle}>
                  {ex.exerciseName}{' '}
                  <Text style={{ color: '#64748B', fontSize: 11 }}>
                    ({inferSpecificMuscleGroup(ex.exerciseName, ex.muscleGroup)} ·{' '}
                    {inferMovementPattern(ex.exerciseName, ex.muscleGroup)})
                  </Text>
                </Text>
                <Text style={styles.sessionExMeta}>
                  RM Epley: {ex.metrics.estimated1RM} kg · RPE Prom: {ex.metrics.averageRpe}
                </Text>
              </View>

              {ex.sets
                .filter((s) => s.completed)
                .map((s) => {
                  const rirVal = s.rir ?? Math.max(0, 10 - s.rpe);
                  const setRm = calculateEpley1RM(s.weight, s.reps, rirVal, s.rpe);
                  return (
                    <View key={s.id} style={styles.loggedSetLine}>
                      <Text style={styles.loggedSetNum}>
                        Serie {s.setNumber} ({s.type === 'warmup' ? 'Calentamiento' : 'Trabajo'})
                      </Text>
                      <Text style={styles.loggedSetVal}>
                        {s.weight} kg × {s.reps} reps · RPE {s.rpe} (RIR {rirVal}) · RM: {setRm} kg · ⚡{' '}
                        {s.effectiveReps ?? calculateEffectiveReps(s.reps, rirVal, s.rpe)} efec.
                      </Text>
                    </View>
                  );
                })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function AnalyticsChartsScreen({ primaryColor }: { primaryColor: string }) {
  const activeGymId = useGymStore((s) => s.activeGymId);
  const currentUserId = useGymStore((s) => s.currentUserId);
  const users = useGymStore((s) => s.users);

  const currentUser = users.find((u) => u.id === currentUserId);
  const gymAthletes = users.filter(
    (u) => u.gymId === activeGymId && u.role === 'athlete'
  );

  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(
    currentUser?.role === 'athlete'
      ? currentUser.id
      : gymAthletes[0]?.id || 'usr_athlete_1'
  );

  const targetAthleteId =
    currentUser?.role === 'athlete' ? currentUser.id : selectedAthleteId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      {currentUser?.role !== 'athlete' && (
        <View style={styles.coachSelectorBanner}>
          <Text style={styles.coachSelectorTitle}>
            👔 Panel Profe · Auditoría Estadística y Científica de Alumnos
          </Text>
          <View style={styles.athletePillsRow}>
            {gymAthletes.map((ath) => {
              const active = targetAthleteId === ath.id;
              return (
                <TouchableOpacity
                  key={ath.id}
                  style={[
                    styles.athleteSelectPill,
                    active && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                  ]}
                  onPress={() => setSelectedAthleteId(ath.id)}
                >
                  <Text
                    style={[
                      styles.athleteSelectPillText,
                      active && { color: '#FFFFFF' },
                    ]}
                  >
                    📊 {ath.displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <AthleteLoadAnalyticsPanel
        athleteId={targetAthleteId}
        primaryColor={primaryColor}
      />
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
  panelContainer: {
    gap: 16,
  },
  topTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1622',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1E293D',
    marginBottom: 8,
  },
  topTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  topTabBtnActive: {
    backgroundColor: '#1E293D',
  },
  topTabBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabContent: {
    gap: 16,
  },
  card: {
    backgroundColor: '#0D131F',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  cardHeaderRow: {
    marginBottom: 8,
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
    marginBottom: 2,
  },
  cardSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  exChip: {
    backgroundColor: '#131A26',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
    marginRight: 8,
  },
  exChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  barExSelectorContainer: {
    backgroundColor: '#090D14',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
    marginVertical: 8,
  },
  barExSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barExSelectorLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  barExResetText: {
    fontSize: 10,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#090D14',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  kpiLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },
  kpiSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  formulaBanner: {
    backgroundColor: '#082F49',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0284C7',
    marginBottom: 12,
  },
  formulaTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  formulaBody: {
    color: '#E0F2FE',
    fontSize: 11,
    lineHeight: 16,
  },
  chartWrapper: {
    backgroundColor: '#090D14',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293D',
    marginTop: 8,
  },
  chartTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  barTopLabel: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  scatterPointLarge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    backgroundColor: '#090D14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scatterPointInnerLarge: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  scatterSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  scatterSummaryPill: {
    backgroundColor: '#090D14',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
    minWidth: 100,
  },
  scatterSummaryLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  scatterSummaryVal: {
    fontSize: 14,
    fontWeight: '900',
    marginVertical: 2,
  },
  scatterSummaryMeta: {
    color: '#94A3B8',
    fontSize: 9,
  },
  sectionHeading: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  historyTable: {
    backgroundColor: '#090D14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293D',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#131A26',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293D',
  },
  thCell: {
    flex: 1,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293D',
  },
  tdCell: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 11,
    textAlign: 'center',
  },
  semaforoDotMini: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tdMainText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  tdSubText: {
    color: '#64748B',
    fontSize: 10,
  },
  filterPillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  filterPill: {
    backgroundColor: '#131A26',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  filterPillActive: {
    backgroundColor: '#1E293D',
    borderColor: '#38BDF8',
  },
  filterPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  scopeSwitcherRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#131A26',
    borderWidth: 1,
    borderColor: '#1E293D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnActive: {
    backgroundColor: '#1E293D',
    borderColor: '#38BDF8',
  },
  scopeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  scopeBtnTextActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  threeKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  miniKpiCard: {
    flex: 1,
    backgroundColor: '#090D14',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  miniKpiLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  miniKpiValue: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  miniKpiSub: {
    color: '#94A3B8',
    fontSize: 10,
  },
  pieContainer: {
    alignItems: 'center',
    marginVertical: 12,
    gap: 16,
  },
  pieLegendList: {
    width: '100%',
    gap: 6,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090D14',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
    gap: 10,
  },
  pieColorBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  pieLegendCat: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  pieLegendMeta: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  pieLegendPct: {
    fontSize: 14,
    fontWeight: '900',
  },
  effectiveRuleCard: {
    backgroundColor: '#052E16',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 10,
  },
  effectiveRuleTitle: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  effectiveRuleBody: {
    color: '#ECFDF5',
    fontSize: 11,
    lineHeight: 16,
  },
  sessionAuditCard: {
    backgroundColor: '#0D131F',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293D',
    marginTop: 10,
  },
  sessionMetaLine: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 10,
  },
  auditMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  auditPill: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#090D14',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  auditPillLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  auditPillValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  sessionExBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293D',
  },
  sessionExHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  sessionExTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionExMeta: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  loggedSetLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  loggedSetNum: {
    color: '#64748B',
    fontSize: 11,
  },
  loggedSetVal: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#0D131F',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293D',
    alignItems: 'center',
  },
  emptyCardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyCardSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  coachSelectorBanner: {
    backgroundColor: '#0D131F',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  coachSelectorTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  athletePillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  athleteSelectPill: {
    backgroundColor: '#131A26',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  athleteSelectPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
});
