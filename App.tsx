import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useGymStore } from './src/store/useGymStore';
import { WorkoutLoggerScreen } from './src/components/WorkoutLoggerScreen';
import { AnalyticsChartsScreen } from './src/components/AnalyticsChartsScreen';
import { CoachDashboardScreen } from './src/components/CoachDashboardScreen';
import { isFirebaseConfigured } from './src/services/firebase';

type TabKey = 'logger' | 'analytics' | 'coach';

export default function App() {
  const gyms = useGymStore((s) => s.gyms);
  const users = useGymStore((s) => s.users);
  const activeGymId = useGymStore((s) => s.activeGymId);
  const currentUserId = useGymStore((s) => s.currentUserId);
  const lastSavedBanner = useGymStore((s) => s.lastSavedBanner);
  const setActiveTenantAndUser = useGymStore((s) => s.setActiveTenantAndUser);
  const clearSavedBanner = useGymStore((s) => s.clearSavedBanner);
  const resetDemoData = useGymStore((s) => s.resetDemoData);

  const [activeTab, setActiveTab] = useState<TabKey>('coach');

  const currentGym = gyms.find((g) => g.id === activeGymId) || gyms[0];
  const currentUser = users.find((u) => u.id === currentUserId) || users[0];
  const primaryColor = currentGym.primaryColor || '#F97316';

  const handleSwitchTenantProfile = (gymId: string, userId: string, defaultTab: TabKey) => {
    setActiveTenantAndUser(gymId, userId);
    setActiveTab(defaultTab);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Barra Superior: Identidad Effort Gym + Selector Rápido de Vista */}
      <View style={styles.topTenantBar}>
        <View style={styles.appContainer}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <View style={[styles.gymColorDot, { backgroundColor: primaryColor }]} />
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.gymNameText}>EFFORT GYM</Text>
                  <View style={styles.badgePro}>
                    <Text style={styles.badgeProText}>SEGUIMIENTO DE CARGA</Text>
                  </View>
                </View>
                <Text style={styles.tenantSubText}>
                  {currentUser.displayName} · {currentUser.role === 'athlete' ? 'Atleta en Sala' : 'Profesor / Director'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.resetDemoBtn} onPress={resetDemoData}>
              <Text style={styles.resetDemoBtnText}>↺ Restaurar Datos</Text>
            </TouchableOpacity>
          </View>

          {/* Botones para alternar entre Vista Profesor y Alumnos */}
          <View style={styles.demoSwitcherRow}>
            <Text style={styles.switcherLabel}>Perfil activo:</Text>
            <TouchableOpacity
              style={[
                styles.profilePill,
                currentUserId === 'usr_coach_1' && {
                  borderColor: primaryColor,
                  backgroundColor: '#1E293B',
                },
              ]}
              onPress={() =>
                handleSwitchTenantProfile('gym_effort', 'usr_coach_1', 'coach')
              }
            >
              <Text style={styles.profilePillText}>
                👔 Profesor: Gian Boasso
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.profilePill,
                currentUserId === 'usr_athlete_1' && {
                  borderColor: primaryColor,
                  backgroundColor: '#1E293B',
                },
              ]}
              onPress={() =>
                handleSwitchTenantProfile('gym_effort', 'usr_athlete_1', 'logger')
              }
            >
              <Text style={styles.profilePillText}>
                🏃 Alumno: Martín Echeverría
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.profilePill,
                currentUserId === 'usr_athlete_2' && {
                  borderColor: primaryColor,
                  backgroundColor: '#1E293B',
                },
              ]}
              onPress={() =>
                handleSwitchTenantProfile('gym_effort', 'usr_athlete_2', 'logger')
              }
            >
              <Text style={styles.profilePillText}>
                🏃 Alumna: Sofía Martínez
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Banner de confirmación de operaciones */}
      {lastSavedBanner && (
        <TouchableOpacity style={styles.toastBanner} onPress={clearSavedBanner}>
          <View style={[styles.appContainer, styles.toastInner]}>
            <Text style={styles.toastText}>✅ {lastSavedBanner}</Text>
            <Text style={styles.toastDismiss}>✕</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Contenido Principal con Contenedor Responsivo */}
      <View style={styles.mainBody}>
        <View style={[styles.appContainer, { flex: 1, paddingHorizontal: 0 }]}>
          {activeTab === 'logger' && (
            <WorkoutLoggerScreen
              primaryColor={primaryColor}
              onWorkoutFinished={() => setActiveTab('analytics')}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsChartsScreen primaryColor={primaryColor} />
          )}
          {activeTab === 'coach' && (
            <CoachDashboardScreen primaryColor={primaryColor} />
          )}
        </View>
      </View>

      {/* Navegación Inferior Clara Responsiva */}
      <View style={styles.bottomNav}>
        <View style={[styles.appContainer, styles.bottomNavInner]}>
          {currentUser.role === 'coach' ? (
            <>
              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveTab('coach')}
              >
                <Text
                  style={[
                    styles.navTabLabel,
                    activeTab === 'coach' && { color: primaryColor, fontWeight: '800' },
                  ]}
                >
                  📋 Panel Profe & Alertas
                </Text>
                {activeTab === 'coach' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveTab('analytics')}
              >
                <Text
                  style={[
                    styles.navTabLabel,
                    activeTab === 'analytics' && { color: primaryColor, fontWeight: '800' },
                  ]}
                >
                  📊 Analítica de Carga
                </Text>
                {activeTab === 'analytics' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveTab('logger')}
              >
                <Text
                  style={[
                    styles.navTabLabel,
                    activeTab === 'logger' && { color: primaryColor, fontWeight: '800' },
                  ]}
                >
                  🏋️ Probar Logger
                </Text>
                {activeTab === 'logger' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveTab('logger')}
              >
                <Text
                  style={[
                    styles.navTabLabel,
                    activeTab === 'logger' && { color: primaryColor, fontWeight: '800' },
                  ]}
                >
                  🏋️ Mi Rutina Hoy
                </Text>
                {activeTab === 'logger' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveTab('analytics')}
              >
                <Text
                  style={[
                    styles.navTabLabel,
                    activeTab === 'analytics' && { color: primaryColor, fontWeight: '800' },
                  ]}
                >
                  📊 Mi Progreso (1RM)
                </Text>
                {activeTab === 'analytics' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveTab('coach')}
              >
                <Text
                  style={[
                    styles.navTabLabel,
                    activeTab === 'coach' && { color: primaryColor, fontWeight: '800' },
                  ]}
                >
                  📋 Panel Profe
                </Text>
                {activeTab === 'coach' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  topTenantBar: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  gymColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  gymNameText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgePro: {
    backgroundColor: '#7C2D12',
    borderColor: '#EA580C',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeProText: {
    color: '#FFEDD5',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tenantSubText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  resetDemoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  resetDemoBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  demoSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  switcherLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 4,
  },
  profilePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  profilePillText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  toastBanner: {
    backgroundColor: '#064E3B',
    borderBottomWidth: 1,
    borderBottomColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toastText: {
    color: '#ECFDF5',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  toastDismiss: {
    color: '#A7F3D0',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
  },
  mainBody: {
    flex: 1,
  },
  appContainer: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomNavInner: {
    flexDirection: 'row',
    paddingHorizontal: 0,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingVertical: 6,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  navTabLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  navActiveIndicator: {
    height: 3,
    width: 36,
    borderRadius: 2,
    marginTop: 5,
  },
});
