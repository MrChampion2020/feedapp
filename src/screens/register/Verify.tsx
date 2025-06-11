"use client"

import type React from "react"
import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Keyboard, Platform } from "react-native"
import { Formik } from "formik"
import * as Yup from "yup"
import { useNavigation, useRoute } from "@react-navigation/native"
import { useTheme } from "../../contexts/ThemeContext"
import { useAuth } from "../../contexts/AuthContext"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../types/navigation"

type VerifyScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Verify">

const VerifySchema = Yup.object().shape({
  otp: Yup.string().required("OTP is required").length(6, "OTP must be 6 digits"),
})

const Verify: React.FC = () => {
  const navigation = useNavigation<VerifyScreenNavigationProp>()
  const { verifyOtp } = useAuth()
  const { colors } = useTheme()
  const route = useRoute()
  const { email } = route.params as { email: string }
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const handleVerify = async (values: { otp: string }) => {
    Keyboard.dismiss()
    setError("")
    try {
      setIsLoading(true)
      await verifyOtp(email, values.otp)
      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      })
    } catch (err: any) {
      setError(err.message || "Verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    try {
      setIsResending(true)
      setError("")

      const response = await fetch("https://feeda.onrender.com/api/auth/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to resend OTP")
      }

      // Show success message
      setError("OTP resent successfully!")
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Verify Your Account</Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>Enter the OTP sent to {email}</Text>

        {error && (
          <Text style={[styles.errorText, error === "OTP resent successfully!" ? styles.successText : null]}>
            {error}
          </Text>
        )}

        <Formik initialValues={{ otp: "" }} validationSchema={VerifySchema} onSubmit={handleVerify}>
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid }) => (
            <View style={[styles.form, { backgroundColor: colors.background }]}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>OTP</Text>
                <TextInput
                  style={[styles.input, touched.otp && errors.otp && styles.inputError]}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={colors.text}
                  value={values.otp}
                  onChangeText={handleChange("otp")}
                  onBlur={handleBlur("otp")}
                  keyboardType="numeric"
                  maxLength={6}
                  editable={!isLoading}
                />
                {touched.otp && errors.otp && <Text style={styles.errorText}>{errors.otp}</Text>}
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.theme === "light" ? "#000000" : "#FFFFFF" },
                  (!isValid || isLoading) && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={!isValid || isLoading}
              >
                <Text style={[styles.submitButtonText, { color: colors.theme === "light" ? "#FFFFFF" : "#000000" }]}>
                  {isLoading ? "Verifying..." : "Verify"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={isResending || isLoading}
                style={styles.resendButton}
              >
                <Text
                  style={[styles.resendText, { color: colors.text }, (isResending || isLoading) && styles.disabledText]}
                >
                  {isResending ? "Resending..." : "Didn't receive the code? Resend OTP"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()} disabled={isLoading}>
                <Text style={[styles.backText, { color: colors.text }, isLoading && styles.disabledText]}>
                  Back to Login
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Formik>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: Platform.OS === "ios" ? 60 : 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 20,
  },
  form: {
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: "red",
  },
  errorText: {
    color: "red",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
    marginBottom: 10,
  },
  successText: {
    color: "green",
  },
  submitButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  resendButton: {
    marginBottom: 15,
  },
  resendText: {
    textAlign: "center",
    textDecorationLine: "underline",
  },
  backText: {
    textAlign: "center",
    textDecorationLine: "underline",
  },
  disabledText: {
    opacity: 0.5,
  },
})

// Make sure to export as default
export default Verify

