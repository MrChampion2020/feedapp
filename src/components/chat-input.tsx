// components/chat-input.tsx
import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Send, Camera, Mic } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

interface ChatInputProps {
  onSend: (message: string, mediaUri?: string, messageType?: "text" | "image" | "video" | "audio") => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const { colors } = useTheme();
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleSendMessage = () => {
    if (messageText.trim() || selectedImage) {
      onSend(messageText, selectedImage);
      setMessageText('');
      setSelectedImage(null);
    }
  };

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCameraPicker = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleStartRecording = async () => {
    // Implement audio recording logic here
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    // Implement audio recording stop and send logic here
    setIsRecording(false);
  };

  return (
    <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={handleImagePicker} style={[styles.mediaButton, { backgroundColor: colors.card }]}>
          <Camera size={20} color={colors.icon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleCameraPicker} style={[styles.mediaButton, { backgroundColor: colors.card }]}>
          <ImageIcon size={20} color={colors.icon} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.placeholder}
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: messageText.trim() || selectedImage ? colors.primary : colors.border },
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() && !selectedImage}
        >
          <Send size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    padding: 8,
    borderTopWidth: 1,
    width: '100%',
    position: 'relative',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 20,
    padding: 8,
  },
  mediaButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    textAlignVertical: 'center',
    fontSize: 15,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatInput;