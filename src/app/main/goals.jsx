import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, Vibration, Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { TaskService } from '@/utils/taskService';
import NavMenu from '../nav/menu';
import LevelUpModal from '../nav/levelUpModal';

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';

const SECTION_TITLES = {
  mandatory: 'Daily',
  extra: 'Extra Tasks',
  challenge: 'Challenges',
};

export default function GoalsScreen (){
    const [tasks, setTasks] = useState({ mandatory: [], extra: [], challenge: [] });
    const [loading, setLoading] = useState(true);
    const [navOpen, setNavOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [pendingTaskId, setPendingTaskId] = useState(null);
    const [levelUpInfo, setLevelUpInfo] = useState(null);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
          const { tasks: t } = await TaskService.getTodayTasks();
          setTasks(t);
        } catch (e) {
          Alert.alert('Error loading tasks', String(e.message || e));
        } finally {
          setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
          loadTasks();
        }, [loadTasks])
    );
    
    const handleTick = async (task) => {
        if (task.completed || pendingTaskId) return; // already done / a request in flight
    
        setPendingTaskId(task.taskId);
        try {
          const result = await TaskService.markTaskDoneForToday(task.taskId);
          Vibration.vibrate(15);
          setSuccessMessage('task completed - points earned');
          setTimeout(() => setSuccessMessage(''), 3000);
          await loadTasks();

          // Interrupt immediately if this completion pushed a level up,
          // rather than waiting for the next Status screen visit.
          if (result.leveledUp) {
            setLevelUpInfo({ newLevel: result.newLevel });
          }
        } catch (e) {
          Alert.alert('Could not complete task', String(e.message || e));
        } finally {
          setPendingTaskId(null);
        }
    };
    
    const renderSection = (type) => {
        const list = tasks[type];
        if (!list || list.length === 0) return null;

        return (
            <View key={type} style={styles.section}>
                <Text style={styles.sectionTitle}>{SECTION_TITLES[type]}</Text>
                {list.map((task) => (
                  <Pressable
                    key={task.id}
                    style={styles.taskRow}
                    onPress={() => handleTick(task)}
                    disabled={task.completed}
                  >
                    <Text style={[styles.taskName, task.completed && styles.taskNameDone]}>
                      {task.name}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        task.completed && styles.checkboxChecked,
                        pendingTaskId === task.taskId && styles.checkboxPending,
                      ]}
                    >
                      {task.completed && <Text style={styles.checkmark}>✓</Text>}
                      {pendingTaskId === task.taskId && (
                        <ActivityIndicator size="small" color={CYAN} />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
        );
    };

    const isEmpty =
        tasks.mandatory.length === 0 && tasks.extra.length === 0 && tasks.challenge.length === 0;
    
    return (
        <SafeAreaView style={styles.screen}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
    
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setNavOpen((v) => !v)}
            >
              <Text style={styles.navButtonText}>{navOpen ? 'Close' : 'Menu'}</Text>
            </TouchableOpacity>
          </View>
    
          {!!successMessage && (
            <Text style={styles.successText}>{successMessage}</Text>
          )}
    
          {navOpen ? (
            <NavMenu onNavigate={() => setNavOpen(false)} />
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.card}>
                <Text style={styles.title}>Goals</Text>
    
                {loading && (
                  <ActivityIndicator size="large" color={CYAN} style={{ marginTop: 24 }} />
                )}
    
                {!loading && isEmpty && (
                  <Text style={styles.emptyText}>
                    No tasks in your daily plan yet.{'\n'}
                    Add some from Manage Tasks.
                  </Text>
                )}
    
                {!loading && (
                  <>
                    {renderSection('mandatory')}
                    {renderSection('extra')}
                    {renderSection('challenge')}
                  </>
                )}
              </View>
            </ScrollView>
          )}

          <LevelUpModal
            visible={!!levelUpInfo}
            newLevel={levelUpInfo?.newLevel}
            onDismiss={() => setLevelUpInfo(null)}
          />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 35
  },
  navButton: {
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  navButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  successText: {
    color: CYAN,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  scrollContent: { padding: 20, paddingBottom: 48 },
  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    backgroundColor: 'rgba(8, 20, 28, 0.92)',
    padding: 22,
    shadowColor: CYAN,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 18,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  emptyText: {
    color: 'rgba(242,245,245,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  section: { marginBottom: 22 },
  sectionTitle: {
    color: CYAN,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    textShadowColor: 'rgba(143,243,232,0.6)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  taskName: { color: '#F2F5F5', fontSize: 15, flex: 1, marginRight: 12 },
  taskNameDone: {
    color: 'rgba(242,245,245,0.4)',
    textDecorationLine: 'line-through',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(185,245,238,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: 'rgba(143,243,232,0.15)',
    borderColor: CYAN,
  },
  checkboxPending: { borderColor: CYAN },
  checkmark: { color: CYAN, fontSize: 14, fontWeight: '800' },
});