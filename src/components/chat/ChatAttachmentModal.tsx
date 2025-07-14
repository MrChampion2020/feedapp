import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import {
  Paperclip,
  Camera,
  Video as VideoIcon,
  Music2,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Message } from '../../types/ChatItem';

interface ChatAttachmentModalProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelect: (media: Message) => void;
  colors: any;
  user: any;
}

const ChatAttachmentModal: React.FC<ChatAttachmentModalProps> = ({
  visible,
  onClose,
  onMediaSelect,
  colors,
  user,
}) => {
  const handleMediaSelection = async (type: 'gallery' | 'camera' | 'video' | 'record' | 'audio') => {
    try {
      let result;
      
      switch (type) {
        case 'gallery':
          const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (galleryStatus !== "granted") {
            throw new Error("Please grant camera roll permissions.");
          }
          
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: false,
            aspect: [1, 1],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 10,
          });
          break;
          
        case 'camera':
          const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
          if (cameraStatus !== "granted") {
            throw new Error("Please grant camera permissions.");
          }
          
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
          });
          break;
          
        case 'video':
          const { status: videoStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (videoStatus !== "granted") {
            throw new Error("Please grant camera roll permissions.");
          }
          
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 5,
          });
          break;
          
        case 'record':
          const { status: recordStatus } = await ImagePicker.requestCameraPermissionsAsync();
          if (recordStatus !== "granted") {
            throw new Error("Please grant camera permissions.");
          }
          
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 0.8,
          });
          break;
          
        case 'audio':
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: false,
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 5,
          });
          break;
          
        default:
          throw new Error("Invalid media type");
      }
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        result.assets.forEach((asset: any) => {
          const isVideo = asset.mimeType?.startsWith('video') || 
                         asset.uri.toLowerCase().includes('.mp4') || 
                         asset.uri.toLowerCase().includes('.mov');
          
          const isAudio = asset.uri.toLowerCase().includes('.mp3') ||
                         asset.uri.toLowerCase().includes('.m4a') ||
                         asset.uri.toLowerCase().includes('.wav') ||
                         asset.uri.toLowerCase().includes('.aac') ||
                         asset.uri.toLowerCase().includes('.ogg');
          
          let messageType = "image";
          if (isVideo) messageType = "video";
          else if (isAudio) messageType = "audio";
          
          const mediaMessage: Message = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            image: messageType === "image" ? asset.uri : undefined,
            video: messageType === "video" ? asset.uri : undefined,
            audio: messageType === "audio" ? asset.uri : undefined,
            messageType: messageType as any,
            sender: {
              _id: user.id,
              username: user.username,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isDraft: true,
          };
          
          onMediaSelect(mediaMessage);
        });
      }
      
      onClose();
    } catch (error) {
      console.error(`Error selecting ${type}:`, error);
      // Show user-friendly error message
      const { Alert } = await import('react-native');
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to select media");
    }
  };

  const attachmentOptions = [
    {
      icon: Paperclip,
      label: "Gallery",
      onPress: () => handleMediaSelection('gallery'),
    },
    {
      icon: Camera,
      label: "Camera",
      onPress: () => handleMediaSelection('camera'),
    },
    {
      icon: VideoIcon,
      label: "Video",
      onPress: () => handleMediaSelection('video'),
    },
    {
      icon: VideoIcon,
      label: "Record",
      onPress: () => handleMediaSelection('record'),
    },
    {
      icon: Music2,
      label: "Audio",
      onPress: () => handleMediaSelection('audio'),
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[
          styles.overlay,
          { backgroundColor: colors.overlay === 'black' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)' },
        ]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            {attachmentOptions.map((option, index) => (
              <View key={index} style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.iconBg }]}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <option.icon size={24} color={colors.iconFg} />
                </TouchableOpacity>
                <Text style={[styles.label, { color: colors.text }]}>{option.label}</Text>
              </View>
            ))}
          </View>
          
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.iconBg }]}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={colors.iconFg} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 32,
    paddingTop: 20,
    paddingHorizontal: 16,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  buttonContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 60,
  },
  closeButton: {
    alignSelf: "center",
    marginTop: 12,
    padding: 12,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ChatAttachmentModal; 