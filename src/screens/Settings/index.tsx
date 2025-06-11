"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Modal,
  ScrollView,
  Platform,
  Switch,
  Animated,
  Easing,
  TextInput,
  Alert,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import Icon from "react-native-vector-icons/Ionicons"
import type { SettingsStackParamList } from "../../types/navigation"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as LocalAuthentication from "expo-local-authentication"

type SettingsScreenNavigationProp = NativeStackNavigationProp<SettingsStackParamList, "SettingsMain">

interface UserProfile {
  id: string
  username: string
  fullName: string
  email: string
  profilePicture?: string
  bio?: string
  followers: any[]
  following: any[]
  posts: any[]
  isVerified: boolean
  createdAt: string
}

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>()
  const { user: currentUser, logout, token, updateUser } = useAuth()
  const { theme, toggleTheme, colors: themeColors } = useTheme()

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({})
  const [loading, setLoading] = useState(true)

  // App lock settings
  const [appLockEnabled, setAppLockEnabled] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [authType, setAuthType] = useState<string>("")

  const fadeAnim = useState(new Animated.Value(0))[0]
  const scaleAnim = useState(new Animated.Value(0.95))[0]
  const modalFadeAnim = useState(new Animated.Value(0))[0]
  const modalScaleAnim = useState(new Animated.Value(0.95))[0]

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  useEffect(() => {
    if (currentUser?.id) {
      fetchProfile()
    }
    loadAppLockSettings()
    checkBiometricAvailability()
  }, [currentUser?.id, token])

  const loadAppLockSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem("appLockEnabled")
      setAppLockEnabled(enabled === "true")
    } catch (error) {
      console.log("Error loading app lock settings:", error)
    }
  }

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
        setAuthType("Device Authentication")
      }
    } catch (error) {
      console.log("Error checking biometric availability:", error)
    }
  }

  const toggleAppLock = async (enabled: boolean) => {
    if (enabled) {
      // Test device authentication before enabling
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Enable App Lock",
          subtitle: "Authenticate to enable app lock feature",
          fallbackLabel: "Use Device Passcode",
          cancelLabel: "Cancel",
          disableDeviceFallback: false,
        })

        if (result.success) {
          await AsyncStorage.setItem("appLockEnabled", "true")
          setAppLockEnabled(true)
          Alert.alert(
            "App Lock Enabled",
            `App lock has been enabled with ${authType}. The app will be locked when minimized.`,
          )
        } else {
          Alert.alert("Authentication Failed", "App lock was not enabled.")
        }
      } catch (error) {
        Alert.alert("Error", "Failed to enable app lock. Please try again.")
      }
    } else {
      // Disable app lock
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Disable App Lock",
          subtitle: "Authenticate to disable app lock feature",
          fallbackLabel: "Use Device Passcode",
          cancelLabel: "Cancel",
          disableDeviceFallback: false,
        })

        if (result.success) {
          await AsyncStorage.removeItem("appLockEnabled")
          setAppLockEnabled(false)
          Alert.alert("App Lock Disabled", "App lock has been disabled")
        }
      } catch (error) {
        Alert.alert("Error", "Failed to disable app lock. Please try again.")
      }
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await api.get(`/users/${currentUser?.id}`)
      if (response.status === 200) {
        setProfile(response.data.user)
        setEditedProfile(response.data.user)
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      Alert.alert("Error", "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      const response = await api.put("/users/update", {
        userId: currentUser?.id,
        fullName: editedProfile.fullName,
        bio: editedProfile.bio,
      })

      if (response.status === 200) {
        setProfile((prev) => (prev ? { ...prev, ...editedProfile } : null))
        updateUser({
          fullName: editedProfile.fullName || "",
          bio: editedProfile.bio || "",
        })
        closeEditModal()
        Alert.alert("Success", "Profile updated successfully!")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", "Failed to update profile")
    }
  }

  const handleSectionPress = (section: string) => {
    setActiveSection(activeSection === section ? null : section)
  }

  const handleLogout = () => {
    setShowLogoutModal(true)
  }

  const confirmLogout = () => {
    setShowLogoutModal(false)
    logout()
  }

  const cancelLogout = () => {
    setShowLogoutModal(false)
  }

  const openEditModal = () => {
    setShowEditModal(true)
    Animated.parallel([
      Animated.timing(modalFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }

  const closeEditModal = () => {
    Animated.parallel([
      Animated.timing(modalFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowEditModal(false))
  }

  const handleSupportPress = () => {
    navigation.navigate("Support")
  }

  const handleFAQsPress = () => {
    navigation.navigate("FAQs")
  }

  const handleNotificationsPress = () => {
    navigation.navigate("Notifications")
  }

  const SettingCard = ({
    icon,
    title,
    onPress,
    isExpandable = false,
    isExpanded = false,
    children,
  }: {
    icon: string
    title: string
    onPress: () => void
    isExpandable?: boolean
    isExpanded?: boolean
    children?: React.ReactNode
  }) => (
    <TouchableOpacity
      style={[styles.settingCard, { backgroundColor: themeColors.card }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: themeColors.primary + "20" }]}>
          <Icon name={icon} size={20} color={themeColors.primary} />
        </View>
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>{title}</Text>
        {isExpandable && (
          <Icon
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={themeColors.text}
            style={styles.expandIcon}
          />
        )}
      </View>
      {isExpanded && children && (
        <Animated.View
          style={[
            styles.cardContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: themeColors.text }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: themeColors.text }]}>Profile not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: themeColors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header with Faint Background Image */}
        <View style={styles.profileHeader}>
          <Image
            source={
              profile?.profilePicture ? { uri: profile.profilePicture } : require("../../assets/images/feeda.png")
            }
            style={styles.backgroundImage}
          />
          <View style={styles.overlay} />
          <View style={styles.profileContent}>
            <View style={styles.profileLeftSection}>
              <Image
                source={
                  profile?.profilePicture ? { uri: profile.profilePicture } : require("../../assets/images/feeda.png")
                }
                style={styles.profileAvatar}
              />
              <TouchableOpacity
                style={[styles.editProfileButton, { backgroundColor: themeColors.background }]}
                onPress={openEditModal}
              >
                <Text style={[styles.editProfileText, { color: themeColors.text }]}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileRightSection}>
              <Text style={[styles.profileName, { color: "#FFFFFF" }]}>{profile?.fullName || "User"}</Text>
              <Text style={[styles.usernameText, { color: "#FFFFFF" }]}>@{profile?.username}</Text>
              <View style={[styles.contactCard, { backgroundColor: themeColors.card }]}>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactLabel, { color: "#FFFFFF" }]}>Email</Text>
                  <Text style={[styles.contactValue, { color: "#FFFFFF" }]}>{profile?.email || "Not provided"}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.settingsContainer}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Preferences</Text>

          <SettingCard
            icon="notifications-outline"
            title="Notifications"
            onPress={handleNotificationsPress}
            isExpandable={true}
            isExpanded={activeSection === "notifications"}
          >
            <View style={styles.notificationSettings}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Push Notifications</Text>
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ false: themeColors.border, true: themeColors.primary }}
                thumbColor={themeColors.background}
              />
            </View>
          </SettingCard>

          <SettingCard icon="document-text-outline" title="FAQs" onPress={handleFAQsPress} />

          <SettingCard
            icon="moon-outline"
            title="Dark Mode"
            onPress={() => handleSectionPress("theme")}
            isExpandable={true}
            isExpanded={activeSection === "theme"}
          >
            <View style={styles.themeSettings}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Dark Theme</Text>
              <Switch
                value={theme === "dark"}
                onValueChange={toggleTheme}
                trackColor={{ false: themeColors.border, true: themeColors.primary }}
                thumbColor={themeColors.background}
              />
            </View>
          </SettingCard>

          {/* App Lock Setting */}
          <SettingCard
            icon="lock-closed-outline"
            title="App Lock"
            onPress={() => handleSectionPress("applock")}
            isExpandable={true}
            isExpanded={activeSection === "applock"}
          >
            <View style={styles.appLockSettings}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Enable App Lock</Text>
              <Switch
                value={appLockEnabled}
                onValueChange={toggleAppLock}
                trackColor={{ false: themeColors.border, true: themeColors.primary }}
                thumbColor={themeColors.background}
              />
            </View>
            {appLockEnabled && (
              <View style={styles.appLockInfo}>
                <Text style={[styles.settingDescription, { color: themeColors.text }]}>
                  App will be locked when minimized and require {authType} to unlock.
                </Text>
              </View>
            )}
            {!biometricAvailable && (
              <View style={styles.appLockInfo}>
                <Text style={[styles.settingDescription, { color: "#FF3B30" }]}>
                  Device authentication not available. Please set up fingerprint, face ID, or device passcode in your
                  device settings.
                </Text>
              </View>
            )}
          </SettingCard>

          <SettingCard icon="headset-outline" title="Support" onPress={handleSupportPress} />
        </View>

        {/* Account Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: themeColors.card }]} onPress={handleLogout}>
            <Text style={[styles.logoutButtonText, { color: themeColors.text }]}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAccountButton}>
            <Text style={[styles.deleteAccountText, { color: themeColors.error }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} transparent={true} animationType="none">
        <View style={[styles.modalOverlay, { backgroundColor: themeColors.background + "80" }]}>
          <Animated.View
            style={[
              styles.editModalContainer,
              {
                backgroundColor: themeColors.card,
                opacity: modalFadeAnim,
                transform: [{ scale: modalScaleAnim }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Profile</Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: themeColors.background }]}
                onPress={closeEditModal}
              >
                <Icon name="close" size={20} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.editModalContent}>
              <TextInput
                style={[styles.editInput, { color: themeColors.text, borderColor: themeColors.border }]}
                value={editedProfile.fullName || ""}
                onChangeText={(text) => setEditedProfile((prev) => ({ ...prev, fullName: text }))}
                placeholder="Full Name"
                placeholderTextColor={themeColors.placeholder}
              />
              <TextInput
                style={[
                  styles.editInput,
                  styles.bioInput,
                  { color: themeColors.text, borderColor: themeColors.border },
                ]}
                value={editedProfile.bio || ""}
                onChangeText={(text) => setEditedProfile((prev) => ({ ...prev, bio: text }))}
                placeholder="Bio"
                placeholderTextColor={themeColors.placeholder}
                multiline
                numberOfLines={3}
              />
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: themeColors.border }]}
                onPress={closeEditModal}
              >
                <Text style={[styles.cancelButtonText, { color: themeColors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: themeColors.primary }]}
                onPress={handleSaveProfile}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent={true} animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: themeColors.background + "80" }]}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                backgroundColor: themeColors.card,
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.warningIconContainer}>
              <Icon name="alert-circle" size={32} color={themeColors.error} />
            </View>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: themeColors.border }]}
                onPress={cancelLogout}
              >
                <Text style={[styles.cancelButtonText, { color: themeColors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.proceedButton, { backgroundColor: themeColors.primary }]}
                onPress={confirmLogout}
              >
                <Text style={styles.proceedButtonText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 90,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
  },
  profileHeader: {
    paddingTop: Platform.OS === "ios" ? 0 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    position: "relative",
    height: 220,
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    opacity: 0.2,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  profileContent: {
    flexDirection: "row",
    zIndex: 1,
  },
  profileLeftSection: {
    alignItems: "center",
    marginRight: 16,
  },
  profileRightSection: {
    flex: 1,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "white",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  usernameText: {
    fontSize: 14,
    marginBottom: 12,
  },
  editProfileButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: "500",
  },
  contactCard: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  settingsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginVertical: 16,
  },
  settingCard: {
    width: "100%",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  expandIcon: {
    marginLeft: "auto",
  },
  cardContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  notificationSettings: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  themeSettings: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appLockSettings: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appLockInfo: {
    marginTop: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 16,
  },
  actionsContainer: {
    paddingHorizontal: 16,
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  deleteAccountButton: {
    alignItems: "center",
    marginBottom: 40,
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  editModalContainer: {
    width: "90%",
    borderRadius: 16,
    padding: 24,
    maxHeight: "80%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  editModalContent: {
    flex: 1,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  bioInput: {
    height: 80,
    textAlignVertical: "top",
  },
  warningIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {
    marginLeft: 8,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  proceedButton: {
    marginLeft: 8,
  },
  proceedButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
})

export default SettingsScreen

