import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, Animated,
  Vibration, Modal,
} from 'react-native';
import { useEffect, useRef } from 'react';

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';
const GOLD = '#FFD873';

/**
 * Interrupt modal shown the instant completeTask()/markTaskDoneForToday()
 * returns { leveledUp: true, newLevel }. Meant to be rendered from
 * goals.jsx (or anywhere else that calls those functions) as:
 *
 *   const [levelUpInfo, setLevelUpInfo] = useState(null);
 *   ...
 *   const result = await TaskService.markTaskDoneForToday(taskId);
 *   if (result.leveledUp) setLevelUpInfo({ newLevel: result.newLevel });
 *   ...
 *   <LevelUpModal
 *     visible={!!levelUpInfo}
 *     newLevel={levelUpInfo?.newLevel}
 *     onDismiss={() => setLevelUpInfo(null)}
 *   />
 *
 * Unlike the notification/name-entry modals, tapping anywhere
 * dismisses it (no glitch/reject path) -- a level-up is good news,
 * there's nothing to "reject."
 */
export default function LevelUpModal({ visible, newLevel, onDismiss }) {
    const scale = useRef(new Animated.Value(0.7)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const glowPulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
          Vibration.vibrate([0, 30, 40, 60]); // distinct from reject/confirm patterns
    
          scale.setValue(0.7);
          opacity.setValue(0);
          glowPulse.setValue(0);
    
          Animated.parallel([
            Animated.spring(scale, {
              toValue: 1,
              friction: 5,
              tension: 60,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
    
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
              Animated.timing(glowPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
            ])
          ).start();
        }
    }, [visible]);

    const glowOpacity = glowPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.8],
    });

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
          <Pressable style={styles.backdrop} onPress={onDismiss}>
            <Animated.View
              style={[
                styles.card,
                {
                  transform: [{ scale }],
                  opacity,
                },
              ]}
            >
              <Animated.View
                style={[styles.glow, { opacity: glowOpacity }]}
                pointerEvents="none"
              />
    
              <Text style={styles.eyebrow}>LEVEL UP</Text>
    
              <View style={styles.levelBadge}>
                <Text style={styles.levelNumber}>{newLevel}</Text>
              </View>
    
              <Text style={styles.message}>
                You have ascended to{' '}
                <Text style={styles.levelHighlight}>Level {newLevel}</Text>.
              </Text>
    
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={onDismiss}
                activeOpacity={0.6}
              >
                <Text style={styles.dismissText}>Continue</Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: GOLD,
    backgroundColor: 'rgba(8, 20, 28, 0.95)',
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: GOLD,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 216, 115, 0.06)',
  },
  eyebrow: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 18,
    textShadowColor: 'rgba(255,216,115,0.7)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  levelBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  levelNumber: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  message: {
    color: '#F2F5F5',
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 28,
  },
  levelHighlight: {
    color: GOLD,
    fontWeight: '700',
    fontStyle: 'italic',
    textShadowColor: 'rgba(255,216,115,0.8)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  dismissButton: {
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
  dismissText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
});