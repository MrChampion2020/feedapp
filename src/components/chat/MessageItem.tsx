import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  Share,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { Audio, Video, ResizeMode } from "expo-av";
import { Linking } from "react-native";
import {
  Reply,
  Play,
  Download,
  Music2,
  X,
  Pause,
} from "lucide-react-native";
import { VoiceNoteWaveform } from "./VoiceNoteWaveform";
import { PostCommentPreview } from "./PostCommentPreview";
import { parsePostCommentMessage } from "../../utils/messageUtils";

interface MessageSender {
  _id: string;
  username: string;
  fullName: string;
  profilePicture?: string;
}

export interface Message {
  id: string;
  text?: string;
  image?: string;
  audio?: string;
  video?: string;
  images?: string[];
  videos?: string[];
  audios?: string[];
  messageType:
    | "text"
    | "image"
    | "text-image"
    | "post-comment"
    | "audio"
    | "video"
    | "text-audio"
    | "text-video"
    | "multiple-media";
  sender: MessageSender;
  timestamp: string;
  replyTo?: Message;
  postData?: {
    image: string;
    caption: string;
    timestamp: string;
  };
  isDraft?: boolean;
  isRead?: boolean;
  createdAt?: string;
}

interface MessageItemProps {
  item: Message;
  user: any;
  colors: any;
  handleSwipeGesture: (event: any, message: Message) => void;
  renderTextWithLinks: (text: string, textColor?: string) => any;
  flatListRef: any;
  onRemoveDraft?: (id: string) => void;
  onLongPress?: (message: Message) => void;
  selectedMessage?: Message | null;
  getMessageTick: (msg: Message) => string;
  messageStatus: { [key: string]: string };
}

export const MessageItem: React.FC<MessageItemProps> = ({
  item,
  user,
  colors,
  handleSwipeGesture,
  renderTextWithLinks,
  flatListRef,
  onRemoveDraft,
  onLongPress,
  selectedMessage,
  getMessageTick,
  messageStatus,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const panRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [modalVideoIndex, setModalVideoIndex] = useState(0);

  const audioUri = item.audio || "";

  const handleDownloadMedia = async (uri: string, type: 'image' | 'video' | 'audio') => {
    try {
      const fileName = `feeda_${type}_${Date.now()}.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'm4a'}`;
      
      await Share.share({
        url: uri,
        title: `Feeda ${type}`,
        message: `Sharing ${type} from Feeda chat`,
      });
      
      console.log(`${type} shared successfully`);
    } catch (error) {
      console.error('Failed to share media:', error);
      Alert.alert('Error', 'Failed to share media');
    }
  };

  const onGestureEvent = (event: any) => {
    const translationX = event.nativeEvent.translationX || 0;
    // Allow both left and right swipes
    translateX.setValue(translationX);
  };

  const onHandlerStateChange = (event: any) => {
    const { translationX, state } = event.nativeEvent || {};
    if (typeof translationX !== "number") {
      return;
    }
    
    if (state === State.END) {
      // Determine swipe direction and threshold
      const threshold = 50;
      
      if (translationX > threshold) {
        // Swipe right - show reply option
        handleSwipeGesture({ direction: 'right', translationX }, item);
      } else if (translationX < -threshold) {
        // Swipe left - show more options
        handleSwipeGesture({ direction: 'left', translationX }, item);
      }
      
      // Reset position
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const playAudio = async (uri: string) => {
    try {
      // If currently playing, pause
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }

      // If sound is loaded and not playing, resume
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }

      // If not loaded, load and play
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            sound.setPositionAsync(0); // Reset for replay
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      Alert.alert("Error", "Failed to play voice note");
    }
  };

  const parsedMessage = item.text ? parsePostCommentMessage(item.text) : { isPostComment: false, text: "" };
  if (parsedMessage.isPostComment && parsedMessage.postData) {
    parsedMessage.postData.image = parsedMessage.postData.image || "";
    parsedMessage.postData.caption = parsedMessage.postData.caption || "";
  }
  const isSender = item.sender && user && item.sender._id === user.id;

  if (!user) return null;

  return (
    <PanGestureHandler
      ref={panRef}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-30, 30]}
      activeOffsetY={[-100, 100]}
      simultaneousHandlers={flatListRef}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => onLongPress && onLongPress(item)}
          onPress={() => {
            // Handle tap for media items
            if (item.image && !item.text) {
              setModalImageIndex(0);
              setShowImageModal(true);
            } else if (item.video && !item.text) {
              setShowVideoModal(true);
            }
          }}
          delayLongPress={300}
        >
          <View
            style={[
              styles.messageBubble,
              isSender
                ? { alignSelf: 'flex-end', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 4, borderBottomLeftRadius: 18, backgroundColor: colors.senderBubble }
                : { alignSelf: 'flex-start', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 4, backgroundColor: colors.receiverBubble },
              {
                opacity: item.isDraft ? 0.7 : 1,
                borderColor: selectedMessage && selectedMessage.id === item.id ? colors.chatroom.primary : "transparent",
                borderWidth: selectedMessage && selectedMessage.id === item.id ? 2 : 0,
              },
            ]}
          >
            {/* Reply preview */}
            {item.replyTo && (
              <View style={{
                backgroundColor: colors.replyPreview,
                borderLeftWidth: 4,
                borderLeftColor: colors.iconFg,
                borderRadius: 8,
                padding: 6,
                marginBottom: 4
              }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: isSender ? colors.senderText : colors.receiverText,
                    opacity: 0.6,
                    fontStyle: 'italic'
                  }}
                >
                  {String(item.replyTo.text || '📷 Image')}
                </Text>
              </View>
            )}

            {/* Display existing media in chat history */}
            {item.image && (
              <TouchableOpacity 
                onPress={() => { setModalImageIndex(0); setShowImageModal(true); }}
                activeOpacity={0.8}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <Image source={{ uri: item.image }} style={styles.messageImage} />
              </TouchableOpacity>
            )}
            
            {item.video && (
              <TouchableOpacity 
                onPress={() => setShowVideoModal(true)}
                activeOpacity={0.8}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <View style={{ position: "relative" }}>
                  <Video
                    source={{ uri: item.video }}
                    style={[styles.messageVideo, { borderRadius: 8 }]}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    useNativeControls={false}
                    isLooping={false}
                  />
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
                    <Play size={20} color="#fff" style={{ opacity: 0.8 }} />
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Display multiple media files in grid */}
            {item.images && item.images.length > 0 && (
              <View style={styles.multipleMediaGrid}>
                {item.images.map((image, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => { setModalImageIndex(index); setShowImageModal(true); }}
                    activeOpacity={0.8}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <View style={styles.mediaGridItem}>
                      <Image source={{ uri: image }} style={styles.multipleMediaImage} />
                      <TouchableOpacity
                        style={styles.downloadButton}
                        onPress={() => handleDownloadMedia(image, 'image')}
                      >
                        <Download size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {item.videos && item.videos.length > 0 && (
              <View style={styles.multipleMediaGrid}>
                {item.videos.map((video, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => { setModalVideoIndex(index); setShowVideoModal(true); }}
                    activeOpacity={0.8}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <View style={styles.mediaGridItem}>
                      <Video
                        source={{ uri: video }}
                        style={styles.multipleMediaVideo}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        useNativeControls={false}
                        isLooping={false}
                      />
                      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
                        <Play size={16} color="#fff" style={{ opacity: 0.8 }} />
                      </View>
                      <TouchableOpacity
                        style={styles.downloadButton}
                        onPress={() => handleDownloadMedia(video, 'video')}
                      >
                        <Download size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Audio messages */}
            {item.audio && (
              <View style={[
                styles.voiceNoteBubble,
                { backgroundColor: isSender ? colors.senderBubble : colors.receiverBubble },
              ]}>
                {/* Play/Pause Button */}
                <TouchableOpacity
                  style={styles.voiceNotePlayButton}
                  onPress={() => playAudio(item.audio!)}
                  activeOpacity={0.7}
                >
                  {isPlaying ? (
                    <Pause size={22} color={isSender ? colors.primary : colors.icon} />
                  ) : (
                    <Play size={22} color={isSender ? colors.primary : colors.icon} />
                  )}
                </TouchableOpacity>
                {/* Waveform (seekable) */}
                <VoiceNoteWaveform
                  audioUri={item.audio!}
                  isPlaying={isPlaying}
                  color={isSender ? colors.primary : colors.icon}
                  backgroundColor={isSender ? colors.senderBubble : colors.receiverBubble}
                  height={28}
                  width={120}
                  showProgress
                  // Add onSeek, progress, duration props as needed
                />
                {/* Duration */}
                <Text style={styles.voiceNoteDuration}>{item.duration || '0:00'}</Text>
              </View>
            )}

            {/* Multiple audio files */}
            {item.audios && item.audios.length > 0 && (
              <View style={{ gap: 8 }}>
                {item.audios.map((audio, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => playAudio(audio)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <View style={styles.audioGridItem}>
                      <View style={[styles.audioPreview, { backgroundColor: colors.iconBg }]}>
                        {isPlaying ? (
                          <Pause size={20} color={colors.iconFg} />
                        ) : (
                          <Play size={20} color={colors.iconFg} />
                        )}
                      </View>
                      <View style={styles.audioInfo}>
                        <VoiceNoteWaveform isPlaying={isPlaying} />
                        <Text style={[styles.audioText, { color: isSender ? colors.senderText : colors.receiverText }]}>
                          Voice Note {index + 1}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.downloadButton}
                        onPress={() => handleDownloadMedia(audio, 'audio')}
                      >
                        <Download size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Fallback text for media-only messages */}
            {!item.image && !item.video && item.messageType === "image" && (
              <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText, fontStyle: 'italic' }]}>
                📷 Image
              </Text>
            )}
            {!item.image && !item.video && item.messageType === "video" && (
              <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText, fontStyle: 'italic' }]}>
                🎥 Video
              </Text>
            )}
            {!item.audio && item.messageType === "audio" && (
              <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText, fontStyle: 'italic' }]}>
                🎵 Audio
              </Text>
            )}

            {/* Post Comment Messages */}
            {item.messageType === "post-comment" && item.postData ? (
              <PostCommentPreview
                postData={item.postData}
                comment={item.text || ""}
                colors={colors}
              />
            ) : null}
            
            {/* Text messages */}
            {item.text && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {renderTextWithLinks(item.text || "", isSender ? colors.senderText : colors.receiverText)}
              </View>
            )}
            
            {/* Audio playback for voice notes */}
            {item.audio && (
              <View style={{ marginTop: 4 }}>
                <VoiceNoteWaveform isPlaying={isPlaying} />
              </View>
            )}

            {/* Message timestamp and status */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
              <Text style={[styles.timestamp, { color: isSender ? colors.senderText : colors.receiverText, opacity: 0.7 }]}>
                {item.timestamp}
              </Text>
              {isSender && (
                <Text style={[styles.timestamp, { color: isSender ? colors.senderText : colors.receiverText, opacity: 0.7, marginLeft: 4 }]}>
                  {getMessageTick(item)}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Image Modal */}
        <Modal
          visible={showImageModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImageModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowImageModal(false)}>
            <View style={styles.mediaModalContainer}>
              <TouchableOpacity
                style={styles.mediaModalClose}
                onPress={() => setShowImageModal(false)}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mediaModalDownload}
                onPress={() => {
                  const images = item.images || [item.image];
                  if (images[modalImageIndex]) {
                    handleDownloadMedia(images[modalImageIndex], 'image');
                  }
                }}
              >
                <Download size={24} color="#fff" />
              </TouchableOpacity>
              <Image
                source={{ uri: (item.images || [item.image])[modalImageIndex] }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Video Modal */}
        <Modal
          visible={showVideoModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowVideoModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowVideoModal(false)}>
            <View style={styles.mediaModalContainer}>
              <TouchableOpacity
                style={styles.mediaModalClose}
                onPress={() => setShowVideoModal(false)}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mediaModalDownload}
                onPress={() => {
                  const videos = item.videos || [item.video];
                  if (videos[modalVideoIndex]) {
                    handleDownloadMedia(videos[modalVideoIndex], 'video');
                  }
                }}
              >
                <Download size={24} color="#fff" />
              </TouchableOpacity>
              <Video
                source={{ uri: (item.videos || [item.video!])[modalVideoIndex] }}
                style={styles.fullScreenVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={true}
                useNativeControls={true}
                isLooping={false}
              />
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
    marginTop: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageVideo: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "#000",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  multipleMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  mediaGridItem: {
    position: 'relative',
    marginBottom: 6,
  },
  multipleMediaImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  multipleMediaVideo: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#000",
  },
  downloadButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 8,
    width: 200,
  },
  audioPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  audioInfo: {
    flex: 1,
    alignItems: 'center',
  },
  audioText: {
    fontSize: 12,
    marginTop: 2,
  },
  mediaModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalClose: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
  },
  mediaModalDownload: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  fullScreenImage: {
    width: '90%',
    height: '70%',
    borderRadius: 12,
  },
  fullScreenVideo: {
    width: '90%',
    height: 300,
    borderRadius: 12,
  },
  voiceNoteBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 4,
    marginBottom: 4,
    width: 'auto', // Allow bubble to grow with content
    minWidth: 200, // Minimum width for the bubble
  },
  voiceNotePlayButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 10,
  },
  voiceNoteDuration: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 10,
  },
}); 