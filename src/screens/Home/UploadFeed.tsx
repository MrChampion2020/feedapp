import { useState, useEffect } from "react"
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useAuth, API_URL } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import NetInfo from "@react-native-community/netinfo"
import ImagePickerModal from "../../components/ImagePickerModal"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../types/navigation"

type UploadFeedNavigationProp = NativeStackNavigationProp<RootStackParamList, "UploadFeed">

const UploadFeed = () => {
  const [caption, setCaption] = useState("")
  const [images, setImages] = useState<{ uri: string; type: string; name: string }[]>([])
  const [error, setError] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const navigation = useNavigation<UploadFeedNavigationProp>()
  const { user, token, refreshToken } = useAuth()
  const { colors } = useTheme()

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: "none" },
    })
    return () => {
      navigation.setOptions({
        tabBarStyle: { display: "flex" },
      })
    }
  }, [navigation])

  const handleImageSelected = (imageUri: string) => {
    if (images.length >= 5) {
      setError("Maximum 5 images allowed")
      return
    }

    const fileExtension = imageUri.split(".").pop() || "jpg"
    const fileName = `image_${Date.now()}.${fileExtension}`

    setImages((prev) => [
      ...prev,
      {
        uri: imageUri,
        type: "image/jpeg",
        name: fileName,
      },
    ])
    setError("")
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    // Validation
    if (!caption.trim() && images.length === 0) {
      setError("Please add a caption or at least one image")
      return
    }

    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    // Check network connectivity
    const netInfo = await NetInfo.fetch()
    if (!netInfo.isConnected) {
      setError("No internet connection. Please connect and try again.")
      return
    }

    setIsUploading(true)
    setError("")
    setUploadProgress(0)

    try {
      const formData = new FormData()

      // Add images with the exact field name expected by server
      images.forEach((image, index) => {
        const imageFile = {
          uri: Platform.OS === "ios" ? image.uri.replace("file://", "") : image.uri,
          type: image.type,
          name: image.name,
        }

        console.log(`Adding image ${index + 1}:`, imageFile)
        formData.append("images", imageFile as any)
      })

      // Add caption
      formData.append("caption", caption.trim())

      console.log("Uploading to:", `${API_URL}/posts`)
      console.log("Token present:", !!token)
      console.log("Images count:", images.length)
      console.log("Caption:", caption.trim())

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: {
          Authorization: token, // Send token directly without Bearer prefix
          // Don't set Content-Type for FormData - let browser handle it
        },
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const responseData = await response.json()
      console.log("Server response:", responseData)

      if (response.ok) {
        console.log("Upload successful:", responseData)
        Alert.alert("Success", "Post uploaded successfully!", [
          {
            text: "OK",
            onPress: () => {
              // Clear form
              setCaption("")
              setImages([])
              setUploadProgress(0)
              // Navigate back to home feed
              navigation.navigate("HomeTab" as never)
            },
          },
        ])
      } else {
        // Handle token expiration
        if (responseData.error === "TOKEN_EXPIRED") {
          console.log("Token expired, attempting refresh...")
          try {
            await refreshToken()
            // Retry the upload with new token
            setError("Token refreshed. Please try uploading again.")
          } catch (refreshError) {
            setError("Session expired. Please log in again.")
          }
        } else {
          console.error("Upload failed:", responseData)
          let errorMessage = "Upload failed"

          if (responseData.error === "INVALID_FIELD_NAME") {
            errorMessage = "Upload configuration error. Please try again."
          } else if (responseData.error === "FILE_TOO_LARGE") {
            errorMessage = "File too large. Please select smaller images."
          } else if (responseData.error === "TOO_MANY_FILES") {
            errorMessage = "Too many files. Maximum 5 images allowed."
          } else if (responseData.message) {
            errorMessage = responseData.message
          }

          setError(errorMessage)
        }
      }
    } catch (err: any) {
      console.error("Upload error:", err)

      let errorMessage = "Upload failed"
      if (err.message === "Network request failed") {
        errorMessage = `Network error. Please check your connection and ensure the server is running at ${API_URL}`
      } else if (err.name === "TypeError") {
        errorMessage = "Connection error. Please check your internet connection."
      } else {
        errorMessage = `Upload failed: ${err.message}`
      }

      setError(errorMessage)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
            <Text style={[styles.close, { opacity: isUploading ? 0.5 : 1 }]}>×</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUpload}
            disabled={isUploading || (!caption.trim() && images.length === 0)}
            style={[
              styles.postButtonContainer,
              (isUploading || (!caption.trim() && images.length === 0)) && styles.disabledButton,
            ]}
          >
            <Text
              style={[
                styles.postButton,
                {
                  color: isUploading || (!caption.trim() && images.length === 0) ? "#999" : "white",
                },
              ]}
            >
              {isUploading ? "Posting..." : "Post"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Upload Progress */}
        {isUploading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.text }]}>Uploading... {uploadProgress}%</Text>
          </View>
        )}

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user?.profilePicture || "https://via.placeholder.com/40" }}
            style={styles.profileImage}
          />
          <TextInput
            style={[styles.captionInput, { color: colors.text, borderBottomColor: colors.border }]}
            placeholder="What's happening?"
            placeholderTextColor="#657786"
            value={caption}
            onChangeText={setCaption}
            multiline
            editable={!isUploading}
            maxLength={500}
          />
        </View>

        {/* Character Count */}
        <View style={styles.characterCount}>
          <Text
            style={[
              styles.characterCountText,
              {
                color: caption.length > 450 ? "#e74c3c" : colors.text,
              },
            ]}
          >
            {caption.length}/500
          </Text>
        </View>

        {/* Image Preview */}
        <View style={styles.imagePreviewContainer}>
          {images.map((img, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri: img.uri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)} disabled={isUploading}>
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}

          {images.length < 5 && (
            <TouchableOpacity
              style={[styles.addImageButton, { borderColor: colors.primary }]}
              onPress={() => setShowImagePicker(true)}
              disabled={isUploading}
            >
              <Text style={[styles.addImageText, { color: colors.primary }]}>📷 Add Photo</Text>
              <Text style={[styles.addImageSubtext, { color: colors.text }]}>{5 - images.length} remaining</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")} style={styles.errorClose}>
              <Text style={styles.errorCloseText}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Tips */}
        {!isUploading && (
          <View style={styles.tipsContainer}>
            <Text style={[styles.tipsTitle, { color: colors.text }]}>Tips for better posts:</Text>
            <Text style={[styles.tipsText, { color: colors.text }]}>
              • Use high-quality images{"\n"}• Write engaging captions{"\n"}• Add relevant hashtags{"\n"}• Keep it
              authentic
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onImageSelected={handleImageSelected}
        title="Add Photo to Post"
        allowsEditing={false}
        quality={0.8}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 10,
  },
  close: {
    fontSize: 35,
    color: "blue",
    fontWeight: "bold",
  },
  postButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: "blue",
  },
  postButton: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  disabledButton: {
    backgroundColor: "#ccc",
    color: "darkgrey",
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#e1e8ed",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "blue",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  captionInput: {
    flex: 1,
    fontSize: 18,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E1E8ED",
    minHeight: 100,
    textAlignVertical: "top",
  },
  characterCount: {
    alignItems: "flex-end",
    marginBottom: 20,
    paddingRight: 10,
  },
  characterCountText: {
    fontSize: 12,
  },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  imageWrapper: {
    position: "relative",
    margin: 5,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#1DA1F2",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
    backgroundColor: "rgba(29, 161, 242, 0.05)",
  },
  addImageText: {
    color: "#1DA1F2",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
  },
  addImageSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
  errorContainer: {
    backgroundColor: "#ffeaea",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    flex: 1,
  },
  errorClose: {
    padding: 5,
  },
  errorCloseText: {
    color: "#e74c3c",
    fontSize: 18,
    fontWeight: "bold",
  },
  tipsContainer: {
    backgroundColor: "rgba(29, 161, 242, 0.05)",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
})

export default UploadFeed



// "use client"

// import { useState, useEffect } from "react"
// import {
//   View,
//   Text,
//   Image,
//   StyleSheet,
//   TextInput,
//   SafeAreaView,
//   TouchableOpacity,
//   Platform,
//   Alert,
//   ScrollView,
// } from "react-native"
// import { useNavigation } from "@react-navigation/native"
// import { useAuth, API_URL } from "../../contexts/AuthContext"
// import { useTheme } from "../../contexts/ThemeContext"
// import * as ImagePicker from "expo-image-picker"
// import NetInfo from "@react-native-community/netinfo"
// import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
// import type { RootStackParamList } from "../../types/navigation"

// type UploadFeedNavigationProp = NativeStackNavigationProp<RootStackParamList, "UploadFeed">

// const UploadFeed = () => {
//   const [caption, setCaption] = useState("")
//   const [images, setImages] = useState<{ uri: string; type: string; name: string }[]>([])
//   const [error, setError] = useState("")
//   const [isUploading, setIsUploading] = useState(false)
//   const [uploadProgress, setUploadProgress] = useState(0)
//   const navigation = useNavigation<UploadFeedNavigationProp>()
//   const { user, token, refreshToken } = useAuth()
//   const { colors } = useTheme()

//   useEffect(() => {
//     // Request permissions on component mount
//     const requestPermissions = async () => {
//       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
//       if (status !== "granted") {
//         setError("Permission to access media library is required to upload images.")
//       }
//     }
//     requestPermissions()
//   }, [])

//   useEffect(() => {
//     navigation.setOptions({
//       tabBarStyle: { display: "none" },
//     })
//     return () => {
//       navigation.setOptions({
//         tabBarStyle: { display: "flex" },
//       })
//     }
//   }, [navigation])

//   const selectImage = async () => {
//     if (images.length >= 5) {
//       setError("Maximum 5 images allowed")
//       return
//     }

//     try {
//       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
//       if (status !== "granted") {
//         setError("Permission to access media library denied.")
//         return
//       }

//       // Fixed: Use the correct API for ImagePicker
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images, // This is the correct way
//         quality: 0.8,
//         allowsEditing: false, // Remove image cropping
//         // aspect: [1, 1], // Remove aspect ratio
//         allowsMultipleSelection: false,
//       })

//       if (!result.canceled && result.assets && result.assets[0]) {
//         const asset = result.assets[0]
//         const fileExtension = asset.uri.split(".").pop() || "jpg"
//         const fileName = `image_${Date.now()}.${fileExtension}`

//         setImages((prev) => [
//           ...prev,
//           {
//             uri: asset.uri,
//             type: asset.mimeType || "image/jpeg",
//             name: fileName,
//           },
//         ])
//         setError("")
//       }
//     } catch (err) {
//       console.error("Image selection error:", err)
//       setError("Failed to select image. Please try again.")
//     }
//   }

//   const removeImage = (index: number) => {
//     setImages((prev) => prev.filter((_, i) => i !== index))
//   }

//   const handleUpload = async () => {
//     // Validation
//     if (!caption.trim() && images.length === 0) {
//       setError("Please add a caption or at least one image")
//       return
//     }

//     if (!token) {
//       setError("Authentication required. Please log in again.")
//       return
//     }

//     // Check network connectivity
//     const netInfo = await NetInfo.fetch()
//     if (!netInfo.isConnected) {
//       setError("No internet connection. Please connect and try again.")
//       return
//     }

//     setIsUploading(true)
//     setError("")
//     setUploadProgress(0)

//     try {
//       const formData = new FormData()

//       // Add images with the exact field name expected by server
//       images.forEach((image, index) => {
//         const imageFile = {
//           uri: Platform.OS === "ios" ? image.uri.replace("file://", "") : image.uri,
//           type: image.type,
//           name: image.name,
//         }

//         console.log(`Adding image ${index + 1}:`, imageFile)
//         formData.append("images", imageFile as any)
//       })

//       // Add caption
//       formData.append("caption", caption.trim())

//       console.log("Uploading to:", `${API_URL}/posts`)
//       console.log("Token present:", !!token)
//       console.log("Images count:", images.length)
//       console.log("Caption:", caption.trim())

//       // Simulate upload progress
//       const progressInterval = setInterval(() => {
//         setUploadProgress((prev) => {
//           if (prev >= 90) {
//             clearInterval(progressInterval)
//             return 90
//           }
//           return prev + 10
//         })
//       }, 200)

//       const response = await fetch(`${API_URL}/posts`, {
//         method: "POST",
//         headers: {
//           Authorization: token, // Send token directly without Bearer prefix
//           // Don't set Content-Type for FormData - let browser handle it
//         },
//         body: formData,
//       })

//       clearInterval(progressInterval)
//       setUploadProgress(100)

//       const responseData = await response.json()
//       console.log("Server response:", responseData)

//       if (response.ok) {
//         console.log("Upload successful:", responseData)
//         Alert.alert("Success", "Post uploaded successfully!", [
//           {
//             text: "OK",
//             onPress: () => {
//               // Clear form
//               setCaption("")
//               setImages([])
//               setUploadProgress(0)
//               // Navigate back to home feed
//               navigation.navigate("HomeTab" as never)
//             },
//           },
//         ])
//       } else {
//         // Handle token expiration
//         if (responseData.error === "TOKEN_EXPIRED") {
//           console.log("Token expired, attempting refresh...")
//           try {
//             await refreshToken()
//             // Retry the upload with new token
//             setError("Token refreshed. Please try uploading again.")
//           } catch (refreshError) {
//             setError("Session expired. Please log in again.")
//           }
//         } else {
//           console.error("Upload failed:", responseData)
//           let errorMessage = "Upload failed"

//           if (responseData.error === "INVALID_FIELD_NAME") {
//             errorMessage = "Upload configuration error. Please try again."
//           } else if (responseData.error === "FILE_TOO_LARGE") {
//             errorMessage = "File too large. Please select smaller images."
//           } else if (responseData.error === "TOO_MANY_FILES") {
//             errorMessage = "Too many files. Maximum 5 images allowed."
//           } else if (responseData.message) {
//             errorMessage = responseData.message
//           }

//           setError(errorMessage)
//         }
//       }
//     } catch (err: any) {
//       console.error("Upload error:", err)

//       let errorMessage = "Upload failed"
//       if (err.message === "Network request failed") {
//         errorMessage = `Network error. Please check your connection and ensure the server is running at ${API_URL}`
//       } else if (err.name === "TypeError") {
//         errorMessage = "Connection error. Please check your internet connection."
//       } else {
//         errorMessage = `Upload failed: ${err.message}`
//       }

//       setError(errorMessage)
//     } finally {
//       setIsUploading(false)
//       setUploadProgress(0)
//     }
//   }

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
//       <ScrollView showsVerticalScrollIndicator={false}>
//         {/* Header */}
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
//             <Text style={[styles.close, { opacity: isUploading ? 0.5 : 1 }]}>×</Text>
//           </TouchableOpacity>
//           <TouchableOpacity
//             onPress={handleUpload}
//             disabled={isUploading || (!caption.trim() && images.length === 0)}
//             style={[
//               styles.postButtonContainer,
//               (isUploading || (!caption.trim() && images.length === 0)) && styles.disabledButton,
//             ]}
//           >
//             <Text
//               style={[
//                 styles.postButton,
//                 {
//                   color: isUploading || (!caption.trim() && images.length === 0) ? "#999" : "white",
//                 },
//               ]}
//             >
//               {isUploading ? "Posting..." : "Post"}
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* Upload Progress */}
//         {isUploading && (
//           <View style={styles.progressContainer}>
//             <View style={styles.progressBar}>
//               <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
//             </View>
//             <Text style={[styles.progressText, { color: colors.text }]}>Uploading... {uploadProgress}%</Text>
//           </View>
//         )}

//         {/* Profile Section */}
//         <View style={styles.profileSection}>
//           <Image
//             source={{ uri: user?.profilePicture || "https://via.placeholder.com/40" }}
//             style={styles.profileImage}
//           />
//           <TextInput
//             style={[styles.captionInput, { color: colors.text, borderBottomColor: colors.border }]}
//             placeholder="What's happening?"
//             placeholderTextColor="#657786"
//             value={caption}
//             onChangeText={setCaption}
//             multiline
//             editable={!isUploading}
//             maxLength={500}
//           />
//         </View>

//         {/* Character Count */}
//         <View style={styles.characterCount}>
//           <Text
//             style={[
//               styles.characterCountText,
//               {
//                 color: caption.length > 450 ? "#e74c3c" : colors.text,
//               },
//             ]}
//           >
//             {caption.length}/500
//           </Text>
//         </View>

//         {/* Image Preview */}
//         <View style={styles.imagePreviewContainer}>
//           {images.map((img, index) => (
//             <View key={index} style={styles.imageWrapper}>
//               <Image source={{ uri: img.uri }} style={styles.imagePreview} />
//               <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)} disabled={isUploading}>
//                 <Text style={styles.removeText}>×</Text>
//               </TouchableOpacity>
//             </View>
//           ))}

//           {images.length < 5 && (
//             <TouchableOpacity
//               style={[styles.addImageButton, { borderColor: colors.primary }]}
//               onPress={selectImage}
//               disabled={isUploading}
//             >
//               <Text style={[styles.addImageText, { color: colors.primary }]}>📷 Add Photo</Text>
//               <Text style={[styles.addImageSubtext, { color: colors.text }]}>{5 - images.length} remaining</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         {/* Error Message */}
//         {error ? (
//           <View style={styles.errorContainer}>
//             <Text style={styles.errorText}>{error}</Text>
//             <TouchableOpacity onPress={() => setError("")} style={styles.errorClose}>
//               <Text style={styles.errorCloseText}>×</Text>
//             </TouchableOpacity>
//           </View>
//         ) : null}

//         {/* Tips */}
//         {!isUploading && (
//           <View style={styles.tipsContainer}>
//             <Text style={[styles.tipsTitle, { color: colors.text }]}>Tips for better posts:</Text>
//             <Text style={[styles.tipsText, { color: colors.text }]}>
//               • Use high-quality images{"\n"}• Write engaging captions{"\n"}• Add relevant hashtags{"\n"}• Keep it
//               authentic
//             </Text>
//           </View>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 30,
//   },
//   header: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     marginBottom: 20,
//     paddingTop: 10,
//   },
//   close: {
//     fontSize: 35,
//     color: "blue",
//     fontWeight: "bold",
//   },
//   postButtonContainer: {
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//     borderRadius: 25,
//     backgroundColor: "blue",
//   },
//   postButton: {
//     fontSize: 16,
//     fontWeight: "bold",
//     color: "white",
//   },
//   disabledButton: {
//     backgroundColor: "#ccc",
//     color: "darkgrey",
//   },
//   progressContainer: {
//     marginBottom: 20,
//   },
//   progressBar: {
//     height: 4,
//     backgroundColor: "#e1e8ed",
//     borderRadius: 2,
//     overflow: "hidden",
//   },
//   progressFill: {
//     height: "100%",
//     backgroundColor: "blue",
//     borderRadius: 2,
//   },
//   progressText: {
//     fontSize: 12,
//     textAlign: "center",
//     marginTop: 5,
//   },
//   profileSection: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     marginBottom: 10,
//   },
//   profileImage: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     marginRight: 15,
//   },
//   captionInput: {
//     flex: 1,
//     fontSize: 18,
//     padding: 15,
//     borderBottomWidth: 1,
//     borderBottomColor: "#E1E8ED",
//     minHeight: 100,
//     textAlignVertical: "top",
//   },
//   characterCount: {
//     alignItems: "flex-end",
//     marginBottom: 20,
//     paddingRight: 10,
//   },
//   characterCountText: {
//     fontSize: 12,
//   },
//   imagePreviewContainer: {
//     flexDirection: "row",
//     flexWrap: "wrap",
//     marginBottom: 20,
//   },
//   imageWrapper: {
//     position: "relative",
//     margin: 5,
//   },
//   imagePreview: {
//     width: 120,
//     height: 120,
//     borderRadius: 12,
//   },
//   removeButton: {
//     position: "absolute",
//     top: 8,
//     right: 8,
//     backgroundColor: "rgba(0,0,0,0.8)",
//     borderRadius: 15,
//     width: 30,
//     height: 30,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   removeText: {
//     color: "#fff",
//     fontSize: 18,
//     fontWeight: "bold",
//   },
//   addImageButton: {
//     width: 120,
//     height: 120,
//     borderRadius: 12,
//     borderWidth: 2,
//     borderColor: "#1DA1F2",
//     borderStyle: "dashed",
//     justifyContent: "center",
//     alignItems: "center",
//     margin: 5,
//     backgroundColor: "rgba(29, 161, 242, 0.05)",
//   },
//   addImageText: {
//     color: "#1DA1F2",
//     fontSize: 16,
//     fontWeight: "600",
//     marginBottom: 5,
//   },
//   addImageSubtext: {
//     fontSize: 12,
//     opacity: 0.7,
//   },
//   errorContainer: {
//     backgroundColor: "#ffeaea",
//     borderRadius: 8,
//     padding: 15,
//     marginBottom: 20,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//   },
//   errorText: {
//     color: "#e74c3c",
//     fontSize: 14,
//     flex: 1,
//   },
//   errorClose: {
//     padding: 5,
//   },
//   errorCloseText: {
//     color: "#e74c3c",
//     fontSize: 18,
//     fontWeight: "bold",
//   },
//   tipsContainer: {
//     backgroundColor: "rgba(29, 161, 242, 0.05)",
//     borderRadius: 8,
//     padding: 15,
//     marginBottom: 20,
//   },
//   tipsTitle: {
//     fontSize: 16,
//     fontWeight: "600",
//     marginBottom: 8,
//   },
//   tipsText: {
//     fontSize: 14,
//     lineHeight: 20,
//     opacity: 0.8,
//   },
// })

// export default UploadFeed



// // import { useState, useEffect } from "react"
// // import {
// //   View,
// //   Text,
// //   Image,
// //   StyleSheet,
// //   TextInput,
// //   SafeAreaView,
// //   TouchableOpacity,
// //   Platform,
// //   Alert,
// //   ScrollView,
// // } from "react-native"
// // import { useNavigation } from "@react-navigation/native"
// // import { useAuth, API_URL } from "../../contexts/AuthContext"
// // import { useTheme, colors } from "../../contexts/ThemeContext"
// // import * as ImagePicker from "expo-image-picker"
// // import NetInfo from "@react-native-community/netinfo"
// // import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
// // import type { RootStackParamList } from "../../types/navigation"

// // type UploadFeedNavigationProp = NativeStackNavigationProp<RootStackParamList, "UploadFeed">

// // const UploadFeed = () => {
// //   const [caption, setCaption] = useState("")
// //   const [images, setImages] = useState<{ uri: string; type: string; name: string }[]>([])
// //   const [error, setError] = useState("")
// //   const [isUploading, setIsUploading] = useState(false)
// //   const [uploadProgress, setUploadProgress] = useState(0)
// //   const navigation = useNavigation<UploadFeedNavigationProp>()
// //   const { user, token, refreshToken } = useAuth()
// //   const { colors } = useTheme()

// //   useEffect(() => {
// //     // Request permissions on component mount
// //     const requestPermissions = async () => {
// //       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
// //       if (status !== "granted") {
// //         setError("Permission to access media library is required to upload images.")
// //       }
// //     }
// //     requestPermissions()
// //   }, [])

// //   useEffect(() => {
// //     navigation.setOptions({
// //       tabBarStyle: { display: "none" },
// //     })
// //     return () => {
// //       navigation.setOptions({
// //         tabBarStyle: { display: "flex" },
// //       })
// //     }
// //   }, [navigation])

// //   const selectImage = async () => {
// //     if (images.length >= 5) {
// //       setError("Maximum 5 images allowed")
// //       return
// //     }

// //     try {
// //       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
// //       if (status !== "granted") {
// //         setError("Permission to access media library denied.")
// //         return
// //       }

// //       // Fixed: Use the correct API for ImagePicker
// //       const result = await ImagePicker.launchImageLibraryAsync({
// //         mediaTypes: ImagePicker.MediaTypeOptions.Images, // This is the correct way
// //         quality: 0.8,
// //         allowsEditing: true,
// //         aspect: [1, 1], // Square aspect ratio
// //         allowsMultipleSelection: false,
// //       })

// //       if (!result.canceled && result.assets && result.assets[0]) {
// //         const asset = result.assets[0]
// //         const fileExtension = asset.uri.split(".").pop() || "jpg"
// //         const fileName = `image_${Date.now()}.${fileExtension}`

// //         setImages((prev) => [
// //           ...prev,
// //           {
// //             uri: asset.uri,
// //             type: asset.mimeType || "image/jpeg",
// //             name: fileName,
// //           },
// //         ])
// //         setError("")
// //       }
// //     } catch (err) {
// //       console.error("Image selection error:", err)
// //       setError("Failed to select image. Please try again.")
// //     }
// //   }

// //   const removeImage = (index: number) => {
// //     setImages((prev) => prev.filter((_, i) => i !== index))
// //   }

// //   const handleUpload = async () => {
// //     // Validation
// //     if (!caption.trim() && images.length === 0) {
// //       setError("Please add a caption or at least one image")
// //       return
// //     }

// //     if (!token) {
// //       setError("Authentication required. Please log in again.")
// //       return
// //     }

// //     // Check network connectivity
// //     const netInfo = await NetInfo.fetch()
// //     if (!netInfo.isConnected) {
// //       setError("No internet connection. Please connect and try again.")
// //       return
// //     }

// //     setIsUploading(true)
// //     setError("")
// //     setUploadProgress(0)

// //     try {
// //       const formData = new FormData()

// //       // Add images with the exact field name expected by server
// //       images.forEach((image, index) => {
// //         const imageFile = {
// //           uri: Platform.OS === "ios" ? image.uri.replace("file://", "") : image.uri,
// //           type: image.type,
// //           name: image.name,
// //         }

// //         console.log(`Adding image ${index + 1}:`, imageFile)
// //         formData.append("images", imageFile as any)
// //       })

// //       // Add caption
// //       formData.append("caption", caption.trim())

// //       console.log("Uploading to:", `${API_URL}/posts`)
// //       console.log("Token present:", !!token)
// //       console.log("Images count:", images.length)
// //       console.log("Caption:", caption.trim())

// //       // Simulate upload progress
// //       const progressInterval = setInterval(() => {
// //         setUploadProgress((prev) => {
// //           if (prev >= 90) {
// //             clearInterval(progressInterval)
// //             return 90
// //           }
// //           return prev + 10
// //         })
// //       }, 200)

// //       const response = await fetch(`${API_URL}/posts`, {
// //         method: "POST",
// //         headers: {
// //           Authorization: token, // Send token directly without Bearer prefix
// //           // Don't set Content-Type for FormData - let browser handle it
// //         },
// //         body: formData,
// //       })

// //       clearInterval(progressInterval)
// //       setUploadProgress(100)

// //       const responseData = await response.json()
// //       console.log("Server response:", responseData)

// //       if (response.ok) {
// //         console.log("Upload successful:", responseData)
// //         Alert.alert("Success", "Post uploaded successfully!", [
// //           {
// //             text: "OK",
// //             onPress: () => {
// //               // Clear form
// //               setCaption("")
// //               setImages([])
// //               setUploadProgress(0)
// //               // Navigate back to home feed
// //               navigation.navigate("HomeTab" as never)
// //             },
// //           },
// //         ])
// //       } else {
// //         // Handle token expiration
// //         if (responseData.error === "TOKEN_EXPIRED") {
// //           console.log("Token expired, attempting refresh...")
// //           try {
// //             await refreshToken()
// //             // Retry the upload with new token
// //             setError("Token refreshed. Please try uploading again.")
// //           } catch (refreshError) {
// //             setError("Session expired. Please log in again.")
// //           }
// //         } else {
// //           console.error("Upload failed:", responseData)
// //           let errorMessage = "Upload failed"

// //           if (responseData.error === "INVALID_FIELD_NAME") {
// //             errorMessage = "Upload configuration error. Please try again."
// //           } else if (responseData.error === "FILE_TOO_LARGE") {
// //             errorMessage = "File too large. Please select smaller images."
// //           } else if (responseData.error === "TOO_MANY_FILES") {
// //             errorMessage = "Too many files. Maximum 5 images allowed."
// //           } else if (responseData.message) {
// //             errorMessage = responseData.message
// //           }

// //           setError(errorMessage)
// //         }
// //       }
// //     } catch (err: any) {
// //       console.error("Upload error:", err)

// //       let errorMessage = "Upload failed"
// //       if (err.message === "Network request failed") {
// //         errorMessage = `Network error. Please check your connection and ensure the server is running at ${API_URL}`
// //       } else if (err.name === "TypeError") {
// //         errorMessage = "Connection error. Please check your internet connection."
// //       } else {
// //         errorMessage = `Upload failed: ${err.message}`
// //       }

// //       setError(errorMessage)
// //     } finally {
// //       setIsUploading(false)
// //       setUploadProgress(0)
// //     }
// //   }

// //   return (
// //     <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
// //       <ScrollView showsVerticalScrollIndicator={false}>
// //         {/* Header */}
// //         <View style={styles.header}>
// //           <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
// //             <Text style={[styles.close, { opacity: isUploading ? 0.5 : 1 }]}>×</Text>
// //           </TouchableOpacity>
// //           <TouchableOpacity
// //             onPress={handleUpload}
// //             disabled={isUploading || (!caption.trim() && images.length === 0)}
// //             style={[
// //               styles.postButtonContainer,
// //               (isUploading || (!caption.trim() && images.length === 0)) && styles.disabledButton,
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.postButton,
// //                 {
// //                   color: isUploading || (!caption.trim() && images.length === 0) ? "#999" : "white",
// //                 },
// //               ]}
// //             >
// //               {isUploading ? "Posting..." : "Post"}
// //             </Text>
// //           </TouchableOpacity>
// //         </View>

// //         {/* Upload Progress */}
// //         {isUploading && (
// //           <View style={styles.progressContainer}>
// //             <View style={styles.progressBar}>
// //               <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
// //             </View>
// //             <Text style={[styles.progressText, { color: colors.text }]}>Uploading... {uploadProgress}%</Text>
// //           </View>
// //         )}

// //         {/* Profile Section */}
// //         <View style={styles.profileSection}>
// //           <Image
// //             source={{ uri: user?.profilePicture || "https://via.placeholder.com/40" }}
// //             style={styles.profileImage}
// //           />
// //           <TextInput
// //             style={[styles.captionInput, { color: colors.text, borderBottomColor: colors.border }]}
// //             placeholder="What's happening?"
// //             placeholderTextColor="#657786"
// //             value={caption}
// //             onChangeText={setCaption}
// //             multiline
// //             editable={!isUploading}
// //             maxLength={500}
// //           />
// //         </View>

// //         {/* Character Count */}
// //         <View style={styles.characterCount}>
// //           <Text
// //             style={[
// //               styles.characterCountText,
// //               {
// //                 color: caption.length > 450 ? "#e74c3c" : colors.text,
// //               },
// //             ]}
// //           >
// //             {caption.length}/500
// //           </Text>
// //         </View>

// //         {/* Image Preview */}
// //         <View style={styles.imagePreviewContainer}>
// //           {images.map((img, index) => (
// //             <View key={index} style={styles.imageWrapper}>
// //               <Image source={{ uri: img.uri }} style={styles.imagePreview} />
// //               <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)} disabled={isUploading}>
// //                 <Text style={styles.removeText}>×</Text>
// //               </TouchableOpacity>
// //             </View>
// //           ))}

// //           {images.length < 5 && (
// //             <TouchableOpacity
// //               style={[styles.addImageButton, { borderColor: colors.primary }]}
// //               onPress={selectImage}
// //               disabled={isUploading}
// //             >
// //               <Text style={[styles.addImageText, { color: colors.primary }]}>📷 Add Photo</Text>
// //               <Text style={[styles.addImageSubtext, { color: colors.text }]}>{5 - images.length} remaining</Text>
// //             </TouchableOpacity>
// //           )}
// //         </View>

// //         {/* Error Message */}
// //         {error ? (
// //           <View style={styles.errorContainer}>
// //             <Text style={styles.errorText}>{error}</Text>
// //             <TouchableOpacity onPress={() => setError("")} style={styles.errorClose}>
// //               <Text style={styles.errorCloseText}>×</Text>
// //             </TouchableOpacity>
// //           </View>
// //         ) : null}

// //         {/* Tips */}
// //         {!isUploading && (
// //           <View style={styles.tipsContainer}>
// //             <Text style={[styles.tipsTitle, { color: colors.text }]}>Tips for better posts:</Text>
// //             <Text style={[styles.tipsText, { color: colors.text }]}>
// //               • Use high-quality images{"\n"}• Write engaging captions{"\n"}• Add relevant hashtags{"\n"}• Keep it
// //               authentic
// //             </Text>
// //           </View>
// //         )}
// //       </ScrollView>
// //     </SafeAreaView>
// //   )
// // }

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //     padding: 30,
// //   },
// //   header: {
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //     marginBottom: 20,
// //     paddingTop: 10,
// //   },
// //   close: {
// //     fontSize: 35,
// //     color: "blue",
// //     fontWeight: "bold",
// //   },
// //   postButtonContainer: {
// //     paddingHorizontal: 20,
// //     paddingVertical: 10,
// //     borderRadius: 25,
// //     backgroundColor: "blue",
// //   },
// //   postButton: {
// //     fontSize: 16,
// //     fontWeight: "bold",
// //     color: "white",
// //   },
// //   disabledButton: {
// //     backgroundColor: "#ccc",
// //     color: "darkgrey"
// //   },
// //   progressContainer: {
// //     marginBottom: 20,
// //   },
// //   progressBar: {
// //     height: 4,
// //     backgroundColor: "#e1e8ed",
// //     borderRadius: 2,
// //     overflow: "hidden",
// //   },
// //   progressFill: {
// //     height: "100%",
// //     backgroundColor: "blue",
// //     borderRadius: 2,
// //   },
// //   progressText: {
// //     fontSize: 12,
// //     textAlign: "center",
// //     marginTop: 5,
// //   },
// //   profileSection: {
// //     flexDirection: "row",
// //     alignItems: "flex-start",
// //     marginBottom: 10,
// //   },
// //   profileImage: {
// //     width: 50,
// //     height: 50,
// //     borderRadius: 25,
// //     marginRight: 15,
// //   },
// //   captionInput: {
// //     flex: 1,
// //     fontSize: 18,
// //     padding: 15,
// //     borderBottomWidth: 1,
// //     borderBottomColor: "#E1E8ED",
// //     minHeight: 100,
// //     textAlignVertical: "top",
// //   },
// //   characterCount: {
// //     alignItems: "flex-end",
// //     marginBottom: 20,
// //     paddingRight: 10,
// //   },
// //   characterCountText: {
// //     fontSize: 12,
// //   },
// //   imagePreviewContainer: {
// //     flexDirection: "row",
// //     flexWrap: "wrap",
// //     marginBottom: 20,
// //   },
// //   imageWrapper: {
// //     position: "relative",
// //     margin: 5,
// //   },
// //   imagePreview: {
// //     width: 120,
// //     height: 120,
// //     borderRadius: 12,
// //   },
// //   removeButton: {
// //     position: "absolute",
// //     top: 8,
// //     right: 8,
// //     backgroundColor: "rgba(0,0,0,0.8)",
// //     borderRadius: 15,
// //     width: 30,
// //     height: 30,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   removeText: {
// //     color: "#fff",
// //     fontSize: 18,
// //     fontWeight: "bold",
// //   },
// //   addImageButton: {
// //     width: 120,
// //     height: 120,
// //     borderRadius: 12,
// //     borderWidth: 2,
// //     borderColor: "#1DA1F2",
// //     borderStyle: "dashed",
// //     justifyContent: "center",
// //     alignItems: "center",
// //     margin: 5,
// //     backgroundColor: "rgba(29, 161, 242, 0.05)",
// //   },
// //   addImageText: {
// //     color: "#1DA1F2",
// //     fontSize: 16,
// //     fontWeight: "600",
// //     marginBottom: 5,
// //   },
// //   addImageSubtext: {
// //     fontSize: 12,
// //     opacity: 0.7,
// //   },
// //   errorContainer: {
// //     backgroundColor: "#ffeaea",
// //     borderRadius: 8,
// //     padding: 15,
// //     marginBottom: 20,
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //   },
// //   errorText: {
// //     color: "#e74c3c",
// //     fontSize: 14,
// //     flex: 1,
// //   },
// //   errorClose: {
// //     padding: 5,
// //   },
// //   errorCloseText: {
// //     color: "#e74c3c",
// //     fontSize: 18,
// //     fontWeight: "bold",
// //   },
// //   tipsContainer: {
// //     backgroundColor: "rgba(29, 161, 242, 0.05)",
// //     borderRadius: 8,
// //     padding: 15,
// //     marginBottom: 20,
// //   },
// //   tipsTitle: {
// //     fontSize: 16,
// //     fontWeight: "600",
// //     marginBottom: 8,
// //   },
// //   tipsText: {
// //     fontSize: 14,
// //     lineHeight: 20,
// //     opacity: 0.8,
// //   },
// // })

// // export default UploadFeed


