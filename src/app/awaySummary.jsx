import { View, Text, Pressable, TouchableOpacity, StyleSheet, ScrollView,
    SafeAreaView, StatusBar, Vibration
 } from "react-native";
 import { router, useLocalSearchParams } from "expo-router";

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';

/**
 * Shown right after _layout.jsx's catchUpMissedDays() call finds
 * anything to report. Expects a `results` param -- a JSON-stringified
 * array of the objects PenaltyRewardService.catchUpMissedDays()
 * returns, e.g.:
 *   { date: '2026-07-12', type: 'penalty', penaltyAmount: -5, ... }
 *   { date: '2026-07-14', type: 'reward', rewardAmount: 10, ... }
 *
 * Routing pattern from _layout.jsx:
 *   router.replace({ pathname: '/awaySummary', params: { results: JSON.stringify(results) } })
 */

export default function AwaySummaryScreen (){
    const { results: resultsParam, homeRoute } = useLocalSearchParams();
    
    let results = [];
    try {
        results = resultsParam ? JSON.parse(resultsParam) : [];
    } catch {
        results = [];
    }

    const penalties = results.filter((r) => r.type === 'penalty');
    const rewards = results.filter((r) => r.type === 'reward');
    const netXp = results.reduce((sum, r) => {
        if (r.type === 'penalty') return sum + (r.penaltyAmount ?? -5);
        if (r.type === 'reward') return sum + (r.rewardAmount ?? 10);
        return sum;
    }, 0);
    
    const handleContinue = () => {
        Vibration.vibrate(15);
        router.replace(homeRoute || '/status');
    };
    
    const formatDate = (dateStr) => {
        const d = new Date(`${dateStr}T00:00:00`);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <SafeAreaView style={styles.screen}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
    
          <View style={styles.backdrop}>
            <View style={styles.watermarkContainer} pointerEvents="none">
              <Text style={styles.watermarkIcon}>⟫⟫</Text>
            </View>
    
            <View style={styles.cardWrapper}>
              <View style={styles.card}>
                <View style={styles.header}>
                  <View style={styles.exclamationCircle}>
                    <Text style={styles.exclamationMark}>!</Text>
                  </View>
                  <Text style={styles.headerText}>WHILE YOU WERE AWAY</Text>
                </View>
    
                <ScrollView style={styles.listArea} contentContainerStyle={{ paddingBottom: 8 }}>
                  {results.length === 0 && (
                    <Text style={styles.emptyText}>Nothing to report.</Text>
                  )}
    
                  {penalties.map((p, i) => (
                    <View key={`penalty-${i}`} style={styles.entryRow}>
                      <View style={[styles.entryDot, styles.entryDotPenalty]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryDate}>{formatDate(p.date)}</Text>
                        <Text style={styles.entryDetail}>
                          Missed mandatory tasks ({p.completedCount ?? 0}/{p.requiredCount ?? 0}
                          {' '}completed)
                        </Text>
                      </View>
                      <Text style={[styles.entryAmount, styles.entryAmountNegative]}>
                        {p.penaltyAmount ?? -5} XP
                      </Text>
                    </View>
                  ))}
    
                  {rewards.map((r, i) => (
                    <View key={`reward-${i}`} style={styles.entryRow}>
                      <View style={[styles.entryDot, styles.entryDotReward]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryDate}>
                          Week of {formatDate(r.weekStart)}
                        </Text>
                        <Text style={styles.entryDetail}>
                          7-day perfect streak completed
                        </Text>
                      </View>
                      <Text style={[styles.entryAmount, styles.entryAmountPositive]}>
                        +{r.rewardAmount ?? 10} XP
                      </Text>
                    </View>
                  ))}
                </ScrollView>
    
                {results.length > 0 && (
                  <View style={styles.netRow}>
                    <Text style={styles.netLabel}>Net change</Text>
                    <Text
                      style={[
                        styles.netValue,
                        netXp >= 0 ? styles.entryAmountPositive : styles.entryAmountNegative,
                      ]}
                    >
                      {netXp >= 0 ? '+' : ''}
                      {netXp} XP
                    </Text>
                  </View>
                )}
    
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinue}
                  activeOpacity={0.6}
                >
                  <Text style={styles.continueText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  watermarkContainer: {
    position: 'absolute',
    top: '14%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkIcon: {
    fontSize: 60,
    color: 'rgba(255,255,255,0.06)',
    fontWeight: '900',
  },
  cardWrapper: { width: '100%' },
  card: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    backgroundColor: 'rgba(8, 20, 28, 0.92)',
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: CYAN,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  exclamationCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  exclamationMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  headerText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  listArea: { width: '100%', maxHeight: 320 },
  emptyText: {
    color: 'rgba(242,245,245,0.5)',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  entryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  entryDotPenalty: { backgroundColor: '#FF5C5C' },
  entryDotReward: { backgroundColor: CYAN },
  entryDate: { color: '#F2F5F5', fontSize: 14, fontWeight: '700' },
  entryDetail: { color: 'rgba(242,245,245,0.55)', fontSize: 12, marginTop: 2 },
  entryAmount: { fontSize: 15, fontWeight: '800' },
  entryAmountNegative: { color: '#FF8C8C' },
  entryAmountPositive: { color: CYAN },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,245,238,0.2)',
    paddingTop: 14,
    marginTop: 6,
    marginBottom: 22,
  },
  netLabel: { color: 'rgba(242,245,245,0.7)', fontSize: 14, fontWeight: '600' },
  netValue: { fontSize: 16, fontWeight: '800' },
  continueButton: {
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 48,
    shadowColor: CYAN,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
});