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
import { WorkoutSession } from '../types/models';

const CATEGORY_COLORS: Record<string, string> = {
  'HEMISFERIO INFERIOR': '#F97316',
  'HEMISFERIO SUPERIOR': '#38BDF8',
  'ZONA MEDIA': '#10B981',
  'ZONA LUMBOPELVICA': '#A855F7',
  'MOVILIDAD CADERA': '#FBBF24',
  'MOVILIDAD TORACICA': '#EC4899',
  'MOVILIDAD HOMBRO': '#6366F1',
  'MOVILIDAD RODILLA': '#14B8A6',
  'MOVILIDAD TOBILLO': '#84CC16',
  RESISTENCIA: '#EF4444',
};

function getCategoryColor(cat: string, idx: number): string {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  const fallback = ['#F97316', '#38BDF8', '#10B981', '#A855F7', '#FBBF24', '#EC4899'];
  return fallback[idx % fallback.length];
}

/**
 * Panel reutilizable de Gráficos de Monitoreo de Carga (Barras, Dispersión/Líneas y Torta).
 * Se usa tanto en la pestaña "Mi Progreso" como dentro de la Ficha del Alumno en el Panel del Profesor.
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

  const athleteSessions = useMemo(() => {
    return workoutSessions
      .filter((s) => s.gymId === activeGymId && s.userId === athleteId)
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  }, [workoutSessions, activeGymId, athleteId]);

  const [barMode, setBarMode] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    athleteSessions[athleteSessions.length - 1]?.id || null
  );

  // Ejercicios con datos registrados para este atleta
  const loggedExerciseIds = useMemo(() => {
    return Array.from(
      new Set(
        athleteSessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))
      )
    );
  }, [athleteSessions]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    loggedExerciseIds[0] || 'ex_c1164817'
  );

  const activeExerciseId = loggedExerciseIds.includes(selectedExerciseId)
    ? selectedExerciseId
    : loggedExerciseIds[0] || 'ex_c1164817';

  // --- CÁLCULO DE VARIACIÓN MENSUAL Y SEMANAL EN PORCENTAJE (%) ---
  const monthlyStats = useMemo(() => {
    const byMonth = new Map<string, { totalVol: number; count: number }>();
    for (const s of athleteSessions) {
      const monthKey = s.completedAt.slice(0, 7); // YYYY-MM
      const prev = byMonth.get(monthKey) || { totalVol: 0, count: 0 };
      byMonth.set(monthKey, {
        totalVol: prev.totalVol + s.totalVolumeKg,
        count: prev.count + 1,
      });
    }
    const months = Array.from(byMonth.entries()).map(([month, data]) => ({
      month,
      totalVol: Math.round(data.totalVol),
      avgVolPerSession: Math.round(data.totalVol / Math.max(1, data.count)),
      count: data.count,
    }));

    let monthlyVariationPct = 0;
    if (months.length >= 2) {
      const last = months[months.length - 1].avgVolPerSession;
      const prev = months[months.length - 2].avgVolPerSession;
      if (prev > 0) {
        monthlyVariationPct = Math.round(((last - prev) / prev) * 1000) / 10;
      }
    }

    let weeklyVariationPct = 0;
    if (athleteSessions.length >= 2) {
      const lastSess = athleteSessions[athleteSessions.length - 1].totalVolumeKg;
      const prevSess = athleteSessions[athleteSessions.length - 2].totalVolumeKg;
      if (prevSess > 0) {
        weeklyVariationPct = Math.round(((lastSess - prevSess) / prevSess) * 1000) / 10;
      }
    }

    return { months, monthlyVariationPct, weeklyVariationPct };
  }, [athleteSessions]);

  // --- 1. DATOS PARA EL GRÁFICO DE BARRAS (SEMANAL O MENSUAL) ---
  const barData = useMemo(() => {
    if (barMode === 'weekly') {
      return athleteSessions.map((sess, idx) => {
        const isSelected =
          (selectedSessionId && sess.id === selectedSessionId) ||
          (!selectedSessionId && idx === athleteSessions.length - 1);
        const dateLabel = sess.completedAt.slice(5, 10); // MM-DD
        return {
          value: Math.round(sess.totalVolumeKg),
          label: `Sem ${idx + 1}\n(${dateLabel})`,
          frontColor: isSelected ? primaryColor : '#38BDF8',
          gradientColor: isSelected ? '#EA580C' : '#0284C7',
          showGradient: true,
          topLabelComponent: () => (
            <Text style={styles.barTopLabel}>
              {Math.round(sess.totalVolumeKg)}kg
            </Text>
          ),
          onPress: () => setSelectedSessionId(sess.id),
        };
      });
    } else {
      return monthlyStats.months.map((m, idx) => {
        const isLast = idx === monthlyStats.months.length - 1;
        return {
          value: m.avgVolPerSession,
          label: m.month === '2026-09' ? 'Sept 2026' : m.month === '2026-10' ? 'Oct 2026' : m.month,
          frontColor: isLast ? '#10B981' : '#6366F1',
          gradientColor: isLast ? '#059669' : '#4F46E5',
          showGradient: true,
          topLabelComponent: () => (
            <Text style={styles.barTopLabel}>{m.avgVolPerSession}kg/ses</Text>
          ),
        };
      });
    }
  }, [barMode, athleteSessions, monthlyStats, selectedSessionId, primaryColor]);

  // --- 2. DATOS PARA EL GRÁFICO DE DISPERSIÓN / LÍNEAS (1RM Y PESO MÁXIMO + % VARIACIÓN) ---
  const exerciseEvolution = useMemo(() => {
    const pts: {
      dateLabel: string;
      month: string;
      estimated1RM: number;
      maxWeightKg: number;
      averageRpe: number;
    }[] = [];

    for (const sess of athleteSessions) {
      const match = sess.exercises.find((e) => e.exerciseId === activeExerciseId);
      if (match && match.metrics.estimated1RM > 0) {
        pts.push({
          dateLabel: sess.completedAt.slice(5, 10),
          month: sess.completedAt.slice(0, 7),
          estimated1RM: match.metrics.estimated1RM,
          maxWeightKg: match.metrics.maxWeightKg,
          averageRpe: match.metrics.averageRpe,
        });
      }
    }

    let strengthVariationPct = 0;
    if (pts.length >= 2) {
      const first = pts[0].estimated1RM;
      const last = pts[pts.length - 1].estimated1RM;
      if (first > 0) {
        strengthVariationPct = Math.round(((last - first) / first) * 1000) / 10;
      }
    }

    const lineData1RM = pts.map((p) => ({
      value: p.estimated1RM,
      label: p.dateLabel,
      dataPointText: `${p.estimated1RM}kg`,
      customDataPoint: () => (
        <View style={[styles.scatterPoint, { borderColor: primaryColor }]}>
          <View style={[styles.scatterPointInner, { backgroundColor: primaryColor }]} />
        </View>
      ),
    }));

    const lineDataMaxWeight = pts.map((p) => ({
      value: p.maxWeightKg,
      label: p.dateLabel,
      dataPointText: `${p.maxWeightKg}kg`,
    }));

    return { pts, strengthVariationPct, lineData1RM, lineDataMaxWeight };
  }, [athleteSessions, activeExerciseId, primaryColor]);

  // --- 3. DATOS PARA EL GRÁFICO DE TORTA (DISTRIBUCIÓN POR CATEGORÍAS EFFORT GYM) ---
  const categoryDistribution = useMemo(() => {
    const counts = new Map<string, { sets: number; volume: number }>();
    let totalSets = 0;

    for (const sess of athleteSessions) {
      for (const ex of sess.exercises) {
        const completedCount = ex.sets.filter((s) => s.completed).length;
        if (completedCount === 0) continue;
        const cat = ex.muscleGroup || 'GENERAL';
        const prev = counts.get(cat) || { sets: 0, volume: 0 };
        counts.set(cat, {
          sets: prev.sets + completedCount,
          volume: prev.volume + ex.metrics.totalVolumeKg,
        });
        totalSets += completedCount;
      }
    }

    const items = Array.from(counts.entries())
      .map(([category, data], idx) => {
        const pct = totalSets > 0 ? Math.round((data.sets / totalSets) * 100) : 0;
        const color = getCategoryColor(category, idx);
        return {
          category,
          sets: data.sets,
          volume: Math.round(data.volume),
          pct,
          value: data.sets,
          color,
          text: `${pct}%`,
        };
      })
      .sort((a, b) => b.sets - a.sets);

    return { items, totalSets };
  }, [athleteSessions]);

  const inspectedSession: WorkoutSession | undefined =
    athleteSessions.find((s) => s.id === selectedSessionId) ||
    athleteSessions[athleteSessions.length - 1];

  if (athleteSessions.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyCardTitle}>
          Este alumno todavía no tiene sesiones registradas
        </Text>
        <Text style={styles.emptyCardSub}>
          En cuanto complete su primer entrenamiento en el Workout Logger, aquí aparecerán sus
          gráficos de barras de volumen, curva de fuerza 1RM y distribución por categorías.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* KPIs DE VARIACIÓN PORCENTUAL MENSUAL Y SEMANAL */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>VARIACIÓN MENSUAL</Text>
          <Text
            style={[
              styles.kpiValue,
              {
                color:
                  monthlyStats.monthlyVariationPct >= 0 ? '#10B981' : '#EF4444',
              },
            ]}
          >
            {monthlyStats.monthlyVariationPct >= 0 ? '+' : ''}
            {monthlyStats.monthlyVariationPct}%
          </Text>
          <Text style={styles.kpiSub}>Carga promedio mes a mes</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>VARIACIÓN SEMANAL</Text>
          <Text
            style={[
              styles.kpiValue,
              {
                color:
                  monthlyStats.weeklyVariationPct >= 0 ? '#38BDF8' : '#F59E0B',
              },
            ]}
          >
            {monthlyStats.weeklyVariationPct >= 0 ? '+' : ''}
            {monthlyStats.weeklyVariationPct}%
          </Text>
          <Text style={styles.kpiSub}>Última sesión vs previa</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>ÚLTIMA CARGA TOTAL</Text>
          <Text style={[styles.kpiValue, { color: primaryColor }]}>
            {athleteSessions[athleteSessions.length - 1]?.totalVolumeKg ?? 0} kg
          </Text>
          <Text style={styles.kpiSub}>
            RPE Promedio: {athleteSessions[athleteSessions.length - 1]?.averageSessionRpe ?? '-'}
          </Text>
        </View>
      </View>

      {/* 1. GRÁFICO DE BARRAS (VOLUMEN DE CARGA SEMANAL / MENSUAL) */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>
              📊 Evolución de Volumen de Carga (kg totales)
            </Text>
            <Text style={styles.chartSubtitle}>
              {barMode === 'weekly'
                ? 'Volumen total movido semana a semana (Toca una barra para ver sus series)'
                : `Comparativa de carga promedio mensual (${
                    monthlyStats.monthlyVariationPct >= 0 ? '+' : ''
                  }${monthlyStats.monthlyVariationPct}% vs mes anterior)`}
            </Text>
          </View>

          <View style={styles.modeToggleGroup}>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                barMode === 'weekly' && { backgroundColor: primaryColor },
              ]}
              onPress={() => setBarMode('weekly')}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  barMode === 'weekly' && { color: '#FFF' },
                ]}
              >
                Semanal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                barMode === 'monthly' && { backgroundColor: primaryColor },
              ]}
              onPress={() => setBarMode('monthly')}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  barMode === 'monthly' && { color: '#FFF' },
                ]}
              >
                Mensual (%)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.giftedChartContainer}>
          <BarChart
            data={barData}
            barWidth={barMode === 'weekly' ? 38 : 56}
            spacing={barMode === 'weekly' ? 26 : 48}
            roundedTop
            roundedBottom={false}
            noOfSections={4}
            yAxisThickness={1}
            xAxisThickness={1}
            yAxisColor="#334155"
            xAxisColor="#334155"
            yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
            xAxisLabelTextStyle={{ color: '#CBD5E1', fontSize: 10, textAlign: 'center' }}
            rulesColor="#1E293B"
            isAnimated
            height={compact ? 160 : 190}
          />
        </View>
      </View>

      {/* 2. GRÁFICO DE DISPERSIÓN / LÍNEAS: PROGRESIÓN 1RM Y PESO CON % VARIACIÓN */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>
              📈 Curva y Dispersión de Fuerza (1RM vs Peso Levantado)
            </Text>
            <Text style={styles.chartSubtitle}>
              Selecciona el ejercicio principal para evaluar ganancia de fuerza y RPE
            </Text>
          </View>

          <View style={styles.variationPill}>
            <Text style={styles.variationPillLabel}>Evolución Ejercicio</Text>
            <Text style={styles.variationPillValue}>
              {exerciseEvolution.strengthVariationPct >= 0 ? '+' : ''}
              {exerciseEvolution.strengthVariationPct}% en 1RM
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.exerciseFilterScroll}
        >
          {exercisesCatalog
            .filter((e) => loggedExerciseIds.includes(e.id))
            .map((ex) => {
              const active = activeExerciseId === ex.id;
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[
                    styles.filterChip,
                    active && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                  ]}
                  onPress={() => setSelectedExerciseId(ex.id)}
                >
                  <Text style={[styles.filterChipText, active && { color: '#FFF' }]}>
                    {ex.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        {exerciseEvolution.lineData1RM.length > 0 ? (
          <>
            <View style={styles.legendInlineRow}>
              <View style={styles.legendDotItem}>
                <View style={[styles.legendDot, { backgroundColor: primaryColor }]} />
                <Text style={styles.legendDotText}>1RM Estimado (Fuerza Teórica)</Text>
              </View>
              <View style={styles.legendDotItem}>
                <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
                <Text style={styles.legendDotText}>Peso Máximo Real Levantado (kg)</Text>
              </View>
            </View>

            <View style={styles.giftedChartContainer}>
              <LineChart
                data={exerciseEvolution.lineData1RM}
                data2={exerciseEvolution.lineDataMaxWeight}
                height={compact ? 160 : 190}
                spacing={64}
                initialSpacing={24}
                color1={primaryColor}
                color2="#38BDF8"
                thickness1={3}
                thickness2={2}
                dataPointsColor1={primaryColor}
                dataPointsColor2="#38BDF8"
                dataPointsRadius={6}
                textColor1="#F8FAFC"
                textColor2="#93C5FD"
                textFontSize={10}
                textShiftY={-8}
                textShiftX={-6}
                yAxisColor="#334155"
                xAxisColor="#334155"
                yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#CBD5E1', fontSize: 10 }}
                rulesColor="#1E293B"
                curved
                isAnimated
                startFillColor1={primaryColor}
                endFillColor1="#0B0F19"
                startOpacity={0.25}
                endOpacity={0.02}
                areaChart
              />
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>Sin datos suficientes para este ejercicio.</Text>
        )}
      </View>

      {/* 3. GRÁFICO DE TORTA (DISTRIBUCIÓN POR CATEGORÍAS EFFORT GYM) */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>
          🍩 Distribución de Carga por Categorías (Equilibrio de Planificación)
        </Text>
        <Text style={styles.chartSubtitle}>
          Porcentaje de series efectivas trabajadas según las categorías de Effort Gym (Ideal para
          que el profesor planifique el próximo mes)
        </Text>

        <View style={styles.pieSectionRow}>
          <View style={styles.pieWrapper}>
            <PieChart
              data={categoryDistribution.items}
              donut
              showText
              textColor="#FFFFFF"
              textSize={11}
              fontWeight="bold"
              radius={compact ? 78 : 90}
              innerRadius={compact ? 46 : 54}
              innerCircleColor="#111827"
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={styles.pieCenterBig}>{categoryDistribution.totalSets}</Text>
                  <Text style={styles.pieCenterSub}>Series Totales</Text>
                </View>
              )}
            />
          </View>

          <View style={styles.pieLegendCol}>
            {categoryDistribution.items.map((item) => (
              <View key={item.category} style={styles.pieLegendRow}>
                <View style={[styles.pieColorBox, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pieLegendCat}>{item.category}</Text>
                  <Text style={styles.pieLegendMeta}>
                    {item.sets} series · {item.volume} kg acumulados
                  </Text>
                </View>
                <Text style={[styles.pieLegendPct, { color: item.color }]}>
                  {item.pct}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 4. DESGLOSE GRANULAR DE LA SESIÓN SELECCIONADA */}
      {!compact && inspectedSession && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            📋 Detalle de Series de la Sesión: {inspectedSession.dayName}
          </Text>
          <Text style={styles.chartSubtitle}>
            Alumno: {inspectedSession.athleteName} · Fecha:{' '}
            {inspectedSession.completedAt.slice(0, 10)} · Carga Total:{' '}
            {inspectedSession.totalVolumeKg} kg
          </Text>

          {inspectedSession.exercises.map((ex) => (
            <View key={ex.exerciseId} style={styles.sessionExBox}>
              <View style={styles.sessionExHeader}>
                <Text style={styles.sessionExTitle}>
                  {ex.exerciseName}{' '}
                  <Text style={{ color: '#94A3B8', fontSize: 11 }}>({ex.muscleGroup})</Text>
                </Text>
                <Text style={styles.sessionExMeta}>
                  1RM Est: {ex.metrics.estimated1RM}kg · Vol: {ex.metrics.totalVolumeKg}kg
                </Text>
              </View>
              {ex.sets
                .filter((s) => s.completed)
                .map((s) => (
                  <View key={s.id} style={styles.loggedSetLine}>
                    <Text style={styles.loggedSetNum}>
                      Serie {s.setNumber} ({s.type === 'warmup' ? 'Calentamiento' : 'Efectiva'})
                    </Text>
                    <Text style={styles.loggedSetVal}>
                      {s.weight} kg × {s.reps} reps @ RPE {s.rpe}
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

  // Si el usuario logueado es Profesor (Gian), puede elegir de qué alumno ver las estadísticas
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
            Vista de Analítica para el Profesor: Selecciona un alumno para auditar su carga
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
    backgroundColor: '#0B0F19',
  },
  contentPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  coachSelectorBanner: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  coachSelectorTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  athletePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  athleteSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  athleteSelectPillText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
  },
  emptyCardTitle: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyCardSub: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  kpiLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  kpiValue: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 4,
  },
  kpiSub: {
    color: '#6B7280',
    fontSize: 10,
  },
  chartCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  chartTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
  },
  chartSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeToggleText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  giftedChartContainer: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
    overflow: 'hidden',
  },
  barTopLabel: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
  },
  variationPill: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  variationPillLabel: {
    color: '#A7F3D0',
    fontSize: 9,
    fontWeight: '700',
  },
  variationPillValue: {
    color: '#ECFDF5',
    fontSize: 13,
    fontWeight: '900',
  },
  exerciseFilterScroll: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  filterChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  legendInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  legendDotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  scatterPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scatterPointInner: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    paddingVertical: 16,
    textAlign: 'center',
  },
  pieSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 14,
  },
  pieWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  pieCenterBig: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
  },
  pieCenterSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  pieLegendCol: {
    flex: 1,
    minWidth: 220,
    gap: 8,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
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
  sessionExBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  sessionExHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  sessionExTitle: {
    color: '#F3F4F6',
    fontSize: 14,
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
    paddingVertical: 4,
  },
  loggedSetNum: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  loggedSetVal: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '700',
  },
});
