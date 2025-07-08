"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, Image } from "react-native"
import * as LocalAuthentication from "expo-local-authentication"
import { useTheme } from "../contexts/ThemeContext"

interface AppLockScreenProps {
  visible: boolean
  onUnlock: () => void
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({ visible, onUnlock }) => {
  const { colors } = useTheme()
  const [attempts, setAttempts] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [authType, setAuthType] = useState<string>("")

  useEffect(() => {
    checkBiometricAvailability()
  }, [])

  useEffect(() => {
    if (visible) {
      // Always try biometric authentication first when screen becomes visible
      setTimeout(() => {
        authenticateWithBiometrics()
      }, 500)
    }
  }, [visible])

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync()

      setBiometricAvailable(hasHardware && isEnrolled)

      // Determine the type of authentication available
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setAuthType("Face ID")
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setAuthType("Fingerprint")
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setAuthType("Iris")
      } else {
        setAuthType("Biometric")
      }
    } catch (error) {
      console.log("Error checking biometric availability:", error)
    }
  }

  const authenticateWithBiometrics = async () => {
    if (!biometricAvailable) return

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Feeda",
        subtitle: "Use your device authentication to unlock the app",
        fallbackLabel: "Use Device Passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false, // Allow device passcode as fallback
      })

      if (result.success) {
        onUnlock()
        setAttempts(0)
      } else if (result.error === "user_cancel") {
        // User cancelled, don't do anything
      } else if (result.error === "user_fallback") {
        // User chose to use device passcode, this should still unlock
        onUnlock()
        setAttempts(0)
      } else {
        // Authentication failed
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        Vibration.vibrate(500)

        if (newAttempts >= 3) {
          setIsLocked(true)
          Alert.alert("Too Many Attempts", "Too many failed authentication attempts. App is locked for 30 seconds.", [
            { text: "OK" },
          ])

          setTimeout(() => {
            setIsLocked(false)
            setAttempts(0)
          }, 30000)
        }
      }
    } catch (error) {
      console.log("Biometric authentication error:", error)
      Alert.alert("Authentication Error", "Unable to authenticate. Please try again.")
    }
  }

  const handleRetryAuthentication = () => {
    if (!isLocked) {
      authenticateWithBiometrics()
    }
  }

  if (!visible) return null

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={require("../assets/images/feeda.png")} style={{ width: 100, height: 100, resizeMode: 'contain' }} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>App Locked</Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          Use {authType || "device authentication"} to unlock Feeda
        </Text>

        {isLocked && (
          <View style={styles.lockedContainer}>
            <Text style={[styles.lockedText, { color: "#FF3B30" }]}>Too many failed attempts</Text>
            <Text style={[styles.lockedSubtext, { color: colors.text }]}>App locked for 30 seconds</Text>
          </View>
        )}

        {/* Authentication Button */}
        <TouchableOpacity
          style={[
            styles.authButton,
            {
              backgroundColor: isLocked ? colors.border : colors.primary,
              opacity: isLocked ? 0.5 : 1,
            },
          ]}
          onPress={handleRetryAuthentication}
          disabled={isLocked}
        >
          <Text style={[styles.authButtonText, { color: isLocked ? colors.text : "white" }]}>
            {isLocked ? "Locked" : `Unlock with ${authType}`}
          </Text>
        </TouchableOpacity>

        {/* Attempts indicator */}
        {attempts > 0 && !isLocked && (
          <Text style={[styles.attemptsText, { color: "#FF3B30" }]}>{3 - attempts} attempts remaining</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    padding: 40,
    width: "100%",
  },
  logoContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
    opacity: 0.8,
  },
  lockedContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  lockedText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  lockedSubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
  authButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 20,
    minWidth: 200,
    alignItems: "center",
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  attemptsText: {
    fontSize: 14,
    textAlign: "center",
  },
})
