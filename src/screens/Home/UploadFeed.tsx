import { useState, useEffect, useRef } from "react";
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
  FlatList,
  Animated,
  Pressable,
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth, API_URL } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import NetInfo from "@react-native-community/netinfo";
import * as ImagePicker from "expo-image-picker";
import { AVPlaybackStatus, Video } from "expo-av";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import Icon from "react-native-vector-icons/MaterialIcons";

type UploadFeedNavigationProp = NativeStackNavigationProp<RootStackParamList, "UploadFeed">;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
const MAX_GALLERY_PREVIEW = 20;

const UploadFeed = () => {
  const { colors, theme } = useTheme();
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<{ uri: string; type: string; name: string; progress?: number }[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<{ uri: string; type: string; name: string }[]>([]);
  const [selectedGalleryIndices, setSelectedGalleryIndices] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const navigation = useNavigation<UploadFeedNavigationProp>();
  const { user, token, api } = useAuth();
  const videoRef = useRef<Video>(null);
  const postButtonScale = useRef(new Animated.Value(1)).current;
  const galleryIconScale = useRef(new Animated.Value(1)).current;
  const cameraIconScale = useRef(new Animated.Value(1)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const mediaOpacity = useRef(new Animated.Value(0)).current;

  // Animations
  const animatePressIn = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 0.92,
      speed: 20,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
  };

  const animatePressOut = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 20,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
  };

  // Fade-in animation for screen
  useEffect(() => {
    Animated.timing(containerOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Fade-in animation for media previews
  useEffect(() => {
    Animated.timing(mediaOpacity, {
      toValue: 1,
      duration: 400,
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, [media]);

  // Request permissions and load gallery media on mount
  useEffect(() => {
    console.log("ImagePicker Exports:", Object.keys(ImagePicker)); // Debug log to inspect exports
    console.log("ImagePicker.MediaTypeOptions:", ImagePicker.MediaTypeOptions); // Debug log for MediaTypeOptions
    console.log("ImagePicker.MediaType:", ImagePicker.MediaType); // Debug log for MediaType
    const requestPermissionsAndLoadGallery = async () => {
      const [libraryStatus, cameraStatus] = await Promise.all([
        ImagePicker.requestMediaLibraryPermissionsAsync(),
        ImagePicker.requestCameraPermissionsAsync(),
      ]);
      if (libraryStatus.status !== "granted") {
        Alert.alert("Permission Denied", "Permission to access media library is required.");
        setError("Permission to access media library is required.");
        return;
      }
      if (cameraStatus.status !== "granted") {
        Alert.alert("Permission Denied", "Permission to access camera is required.");
        setError("Permission to access camera is required.");
        return;
      }
      await loadGalleryMedia();
    };
    requestPermissionsAndLoadGallery();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: "none" },
    });
    return () => {
      navigation.setOptions({
        tabBarStyle: { display: "flex" },
      });
    };
  }, [navigation]);

  const loadGalleryMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_GALLERY_PREVIEW,
      });
      if (!result.canceled && result.assets) {
        const mediaItems = result.assets.map((asset) => {
          const mediaType = asset.mimeType || (asset.uri.match(/\.mp4$/i) ? "video/mp4" : "image/jpeg");
          const fileExtension = asset.uri.split(".").pop() || (mediaType.startsWith("video") ? "mp4" : "jpg");
          const fileName = `${mediaType.startsWith("video") ? "video" : "image"}_${Date.now()}.${fileExtension}`;
          return { uri: asset.uri, type: mediaType, name: fileName };
        });
        setGalleryMedia(mediaItems);
      }
    } catch (err) {
      console.error("Gallery load error:", err);
      setError("Failed to load gallery media.");
    }
  };

  const estimateVideoSize = async (uri: string): Promise<{ size: number; duration: number }> => {
    try {
      const video = await new Promise<AVPlaybackStatus>((resolve) => {
        videoRef.current?.loadAsync({ uri }, {}, false).then(() => {
          videoRef.current?.getStatusAsync().then(resolve);
        });
      });
      if (!(video as any).isLoaded) {
        throw new Error("Video failed to load");
      }
      const duration = (video as any).durationMillis / 1000; // Duration in seconds
      const bitrate = 2 * 1024 * 1024; // Assume 2Mbps average bitrate
      const size = (bitrate * duration) / 8; // Size in bytes
      return { size, duration };
    } catch (err) {
      console.error("Video size estimation error:", err);
      return { size: 0, duration: 0 };
    }
  };

  const handleMediaSelected = async (selectedMedia: { uri: string; type: string; name: string }[]) => {
    const newMedia = [...media];
    for (const item of selectedMedia) {
      if (newMedia.length >= 5) {
        setError("Maximum 5 media files allowed.");
        return;
      }
      if (item.type.startsWith("video")) {
        const { size } = await estimateVideoSize(item.uri);
        if (size > MAX_FILE_SIZE) {
          setError("Video too large. Maximum size is 100MB.");
          continue;
        }
      }
      newMedia.push({ ...item, progress: 0 });
    }
    setMedia(newMedia);
    setSelectedGalleryIndices(newMedia.map((m) => galleryMedia.findIndex((gm) => gm.uri === m.uri)).filter((i) => i !== -1));
    setError("");
  };

  const capturePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.mimeType || "image/jpeg";
        const fileExtension = asset.uri.split(".").pop() || "jpg";
        const fileName = `image_${Date.now()}.${fileExtension}`;
        await handleMediaSelected([{ uri: asset.uri, type: mediaType, name: fileName }]);
      }
    } catch (err) {
      console.error("Photo capture error:", err);
      setError("Failed to capture photo.");
    } finally {
      setCameraModalVisible(false);
    }
  };

  const captureVideo = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        allowsEditing: true,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.mimeType || "video/mp4";
        const fileExtension = asset.uri.split(".").pop() || "mp4";
        const fileName = `video_${Date.now()}.${fileExtension}`;
        await handleMediaSelected([{ uri: asset.uri, type: mediaType, name: fileName }]);
      }
    } catch (err) {
      console.error("Video capture error:", err);
      setError("Failed to capture video.");
    } finally {
      setCameraModalVisible(false);
    }
  };

  const openGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 5 - media.length,
      });
      if (!result.canceled && result.assets) {
        const selected = result.assets.map((asset) => {
          const mediaType = asset.mimeType || (asset.uri.match(/\.mp4$/i) ? "video/mp4" : "image/jpeg");
          const fileExtension = asset.uri.split(".").pop() || (mediaType.startsWith("video") ? "mp4" : "jpg");
          const fileName = `${mediaType.startsWith("video") ? "video" : "image"}_${Date.now()}.${fileExtension}`;
          return { uri: asset.uri, type: mediaType, name: fileName };
        });
        await handleMediaSelected(selected);
      }
    } catch (err) {
      console.error("Gallery selection error:", err);
      setError("Failed to select from gallery.");
    }
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
    setSelectedGalleryIndices((prev) => prev.filter((i) => i !== index));
  };

  const validateInputs = () => {
    if (!caption.trim() && media.length === 0) {
      setError("Please add a caption or at least one media file.");
      return false;
    }
    return true;
  };

  const checkServerHealth = async () => {
    try {
      await api.get("/health");
      return true;
    } catch (err) {
      console.error("Server health check failed:", err);
      return false;
    }
  };

  const retryUpload = async (formData: FormData, retries: number = 3, delay: number = 1000): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await api.post("/posts", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percentCompleted);
            }
          },
        });
        return response;
      } catch (err: any) {
        console.warn(`Retry attempt ${attempt} failed:`, {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          request: err.request,
        });
        if (attempt === retries) throw err;
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  };

  const handleUpload = async () => {
    if (!validateInputs()) return;

    if (!token) {
      setError("Authentication required. Please log in.");
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setError("No internet connection. Please try again.");
      return;
    }

    const serverAlive = await checkServerHealth();
    if (!serverAlive) {
      setError(`Cannot reach server at ${API_URL}. Please check your connection or server status.`);
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("caption", caption.trim());

      media.forEach((file, index) => {
        const fileData = {
          uri: Platform.OS === "ios" ? file.uri.replace("file://", "") : file.uri,
          type: file.type,
          name: file.name,
        };
        formData.append("media", fileData as any);
        setMedia((prev) => prev.map((m, i) => i === index ? { ...m, progress: 0 } : m));
      });

      const response = await retryUpload(formData);

      setUploadProgress(100);
      Alert.alert("Success", "Post uploaded successfully!", [
        {
          text: "OK",
          onPress: () => {
            setCaption("");
            setMedia([]);
            setSelectedGalleryIndices([]);
            setUploadProgress(0);
            navigation.navigate("HomeTab" as never);
          },
        },
      ]);
    } catch (err: any) {
      let errorMessage = "Upload failed.";
      if (err.response) {
        const { error, message } = err.response.data;
        if (error === "INVALID_FIELD_NAME") errorMessage = "Upload configuration error.";
        else if (error === "FILE_TOO_LARGE") errorMessage = "File too large. Maximum size is 100MB.";
        else if (error === "TOO_MANY_FILES") errorMessage = "Too many files. Maximum 5 files allowed.";
        else if (error === "NO_CONTENT") errorMessage = "No content provided.";
        else if (message) errorMessage = message;
      } else if (err.message === "Network Error") {
        errorMessage = `Network error. Ensure the server is running at ${API_URL} and accessible.`;
      } else {
        errorMessage = `Upload failed: ${err.message}`;
      }
      console.error("API Error: POST /posts -", err.message);
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const renderGalleryItem = ({ item, index }: { item: { uri: string; type: string; name: string } | 'gallery'; index: number }) => {
    if (item === 'gallery') {
      return (
        <TouchableOpacity
          style={styles.galleryItem}
          onPress={openGallery}
          disabled={isUploading}
          onPressIn={() => animatePressIn(galleryIconScale)}
          onPressOut={() => animatePressOut(galleryIconScale)}
        >
          <Animated.View style={[styles.galleryIconWrapper, { transform: [{ scale: galleryIconScale }] }]}>
            <Icon name="photo-library" size={40} color={colors.primary} />
          </Animated.View>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[
          styles.galleryItem,
          selectedGalleryIndices.includes(index) && styles.selectedGalleryItem,
        ]}
        onPress={() => {
          if (selectedGalleryIndices.includes(index)) {
            removeMedia(media.findIndex((m) => m.uri === item.uri));
          } else {
            handleMediaSelected([item]);
          }
        }}
        disabled={isUploading}
      >
        <Image source={{ uri: item.uri }} style={styles.galleryPreview} />
        {item.type.startsWith("video") && (
          <View style={styles.playIconOverlay}>
            <Icon name="play-circle-outline" size={24} color="white" />
          </View>
        )}
        {selectedGalleryIndices.includes(index) && (
          <View style={styles.progressOverlay}>
            <Text style={styles.progressText}>
              {media.find((m) => m.uri === item.uri)?.progress || 0}%
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity, backgroundColor: colors.background }]}>
      <Video ref={videoRef} style={{ display: "none" }} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
              <Text style={[styles.close, { opacity: isUploading ? 0.5 : 1, color: colors.text }]}>×</Text>
            </TouchableOpacity>
            <Animated.View style={{ transform: [{ scale: postButtonScale }] }}>
              <Pressable
                onPress={handleUpload}
                disabled={isUploading || (!caption.trim() && media.length === 0)}
                onPressIn={() => animatePressIn(postButtonScale)}
                onPressOut={() => animatePressOut(postButtonScale)}
                style={[
                  styles.postButtonContainer,
                  { backgroundColor: isUploading || (!caption.trim() && media.length === 0) ? colors.secondary : colors.primary },
                ]}
              >
                <Text style={[styles.postButton, { color: colors.background }]}>
                  {isUploading ? "Posting..." : "Post"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>

          {/* Upload Progress */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.text }]}>Uploading... {uploadProgress}%</Text>
            </View>
          )}

          {/* Profile and Caption */}
          <View style={styles.profileSection}>
            <Image
              source={{ uri: user?.profilePicture || "https://via.placeholder.com/40" }}
              style={styles.profileImage}
            />
            <TextInput
              style={[styles.captionInput, { color: colors.text, borderBottomColor: colors.border }]}
              placeholder="What's happening?"
              placeholderTextColor={colors.placeholder}
              value={caption}
              onChangeText={setCaption}
              multiline
              editable={!isUploading}
              maxLength={500}
              autoFocus
            />
          </View>

          {/* Character Count */}
          <View style={styles.characterCount}>
            <Text
              style={[
                styles.characterCountText,
                { color: caption.length > 450 ? colors.error : colors.secondary },
              ]}
            >
              {caption.length}/500
            </Text>
          </View>

          {/* Media Preview */}
          <Animated.View style={[styles.mediaPreviewContainer, { opacity: mediaOpacity }]}>
            {media.map((item, index) => (
              <View key={index} style={styles.mediaWrapper}>
                <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
                {item.type.startsWith("video") && (
                  <View style={styles.playIconOverlay}>
                    <Icon name="play-circle-outline" size={40} color="white" />
                  </View>
                )}
                <TouchableOpacity style={styles.removeButton} onPress={() => removeMedia(index)} disabled={isUploading}>
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Animated.View>

          {/* Gallery Preview */}
          <View style={styles.galleryPreviewContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Media</Text>
            <FlatList
              data={galleryMedia.length === MAX_GALLERY_PREVIEW ? [...galleryMedia, 'gallery'] : galleryMedia}
              renderItem={renderGalleryItem}
              keyExtractor={(item, index) => item === 'gallery' ? 'gallery' : index.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.galleryList}
            />
          </View>

          {/* Toolbar */}
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={openGallery}
              disabled={isUploading || media.length >= 5}
              onPressIn={() => animatePressIn(galleryIconScale)}
              onPressOut={() => animatePressOut(galleryIconScale)}
            >
              <Animated.View style={{ transform: [{ scale: galleryIconScale }] }}>
                <Icon name="photo" size={28} color={media.length >= 5 ? colors.secondary : colors.primary} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => setCameraModalVisible(true)}
              disabled={isUploading || media.length >= 5}
              onPressIn={() => animatePressIn(cameraIconScale)}
              onPressOut={() => animatePressOut(cameraIconScale)}
            >
              <Animated.View style={{ transform: [{ scale: cameraIconScale }] }}>
                <Icon name="camera" size={28} color={media.length >= 5 ? colors.secondary : colors.primary} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Camera Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={cameraModalVisible}
            onRequestClose={() => setCameraModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <Animated.View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.background, transform: [{ scale: cameraModalVisible ? 1 : 0.8 }] },
                ]}
              >
                <TouchableOpacity
                  style={[styles.modalButton, { borderColor: colors.border }]}
                  onPress={capturePhoto}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { borderColor: colors.border }]}
                  onPress={captureVideo}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>Record Video</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setCameraModalVisible(false)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Modal>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError("")} style={styles.errorClose}>
                <Text style={styles.errorCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  close: {
    fontSize: 32,
    fontWeight: "700",
    padding: 12,
  },
  postButtonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  postButton: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "-apple-system",
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E1E8ED",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontFamily: "-apple-system",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  captionInput: {
    flex: 1,
    fontSize: 20,
    paddingVertical: 16,
    paddingHorizontal: 0,
    minHeight: 100,
    textAlignVertical: "top",
    fontFamily: "-apple-system",
  },
  characterCount: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  characterCountText: {
    fontSize: 13,
    fontFamily: "-apple-system",
  },
  mediaPreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  mediaWrapper: {
    position: "relative",
    margin: 6,
    borderRadius: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mediaPreview: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  playIconOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -20 }, { translateY: -20 }],
    opacity: 0.85,
  },
  removeButton: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  galleryPreviewContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    fontFamily: "-apple-system",
  },
  galleryList: {
    maxHeight: 96,
  },
  galleryItem: {
    width: 88,
    height: 88,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E1E8ED",
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedGalleryItem: {
    borderColor: "#1DA1F2",
    borderWidth: 2.5,
  },
  galleryPreview: {
    width: "100%",
    height: "100%",
  },
  galleryIconWrapper: {
    width: 88,
    height: 88,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F8FA",
    borderRadius: 12,
  },
  progressOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "-apple-system",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 24,
    paddingVertical: 12,
  },
  toolbarButton: {
    padding: 12,
    marginRight: 24,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalButton: {
    padding: 20,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "-apple-system",
  },
  modalCancelButton: {
    padding: 20,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "-apple-system",
  },
  errorContainer: {
    backgroundColor: "#FFF1F1",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  errorText: {
    color: "#FF4C4C",
    fontSize: 15,
    flex: 1,
    fontFamily: "-apple-system",
  },
  errorClose: {
    padding: 8,
  },
  errorCloseText: {
    color: "#FF4C4C",
    fontSize: 18,
    fontWeight: "700",
  },
});

export default UploadFeed;





// import { useState, useEffect } from "react";
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
//   FlatList,
// } from "react-native";
// import { useNavigation } from "@react-navigation/native";
// import { useAuth, API_URL } from "../../contexts/AuthContext";
// import { useTheme } from "../../contexts/ThemeContext";
// import NetInfo from "@react-native-community/netinfo";
// import * as ImagePicker from "expo-image-picker";
// import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
// import type { RootStackParamList } from "../../types/navigation";
// import Icon from "react-native-vector-icons/MaterialIcons";

// type UploadFeedNavigationProp = NativeStackNavigationProp<RootStackParamList, "UploadFeed">;

// const UploadFeed = () => {
//   const { colors, theme } = useTheme() || {
//     colors: { primary: "#0A84FF", background: "#FFFFFF", text: "#000000", border: "#D3D3D3", error: "#e74c3c", placeholder: "#999999" },
//     theme: "light",
//   };
//   const [caption, setCaption] = useState("");
//   const [hashtags, setHashtags] = useState("");
//   const [mentions, setMentions] = useState("");
//   const [media, setMedia] = useState<{ uri: string; type: string; name: string; progress?: number }[]>([]);
//   const [galleryMedia, setGalleryMedia] = useState<{ uri: string; type: string; name: string }[]>([]);
//   const [selectedGalleryIndices, setSelectedGalleryIndices] = useState<number[]>([]);
//   const [error, setError] = useState("");
//   const [isUploading, setIsUploading] = useState(false);
//   const [uploadProgress, setUploadProgress] = useState(0);
//   const navigation = useNavigation<UploadFeedNavigationProp>();
//   const { user, token, api } = useAuth();

//   // Request permissions and load gallery media on mount
//   useEffect(() => {
//     const requestPermissionsAndLoadGallery = async () => {
//       const [libraryStatus, cameraStatus] = await Promise.all([
//         ImagePicker.requestMediaLibraryPermissionsAsync(),
//         ImagePicker.requestCameraPermissionsAsync(),
//       ]);
//       if (libraryStatus.status !== "granted") {
//         setError("Permission to access media library is required.");
//       }
//       if (cameraStatus.status !== "granted") {
//         setError("Permission to access camera is required.");
//       }
//       if (libraryStatus.status === "granted") {
//         await loadGalleryMedia();
//       }
//     };
//     requestPermissionsAndLoadGallery();
//   }, []);

//   useEffect(() => {
//     navigation.setOptions({
//       tabBarStyle: { display: "none" },
//     });
//     return () => {
//       navigation.setOptions({
//         tabBarStyle: { display: "flex" },
//       });
//     };
//   }, [navigation]);

//   const loadGalleryMedia = async () => {
//     try {
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.All,
//         quality: 0.8,
//         allowsEditing: false,
//         allowsMultipleSelection: true,
//         selectionLimit: 20,
//       });
//       if (!result.canceled && result.assets) {
//         const mediaItems = result.assets.map((asset) => {
//           const mediaType = asset.mimeType || (asset.uri.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
//           const fileExtension = asset.uri.split(".").pop() || (mediaType.startsWith("video") ? "mp4" : "jpg");
//           const fileName = `${mediaType.startsWith("video") ? "video" : "image"}_${Date.now()}.${fileExtension}`;
//           return { uri: asset.uri, type: mediaType, name: fileName };
//         });
//         setGalleryMedia(mediaItems);
//       }
//     } catch (err) {
//       console.error("Gallery load error:", err);
//       setError("Failed to load gallery media.");
//     }
//   };

//   const handleMediaSelected = async (selectedMedia: { uri: string; type: string; name: string }[]) => {
//     const newMedia = [...media];
//     for (const item of selectedMedia) {
//       if (newMedia.length >= 5) {
//         setError("Maximum 5 media files allowed.");
//         return;
//       }
//       // Approximate file size check (if available)
//       if (item.uri) {
//         // Note: expo-image-picker doesn't provide file size; rely on backend for precise validation
//         newMedia.push({ ...item, progress: 0 });
//       }
//     }
//     setMedia(newMedia);
//     setSelectedGalleryIndices(newMedia.map((m) => galleryMedia.findIndex((gm) => gm.uri === m.uri)).filter((i) => i !== -1));
//     setError("");
//   };

//   const capturePhoto = async () => {
//     try {
//       const result = await ImagePicker.launchCameraAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         quality: 0.8,
//         allowsEditing: true,
//       });
//       if (!result.canceled && result.assets && result.assets[0]) {
//         const asset = result.assets[0];
//         const mediaType = asset.mimeType || "image/jpeg";
//         const fileExtension = asset.uri.split(".").pop() || "jpg";
//         const fileName = `image_${Date.now()}.${fileExtension}`;
//         await handleMediaSelected([{ uri: asset.uri, type: mediaType, name: fileName }]);
//       }
//     } catch (err) {
//       console.error("Photo capture error:", err);
//       setError("Failed to capture photo.");
//     }
//   };

//   const captureVideo = async () => {
//     try {
//       const result = await ImagePicker.launchCameraAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Videos,
//         quality: 0.8,
//         videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
//         allowsEditing: true,
//         videoMaxDuration: 60,
//       });
//       if (!result.canceled && result.assets && result.assets[0]) {
//         const asset = result.assets[0];
//         const mediaType = asset.mimeType || "video/mp4";
//         const fileExtension = asset.uri.split(".").pop() || "mp4";
//         const fileName = `video_${Date.now()}.${fileExtension}`;
//         await handleMediaSelected([{ uri: asset.uri, type: mediaType, name: fileName }]);
//       }
//     } catch (err) {
//       console.error("Video capture error:", err);
//       setError("Failed to capture video.");
//     }
//   };

//   const openGallery = async () => {
//     try {
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.All,
//         quality: 0.8,
//         allowsEditing: false,
//         allowsMultipleSelection: true,
//         selectionLimit: 5 - media.length,
//       });
//       if (!result.canceled && result.assets) {
//         const selected = result.assets.map((asset) => {
//           const mediaType = asset.mimeType || (asset.uri.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
//           const fileExtension = asset.uri.split(".").pop() || (mediaType.startsWith("video") ? "mp4" : "jpg");
//           const fileName = `${mediaType.startsWith("video") ? "video" : "image"}_${Date.now()}.${fileExtension}`;
//           return { uri: asset.uri, type: mediaType, name: fileName };
//         });
//         await handleMediaSelected(selected);
//       }
//     } catch (err) {
//       console.error("Gallery selection error:", err);
//       setError("Failed to select from gallery.");
//     }
//   };

//   const removeMedia = (index: number) => {
//     setMedia((prev) => prev.filter((_, i) => i !== index));
//     setSelectedGalleryIndices((prev) => prev.filter((i) => i !== index));
//   };

//   const retryUpload = async (formData: FormData, retries: number = 3, delay: number = 1000): Promise<any> => {
//     for (let attempt = 1; attempt <= retries; attempt++) {
//       try {
//         const response = await api.post("/posts", formData, {
//           headers: { "Content-Type": "multipart/form-data" },
//           onUploadProgress: (progressEvent) => {
//             if (progressEvent.total) {
//               const percentCompleted = Math.round((progressEvent.loaded * 90) / progressEvent.total);
//               setUploadProgress(percentCompleted);
//             }
//           },
//         });
//         return response;
//       } catch (err: any) {
//         if (attempt === retries) throw err;
//         console.warn(`Retry attempt ${attempt} failed:`, err.message);
//         await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
//       }
//     }
//   };

//   const handleUpload = async () => {
//     if (!caption.trim() && media.length === 0) {
//       setError("Please add a caption or at least one media file.");
//       return;
//     }

//     if (!token) {
//       setError("Authentication required. Please log in.");
//       return;
//     }

//     const netInfo = await NetInfo.fetch();
//     if (!netInfo.isConnected) {
//       setError("No internet connection. Please try again.");
//       return;
//     }

//     setIsUploading(true);
//     setError("");
//     setUploadProgress(0);

//     try {
//       const formData = new FormData();
//       formData.append("caption", caption.trim());
//       formData.append("hashtags", hashtags.trim());
//       formData.append("mentions", mentions.trim());

//       media.forEach((file, index) => {
//         const fileData = {
//           uri: Platform.OS === "ios" ? file.uri.replace("file://", "") : file.uri,
//           type: file.type,
//           name: file.name,
//         };
//         formData.append("media", fileData as any);
//         setMedia((prev) => prev.map((m, i) => i === index ? { ...m, progress: 0 } : m));
//       });

//       const response = await retryUpload(formData);

//       setUploadProgress(100);
//       Alert.alert("Success", "Post uploaded successfully!", [
//         {
//           text: "OK",
//           onPress: () => {
//             setCaption("");
//             setHashtags("");
//             setMentions("");
//             setMedia([]);
//             setSelectedGalleryIndices([]);
//             setUploadProgress(0);
//             navigation.navigate("HomeTab" as never);
//           },
//         },
//       ]);
//     } catch (err: any) {
//       let errorMessage = "Upload failed.";
//       if (err.response) {
//         const { error, message } = err.response.data;
//         if (error === "INVALID_FIELD_NAME") errorMessage = "Upload configuration error.";
//         else if (error === "FILE_TOO_LARGE") errorMessage = "File too large. Maximum size is 50MB.";
//         else if (error === "TOO_MANY_FILES") errorMessage = "Too many files. Maximum 5 files allowed.";
//         else if (error === "NO_CONTENT") errorMessage = "No content provided.";
//         else if (message) errorMessage = message;
//       } else if (err.message === "Network Error") {
//         errorMessage = `Network error. Ensure the server is running at ${API_URL}.`;
//       } else {
//         errorMessage = `Upload failed: ${err.message}`;
//       }
//       setError(errorMessage);
//     } finally {
//       setIsUploading(false);
//       setUploadProgress(0);
//     }
//   };

//   const renderGalleryItem = ({ item, index }: { item: { uri: string; type: string; name: string }; index: number }) => (
//     <TouchableOpacity
//       style={[
//         styles.galleryItem,
//         selectedGalleryIndices.includes(index) && styles.selectedGalleryItem,
//       ]}
//       onPress={() => {
//         if (selectedGalleryIndices.includes(index)) {
//           removeMedia(media.findIndex((m) => m.uri === item.uri));
//         } else {
//           handleMediaSelected([item]);
//         }
//       }}
//     >
//       <Image source={{ uri: item.uri }} style={styles.galleryPreview} />
//       {item.type.startsWith("video") && (
//         <View style={styles.playIconOverlay}>
//           <Icon name="play-circle-outline" size="20" color="white" />
//         </View>
//       )}
//       {selectedGalleryIndices.includes(index) && (
//         <View style={styles.progressOverlay}>
//           <Text style={styles.progressText}>
//             {media.find((m) => m.uri === item.uri)?.progress || 0}%
//           </Text>
//         </View>
//       )}
//     </TouchableOpacity>
//   );

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
//       <ScrollView showsVerticalScrollIndicator={false}>
//         {/* Header */}
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
//             <Text style={[styles.close, { opacity: isUploading ? 0.5 : 1, color: colors.text }]}>×</Text>
//           </TouchableOpacity>
//           <TouchableOpacity
//             onPress={handleUpload}
//             disabled={isUploading || (!caption.trim() && media.length === 0)}
//             style={[
//               styles.postButtonContainer,
//               { backgroundColor: isUploading || (!caption.trim() && media.length === 0) ? "#ccc" : colors.primary },
//             ]}
//           >
//             <Text style={[styles.postButton, { color: colors.background }]}>
//               {isUploading ? "Posting..." : "Post"}
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* Upload Progress */}
//         {isUploading && (
//           <View style={styles.progressContainer}>
//             <View style={styles.progressBar}>
//               <View style={[styles.progressFill, { width: `${uploadProgress}%`, backgroundColor: colors.primary }]} />
//             </View>
//             <Text style={[styles.progressText, { color: colors.text }]}>Uploading... {uploadProgress}%</Text>
//           </View>
//         )}

//         {/* Profile and Caption */}
//         <View style={styles.profileSection}>
//           <Image
//             source={{ uri: user?.profilePicture || "https://via.placeholder.com/40" }}
//             style={styles.profileImage}
//           />
//           <TextInput
//             style={[styles.captionInput, { color: colors.text, borderBottomColor: colors.border }]}
//             placeholder="What's happening?"
//             placeholderTextColor={colors.placeholder}
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
//               { color: caption.length > 450 ? colors.error : colors.text },
//             ]}
//           >
//             {caption.length}/500
//           </Text>
//         </View>

//         {/* Hashtags Input */}
//         <TextInput
//           style={[styles.input, { color: colors.text, borderColor: colors.border }]}
//           placeholder="Hashtags (e.g., #travel, #food)"
//           placeholderTextColor={colors.placeholder}
//           value={hashtags}
//           onChangeText={setHashtags}
//           editable={!isUploading}
//         />

//         {/* Mentions Input */}
//         <TextInput
//           style={[styles.input, { color: colors.text, borderColor: colors.border }]}
//           placeholder="Mentions (e.g., user1, user2)"
//           placeholderTextColor={colors.placeholder}
//           value={mentions}
//           onChangeText={setMentions}
//           editable={!isUploading}
//         />

//         {/* Media Preview */}
//         <View style={styles.mediaPreviewContainer}>
//           {media.map((item, index) => (
//             <View key={index} style={styles.mediaWrapper}>
//               <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
//               {item.type.startsWith("video") && (
//                 <View style={styles.playIconOverlay}>
//                   <Icon name="play-circle-outline" size={40} color="white" />
//                 </View>
//               )}
//               <TouchableOpacity style={styles.removeButton} onPress={() => removeMedia(index)} disabled={isUploading}>
//                 <Text style={styles.removeText}>×</Text>
//               </TouchableOpacity>
//             </View>
//           ))}
//         </View>

//         {/* Gallery Preview */}
//         <View style={styles.galleryPreviewContainer}>
//           <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Media</Text>
//           <FlatList
//             data={galleryMedia}
//             renderItem={renderGalleryItem}
//             keyExtractor={(item, index) => index.toString()}
//             horizontal
//             showsHorizontalScrollIndicator={false}
//             style={styles.galleryList}
//           />
//         </View>

//         {/* Add Media Buttons */}
//         {media.length < 5 && (
//           <View style={styles.addMediaButtonsContainer}>
//             <TouchableOpacity
//               style={[styles.addMediaButton, { borderColor: colors.primary }]}
//               onPress={capturePhoto}
//               disabled={isUploading}
//             >
//               <Text style={[styles.addMediaText, { color: colors.text }]}>📸 Photo</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={[styles.addMediaButton, { borderColor: colors.primary }]}
//               onPress={captureVideo}
//               disabled={isUploading}
//             >
//               <Text style={[styles.addMediaText, { color: colors.text }]}>🎥 Video</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={[styles.addMediaButton, { borderColor: colors.primary }]}
//               onPress={openGallery}
//               disabled={isUploading}
//             >
//               <Text style={[styles.addMediaText, { color: colors.text }]}>📁 Gallery</Text>
//             </TouchableOpacity>
//           </View>
//         )}

//         {/* Error Message */}
//         {error && (
//           <View style={styles.errorContainer}>
//             <Text style={styles.errorText}>{error}</Text>
//             <TouchableOpacity onPress={() => setError("")} style={styles.errorClose}>
//               <Text style={styles.errorCloseText}>×</Text>
//             </TouchableOpacity>
//           </View>
//         )}

//         {/* Tips */}
//         {!isUploading && (
//           <View style={styles.tipsContainer}>
//             <Text style={[styles.tipsTitle, { color: colors.text }]}>Tips for better posts:</Text>
//             <Text style={[styles.tipsText, { color: colors.text }]}>
//               • Use high-quality media{"\n"}• Write engaging captions{"\n"}• Add relevant hashtags{"\n"}• Tag friends with mentions
//             </Text>
//           </View>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

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
//     fontWeight: "bold",
//   },
//   postButtonContainer: {
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//     borderRadius: 25,
//   },
//   postButton: {
//     fontSize: 16,
//     fontWeight: "bold",
//   },
//   disabledButton: {
//     backgroundColor: "#ccc",
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
//   mediaPreviewContainer: {
//     flexDirection: "row",
//     flexWrap: "wrap",
//     marginBottom: 20,
//   },
//   mediaWrapper: {
//     position: "relative",
//     margin: 5,
//   },
//   mediaPreview: {
//     width: 120,
//     height: 120,
//     borderRadius: 12,
//   },
//   playIconOverlay: {
//     position: "absolute",
//     top: "50%",
//     left: "50%",
//     transform: [{ translateX: -20 }, { translateY: -20 }],
//     opacity: 0.7,
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
//   galleryPreviewContainer: {
//     marginBottom: 20,
//   },
//   galleryList: {
//     maxHeight: 120,
//   },
//   galleryItem: {
//     width: 80,
//     height: 80,
//     marginRight: 10,
//     borderWidth: 2,
//     borderColor: "#ccc",
//     borderRadius: 8,
//     overflow: "hidden",
//   },
//   selectedGalleryItem: {
//     borderColor: "#0A84FF",
//   },
//   galleryPreview: {
//     width: "100%",
//     height: "100%",
//   },
//   addMediaButtonsContainer: {
//     flexDirection: "row",
//     flexWrap: "wrap",
//   },
//   addMediaButton: {
//     width: 120,
//     height: 50,
//     borderRadius: 12,
//     borderWidth: 2,
//     borderStyle: "dashed",
//     justifyContent: "center",
//     alignItems: "center",
//     margin: 5,
//   },
//   addMediaText: {
//     fontSize: 16,
//     fontWeight: "600",
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
// });

// export default UploadFeed;




// // import { useState, useEffect } from "react";
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
// //   FlatList,
// // } from "react-native";
// // import { useNavigation } from "@react-navigation/native";
// // import { useAuth, API_URL } from "../../contexts/AuthContext";
// // import { useTheme } from "../../contexts/ThemeContext";
// // import NetInfo from "@react-native-community/netinfo";
// // import * as ImagePicker from "expo-image-picker";
// // import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
// // import type { RootStackParamList } from "../../types/navigation";
// // import Icon from "react-native-vector-icons/MaterialIcons";

// // type UploadFeedNavigationProp = NativeStackNavigationProp<RootStackParamList, "UploadFeed">;

// // const UploadFeed = () => {
// //   const { colors, theme } = useTheme() || { colors: { primary: "#0A84FF", background: "#FFFFFF", text: "#000000", border: "#D3D3D3" }, theme: "light" };
// //   const [caption, setCaption] = useState("");
// //   const [images, setImages] = useState<{ uri: string; type: string; name: string }[]>([]);
// //   const [video, setVideo] = useState<{ uri: string; type: string; name: string } | null>(null);
// //   const [galleryMedia, setGalleryMedia] = useState<{ uri: string; type: string; name: string }[]>([]);
// //   const [selectedGalleryIndices, setSelectedGalleryIndices] = useState<number[]>([]);
// //   const [error, setError] = useState("");
// //   const [isUploading, setIsUploading] = useState(false);
// //   const [uploadProgress, setUploadProgress] = useState(0);
// //   const navigation = useNavigation<UploadFeedNavigationProp>();
// //   const { user, token, api } = useAuth();

// //   // Request permissions and load gallery media on mount
// //   useEffect(() => {
// //     const requestPermissionsAndLoadGallery = async () => {
// //       const [libraryStatus, cameraStatus] = await Promise.all([
// //         ImagePicker.requestMediaLibraryPermissionsAsync(),
// //         ImagePicker.requestCameraPermissionsAsync(),
// //       ]);
// //       if (libraryStatus.status !== "granted") {
// //         setError("Permission to access media library is required for gallery selection.");
// //       }
// //       if (cameraStatus.status !== "granted") {
// //         setError("Permission to access camera is required for capturing photos or videos.");
// //       }
// //       if (libraryStatus.status === "granted") {
// //         await loadGalleryMedia();
// //       }
// //     };
// //     requestPermissionsAndLoadGallery();
// //   }, []);

// //   useEffect(() => {
// //     navigation.setOptions({
// //       tabBarStyle: { display: "none" },
// //     });
// //     return () => {
// //       navigation.setOptions({
// //         tabBarStyle: { display: "flex" },
// //       });
// //     };
// //   }, [navigation]);

// //   const loadGalleryMedia = async () => {
// //     try {
// //       const result = await ImagePicker.launchImageLibraryAsync({
// //         mediaTypes: ImagePicker.MediaTypeOptions.All,
// //         quality: 0.8,
// //         allowsEditing: false,
// //         allowsMultipleSelection: true,
// //         selectionLimit: 20,
// //       });
// //       if (!result.canceled && result.assets) {
// //         const media = result.assets.map((asset) => {
// //           const mediaType = asset.mimeType || (asset.uri.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
// //           const fileExtension = asset.uri.split(".").pop() || (mediaType.startsWith("video") ? "mp4" : "jpg");
// //           const fileName = `${mediaType.startsWith("video") ? "video" : "image"}_${Date.now()}.${fileExtension}`;
// //           return { uri: asset.uri, type: mediaType, name: fileName };
// //         });
// //         setGalleryMedia(media);
// //       }
// //     } catch (err) {
// //       console.error("Gallery load error:", err);
// //       setError("Failed to load gallery media.");
// //     }
// //   };

// //   const handleMediaSelected = (media: { uri: string; type: string; name: string }) => {
// //     if (media.type.startsWith("video")) {
// //       if (images.length > 0) {
// //         setError("Cannot upload video with images. Remove images first.");
// //         return;
// //       }
// //       setVideo(media);
// //       setImages([]);
// //       setSelectedGalleryIndices([]);
// //       setError("");
// //     } else if (media.type.startsWith("image")) {
// //       if (video) {
// //         setError("Cannot upload images with a video. Remove video first.");
// //         return;
// //       }
// //       if (images.length >= 5) {
// //         setError("Maximum 5 images allowed");
// //         return;
// //       }
// //       setImages((prev) => [...prev, media]);
// //       setSelectedGalleryIndices((prev) => [...prev, galleryMedia.findIndex((m) => m.uri === media.uri)]);
// //       setError("");
// //     }
// //   };

// //   const capturePhoto = async () => {
// //     try {
// //       console.log("Launching camera for photo, platform:", Platform.OS);
// //       const result = await ImagePicker.launchCameraAsync({
// //         mediaTypes: ImagePicker.MediaTypeOptions.Images,
// //         quality: 0.8,
// //         allowsEditing: true,
// //       });
// //       console.log("Photo capture result:", result);
// //       if (!result.canceled && result.assets && result.assets[0]) {
// //         const asset = result.assets[0];
// //         const mediaType = asset.mimeType || "image/jpeg";
// //         const fileExtension = asset.uri.split(".").pop() || "jpg";
// //         const fileName = `image_${Date.now()}.${fileExtension}`;
// //         handleMediaSelected({ uri: asset.uri, type: mediaType, name: fileName });
// //       }
// //     } catch (err) {
// //       console.error("Photo capture error:", err);
// //       setError("Failed to capture photo. Ensure camera permissions are granted.");
// //     }
// //   };

// //   const captureVideo = async () => {
// //     try {
// //       console.log("Launching camera for video, platform:", Platform.OS);
// //       const result = await ImagePicker.launchCameraAsync({
// //         mediaTypes: ImagePicker.MediaTypeOptions.Videos,
// //         quality: 0.8,
// //         videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
// //         allowsEditing: true,
// //         videoMaxDuration: 60,
// //       });
// //       console.log("Video capture result:", result);
// //       if (!result.canceled && result.assets && result.assets[0]) {
// //         const asset = result.assets[0];
// //         const mediaType = asset.mimeType || "video/mp4";
// //         const fileExtension = asset.uri.split(".").pop() || "mp4";
// //         const fileName = `video_${Date.now()}.${fileExtension}`;
// //         handleMediaSelected({ uri: asset.uri, type: mediaType, name: fileName });
// //       }
// //     } catch (err) {
// //       console.error("Video capture error:", err);
// //       setError("Failed to capture video. Ensure camera permissions are granted.");
// //     }
// //   };

// //   const removeImage = (index: number) => {
// //     setImages((prev) => prev.filter((_, i) => i !== index));
// //     setSelectedGalleryIndices((prev) => prev.filter((i) => i !== index));
// //   };

// //   const removeVideo = () => {
// //     setVideo(null);
// //     setSelectedGalleryIndices([]);
// //   };

// //   const handleUpload = async () => {
// //     if (!caption.trim() && images.length === 0 && !video) {
// //       setError("Please add a caption, at least one image, or a video");
// //       return;
// //     }

// //     if (!token) {
// //       setError("Authentication required. Please log in again.");
// //       return;
// //     }

// //     const netInfo = await NetInfo.fetch();
// //     if (!netInfo.isConnected) {
// //       setError("No internet connection. Please connect and try again.");
// //       return;
// //     }

// //     setIsUploading(true);
// //     setError("");
// //     setUploadProgress(0);

// //     try {
// //       const formData = new FormData();

// //       if (video) {
// //         const videoFile = {
// //           uri: Platform.OS === "ios" ? video.uri.replace("file://", "") : video.uri,
// //           type: video.type,
// //           name: video.name,
// //         };
// //         console.log("Adding video to media field:", videoFile);
// //         formData.append("media", videoFile as any);
// //       } else if (images.length > 0) {
// //         images.forEach((image, index) => {
// //           const imageFile = {
// //             uri: Platform.OS === "ios" ? image.uri.replace("file://", "") : image.uri,
// //             type: image.type,
// //             name: image.name,
// //           };
// //           console.log(`Adding image ${index + 1} to media field:`, imageFile);
// //           formData.append("media", imageFile as any);
// //         });
// //       }

// //       formData.append("caption", caption.trim());

// //       console.log("Uploading to:", `${API_URL}/posts`);
// //       console.log("Token present:", !!token);
// //       console.log("Video present:", !!video);
// //       console.log("Images count:", images.length);
// //       console.log("Caption:", caption.trim());

// //       const progressInterval = setInterval(() => {
// //         setUploadProgress((prev) => {
// //           if (prev >= 90) {
// //             clearInterval(progressInterval);
// //             return 90;
// //           }
// //           return prev + 10;
// //         });
// //       }, 200);

// //       const response = await api.post("/posts", formData, {
// //         headers: {
// //           "Content-Type": "multipart/form-data",
// //         },
// //         onUploadProgress: (progressEvent) => {
// //           if (progressEvent.total) {
// //             const percentCompleted = Math.round((progressEvent.loaded * 90) / progressEvent.total);
// //             setUploadProgress(percentCompleted);
// //           }
// //         },
// //       });

// //       clearInterval(progressInterval);
// //       setUploadProgress(100);

// //       console.log("Upload successful:", response.data);

// //       Alert.alert("Success", "Post uploaded successfully!", [
// //         {
// //           text: "OK",
// //           onPress: () => {
// //             setCaption("");
// //             setImages([]);
// //             setVideo(null);
// //             setSelectedGalleryIndices([]);
// //             setUploadProgress(0);
// //             navigation.navigate("HomeTab" as never);
// //           },
// //         },
// //       ]);
// //     } catch (err: any) {
// //       console.error("Upload error:", err);

// //       let errorMessage = "Upload failed";
// //       if (err.response) {
// //         const { error, message } = err.response.data;
// //         if (error === "INVALID_FIELD_NAME") {
// //           errorMessage = "Upload configuration error. Expected field 'media'.";
// //         } else if (error === "FILE_TOO_LARGE") {
// //           errorMessage = "File too large. Maximum size is 50MB.";
// //         } else if (error === "TOO_MANY_FILES") {
// //           errorMessage = "Too many files. Maximum 5 files allowed.";
// //         } else if (message) {
// //           errorMessage = message;
// //         }
// //       } else if (err.message === "Network Error") {
// //         errorMessage = `Network error. Please check your connection and ensure the server is running at ${API_URL}`;
// //       } else if (err.name === "TypeError") {
// //         errorMessage = "Connection error. Please check your internet connection.";
// //       } else {
// //         errorMessage = `Upload failed: ${err.message}`;
// //       }

// //       setError(errorMessage);
// //     } finally {
// //       setIsUploading(false);
// //       setUploadProgress(0);
// //     }
// //   };

// //   const renderGalleryItem = ({ item, index }: { item: { uri: string; type: string; name: string }; index: number }) => (
// //     <TouchableOpacity
// //       style={[
// //         styles.galleryItem,
// //         selectedGalleryIndices.includes(index) && styles.selectedGalleryItem,
// //       ]}
// //       onPress={() => {
// //         if (selectedGalleryIndices.includes(index)) {
// //           if (item.type.startsWith("video")) removeVideo();
// //           else removeImage(images.findIndex((img) => img.uri === item.uri));
// //         } else {
// //           handleMediaSelected(item);
// //         }
// //       }}
// //     >
// //       <Image source={{ uri: item.uri }} style={styles.galleryPreview} />
// //       {item.type.startsWith("video") && (
// //         <View style={styles.playIconOverlay}>
// //           <Icon name="play-circle-outline" size={20} color="white" />
// //         </View>
// //       )}
// //     </TouchableOpacity>
// //   );

// //   return (
// //     <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
// //       <ScrollView showsVerticalScrollIndicator={false}>
// //         {/* Header */}
// //         <View style={styles.header}>
// //           <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
// //             <Text style={[styles.close, { opacity: isUploading ? 0.5 : 1, color: colors.text }]}>×</Text>
// //           </TouchableOpacity>
// //           <TouchableOpacity
// //             onPress={handleUpload}
// //             disabled={isUploading || (!caption.trim() && images.length === 0 && !video)}
// //             style={[
// //               styles.postButtonContainer,
// //               isUploading || (!caption.trim() && images.length === 0 && !video) ? styles.disabledButton : null,
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.postButton,
// //                 {
// //                   color: isUploading || (!caption.trim() && images.length === 0 && !video) ? "#999" : colors.text,
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
// //               <View style={[styles.progressFill, { width: `${uploadProgress}%`, backgroundColor: colors.primary }]} />
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
// //             placeholderTextColor={colors.placeholder}
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
// //               { color: caption.length > 450 ? colors.error : colors.text },
// //             ]}
// //           >
// //             {caption.length}/500
// //           </Text>
// //         </View>

// //         {/* Media Preview */}
// //         <View style={styles.mediaPreviewContainer}>
// //           {video && (
// //             <View style={styles.mediaWrapper}>
// //               <Image source={{ uri: video.uri }} style={styles.mediaPreview} />
// //               <View style={styles.playIconOverlay}>
// //                 <Icon name="play-circle-outline" size={40} color="white" />
// //               </View>
// //               <TouchableOpacity style={styles.removeButton} onPress={removeVideo} disabled={isUploading}>
// //                 <Text style={styles.removeText}>×</Text>
// //               </TouchableOpacity>
// //             </View>
// //           )}
// //           {images.map((img, index) => (
// //             <View key={index} style={styles.mediaWrapper}>
// //               <Image source={{ uri: img.uri }} style={styles.mediaPreview} />
// //               <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)} disabled={isUploading}>
// //                 <Text style={styles.removeText}>×</Text>
// //               </TouchableOpacity>
// //             </View>
// //           ))}
// //         </View>

// //         {/* Gallery Preview */}
// //         <View style={styles.galleryContainer}>
// //           <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Gallery (Tap to Select)</Text>
// //           <FlatList
// //             data={galleryMedia}
// //             renderItem={renderGalleryItem}
// //             keyExtractor={(item, index) => index.toString()}
// //             horizontal
// //             showsHorizontalScrollIndicator={false}
// //             style={styles.galleryList}
// //           />
// //         </View>

// //         {/* Add Media Buttons */}
// //         {images.length < 5 && !video && (
// //           <View style={styles.addMediaButtonsContainer}>
// //             <TouchableOpacity
// //               style={[styles.addMediaButton, { borderColor: colors.primary, backgroundColor: colors.primary }]}
// //               onPress={capturePhoto}
// //               disabled={isUploading}
// //             >
// //               <Text style={[styles.addMediaText, { color: theme === "dark" ? "white" : "black" }]}>📸 Photo</Text>
// //             </TouchableOpacity>
// //             <TouchableOpacity
// //               style={[styles.addMediaButton, { borderColor: colors.primary, backgroundColor: colors.primary }]}
// //               onPress={captureVideo}
// //               disabled={isUploading}
// //             >
// //               <Text style={[styles.addMediaText, { color: theme === "dark" ? "white" : "black" }]}>🎥 Video</Text>
// //             </TouchableOpacity>
// //           </View>
// //         )}

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
// //               • Use high-quality images or videos{"\n"}• Write engaging captions{"\n"}• Add relevant hashtags{"\n"}• Keep it authentic
// //             </Text>
// //           </View>
// //         )}
// //       </ScrollView>
// //     </SafeAreaView>
// //   );
// // };

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
// //     fontWeight: "bold",
// //   },
// //   postButtonContainer: {
// //     paddingHorizontal: 20,
// //     paddingVertical: 10,
// //     borderRadius: 25,
// //   },
// //   postButton: {
// //     fontSize: 16,
// //     fontWeight: "bold",
// //   },
// //   disabledButton: {
// //     backgroundColor: "#ccc",
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
// //   mediaPreviewContainer: {
// //     flexDirection: "row",
// //     flexWrap: "wrap",
// //     marginBottom: 20,
// //   },
// //   mediaWrapper: {
// //     position: "relative",
// //     margin: 5,
// //   },
// //   mediaPreview: {
// //     width: 120,
// //     height: 120,
// //     borderRadius: 12,
// //   },
// //   playIconOverlay: {
// //     position: "absolute",
// //     top: "50%",
// //     left: "50%",
// //     transform: [{ translateX: -20 }, { translateY: -20 }],
// //     opacity: 0.7,
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
// //   galleryContainer: {
// //     marginBottom: 20,
// //   },
// //   sectionTitle: {
// //     fontSize: 16,
// //     fontWeight: "600",
// //     marginBottom: 10,
// //   },
// //   galleryList: {
// //     maxHeight: 120,
// //   },
// //   galleryItem: {
// //     width: 80,
// //     height: 80,
// //     marginRight: 10,
// //     borderWidth: 2,
// //     borderColor: "#ccc",
// //     borderRadius: 8,
// //     overflow: "hidden",
// //   },
// //   selectedGalleryItem: {
// //     borderColor: "#0A84FF", // Fallback color if colors.primary is unavailable initially
// //   },
// //   galleryPreview: {
// //     width: "100%",
// //     height: "100%",
// //   },
// //   addMediaButtonsContainer: {
// //     flexDirection: "row",
// //     flexWrap: "wrap",
// //   },
// //   addMediaButton: {
// //     width: 120,
// //     height: 50,
// //     borderRadius: 12,
// //     borderWidth: 2,
// //     borderStyle: "dashed",
// //     justifyContent: "center",
// //     alignItems: "center",
// //     margin: 5,
// //   },
// //   addMediaText: {
// //     fontSize: 16,
// //     fontWeight: "600",
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
// // });

// // export default UploadFeed;


