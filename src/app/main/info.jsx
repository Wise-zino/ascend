import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { UserService } from '@/utils/userService';
import NavMenu from '../nav/menu';

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';

export default function InfoScreen (){
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [navOpen, setNavOpen] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
          const stats = await UserService.getInfoStats();
          setData(stats);
        } catch (e) {
          Alert.alert('Error loading info', String(e.message || e));
        } finally {
          setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
          loadData();
        }, [loadData])
    );

    const rows = data
    ? [
        { label: 'Player', value: data.username },
        { label: 'Total accumulated points', value: data.total_points },
        { label: 'Experience points (XP)', value: data.experience },
        {
          label: 'Consistency score',
          value: `${(data.consistency_score * 100).toFixed(3)}%`,
        },
        { label: 'Daily streak (last 30 days)', value: `${data.streak_days} days` },
        { label: 'Current level', value: `level ${data.level}` },
      ]
    : [];

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
                <Text style={styles.title}>Info</Text>
    
                {loading && (
                  <ActivityIndicator size="large" color={CYAN} style={{ marginTop: 24 }} />
                )}
    
                {!loading &&
                  rows.map((row) => (
                    <View key={row.label} style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{row.label}</Text>
                      <Text style={styles.infoValue}>{row.value}</Text>
                    </View>
                  ))}
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
    marginBottom: 20,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  infoLabel: { color: 'rgba(242,245,245,0.7)', fontSize: 14, flex: 1, marginRight: 12 },
  infoValue: { color: CYAN, fontSize: 15, fontWeight: '800' },
});