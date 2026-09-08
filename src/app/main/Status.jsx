import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { getDB } from '../../../database/client';
import { LevelCalculator } from '@/utils/levelCalculator';
import NavMenu from '../nav/menu';

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Ported from status.html's loadUI + setProgress, which built an SVG
 * ring by hand and mutated stroke-dashoffset directly. react-native-svg
 * gives us the same <Circle> primitive, so the math (circumference,
 * dash offset from a 0-100 progress value) carries over unchanged.
 *
 * Data comes from a local equivalent of
 * UserViewSet.category_points_summary -- computed inline here from
 * user_state + user_category_stats + categories rather than a fetch,
 * since it's all local.
 */

export default function StatusScreen (){
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [navOpen, setNavOpen] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
          const db = await getDB();
          const user = await db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`);
    
          const stats = await db.getAllAsync(
            `SELECT ucs.*, c.name, c.abbrv
             FROM user_category_stats ucs
             JOIN categories c ON c.id = ucs.category_id;`
          );
          const statCategoryIds = new Set(stats.map((s) => s.category_id));
    
          const allCategories = await db.getAllAsync(`SELECT * FROM categories;`);
          const zeroCategories = allCategories.filter((c) => !statCategoryIds.has(c.id));
    
          const categories = [
            ...stats.map((s) => ({
              id: s.category_id,
              name: s.name,
              abbrv: s.abbrv,
              points: s.total_points,
              taskCount: s.mandatory_completed + s.extra_completed + s.challenges_completed,
            })),
            ...zeroCategories.map((c) => ({
              id: c.id,
              name: c.name,
              abbrv: c.abbrv,
              points: 0,
              taskCount: 0,
            })),
          ];
    
          const totalPointsAll = stats.reduce((sum, s) => sum + s.total_points, 0);
    
          const nextLevelExp = LevelCalculator.experienceForLevel(user.level + 1);
          const currentLevelExp = LevelCalculator.experienceForLevel(user.level);
          const progress =
            nextLevelExp === currentLevelExp
              ? 1.0
              : (user.experience - currentLevelExp) / (nextLevelExp - currentLevelExp);
    
          setData({
            totalPoints: totalPointsAll,
            progress,
            level: user.level,
            categories,
          });
        } catch (e) {
          Alert.alert('Error loading status', String(e.message || e));
        } finally {
          setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
          loadData();
        }, [loadData])
    );
    
    const progressPercent = data ? Math.max(0, Math.min(1, data.progress)) : 0;
    const dashOffset = RING_CIRCUMFERENCE - progressPercent * RING_CIRCUMFERENCE;

    return (
        <SafeAreaView style={styles.screen}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
    
          <View style={styles.navBar}>
            <TouchableOpacity style={styles.navButton} onPress={() => setNavOpen((v) => !v)}>
              <Text style={styles.navButtonText}>{navOpen ? 'Close' : 'Menu'}</Text>
            </TouchableOpacity>
          </View>
    
          {navOpen ? (
            <NavMenu onNavigate={() => setNavOpen(false)} />
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.card}>
                <Text style={styles.title}>Status</Text>
    
                {loading && (
                  <ActivityIndicator size="large" color={CYAN} style={{ marginTop: 24 }} />
                )}
    
                {!loading && data && (
                  <>
                    <View style={styles.levelContainer}>
                      <View style={styles.levelBox}>
                        <Text style={styles.levelNumber}>{data.level}</Text>
                        <Text style={styles.levelLabel}>Level</Text>
                      </View>
    
                      <View style={styles.progressWrapper}>
                        <Svg width={64} height={64}>
                          <Circle
                            cx={32}
                            cy={32}
                            r={RING_RADIUS}
                            stroke="rgba(185,245,238,0.15)"
                            strokeWidth={5}
                            fill="none"
                          />
                          <Circle
                            cx={32}
                            cy={32}
                            r={RING_RADIUS}
                            stroke={CYAN}
                            strokeWidth={5}
                            fill="none"
                            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            // rotate so progress starts at 12 o'clock, like
                            // the CSS-transform trick often used with the
                            // web version's SVG ring
                            rotation={-90}
                            originX={32}
                            originY={32}
                          />
                        </Svg>
                        <Text style={styles.progressPercentText}>
                          {Math.round(progressPercent * 100)}%
                        </Text>
                      </View>
                    </View>
    
                    <View style={styles.skillsSection}>
                      {data.categories.length === 0 && (
                        <Text style={styles.emptyText}>
                          No categories yet. Add some from Manage Tasks.
                        </Text>
                      )}
                      <View style={styles.skillsGrid}>
                        {data.categories.map((cat) => (
                          <View key={cat.id} style={styles.skillCard}>
                            <Text style={styles.skillAbbrv}>{cat.abbrv || cat.name.slice(0, 3).toUpperCase()}</Text>
                            <Text style={styles.skillPoints}>{cat.points}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  navBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, marginTop: 35 },
  navButton: {
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  navButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
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
    marginBottom: 22,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  levelBox: {
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginRight: 24,
    shadowColor: CYAN,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  levelNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  levelLabel: { color: 'rgba(242,245,245,0.6)', fontSize: 12, marginTop: 2 },
  progressWrapper: { alignItems: 'center', justifyContent: 'center' },
  progressPercentText: {
    position: 'absolute',
    color: CYAN,
    fontSize: 13,
    fontWeight: '800',
  },
  skillsSection: { width: '100%' },
  emptyText: {
    color: 'rgba(242,245,245,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  skillCard: {
    width: '45%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(185,245,238,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  skillAbbrv: {
    color: CYAN,
    fontSize: 15,
    fontWeight: '800',
    width: 48,
  },
  skillPoints: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
});