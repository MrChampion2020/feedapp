import type React from "react"
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { Ionicons } from "@expo/vector-icons"

interface ImagePickerModalProps {
  visible: boolean
  onClose: () => void
  onImageSelected: (imageUri: string) => void
  title?: string
  allowsEditing?: boolean
  aspect?: [number, number]
  quality?: number
}

const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  visible,
  onClose,
  onImageSelected,
  title = "Select Image",
  allowsEditing = true,
  aspect = [1, 1],
  quality = 0.8,
}) => {
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Camera Permission Required", "Please grant camera permissions to take photos.", [{ text: "OK" }])
      return false
    }
    return true
  }

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Gallery Permission Required", "Please grant gallery permissions to select photos.", [{ text: "OK" }])
      return false
    }
    return true
  }

  const handleCameraPress = async () => {
    try {
      const hasPermission = await requestCameraPermission()
      if (!hasPermission) return

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
      })

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri)
        onClose()
      }
    } catch (error) {
      console.error("Camera error:", error)
      Alert.alert("Error", "Failed to take photo. Please try again.")
    }
  }

  const handleGalleryPress = async () => {
    try {
      const hasPermission = await requestGalleryPermission()
      if (!hasPermission) return

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
        allowsMultipleSelection: false,
      })

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri)
        onClose()
      }
    } catch (error) {
      console.error("Gallery error:", error)
      Alert.alert("Error", "Failed to select image. Please try again.")
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.option} onPress={handleCameraPress}>
              <View style={styles.optionIcon}>
                <Ionicons name="camera" size={32} color="#1DA1F2" />
              </View>
              <Text style={styles.optionText}>Take Photo</Text>
              <Text style={styles.optionSubtext}>Use camera to take a new photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleGalleryPress}>
              <View style={styles.optionIcon}>
                <Ionicons name="images" size={32} color="#1DA1F2" />
              </View>
              <Text style={styles.optionText}>Choose from Gallery</Text>
              <Text style={styles.optionSubtext}>Select from your photo library</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area padding
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E1E8ED",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#14171A",
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    padding: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#F7F9FA",
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(29, 161, 242, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#14171A",
    flex: 1,
  },
  optionSubtext: {
    fontSize: 14,
    color: "#657786",
    marginTop: 2,
    flex: 1,
  },
})

export default ImagePickerModal
