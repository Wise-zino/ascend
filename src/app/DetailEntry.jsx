import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, Animated, Vibration, SafeAreaView, StatusBar,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import React, { useState, useRef} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router';
import { UserService } from '@/utils/userService';

const NAME_STORAGE_KEY = 'username';

export default function DetailEntry(){
    const [name, setName] = useState('');
    const [errorFlash, setErrorFlash] = useState(false);

    // Animated values driving the "glitch" effect on the modal
    const shakeX = useRef(new Animated.Value(0)).current;
    const glitchOpacity = useRef(new Animated.Value(1)).current;
    const glitchOffsetR = useRef(new Animated.Value(0)).current;
    const glitchOffsetB = useRef(new Animated.Value(0)).current;

    const runGlitch = (onDone) => {
        shakeX.setValue(0);
        glitchOpacity.setValue(1);
        glitchOffsetR.setValue(0);
        glitchOffsetB.setValue(0);
    
        const shakeSequence = Animated.sequence([
          Animated.timing(shakeX, { toValue: -10, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 10, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -8, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 8, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
        ]);
    
        const glitchSequence = Animated.sequence([
          Animated.timing(glitchOpacity, { toValue: 0.3, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOpacity, { toValue: 1, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOpacity, { toValue: 0.5, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOpacity, { toValue: 1, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOpacity, { toValue: 0.2, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
        ]);
    
        const rgbGlitch = Animated.sequence([
          Animated.timing(glitchOffsetR, { toValue: 4, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOffsetB, { toValue: -4, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOffsetR, { toValue: -3, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOffsetB, { toValue: 3, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOffsetR, { toValue: 0, duration: 30, useNativeDriver: true }),
          Animated.timing(glitchOffsetB, { toValue: 0, duration: 30, useNativeDriver: true }),
        ]);
    
        Animated.parallel([shakeSequence, glitchSequence, rgbGlitch]).start(() => {
          if (onDone) onDone();
        });
    };

    const handleReject = () => {
        Keyboard.dismiss();
        Vibration.vibrate([0, 40, 30, 40]);
        runGlitch(() => {
            router.back()
        });
    };

    const handleConfirm = async () => {
        const trimmed = name.trim();
    
        if (!trimmed) {
          // Empty name -> glitch in place as an error state, don't navigate
          Vibration.vibrate([0, 30, 20, 30]);
          setErrorFlash(true);
          runGlitch(() => setErrorFlash(false));
          return;
        }
    
        try {
          // AsyncStorage stays the fast "has this device onboarded"
          // flag that index.jsx / routing can check without touching
          // SQLite. user_state.username in SQLite is the source of
          // truth the rest of the app (Info screen, stats) reads from.
          await AsyncStorage.setItem(NAME_STORAGE_KEY, trimmed);
          await UserService.setUsername(trimmed);

        } catch (e) {
            console.warn('Failed to save name', e);
            // If SQLite write fails, don't silently proceed as if it
            // worked -- surface it the same way an empty name does.
            Vibration.vibrate([0, 30, 20, 30]);
            setErrorFlash(true);
            runGlitch(() => setErrorFlash(false));
            return;
        }
    
        Vibration.vibrate(15);
        Keyboard.dismiss();
        router.replace('/main/Status'); // next screen in your flow
    };

    return (
        <SafeAreaView style={styles.screen}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
    
          <Pressable style={styles.backdrop} onPress={handleReject}>
            <View style={styles.watermarkContainer} pointerEvents="none">
              <Text style={styles.watermarkIcon}>⟫⟫</Text>
            </View>
    
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.cardWrapper}
            >
              <Pressable onPress={() => {}}>
                <Animated.View
                  style={[
                    styles.card,
                    {
                      transform: [{ translateX: shakeX }],
                      opacity: glitchOpacity,
                      borderColor: errorFlash ? '#FF5C5C' : CYAN_BORDER,
                    },
                  ]}
                >
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
                      State your name, <Text style={styles.playerText}>Player</Text>.
                    </Text>
    
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter your name"
                      placeholderTextColor="rgba(242,245,245,0.35)"
                      selectionColor={CYAN}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={30}
                      returnKeyType="done"
                      onSubmitEditing={handleConfirm}
                    />
                  </View>
    
                  {/* Confirm button */}
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={handleConfirm}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.acceptText}>Confirm</Text>
                  </TouchableOpacity>
                </Animated.View>
              </Pressable>
            </KeyboardAvoidingView>
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
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        paddingVertical: 24,
        paddingHorizontal: 16,
        marginBottom: 28,
        alignItems: 'center',
      },
      messageText: {
        color: '#F2F5F5',
        fontSize: 19,
        lineHeight: 30,
        textAlign: 'center',
        fontWeight: '400',
        marginBottom: 18,
      },
      playerText: {
        color: CYAN,
        fontStyle: 'italic',
        fontWeight: '600',
        textShadowColor: 'rgba(143,243,232,0.8)',
        textShadowRadius: 8,
        textShadowOffset: { width: 0, height: 0 },
      },
      input: {
        width: '100%',
        borderWidth: 1.5,
        borderColor: 'rgba(185,245,238,0.5)',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        color: '#FFFFFF',
        fontSize: 17,
        textAlign: 'center',
        backgroundColor: 'rgba(143,243,232,0.05)',
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
