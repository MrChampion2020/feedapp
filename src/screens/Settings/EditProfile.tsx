
import React, { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, Modal, ActivityIndicator, Image, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useAuth } from "../../contexts/AuthContext"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import Icon from "react-native-vector-icons/Ionicons"
import type { RootStackParamList } from "../../types/navigation"
import { useTheme } from "../../contexts/ThemeContext"
import * as ImagePicker from 'expo-image-picker';
import ImagePickerModal from '../../components/ImagePickerModal';

type EditProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "EditProfile">

type PasswordChangeStep = "email" | "otp" | "newPassword" | "none"

export default function EditProfileScreen() {
  const navigation = useNavigation<EditProfileScreenNavigationProp>()
  const { user, token, api } = useAuth()
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [bio, setBio] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [profilePicture, setProfilePicture] = useState("")
  
  // Password change modal states
  const [passwordChangeStep, setPasswordChangeStep] = useState<PasswordChangeStep>("none")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const { colors: themeColors } = useTheme()
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return
      setIsLoading(true)
      setError("")
      try {
        const response = await api.get(`/users/${user.id}`)
        if (response.status === 200) {
          setUsername(response.data.user.username || "")
          setFullName(response.data.user.fullName || "")
          setBio(response.data.user.bio || "")
          setProfilePicture(response.data.user.profilePicture || "")
        }
      } catch (err) {
        setError("Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [user?.id])

  const handleSave = async () => {
    if (!user?.id) return
    setIsLoading(true)
    setError("")
    try {
      const response = await api.put("/users/update", {
        userId: user.id,
        username,
        fullName,
        bio,
      })
      if (response.status === 200) {
        navigation.goBack()
      }
    } catch (err) {
      setError("Failed to update profile")
    } finally {
      setIsLoading(false)
    }
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

  // Open the bottom modal for profile image change
  const handleProfileImagePress = () => {
    setShowImagePicker(true);
  };

  // Handle image selection from modal
  const handleImageSelected = async (uri: string) => {
    setIsLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("profileImage", {
        uri,
        type: "image/jpeg",
        name: "profile.jpg",
      } as any);
      const response = await api.put("/users/update-profile-image", formData);
      if (response.status === 200) {
        setProfilePicture(response.data.profilePicture);
      }
    } catch (err) {
      setError("Failed to upload image");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}> 
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomWidth: 1, borderBottomColor: themeColors.border }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: themeColors.card }]}> 
          <Icon name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Edit Profile</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Profile Image with Edit Overlay */}
      <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 24 }}>
        <View style={{ position: 'relative' }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={themeColors.primary} />
          ) : profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: themeColors.primary, backgroundColor: themeColors.card }}
            />
          ) : (
            <View style={[styles.gradientBorder, { backgroundColor: themeColors.card, borderColor: themeColors.primary, width: 110, height: 110, borderRadius: 55 }]} />
          )}
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: themeColors.primary, borderRadius: 16, padding: 6, borderWidth: 2, borderColor: themeColors.background }}
            onPress={handleProfileImagePress}
            activeOpacity={0.8}
          >
            <Icon name="camera" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.content, { backgroundColor: themeColors.background, marginTop: 0 }]}> 
        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.text }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Username"
            placeholderTextColor={themeColors.placeholder}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.text }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full Name"
            placeholderTextColor={themeColors.placeholder}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.text }]}>Bio</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            placeholder="Bio"
            placeholderTextColor={themeColors.placeholder}
          />
        </View>
        {error ? <Text style={{ color: themeColors.error, marginBottom: 8 }}>{error}</Text> : null}

        <TouchableOpacity 
          style={[styles.changePasswordButton, { backgroundColor: themeColors.primary, borderRadius: 8, marginTop: 24, padding: 12 }]} 
          onPress={handleChangePassword}
        >
          <Text style={[styles.changePasswordText, { color: themeColors.background, fontWeight: 'bold' }]}>Change Password</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, { backgroundColor: themeColors.primary }]} 
        onPress={handleSave}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={themeColors.background} />
        ) : (
          <Text style={[styles.saveButtonText, { color: themeColors.background }]}>Save</Text>
        )}
      </TouchableOpacity>


      {/* Change Password Modal - Backend integrated */}
      <Modal
        visible={passwordChangeStep !== "none"}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.card }]}> 
            <TouchableOpacity style={styles.closeButton} onPress={closePasswordModal}>
              <Icon name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Change Password</Text>
            {passwordChangeStep === "email" && (
              <>
                <Text style={[styles.modalLabel, { color: themeColors.text }]}>Email Address</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                  placeholder="Input Email Address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholderTextColor={themeColors.placeholder}
                />
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: themeColors.primary }]} 
                  onPress={async () => {
                    setIsLoading(true)
                    setError("")
                    try {
                      const response = await api.post("/auth/generate-otp", { email })
                      if (response.status === 200) {
                        setPasswordChangeStep("otp")
                      }
                    } catch (err) {
                      setError("Failed to send OTP")
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: themeColors.text }]}>Proceed</Text>
                </TouchableOpacity>
              </>
            )}
            {passwordChangeStep === "otp" && (
              <>
                <Text style={[styles.modalLabel, { color: themeColors.text }]}>Enter OTP</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                  placeholder="Enter OTP code sent to mail"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  placeholderTextColor={themeColors.placeholder}
                />
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: themeColors.primary }]} 
                  onPress={async () => {
                    setIsLoading(true)
                    setError("")
                    try {
                      const response = await api.post("/auth/verify-otp", { email, otp })
                      if (response.status === 200) {
                        setPasswordChangeStep("newPassword")
                      }
                    } catch (err) {
                      setError("Invalid OTP")
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: themeColors.text }]}>Proceed</Text>
                </TouchableOpacity>
              </>
            )}
            {passwordChangeStep === "newPassword" && (
              <>
                <Text style={[styles.modalLabel, { color: themeColors.text }]}>New Password</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholderTextColor={themeColors.placeholder}
                />
                <Text style={[styles.modalLabel, { color: themeColors.text }]}>Re-enter Password</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholderTextColor={themeColors.placeholder}
                />
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: themeColors.primary }]} 
                  onPress={async () => {
                    setIsLoading(true)
                    setError("")
                    try {
                      if (!newPassword || newPassword.length < 6) {
                        setError("Password must be at least 6 characters")
                        setIsLoading(false)
                        return
                      }
                      if (newPassword !== confirmPassword) {
                        setError("Passwords do not match")
                        setIsLoading(false)
                        return
                      }
                      const response = await api.post("/auth/reset-password", { email, otp, newPassword });
                      if (response.status === 200) {
                        Alert.alert("Success", "Password has been reset.");
                        setPasswordChangeStep("none");
                      } else {
                        setError(response.data?.message || "Failed to reset password");
                      }
                    } catch (err) {
                      setError("Failed to reset password");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: themeColors.text }]}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onImageSelected={handleImageSelected}
        title="Change Profile Picture"
        allowsEditing={true}
        aspect={[1, 1]}
        quality={0.8}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingTop: 2,
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