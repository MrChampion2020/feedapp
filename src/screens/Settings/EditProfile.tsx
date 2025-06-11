"use client"

import React, { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, Modal, ActivityIndicator, Image } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import Icon from "react-native-vector-icons/Ionicons"
import type { RootStackParamList } from "../../types/navigation"

type EditProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "EditProfile">

type PasswordChangeStep = "email" | "otp" | "newPassword" | "none"

export default function EditProfileScreen() {
  const navigation = useNavigation<EditProfileScreenNavigationProp>()
  const [name, setName] = useState("Qamardeen Malik")
  const [phoneNumber, setPhoneNumber] = useState("07033484845")
  const [isLoading, setIsLoading] = useState(false)
  
  // Password change modal states
  const [passwordChangeStep, setPasswordChangeStep] = useState<PasswordChangeStep>("none")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSave = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      navigation.goBack()
    }, 1500)
  }

  const handleChangePassword = () => {
    setPasswordChangeStep("email")
  }

  const handleEmailSubmit = () => {
    // Simulate sending OTP
    setPasswordChangeStep("otp")
  }

  const handleOtpSubmit = () => {
    // Simulate OTP verification
    setPasswordChangeStep("newPassword")
  }

  const handlePasswordSubmit = () => {
    // Simulate password change
    setPasswordChangeStep("none")
  }

  const closePasswordModal = () => {
    setPasswordChangeStep("none")
    setEmail("")
    setOtp("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* Profile Image */}
        <View style={styles.profileImageContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#800080" />
          ) : (
            <View style={styles.gradientBorder}>
              {/* This is a placeholder for the gradient border */}
            </View>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity 
          style={styles.changePasswordButton} 
          onPress={handleChangePassword}
        >
          <Text style={styles.changePasswordText}>Change Password</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.saveButton} 
        onPress={handleSave}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>


      {/* Password Change Modal */}
      <Modal
        visible={passwordChangeStep !== "none"}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={closePasswordModal}>
              <Icon name="close" size={24} color="#000000" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Change Password</Text>
            
            {passwordChangeStep === "email" && (
              <>
                <Text style={styles.modalLabel}>Email Address</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Input Email Address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={handleEmailSubmit}
                >
                  <Text style={styles.modalButtonText}>Proceed</Text>
                </TouchableOpacity>
              </>
            )}

            {passwordChangeStep === "otp" && (
              <>
                <Text style={styles.modalLabel}>Enter OTP</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter OTP code sent to mail"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                />
                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={handleOtpSubmit}
                >
                  <Text style={styles.modalButtonText}>Proceed</Text>
                </TouchableOpacity>
              </>
            )}

            {passwordChangeStep === "newPassword" && (
              <>
                <Text style={styles.modalLabel}>New Password</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                <Text style={styles.modalLabel}>Re-enter Password</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={handlePasswordSubmit}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingTop: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileImageContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
  },
  gradientBorder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#800080", // This is a placeholder for the gradient
    justifyContent: "center",
    alignItems: "center",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  changePasswordButton: {
    alignItems: "center",
    marginTop: 16,
  },
  changePasswordText: {
    fontSize: 16,
    color: "#000000",
    textDecorationLine: "underline",
  },
  saveButton: {
    backgroundColor: "#800080",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 56,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    justifyContent: "space-around",
    alignItems: "center",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  navText: {
    fontSize: 12,
    color: "#666666",
    marginTop: 4,
  },
  activeNavText: {
    color: "#800080",
    fontWeight: "500",
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#800080",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -25,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 24,
    textAlign: "center",
  },
  modalLabel: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: "#800080",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
})