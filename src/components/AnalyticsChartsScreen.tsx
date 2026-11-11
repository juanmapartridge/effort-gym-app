import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { useGymStore } from '../store/useGymStore';
import {
  WorkoutSession,
  calculateEffectiveReps,
  calculatePercentageVariation,
  inferBodyZone,
  inferExerciseTier,
  BodyZone,
  ExerciseTier,
} from '../types/models';
import { getRecoveryColor, getRpeTraffic, RPE_TRAFFIC_LIGHT } from './WorkoutLoggerScreen';

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

/**
 * Panel completo de Analítica y Estadísticas Científicas para Effort Gym:
 * 1. Registro diario de KG por ejercicio (acumulado semanal/mensual) + Variación % (Final - Inicial)/Inicial*100.
 * 2. RPE promedio de series por ejercicio y RPE de sesión (1-10) al final.
 * 3. Recuperación previa (1-10) y su promedio semanal/mensual.
 * 4. Gráficos de barras multi-variable (KG, RPE, Recuperación) semanal y mensual.
 * 5. Gráfico de torta semanal y mensual por Zonas (Superior, Inferior, Zona Media).
 * 6. Gráfico de torta semanal y mensual por Tipos (Básicos, Secundarios, Auxiliares).
 * 7. Repeticiones efectivas por grupo muscular con algoritmo científico (RIR <= 4).
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
  const exercisesCatalog = useGymStore((s) => s.exercisesCatalog);

  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>('cargas');
  const [barVariable, setBarVariable] = useState<BarVariableKey>('kg');
  const [timeScope, setTimeScope] = useState<'weekly' | 'monthly'>('weekly');
  const [pieMode, setPieMode] = useState<'zones' | 'tiers'>('zones');
  const [pieTimeFilter, setPieTimeFilter] = useState<'all' | 'monthly' | 'weekly'>('all');
  const [exerciseSearch, setExerciseSearch] = useState<string>('');

  // Sesiones del atleta ordenadas cronológicamente
  const athleteSessions = useMemo(() => {
    return workoutSessions
      .filter((s) => s.gymId === activeGymId && s.userId === athleteId)
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  }, [workoutSessions, activeGymId, athleteId]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    athleteSessions[athleteSessions.length - 1]?.id || null
  );

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
    loggedExercises[0]?.id || 'ex_0c491f10'
  );

  const activeExercise = loggedExercises.find((e) => e.id === selectedExerciseId) || loggedExercises[0];

  // =========================================================================
  // 1. ANÁLISIS DE KG & RPE POR EJERCICIO (DIARIO, SEMANAL Y MENSUAL + % VAR)
  // =========================================================================
  const exerciseHistory = useMemo(() => {
    if (!activeExercise) return { records: [], variationPct: 0, firstVal: 0, lastVal: 0, avgRpeOverall: 0 };

    interface ExRecord {
      date: string;
      sessionName: string;
      weekLabel: string;
      monthLabel: string;
      maxWeightKg: number;
      avgWeightKg: number;
      totalVolumeKg: number;
      averageRpe: number;
      effectiveReps: number;
      completedWorkingSets: number;
    }

    const records: ExRecord[] = [];

    athleteSessions.forEach((sess, sessIdx) => {
      const exMatch = sess.exercises.find((e) => e.exerciseId === activeExercise.id);
      if (!exMatch) return;

      const workingSets = exMatch.sets.filter((s) => s.completed && s.type === 'working');
      if (workingSets.length === 0) return;

      const totalVol = workingSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const totalReps = workingSets.reduce((sum, s) => sum + s.reps, 0);
      const avgWeight = totalReps > 0 ? Math.round((totalVol / totalReps) * 10) / 10 : 0;
      const maxWeight = Math.max(...workingSets.map((s) => s.weight));
      const avgRpe =
        Math.round(
          (workingSets.reduce((sum, s) => sum + s.rpe, 0) / workingSets.length) * 10
        ) / 10;
      const totalEff = workingSets.reduce(
        (sum, s) => sum + (s.effectiveReps ?? calculateEffectiveReps(s.reps, s.rir, s.rpe)),
        0
      );

      records.push({
        date: sess.completedAt.slice(0, 10),
        sessionName: sess.dayName,
        weekLabel: `Semana ${sessIdx + 1} (${sess.completedAt.slice(5, 10)})`,
        monthLabel: sess.completedAt.slice(0, 7),
        maxWeightKg: maxWeight,
        avgWeightKg: avgWeight,
        totalVolumeKg: Math.round(totalVol),
        averageRpe: avgRpe,
        effectiveReps: totalEff,
        completedWorkingSets: workingSets.length,
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

    return { records, variationPct, firstVal, lastVal, avgRpeOverall };
  }, [athleteSessions, activeExercise]);

  // Agrupado Mensual del ejercicio
  const exerciseMonthlyRecords = useMemo(() => {
    const map = new Map<string, { maxWeight: number; sumWeight: number; count: number; sumRpe: number }>();
    exerciseHistory.records.forEach((r) => {
      const prev = map.get(r.monthLabel) || { maxWeight: 0, sumWeight: 0, count: 0, sumRpe: 0 };
      map.set(r.monthLabel, {
        maxWeight: Math.max(prev.maxWeight, r.maxWeightKg),
        sumWeight: prev.sumWeight + r.avgWeightKg,
        count: prev.count + 1,
        sumRpe: prev.sumRpe + r.averageRpe,
      });
    });

    const list = Array.from(map.entries()).map(([month, data]) => ({
      month,
      monthName: month === '2026-09' ? 'Septiembre' : month === '2026-10' ? 'Octubre' : month === '2026-11' ? 'Noviembre' : month,
      maxWeightKg: data.maxWeight,
      avgWeightKg: Math.round((data.sumWeight / Math.max(1, data.count)) * 10) / 10,
      avgRpe: Math.round((data.sumRpe / Math.max(1, data.count)) * 10) / 10,
    }));

    let monthVariationPct = 0;
    if (list.length >= 2) {
      const first = list[0].maxWeightKg;
      const last = list[list.length - 1].maxWeightKg;
      monthVariationPct = calculatePercentageVariation(last, first);
    }

    return { list, monthVariationPct };
  }, [exerciseHistory]);

  // Línea de evolución de KG para el ejercicio seleccionado
  const exerciseLineData = useMemo(() => {
    return exerciseHistory.records.map((r) => ({
      value: r.maxWeightKg,
      label: r.date.slice(5),
      dataPointText: `${r.maxWeightKg}kg`,
      customDataPoint: () => (
        <View style={[styles.scatterPoint, { borderColor: primaryColor }]}>
          <View style={[styles.scatterPointInner, { backgroundColor: primaryColor }]} />
        </View>
      ),
    }));
  }, [exerciseHistory, primaryColor]);

  // =========================================================================
  // 2. DATOS PARA EL GRÁFICO DE BARRAS (KG, RPE, RECUPERACIÓN - SEMANAL O MENSUAL)
  // =========================================================================
  const barChartData = useMemo(() => {
    if (timeScope === 'weekly') {
      // Por cada sesión/semana
      return athleteSessions.map((sess, idx) => {
        let value = 0;
        let topText = '';
        let frontColor = primaryColor;

        if (barVariable === 'kg') {
          value = Math.round(sess.totalVolumeKg);
          topText = `${value} kg`;
          frontColor = primaryColor;
        } else if (barVariable === 'rpe') {
          value = sess.sessionRpe ?? sess.averageSessionRpe;
          topText = `${value}`;
          const traffic = getRpeTraffic(value);
          frontColor = traffic.color;
        } else {
          // recovery
          value = sess.preWorkoutRecovery ?? 8;
          topText = `${value}/10`;
          const recColor = getRecoveryColor(value);
          frontColor = recColor.border;
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
      const byMonth = new Map<string, { sumKg: number; sumRpe: number; sumRec: number; count: number }>();
      athleteSessions.forEach((s) => {
        const m = s.completedAt.slice(0, 7);
        const prev = byMonth.get(m) || { sumKg: 0, sumRpe: 0, sumRec: 0, count: 0 };
        const sRpe = s.sessionRpe ?? s.averageSessionRpe;
        const sRec = s.preWorkoutRecovery ?? 8;
        byMonth.set(m, {
          sumKg: prev.sumKg + s.totalVolumeKg,
          sumRpe: prev.sumRpe + sRpe,
          sumRec: prev.sumRec + sRec,
          count: prev.count + 1,
        });
      });

      return Array.from(byMonth.entries()).map(([month, data]) => {
        let value = 0;
        let topText = '';
        let frontColor = primaryColor;

        const label =
          month === '2026-09' ? 'Sept' : month === '2026-10' ? 'Oct' : month === '2026-11' ? 'Nov' : month;

        if (barVariable === 'kg') {
          value = Math.round(data.sumKg / Math.max(1, data.count));
          topText = `${value} kg/ses`;
          frontColor = primaryColor;
        } else if (barVariable === 'rpe') {
          value = Math.round((data.sumRpe / Math.max(1, data.count)) * 10) / 10;
          topText = `${value} RPE`;
          frontColor = getRpeTraffic(value).color;
        } else {
          value = Math.round((data.sumRec / Math.max(1, data.count)) * 10) / 10;
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
  }, [athleteSessions, timeScope, barVariable, selectedSessionId, primaryColor]);

  // Promedios generales de KPIs
  const overallAverages = useMemo(() => {
    if (athleteSessions.length === 0) return { avgKg: 0, avgRpe: 0, avgRecovery: 0 };
    const totalKg = athleteSessions.reduce((sum, s) => sum + s.totalVolumeKg, 0);
    const totalRpe = athleteSessions.reduce((sum, s) => sum + (s.sessionRpe ?? s.averageSessionRpe), 0);
    const totalRec = athleteSessions.reduce((sum, s) => sum + (s.preWorkoutRecovery ?? 8), 0);
    const n = athleteSessions.length;
    return {
      avgKg: Math.round(totalKg / n),
      avgRpe: Math.round((totalRpe / n) * 10) / 10,
      avgRecovery: Math.round((totalRec / n) * 10) / 10,
    };
  }, [athleteSessions]);

  // =========================================================================
  // 3. GRÁFICOS DE TORTA (ZONAS CORPORALES & TIPOS DE EJERCICIO)
  // =========================================================================
  const pieDistribution = useMemo(() => {
    // Filtrar sesiones según el selector temporal
    let sessionsToAnalyze = athleteSessions;
    if (pieTimeFilter === 'weekly' && athleteSessions.length > 0) {
      sessionsToAnalyze = [athleteSessions[athleteSessions.length - 1]];
    } else if (pieTimeFilter === 'monthly' && athleteSessions.length > 0) {
      const lastMonth = athleteSessions[athleteSessions.length - 1].completedAt.slice(0, 7);
      sessionsToAnalyze = athleteSessions.filter((s) => s.completedAt.slice(0, 7) === lastMonth);
    }

    if (pieMode === 'zones') {
      // HEMISFERIO SUPERIOR, HEMISFERIO INFERIOR, ZONA MEDIA
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
          value: Math.max(1, data.sets),
          color: ZONE_COLORS[zone],
          text: `${pct}%`,
        };
      });

      return { items, totalSets };
    } else {
      // BÁSICOS, SECUNDARIOS, AUXILIARES
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
          value: Math.max(1, data.sets),
          color: TIER_COLORS[tier],
          text: `${pct}%`,
        };
      });

      return { items, totalSets };
    }
  }, [athleteSessions, pieMode, pieTimeFilter]);

  // =========================================================================
  // 4. REPETICIONES EFECTIVAS POR GRUPO MUSCULAR (ALGORITMO CIENTÍFICO RIR <= 4)
  // =========================================================================
  const [effectiveScope, setEffectiveScope] = useState<'session' | 'weekly'>('weekly');

  const effectiveRepsAnalysis = useMemo(() => {
    let sessionsToCount = athleteSessions;
    if (effectiveScope === 'session' && athleteSessions.length > 0) {
      sessionsToCount = selectedSessionId
        ? athleteSessions.filter((s) => s.id === selectedSessionId)
        : [athleteSessions[athleteSessions.length - 1]];
    }

    const muscleMap = new Map<
      string,
      {
        muscleGroup: string;
        sets: number;
        effectiveReps: number;
        rirSum: number;
        repsSum: number;
      }
    >();

    let grandTotalEffective = 0;

    for (const sess of sessionsToCount) {
      for (const ex of sess.exercises) {
        const mg = ex.muscleGroup.toUpperCase();
        const prev = muscleMap.get(mg) || {
          muscleGroup: mg,
          sets: 0,
          effectiveReps: 0,
          rirSum: 0,
          repsSum: 0,
        };

        for (const s of ex.sets) {
          if (!s.completed || s.type !== 'working') continue;
          const rirVal = s.rir !== undefined ? s.rir : Math.max(0, 10 - s.rpe);
          const eff = s.effectiveReps !== undefined ? s.effectiveReps : calculateEffectiveReps(s.reps, rirVal, s.rpe);
          prev.sets += 1;
          prev.effectiveReps += eff;
          prev.rirSum += rirVal;
          prev.repsSum += s.reps;
          grandTotalEffective += eff;
        }

        muscleMap.set(mg, prev);
      }
    }

    const list = Array.from(muscleMap.values())
      .filter((m) => m.sets > 0)
      .map((m) => ({
        muscleGroup: m.muscleGroup,
        sets: m.sets,
        effectiveReps: m.effectiveReps,
        avgRir: Math.round((m.rirSum / m.sets) * 10) / 10,
        totalReps: m.repsSum,
      }))
      .sort((a, b) => b.effectiveReps - a.effectiveReps);

    const barData = list.map((item, idx) => ({
      value: item.effectiveReps,
      label: item.muscleGroup.length > 10 ? item.muscleGroup.slice(0, 9) + '..' : item.muscleGroup,
      frontColor: idx === 0 ? primaryColor : '#38BDF8',
      topLabelComponent: () => (
        <Text style={styles.barTopLabel}>{item.effectiveReps}</Text>
      ),
    }));

    return { list, grandTotalEffective, barData };
  }, [athleteSessions, effectiveScope, selectedSessionId, primaryColor]);

  // Sesión inspeccionada
  const inspectedSession: WorkoutSession | undefined =
    athleteSessions.find((s) => s.id === selectedSessionId) ||
    athleteSessions[athleteSessions.length - 1];

  if (athleteSessions.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyCardTitle}>Sin sesiones de entrenamiento aún</Text>
        <Text style={styles.emptyCardSub}>
          En cuanto el alumno complete su primer entrenamiento en el Workout Logger, aquí
          se generará automáticamente su analítica de KG, RPE, recuperación y repeticiones efectivas.
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
            🏋️ KG & RPE Ejercicios
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
            📊 Barras Promedio
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
          PESTAÑA 1: KG Y RPE POR EJERCICIO (DIARIO, SEMANAL Y MENSUAL + % VARIACIÓN)
          ========================================================================= */}
      {activeTab === 'cargas' && (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>REGISTRO DE CARGAS & ESFUERZO POR EJERCICIO</Text>
                <Text style={styles.cardTitle}>Evolución de Cargas y RPE</Text>
                <Text style={styles.cardSub}>
                  Elige un ejercicio para auditar los KG utilizados semana a semana y su variación %
                </Text>
              </View>
            </View>

            {/* Selector de Ejercicio */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
              {loggedExercises.map((ex) => {
                const isSelected = ex.id === activeExercise?.id;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.exChip,
                      isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setSelectedExerciseId(ex.id)}
                  >
                    <Text style={[styles.exChipText, isSelected && { color: '#FFF', fontWeight: '800' }]}>
                      {ex.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* KPIS DE VARIACIÓN PORCENTUAL DE CARGA */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>VARIACIÓN TOTAL DE CARGA</Text>
                <Text
                  style={[
                    styles.kpiValue,
                    {
                      color:
                        exerciseHistory.variationPct >= 0 ? '#10B981' : '#EF4444',
                    },
                  ]}
                >
                  {exerciseHistory.variationPct >= 0 ? '+' : ''}
                  {exerciseHistory.variationPct}%
                </Text>
                <Text style={styles.kpiSub}>
                  {exerciseHistory.firstVal}kg ➔ {exerciseHistory.lastVal}kg
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>RPE PROMEDIO EJERCICIO</Text>
                <Text style={[styles.kpiValue, { color: '#FBBF24' }]}>
                  {exerciseHistory.avgRpeOverall}
                </Text>
                <Text style={styles.kpiSub}>Esfuerzo promedio de series</Text>
              </View>
            </View>

            {/* Banner Didáctico de Fórmula de Sobrecarga Progresiva */}
            <View style={styles.formulaBanner}>
              <Text style={styles.formulaTitle}>
                📐 Fórmula de Variación Porcentual: (Valor Final – Valor Inicial) / Valor Inicial × 100
              </Text>
              <Text style={styles.formulaBody}>
                {activeExercise?.name}: Comenzó con {exerciseHistory.firstVal} kg y alcanzó {exerciseHistory.lastVal} kg ({exerciseHistory.variationPct >= 0 ? '+' : ''}{exerciseHistory.variationPct}%).
              </Text>
            </View>

            {/* Gráfico de Evolución de KG */}
            {exerciseLineData.length > 1 && (
              <View style={styles.chartWrapper}>
                <Text style={styles.chartTitle}>Curva de Cargas Máximas (kg) a lo largo del tiempo</Text>
                <LineChart
                  data={exerciseLineData}
                  color={primaryColor}
                  thickness={3}
                  startFillColor={primaryColor}
                  endFillColor="rgba(249, 115, 22, 0.05)"
                  areaChart
                  height={180}
                  yAxisColor="#1E293B"
                  xAxisColor="#1E293B"
                  yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                  noOfSections={4}
                />
              </View>
            )}

            {/* Tabla Detallada Semana a Semana */}
            <Text style={[styles.sectionHeading, { marginTop: 16 }]}>
              Detalle Semana a Semana / Sesión a Sesión:
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2 }]}>Fecha / Sesión</Text>
                <Text style={styles.thCell}>Top KG</Text>
                <Text style={styles.thCell}>RPE Prom</Text>
                <Text style={styles.thCell}>Reps Efectivas</Text>
              </View>
              {exerciseHistory.records.map((rec, i) => (
                <View key={i} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tdMainText}>{rec.date}</Text>
                    <Text style={styles.tdSubText}>{rec.sessionName}</Text>
                  </View>
                  <Text style={[styles.tdCell, { color: primaryColor, fontWeight: '800' }]}>
                    {rec.maxWeightKg} kg
                  </Text>
                  <View style={styles.tdCellRpe}>
                    <View
                      style={[
                        styles.semaforoDotMini,
                        { backgroundColor: getRpeTraffic(rec.averageRpe).color },
                      ]}
                    />
                    <Text style={styles.tdText}>{rec.averageRpe}</Text>
                  </View>
                  <Text style={[styles.tdCell, { color: '#10B981', fontWeight: '800' }]}>
                    ⚡ {rec.effectiveReps}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          PESTAÑA 2: GRÁFICOS DE BARRAS (KG, RPE Y RECUPERACIÓN - SEMANAL O MENSUAL)
          ========================================================================= */}
      {activeTab === 'barras' && (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>GRÁFICO DE BARRAS COMPARATIVO</Text>
                <Text style={styles.cardTitle}>Promedios Semanales y Mensuales</Text>
                <Text style={styles.cardSub}>
                  Visualiza el valor promedio de cada variable en cada semana y a lo largo de cada mes
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
                  🏋️ Carga Total (KG)
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

            {/* Switch Semanal vs Mensual */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, timeScope === 'weekly' && styles.scopeBtnActive]}
                onPress={() => setTimeScope('weekly')}
              >
                <Text style={[styles.scopeBtnText, timeScope === 'weekly' && styles.scopeBtnTextActive]}>
                  📅 Vista Semanal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, timeScope === 'monthly' && styles.scopeBtnActive]}
                onPress={() => setTimeScope('monthly')}
              >
                <Text style={[styles.scopeBtnText, timeScope === 'monthly' && styles.scopeBtnTextActive]}>
                  📆 Vista Mensual
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

            {/* Tarjetas de Promedios Generales */}
            <View style={styles.threeKpiRow}>
              <View style={styles.miniKpiCard}>
                <Text style={styles.miniKpiLabel}>CARGA PROM/SESIÓN</Text>
                <Text style={[styles.miniKpiValue, { color: primaryColor }]}>{overallAverages.avgKg} kg</Text>
                <Text style={styles.miniKpiSub}>Volumen promedio</Text>
              </View>

              <View style={styles.miniKpiCard}>
                <Text style={styles.miniKpiLabel}>RPE PROMEDIO</Text>
                <Text style={[styles.miniKpiValue, { color: '#FBBF24' }]}>{overallAverages.avgRpe}</Text>
                <Text style={styles.miniKpiSub}>Escala 1 al 10</Text>
              </View>

              <View style={styles.miniKpiCard}>
                <Text style={styles.miniKpiLabel}>RECUPERACIÓN</Text>
                <Text style={[styles.miniKpiValue, { color: '#06B6D4' }]}>{overallAverages.avgRecovery}/10</Text>
                <Text style={styles.miniKpiSub}>Promedio pre-entreno</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          PESTAÑA 3: GRÁFICO DE TORTA (% ZONAS & % TIPOS DE EJERCICIO)
          ========================================================================= */}
      {activeTab === 'tortas' && (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>DISTRIBUCIÓN EN GRÁFICO DE TORTA</Text>
                <Text style={styles.cardTitle}>Porcentaje por Zona y Tipo de Ejercicio</Text>
                <Text style={styles.cardSub}>
                  Compara semanal y mensualmente qué volumen ocupó cada zona corporal y cada categoría de ejercicio
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

            {/* Filtro Temporal (Todo / Mensual / Semanal) */}
            <View style={[styles.filterPillGroup, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.filterPill, pieTimeFilter === 'all' && styles.filterPillActive]}
                onPress={() => setPieTimeFilter('all')}
              >
                <Text style={[styles.filterPillText, pieTimeFilter === 'all' && { color: '#FFF' }]}>
                  Todo el Historial
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, pieTimeFilter === 'monthly' && styles.filterPillActive]}
                onPress={() => setPieTimeFilter('monthly')}
              >
                <Text style={[styles.filterPillText, pieTimeFilter === 'monthly' && { color: '#FFF' }]}>
                  Último Mes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, pieTimeFilter === 'weekly' && styles.filterPillActive]}
                onPress={() => setPieTimeFilter('weekly')}
              >
                <Text style={[styles.filterPillText, pieTimeFilter === 'weekly' && { color: '#FFF' }]}>
                  Última Semana
                </Text>
              </TouchableOpacity>
            </View>

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
                        {item.sets} series · {item.volume} kg
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
          PESTAÑA 4: REPETICIONES EFECTIVAS POR GRUPO MUSCULAR (RIR <= 4)
          ========================================================================= */}
      {activeTab === 'efectivas' && (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>CIENCIA DEL ENTRENAMIENTO · REPETICIONES EFECTIVAS</Text>
                <Text style={styles.cardTitle}>Estímulo Real por Grupo Muscular</Text>
                <Text style={styles.cardSub}>
                  Sumatoria de repeticiones efectivas en series de RIR 4 o menos (las últimas 5 repeticiones previas al fallo)
                </Text>
              </View>
            </View>

            {/* Cuadro Explicativo de la Regla Científica */}
            <View style={styles.effectiveRuleCard}>
              <Text style={styles.effectiveRuleTitle}>⚡ Regla Científica de Repeticiones Efectivas:</Text>
              <Text style={styles.effectiveRuleBody}>
                • RIR 0 = 5 repeticiones efectivas (Fallo total){'\n'}
                • RIR 1 = 4 repeticiones efectivas{'\n'}
                • RIR 2 = 3 repeticiones efectivas (Óptimo hipertrofia){'\n'}
                • RIR 3 = 2 repeticiones efectivas{'\n'}
                • RIR 4 = 1 repetición efectiva{'\n'}
                • RIR {'>'} 4 = 0 repeticiones efectivas (Carga preparatoria)
              </Text>
            </View>

            {/* Selector de Alcance (Semanal vs Sesión Individual) */}
            <View style={styles.scopeSwitcherRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, effectiveScope === 'weekly' && styles.scopeBtnActive]}
                onPress={() => setEffectiveScope('weekly')}
              >
                <Text style={[styles.scopeBtnText, effectiveScope === 'weekly' && styles.scopeBtnTextActive]}>
                  📅 Acumulado de la Semana
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, effectiveScope === 'session' && styles.scopeBtnActive]}
                onPress={() => setEffectiveScope('session')}
              >
                <Text style={[styles.scopeBtnText, effectiveScope === 'session' && styles.scopeBtnTextActive]}>
                  🏋️ Última Sesión
                </Text>
              </TouchableOpacity>
            </View>

            {/* Total General */}
            <View style={[styles.kpiCard, { marginVertical: 12 }]}>
              <Text style={styles.kpiLabel}>TOTAL REPETICIONES EFECTIVAS LOGRADAS</Text>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                ⚡ {effectiveRepsAnalysis.grandTotalEffective}
              </Text>
              <Text style={styles.kpiSub}>Repeticiones dentro del umbral de estímulo máximo</Text>
            </View>

            {/* Gráfico de Barras de Repeticiones Efectivas por Músculo */}
            <View style={styles.chartWrapper}>
              <Text style={styles.chartTitle}>Repeticiones Efectivas por Músculo / Patrón</Text>
              <BarChart
                data={effectiveRepsAnalysis.barData}
                height={180}
                barWidth={36}
                spacing={24}
                roundedTop
                yAxisColor="#1E293B"
                xAxisColor="#1E293B"
                yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                noOfSections={4}
              />
            </View>

            {/* Tabla Desglosada por Grupo Muscular */}
            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>
              Desglose por Músculo o Patrón de Movimiento:
            </Text>
            <View style={styles.historyTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2 }]}>Músculo / Patrón</Text>
                <Text style={styles.thCell}>Series</Text>
                <Text style={styles.thCell}>RIR Prom</Text>
                <Text style={styles.thCell}>Reps Efectivas</Text>
              </View>
              {effectiveRepsAnalysis.list.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tdMainText, { flex: 2 }]}>{item.muscleGroup}</Text>
                  <Text style={styles.tdCell}>{item.sets}</Text>
                  <Text style={styles.tdCell}>RIR {item.avgRir}</Text>
                  <Text style={[styles.tdCell, { color: '#10B981', fontWeight: '900' }]}>
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
      {inspectedSession && (
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
                    ({ex.bodyZone || ex.muscleGroup} · {ex.exerciseTier || 'Fuerza'})
                  </Text>
                </Text>
                <Text style={styles.sessionExMeta}>
                  1RM: {ex.metrics.estimated1RM} kg · RPE Prom: {ex.metrics.averageRpe}
                </Text>
              </View>

              {ex.sets
                .filter((s) => s.completed)
                .map((s) => (
                  <View key={s.id} style={styles.loggedSetLine}>
                    <Text style={styles.loggedSetNum}>
                      Serie {s.setNumber} ({s.type === 'warmup' ? 'Calentamiento' : 'Trabajo'})
                    </Text>
                    <Text style={styles.loggedSetVal}>
                      {s.weight} kg × {s.reps} reps · RPE {s.rpe} (RIR {s.rir ?? Math.max(0, 10 - s.rpe)}) · ⚡ {s.effectiveReps ?? calculateEffectiveReps(s.reps, s.rir, s.rpe)} efec.
                    </Text>
                  </View>
                ))}
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
            Auditoría de Cargas y Rendimiento para el Profesor
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
    fontSize: 22,
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
  scatterPoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scatterPointInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    fontSize: 12,
    textAlign: 'center',
  },
  tdCellRpe: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  semaforoDotMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  tdText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#131A26',
    borderWidth: 1,
    borderColor: '#1E293D',
    alignItems: 'center',
  },
  scopeBtnActive: {
    backgroundColor: '#1E293D',
    borderColor: '#475569',
  },
  scopeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
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
