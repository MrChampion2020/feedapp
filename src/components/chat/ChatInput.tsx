import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Alert,
  Image,
} from 'react-native';
import {
  Send,
  Mic,
  Paperclip,
  X,
  Trash2,
  Pause,
  Play,
  Music2,
} from 'lucide-react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Message } from '../../types/ChatItem';
import { VoiceNoteWaveform } from './VoiceNoteWaveform';

interface ChatInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  drafts: Message[];
  setDrafts: React.Dispatch<React.SetStateAction<Message[]>>;
  replyingTo: Message | null;
  setReplyingTo: (message: Message | null) => void;
  onSendMessage: (text: string, mediaDrafts?: Message[]) => void;
  onAttachmentPress: () => void;
  sending: boolean;
  colors: any;
  user: any;
  activeChat: any;
  // Edit functionality props
  isEditing?: boolean;
  editText?: string;
  setEditText?: (text: string) => void;
  onEditSubmit?: () => void;
  onEditCancel?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  messageText,
  setMessageText,
  drafts,
  setDrafts,
  replyingTo,
  setReplyingTo,
  onSendMessage,
  onAttachmentPress,
  sending,
  colors,
  user,
  activeChat,
  // Edit functionality props
  isEditing = false,
  editText = '',
  setEditText,
  onEditSubmit,
  onEditCancel,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const recording = useRef<Audio.Recording | null>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  // Keyboard handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Format duration helper
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Start recording with error handling
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant microphone permissions.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingObject = new Audio.Recording();
      await recordingObject.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingObject.startAsync();
      
      recording.current = recordingObject;
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  // Pause recording
  const pauseRecording = async () => {
    try {
      if (recording.current) {
        await recording.current.pauseAsync();
        setRecordingPaused(true);
        if (recordingTimer.current) clearInterval(recordingTimer.current);
      }
    } catch (error) {
      console.error("Failed to pause recording:", error);
      Alert.alert("Error", "Failed to pause recording");
    }
  };

  // Resume recording
  const resumeRecording = async () => {
    try {
      if (recording.current) {
        await recording.current.startAsync();
        setRecordingPaused(false);
        recordingTimer.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      }
    } catch (error) {
      console.error("Failed to resume recording:", error);
      Alert.alert("Error", "Failed to resume recording");
    }
  };

  // Stop recording with error handling
  const stopRecording = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (!user || !activeChat) {
        throw new Error("User or chat not available");
      }

      if (recording.current) {
        await recording.current.stopAndUnloadAsync();
        const uri = recording.current.getURI();
        
        if (uri) {
          const audioMessage: Message = {
            id: `temp-${Date.now()}`,
            audio: uri,
            messageType: 'audio',
            sender: {
              _id: user.id,
              username: user.username,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isDraft: true,
          };

          // Send the audio message
          onSendMessage("", [audioMessage]);
        }
        
        recording.current = null;
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to stop recording");
    } finally {
      setIsRecording(false);
      setRecordingPaused(false);
      setRecordingDuration(0);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      isStoppingRef.current = false;
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    try {
      if (recording.current) {
        recording.current.stopAndUnloadAsync();
        recording.current = null;
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      setIsRecording(false);
      setRecordingPaused(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error("Failed to cancel recording:", error);
    }
  };

  // Delete recording with confirmation
  const deleteRecording = () => {
    Alert.alert(
      "Delete Recording",
      "Are you sure you want to delete this recording?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: cancelRecording,
        },
      ]
    );
  };

  // Remove draft
  const removeDraft = (id: string) => {
    setDrafts((prev: Message[]) => prev.filter(d => d.id !== id));
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!messageText.trim() && drafts.length === 0) return;
    
    try {
      // Send message with media drafts if any
      onSendMessage(messageText.trim(), drafts.length > 0 ? drafts : undefined);
      
      // Clear input and drafts
      setMessageText("");
      setDrafts([]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Handle text change
  const handleTextChange = (text: string) => {
    try {
      setMessageText(text);
    } catch (error) {
      console.error("Failed to update text:", error);
    }
  };

  // Render reply preview
  const renderReplyPreview = () => {
    if (!replyingTo) return null;

    return (
      <View
        style={[
          styles.replyPreview,
          {
            backgroundColor: colors.replyPreview,
            borderLeftWidth: 4,
            borderLeftColor: colors.iconFg,
            borderRadius: 8,
            padding: 6,
          },
        ]}
      >
        <View style={styles.replyPreviewContent}>
          {/* Show media preview if available */}
          {replyingTo.image && (
            <Image 
              source={{ uri: replyingTo.image }} 
              style={styles.replyMediaPreview}
              resizeMode="cover"
            />
          )}
          {replyingTo.video && (
            <View style={styles.replyMediaPreview}>
              <Video
                source={{ uri: replyingTo.video }}
                style={styles.replyMediaPreview}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                useNativeControls={false}
                isLooping={false}
              />
              <View style={styles.replyVideoPlayOverlay}>
                <Play size={12} color="#fff" />
              </View>
            </View>
          )}
          {replyingTo.audio && (
            <View style={[styles.replyMediaPreview, { backgroundColor: colors.iconBg, justifyContent: 'center', alignItems: 'center' }]}>
              <Music2 size={16} color={colors.iconFg} />
            </View>
          )}
          
          <Text
            numberOfLines={1}
            style={{
              color: replyingTo.sender && user && replyingTo.sender._id === user.id
                ? colors.senderText
                : colors.receiverText,
              opacity: 0.6,
              fontStyle: 'italic',
              flex: 1,
              marginRight: 8,
            }}
          >
            {replyingTo.text || (replyingTo.image ? '📷 Image' : replyingTo.video ? '🎥 Video' : replyingTo.audio ? '🎵 Audio' : 'Message')}
          </Text>
          <TouchableOpacity
            onPress={() => setReplyingTo(null)}
            style={styles.replyCloseButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color={colors.iconFg} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render selected media preview
  const renderSelectedMedia = () => {
    if (drafts.length === 0) return null;

    return (
      <View style={styles.selectedMediaContainer}>
        <View style={styles.selectedMediaHeader}>
          <Text style={[styles.selectedMediaText, { color: colors.chatroom.text }]}>
            {drafts.length} media file{drafts.length > 1 ? 's' : ''} selected
          </Text>
          <TouchableOpacity
            onPress={() => setDrafts([])}
            style={styles.clearAllButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.clearAllText, { color: colors.primary }]}>
              Clear All
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.selectedMediaGrid}>
          {drafts.map((draft) => (
            <View key={draft.id} style={styles.selectedMediaItem}>
              {/* Show actual media preview */}
              {draft.image && (
                <Image 
                  source={{ uri: draft.image }} 
                  style={styles.selectedMediaPreview}
                  resizeMode="cover"
                />
              )}
              {draft.video && (
                <View style={styles.selectedMediaPreview}>
                  <Video
                    source={{ uri: draft.video }}
                    style={styles.selectedMediaPreview}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    useNativeControls={false}
                    isLooping={false}
                  />
                  <View style={styles.videoPlayOverlay}>
                    <Play size={16} color="#fff" />
                  </View>
                </View>
              )}
              {draft.audio && (
                <View style={[styles.selectedMediaPreview, { backgroundColor: colors.iconBg, justifyContent: 'center', alignItems: 'center' }]}>
                  <Music2 size={20} color={colors.iconFg} />
                </View>
              )}
              {!draft.image && !draft.video && !draft.audio && (
                <View style={[styles.selectedMediaPreview, { backgroundColor: colors.chatroom.border, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={[styles.mediaTypeText, { color: colors.chatroom.secondary }]}>
                    📎
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeMediaButton}
                onPress={() => removeDraft(draft.id)}
                activeOpacity={0.8}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render recording interface
  const renderRecordingInterface = () => {
    if (!isRecording) return null;

    return (
      <View style={[styles.recordingContainer, { justifyContent: "space-between", alignItems: "center" }]}>
        <TouchableOpacity
          onPress={deleteRecording}
          style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
          activeOpacity={0.7}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Trash2 size={20} color={colors.iconFg} />
        </TouchableOpacity>
        
        <VoiceNoteWaveform
          isRecording={true}
          color={colors.chatroom.primary}
          height={28}
          width={60}
        />
        
        <Text style={[styles.recordingDuration, { color: colors.chatroom.text }]}>
          {formatDuration(recordingDuration)}
        </Text>
        
        <TouchableOpacity
          onPress={recordingPaused ? resumeRecording : pauseRecording}
          style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
          activeOpacity={0.7}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          {recordingPaused ? (
            <Play size={20} color={colors.iconFg} />
          ) : (
            <Pause size={20} color={colors.iconFg} />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={stopRecording}
          style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
          activeOpacity={0.7}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Send size={20} color={colors.iconFg} />
        </TouchableOpacity>
      </View>
    );
  };

  // Render edit interface
  const renderEditInterface = () => {
    if (!isEditing) return null;

    return (
      <View
        style={[
          styles.editContainer,
          {
            backgroundColor: colors.chatroom.inputBg,
            borderColor: colors.primary,
            borderWidth: 2,
          },
        ]}
      >
        <View style={styles.editHeader}>
          <Text style={[styles.editLabel, { color: colors.primary }]}>
            Edit Message
          </Text>
          <TouchableOpacity
            onPress={onEditCancel}
            style={styles.editCancelButton}
            activeOpacity={0.7}
          >
            <X size={16} color={colors.iconFg} />
          </TouchableOpacity>
        </View>
        
        <TextInput
          style={[
            styles.editInput,
            {
              color: colors.chatroom.inputText,
              backgroundColor: 'transparent',
            },
          ]}
          placeholder="Edit your message..."
          placeholderTextColor={colors.placeholderDark}
          value={editText}
          onChangeText={setEditText}
          multiline
          autoFocus
        />
        
        <View style={styles.editActions}>
          <TouchableOpacity
            style={[
              styles.editButton,
              {
                backgroundColor: editText.trim() ? colors.primary : colors.chatroom.border,
              },
            ]}
            onPress={onEditSubmit}
            disabled={!editText.trim()}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.editButtonText,
              { color: editText.trim() ? '#fff' : colors.chatroom.secondary },
            ]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render input interface
  const renderInputInterface = () => {
    if (isRecording || isEditing) return null;

    return (
      <View
        style={[
          styles.inputRow,
          {
            minHeight: 52,
            maxHeight: 120,
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 24,
            backgroundColor: colors.chatroom.inputBg,
            alignItems: 'center',
            margin: 0,
          },
        ]}
      >
        <TouchableOpacity
          onPress={onAttachmentPress}
          style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
          activeOpacity={0.7}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Paperclip size={20} color={colors.iconFg} />
        </TouchableOpacity>
        
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              backgroundColor: 'transparent',
              color: colors.chatroom.inputText,
              borderColor: 'transparent',
              flex: 1,
              minHeight: 40,
              maxHeight: 100,
              fontSize: 16,
              paddingHorizontal: 12,
              paddingVertical: 8,
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.placeholderDark}
          value={messageText}
          onChangeText={handleTextChange}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSendMessage}
        />
        
        {messageText.trim().length > 0 || drafts.length > 0 ? (
          <TouchableOpacity
            style={[
              styles.mediaButton,
              { backgroundColor: colors.iconBg, opacity: sending ? 0.5 : 1 },
            ]}
            activeOpacity={0.7}
            onPress={handleSendMessage}
            disabled={sending}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Send size={20} color={colors.iconFg} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
            activeOpacity={0.7}
            onPress={startRecording}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Mic size={20} color={colors.iconFg} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.inputContainer,
        {
          backgroundColor: colors.theme === 'dark' ? 'transparent' : 'rgba(0, 0, 0, 0.86)',
          borderTopColor: 'transparent',
          borderRadius: 24,
          margin: 8,
          padding: 8,
          shadowColor: colors.theme === 'dark' ? 'transparent' : '#ccc',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: colors.theme === 'dark' ? 0 : 0.12,
          shadowRadius: 8,
        },
      ]}
    >
      {renderReplyPreview()}
      {renderSelectedMedia()}
      {renderRecordingInterface()}
      {renderEditInterface()}
      {renderInputInterface()}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    padding: 4,
    borderTopWidth: 0.3,
    width: "100%",
    flexShrink: 0,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    backgroundColor: "transparent",
    padding: 4,
    margin: 4,
    gap: 4,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    minHeight: 36,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    textAlignVertical: "center",
    fontSize: 15,
  },
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  replyPreviewContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  replyCloseButton: {
    padding: 4,
  },
  selectedMediaContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  selectedMediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  selectedMediaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearAllButton: {
    padding: 4,
  },
  clearAllText: {
    fontSize: 14,
  },
  selectedMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedMediaItem: {
    position: "relative",
  },
  editContainer: {
    margin: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  editCancelButton: {
    padding: 4,
  },
  editInput: {
    minHeight: 40,
    maxHeight: 100,
    fontSize: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedMediaPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaTypeText: {
    fontSize: 24,
  },
  removeMediaButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  recordingContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recordingDuration: {
    fontWeight: "bold",
    fontSize: 18,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  replyMediaPreview: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 8,
  },
  replyVideoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
  },
});

export default ChatInput; 