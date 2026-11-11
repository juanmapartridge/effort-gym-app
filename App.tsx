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

  const isCoachMode = currentUser.role === 'coach';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090D14" />

      {/* Barra Superior con Selector de Rol Cristalino y Profesional */}
      <View style={styles.topTenantBar}>
        <View style={styles.appContainer}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <View style={[styles.gymColorDot, { backgroundColor: primaryColor }]} />
              <View>
                <Text style={styles.gymNameText}>EFFORT GYM</Text>
                <Text style={styles.tenantSubText}>
                  {isCoachMode
                    ? 'Director: Gian Boasso · Panel de Gestión'
                    : `Socio en Sala: ${currentUser.displayName}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.resetDemoBtn} onPress={resetDemoData}>
              <Text style={styles.resetDemoBtnText}>↺ Reiniciar Demo</Text>
            </TouchableOpacity>
          </View>

          {/* Selector de Modo Dedicado: Entrenador vs Alumno */}
          <View style={styles.modeSwitchContainer}>
            <TouchableOpacity
              style={[
                styles.modeSwitchBtn,
                isCoachMode && {
                  backgroundColor: '#1E293D',
                  borderColor: primaryColor,
                },
              ]}
              onPress={() =>
                handleSwitchTenantProfile('gym_effort', 'usr_coach_1', 'coach')
              }
            >
              <Text
                style={[
                  styles.modeSwitchBtnText,
                  isCoachMode && { color: '#FFFFFF', fontWeight: '800' },
                ]}
              >
                👔 Panel del Profesor (Gian)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeSwitchBtn,
                !isCoachMode && {
                  backgroundColor: '#1E293D',
                  borderColor: primaryColor,
                },
              ]}
              onPress={() =>
                handleSwitchTenantProfile('gym_effort', 'usr_athlete_1', 'logger')
              }
            >
              <Text
                style={[
                  styles.modeSwitchBtnText,
                  !isCoachMode && { color: '#FFFFFF', fontWeight: '800' },
                ]}
              >
                📱 App del Alumno (Socio)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sub-selector de Atleta si está en Modo Alumno */}
          {!isCoachMode && (
            <View style={styles.athleteSwitcherRow}>
              <Text style={styles.athleteSwitcherLabel}>Simular socio:</Text>
              <TouchableOpacity
                style={[
                  styles.profilePill,
                  currentUserId === 'usr_athlete_1' && styles.profilePillActive,
                ]}
                onPress={() =>
                  handleSwitchTenantProfile('gym_effort', 'usr_athlete_1', 'logger')
                }
              >
                <Text
                  style={[
                    styles.profilePillText,
                    currentUserId === 'usr_athlete_1' && styles.profilePillTextActive,
                  ]}
                >
                  Martín Echeverría
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.profilePill,
                  currentUserId === 'usr_athlete_2' && styles.profilePillActive,
                ]}
                onPress={() =>
                  handleSwitchTenantProfile('gym_effort', 'usr_athlete_2', 'logger')
                }
              >
                <Text
                  style={[
                    styles.profilePillText,
                    currentUserId === 'usr_athlete_2' && styles.profilePillTextActive,
                  ]}
                >
                  Sofía Martínez
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Banner de confirmación sutil */}
      {lastSavedBanner && (
        <TouchableOpacity style={styles.toastBanner} onPress={clearSavedBanner}>
          <View style={[styles.appContainer, styles.toastInner]}>
            <Text style={styles.toastText}>✓ {lastSavedBanner}</Text>
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

      {/* Navegación Inferior Limpia */}
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
                  📋 Alumnos & Rutinas
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
                  📊 Auditoría Científica
                </Text>
                {activeTab === 'analytics' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navTab}
                onPress={() =>
                  handleSwitchTenantProfile('gym_effort', 'usr_athlete_1', 'logger')
                }
              >
                <Text style={styles.navTabLabel}>
                  📱 Probar App Alumno
                </Text>
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
                  🏋️ Mi Entrenamiento
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
                  📈 Mi Progreso
                </Text>
                {activeTab === 'analytics' && (
                  <View style={[styles.navActiveIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navTab}
                onPress={() =>
                  handleSwitchTenantProfile('gym_effort', 'usr_coach_1', 'coach')
                }
              >
                <Text style={[styles.navTabLabel, { color: '#F59E0B', fontWeight: '800' }]}>
                  👔 Volver a Profe
                </Text>
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
    backgroundColor: '#090D14',
  },
  topTenantBar: {
    backgroundColor: '#131A26',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293D',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gymColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gymNameText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tenantSubText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  resetDemoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  resetDemoBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  demoSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  modeSwitchBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0D131F',
    borderWidth: 1.5,
    borderColor: '#1E293D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitchBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  athleteSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293D',
  },
  athleteSwitcherLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  profilePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0D131F',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  profilePillActive: {
    backgroundColor: '#1E293D',
    borderColor: '#334155',
  },
  profilePillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  profilePillTextActive: {
    color: '#F8FAFC',
  },
  toastBanner: {
    backgroundColor: '#064E3B',
    borderBottomWidth: 1,
    borderBottomColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    backgroundColor: '#131A26',
    borderTopWidth: 1,
    borderTopColor: '#1E293D',
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
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  navActiveIndicator: {
    height: 3,
    width: 32,
    borderRadius: 2,
    marginTop: 4,
  },
});
