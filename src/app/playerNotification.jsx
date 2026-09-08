import { StyleSheet, Text, View, TouchableOpacity, Pressable, Animated, Vibration, SafeAreaView, StatusBar } from 'react-native';
import { router } from "expo-router";
import { useRef } from 'react';

export default function WelcomeModal () {
  // glitch effects
  const shakeX = useRef(new Animated.Value(0)).current;
  const glitchOpacity = useRef(new Animated.Value(1)).current;
  const glitchOffsetB = useRef(new Animated.Value(0)).current;
  const glitchOffsetR = useRef(new Animated.Value(0)).current;

  const handleAccept = () => {
      Vibration.vibrate(15); // small confirm buzz
      router.replace('/DetailEntry');
  };

  const handleReject = () => {
      // Phone vibration pattern: quick buzz-buzz
      Vibration.vibrate([0, 40, 30, 40]);
  
      // Reset animated values
      shakeX.setValue(0);
      glitchOpacity.setValue(1);
      glitchOffsetR.setValue(0);
      glitchOffsetB.setValue(0);
  
      // Horizontal shake sequence
      const shakeSequence = Animated.sequence([
        Animated.timing(shakeX, { toValue: -10, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 10, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]);
  
      // Glitch flicker sequence (opacity flashes)
      const glitchSequence = Animated.sequence([
        Animated.timing(glitchOpacity, { toValue: 0.3, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOpacity, { toValue: 1, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOpacity, { toValue: 0.5, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOpacity, { toValue: 1, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOpacity, { toValue: 0.2, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
      ]);
  
      // Chromatic-aberration-style offset flicker
      const rgbGlitch = Animated.sequence([
        Animated.timing(glitchOffsetR, { toValue: 4, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOffsetB, { toValue: -4, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOffsetR, { toValue: -3, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOffsetB, { toValue: 3, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOffsetR, { toValue: 0, duration: 30, useNativeDriver: true }),
        Animated.timing(glitchOffsetB, { toValue: 0, duration: 30, useNativeDriver: true }),
      ]);
  
      Animated.parallel([shakeSequence, glitchSequence, rgbGlitch]).start(() => {
        router.push('/'); // or navigation.goBack()
      });
    };

  return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
  
        {/* Backdrop - clicking anywhere outside the card triggers reject/glitch */}
        <Pressable style={styles.backdrop} onPress={handleReject}>
          {/* Watermark icon */}
          <View style={styles.watermarkContainer} pointerEvents="none">
            <Text style={styles.watermarkIcon}>⟫⟫</Text>
          </View>
  
          {/* Stop propagation on the card itself so taps inside don't count as "outside" */}
          <Pressable onPress={() => {}} style={styles.cardWrapper}>
            <Animated.View
              style={[
                styles.card,
                {
                  transform: [{ translateX: shakeX }],
                  opacity: glitchOpacity,
                },
              ]}
            >
              {/* Chromatic aberration glitch layers (red/blue ghost text) */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.glitchLayer,
                  { transform: [{ translateX: glitchOffsetR }] },
                ]}
                pointerEvents="none"
              >
                <View style={[styles.glitchTint, { backgroundColor: 'rgba(255,0,60,0.06)' }]} />
              </Animated.View>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.glitchLayer,
                  { transform: [{ translateX: glitchOffsetB }] },
                ]}
                pointerEvents="none"
              >
                <View style={[styles.glitchTint, { backgroundColor: 'rgba(0,180,255,0.06)' }]} />
              </Animated.View>
  
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.exclamationCircle}>
                  <Text style={styles.exclamationMark}>!</Text>
                </View>
                <Text style={styles.headerText}>NOTIFICATION</Text>
              </View>
  
              {/* Message box */}
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>
                  You have acquired the qualifications to be a{' '}
                  <Text style={styles.playerText}>Player</Text>. Will you accept?
                </Text>
              </View>
  
              {/* Accept button */}
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAccept}
                activeOpacity={0.6}
              >
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Pressable>
      </SafeAreaView>
    );
}

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  watermarkContainer: {
    position: 'absolute',
    top: '18%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkIcon: {
    fontSize: 60,
    color: 'rgba(255,255,255,0.06)',
    fontWeight: '900',
    transform: [{ rotate: '0deg' }],
  },
  cardWrapper: {
    width: '100%',
  },
  card: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    backgroundColor: 'rgba(8, 20, 28, 0.92)',
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: CYAN,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  glitchLayer: {
    borderRadius: 28,
  },
  glitchTint: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  exclamationCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  exclamationMark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  messageBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  messageText: {
    color: '#F2F5F5',
    fontSize: 19,
    lineHeight: 30,
    textAlign: 'center',
    fontWeight: '400',
  },
  playerText: {
    color: CYAN,
    fontStyle: 'italic',
    fontWeight: '600',
    textShadowColor: 'rgba(143,243,232,0.8)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  acceptButton: {
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
  acceptText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
});