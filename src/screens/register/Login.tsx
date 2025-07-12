"use client"

import type React from "react"
import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Pressable, Platform } from "react-native"
import { Eye, EyeOff } from "lucide-react-native"
import { Formik } from "formik"
import * as Yup from "yup"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../contexts/ThemeContext"
import { useAuth } from "../../contexts/AuthContext"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../types/navigation"
import * as Device from "expo-device"

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">

const LoginSchema = Yup.object().shape({
  identifier: Yup.string().required("Username or email is required"),
  password: Yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
})

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigation = useNavigation<LoginScreenNavigationProp>()
  const { login } = useAuth()
  const { colors } = useTheme()

  const handleLogin = async (values: { identifier: string; password: string }) => {
    setError("")
    setIsLoading(true)

    try {
      const deviceId = Device.deviceName || "unknown-device"

      // First, validate credentials
      await login(values.identifier, values.password, deviceId)

      // Then generate OTP
      const otpResponse = await fetch("https://feeda.onrender.com/api/auth/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.identifier }),
      })

      if (!otpResponse.ok) {
        const errorData = await otpResponse.json()
        throw new Error(errorData.message || "Failed to send OTP")
      }

      const otpData = await otpResponse.json()

      // Navigate to verification screen with the actual email
      navigation.navigate("Verify", { email: otpData.email || values.identifier })
    } catch (err: any) {
      setError(err.message || "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Login</Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>Login to your Feeda account</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Formik initialValues={{ identifier: "", password: "" }} validationSchema={LoginSchema} onSubmit={handleLogin}>
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
            <View style={[styles.form, { backgroundColor: colors.background }]}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Username or Email</Text>
                <TextInput
                  style={[styles.input, touched.identifier && errors.identifier && styles.inputError]}
                  placeholder="Enter username or email"
                  placeholderTextColor={colors.placeholder}
                  value={values.identifier}
                  onChangeText={handleChange("identifier")}
                  onBlur={handleBlur("identifier")}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                {touched.identifier && errors.identifier && <Text style={styles.errorText}>{errors.identifier}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.passwordInput, touched.password && errors.password && styles.inputError]}
                    placeholder="Enter password"
                    placeholderTextColor={colors.placeholder}
                    value={values.password}
                    onChangeText={handleChange("password")}
                    onBlur={handleBlur("password")}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    {showPassword ? <EyeOff size={20} color={colors.icon} /> : <Eye size={20} color={colors.icon} />}
                  </Pressable>
                </View>
                {touched.password && errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  { backgroundColor: colors.theme === "light" ? "#000000" : "#FFFFFF" },
                  isLoading && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                <Text style={[styles.loginButtonText, { color: colors.theme === "light" ? "#FFFFFF" : "#000000" }]}>
                  {isLoading ? "Logging in..." : "Login"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate("SignUp")} disabled={isLoading}>
                <Text style={[styles.resetPassword, { color: colors.text }, isLoading && styles.disabledText]}>
                  Don't have an account? Sign Up
                </Text>
              </TouchableOpacity>

              <View style={styles.termsContainer}>
                <Text style={[styles.termsText, { color: colors.text }]}>
                  By continuing you agree with Feeda{" "}
                  <Text 
                    style={[styles.link, { color: colors.icon }]}
                    onPress={() => navigation.navigate("Terms")}
                  >
                    terms of agreement
                  </Text> and{" "}
                  <Text 
                    style={[styles.link, { color: colors.icon }]}
                    onPress={() => navigation.navigate("Privacy")}
                  >
                    privacy policy
                  </Text>
                </Text>
              </View>
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
    marginTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 7,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  form: {
    borderRadius: 20,
    padding: 10,
    marginTop: 20,
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
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0E0E0",
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 12,
  },
  resetPassword: {
    textAlign: "center",
    marginBottom: 20,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  loginButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  termsContainer: {
    paddingHorizontal: 20,
  },
  termsText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    textDecorationLine: "underline",
  },
  disabledText: {
    opacity: 0.5,
  },
})

export default Login
