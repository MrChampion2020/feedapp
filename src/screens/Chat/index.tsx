import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Share,
  Clipboard,
  Animated,
  TouchableWithoutFeedback,
  Pressable,
  ScrollView,
  RefreshControl,
  useColorScheme,
  Keyboard,
  Easing,
  AppState,
  ToastAndroid,
  ImageBackground
} from "react-native";
import { PanGestureHandler, State, GestureHandlerRootView } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RootStackParamList } from "../../types/navigation";
import {
  ArrowLeft,
  UserPlus,
  UserCheck,
  Send,
  X,
  Reply,
  Paperclip,
  Image as ImageIcon,
  Camera,
  ArrowDown,
  Mic,
  Video as VideoIcon,
  Trash2,
  Pause,
  Play,
  Music2,
  MoreVertical,
  Edit,
  Download,
  Info,
  Copy,
  Share2,
  ChevronDown,
  Star,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Audio, Video, ResizeMode } from "expo-av";
import { Linking } from "react-native";
import io, { Socket } from "socket.io-client";
import { api, API_URL } from '../../contexts/AuthContext';
import VerifiedBadge from "../../components/VerifiedBadge";
import { getUserVerificationStatus } from "../../utils/userUtils";
import SuccessNotification from "../../components/SuccessNotification";

type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">;

interface ChatItem {
  id: string;
  name: string;
  fullName: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface Message {
  id: string;
  text?: string;
  image?: string;
  audio?: string;
  video?: string;
  images?: string[]; // Multiple images
  videos?: string[]; // Multiple videos
  audios?: string[]; // Multiple audios
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
  sender: { _id: string; username: string; fullName: string; profilePicture?: string };
  timestamp: string;
  replyTo?: Message;
  postData?: {
    image: string;
    caption: string;
    timestamp: string;
  };
  isDraft?: boolean; // for local draft preview
  isRead?: boolean; // Add read status from database
  createdAt?: string; // Add creation date for grouping
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const URL_REGEX =
  /(https?:\/\/www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;

const getEmojiFromName = (name: string) => {
  const firstLetter = name.charAt(0).toUpperCase();
  const emojiMap: { [key: string]: string } = {
    A: "😀", B: "😂", C: "😊", D: "👍", E: "❤️", F: "😎", G: "🎉", H: "🌟", I: "🌈",
    J: "💡", K: "🔥", L: "🌹", M: "🎶", N: "🌍", O: "🚀", P: "💕", Q: "🌺", R: "🎵",
    S: "🌞", T: "🍎", U: "🌴", V: "🐱", W: "🐶", X: "🐼", Y: "🐰", Z: "🐸",
  };
  return emojiMap[firstLetter] || "👤";
};

const parsePostCommentMessage = (text: string) => {
  if (!text) return { isPostComment: false, text };

  // Try multiple patterns for comment messages
  const patterns = [
    // Pattern 1: [img]URL[/img][faint]details[/faint]Comment: text
    {
      imgMatch: text.match(/\[img\](.*?)\[\/img\]/),
      faintMatch: text.match(/\[faint\](.*?)\[\/faint\]/),
      commentMatch: text.match(/Comment: (.*)/)
    },
    // Pattern 2: Comment on post with image URL directly
    {
      imgMatch: text.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i),
      faintMatch: text.match(/Post: (.*?)(?=Comment:|$)/),
      commentMatch: text.match(/Comment: (.*)/)
    },
    // Pattern 3: Just look for image URLs in comment messages
    {
      imgMatch: text.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i),
      faintMatch: text.match(/\[faint\](.*?)\[\/faint\]/),
      commentMatch: text.match(/Comment: (.*)/)
    }
  ];

  for (const pattern of patterns) {
    if (pattern.imgMatch && pattern.commentMatch) {
      const imageUrl = pattern.imgMatch[1];
      const comment = pattern.commentMatch[1];
      let caption = "Post";
      let timestamp = "2 days ago";

      if (pattern.faintMatch) {
        const postDetails = pattern.faintMatch[1];
        const parts = postDetails.split(" (");
        caption = parts[0];
        timestamp = parts[1] ? parts[1].replace(")", "") : "2 days ago";
      }

      console.log("🔍 Parsed comment message:", { imageUrl, caption, comment, timestamp });

      return {
        isPostComment: true,
        postData: {
          image: imageUrl,
          caption: caption,
          timestamp: timestamp,
        },
        comment: comment,
      };
    }
  }

  return { isPostComment: false, text };
};

const PostCommentPreview = ({
  postData,
  comment,
  colors,
}: {
  postData: any;
  comment: string;
  colors: any;
}) => {
  console.log("🖼️ Rendering PostCommentPreview:", { postData, comment });
  
  return (
    <View style={{backgroundColor: colors.commentCard, borderRadius: 12, padding: 10, marginVertical: 4}}>
      <View style={styles.postPreviewContainer}>
        {postData.image ? (
          <Image 
            source={{ uri: postData.image }} 
            style={styles.postPreviewImage as any}
            onError={(error) => console.log("❌ Image load error:", error)}
            onLoad={() => console.log("✅ Image loaded successfully:", postData.image)}
          />
        ) : (
          <View style={[styles.postPreviewImage, { backgroundColor: colors.chatroom.border, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: colors.chatroom.secondary, fontSize: 12 }}>No Image</Text>
          </View>
        )}
        <View style={[styles.postDetailsContainer, { backgroundColor: colors.chatroom.com }]}>
          <Text style={[styles.postLabel, { color: colors.chatroom.headerText }]}>Post:</Text>
          <Text style={[styles.postCaption, { color: colors.chatroom.headerText }]} numberOfLines={1}>
            {postData.caption}
          </Text>
          <Text style={[styles.postTimestamp, { color: colors.chatroom.secondary }]}>{postData.timestamp}</Text>
        </View>
      </View>
      <View style={[styles.commentContainer, { backgroundColor: colors.chatroom.rec }]}>
        <Text style={[styles.commentLabel, { color: colors.chatroom.text }]}>Comment: </Text>
        <Text style={[styles.commentText, { color: colors.chatroom.text }]}>{comment}</Text>
      </View>
    </View>
  );
};

// Voice note waveform component
const VoiceNoteWaveform = ({ 
  isPlaying = false, 
  isRecording = false, 
  color = "#25D366", 
  height = 24, 
  width = 120 
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (isPlaying || isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    } else {
      anim.setValue(0);
    }
  }, [isPlaying, isRecording]);

  const barHeights = [6, 12, 18, 12, 6, 10, 16, 10, 6];
  
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height, width }}>
      {barHeights.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            marginHorizontal: 1,
            height: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [h, h + (isPlaying || isRecording ? 6 : 0)],
            }),
            backgroundColor: color,
            borderRadius: 2,
            opacity: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1],
            }),
          }}
        />
      ))}
    </View>
  );
};

const MessageItem = React.memo(({
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
}: {
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
}) => {
  // Download media functionality
  const handleDownloadMedia = async (uri: string, type: 'image' | 'video' | 'audio') => {
    try {
      // For now, we'll use the Share API to allow users to save media
      // In a real app, you'd implement proper file download to device storage
      const fileName = `feeda_${type}_${Date.now()}.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'm4a'}`;
      
      await Share.share({
        url: uri,
        title: `Feeda ${type}`,
        message: `Sharing ${type} from Feeda chat`,
      });
      
      // Show success notification (you might want to pass this as a prop)
      console.log(`${type} shared successfully`);
    } catch (error) {
      console.error('Failed to share media:', error);
      Alert.alert('Error', 'Failed to share media');
    }
  };
  if (!user) return null;
  const translateX = useRef(new Animated.Value(0)).current;
  const panRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [modalVideoIndex, setModalVideoIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  // For audio URIs and existing media
  const audioUri = item.audio || "";

  const onGestureEvent = (event: any) => {
    const translationX = event.nativeEvent.translationX || 0;
    if (translationX >= 0) {
      translateX.setValue(translationX);
    } else {
      translateX.setValue(0);
    }
  };

  const onHandlerStateChange = (event: any) => {
    const { translationX, state } = event.nativeEvent || {};
    if (typeof translationX !== "number") {
      return;
    }
    if (translationX < 0) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (state === State.END && translationX > 50) {
      handleSwipeGesture(event, item);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else if (state === State.END) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const playAudio = async (uri: string) => {
    try {
      console.log("🎵 Attempting to play audio with URI:", uri);
      
      if (isPlaying) {
        console.log("⏹ Stopping current audio playback");
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
        setIsPlaying(false);
        return;
      }

      // Clean up any existing sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      console.log("🔧 Creating audio sound object...");
      // Create and load the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        (status) => {
          console.log("📊 Audio status update:", status);
          if (status.isLoaded) {
            if (status.didJustFinish) {
              console.log("✅ Audio finished playing");
              setIsPlaying(false);
            }
          } else if (status.error) {
            console.error('❌ Audio playback error:', status.error);
            const errorMessage = typeof status.error === 'string' ? status.error : 'Unknown error occurred';
            Alert.alert("Error", `Failed to play voice note: ${errorMessage}`);
            setIsPlaying(false);
          }
        }
      );

      soundRef.current = sound;
      console.log("▶️ Starting audio playback...");
      setIsPlaying(true);
      await sound.playAsync();
      console.log("🎉 Audio playback started successfully");
    } catch (error) {
      console.error('❌ Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert("Error", `Failed to play voice note: ${errorMessage}`);
      setIsPlaying(false);
    }
  };

  // For parsePostCommentMessage fallback
  const parsedMessage = item.text ? parsePostCommentMessage(item.text) : { isPostComment: false, text: "" };
  if (parsedMessage.isPostComment && parsedMessage.postData) {
    parsedMessage.postData.image = parsedMessage.postData.image || "";
    parsedMessage.postData.caption = parsedMessage.postData.caption || "";
  }
  const isSender = item.sender._id === user?.id;

  // --- Menu Handlers ---
  const handleMenuPress = () => setShowMenu(true);
  const handleMenuClose = () => setShowMenu(false);
  const handleEdit = () => { setShowMenu(false); Alert.alert("Edit", "Edit message (not implemented)"); };
  const handleDelete = () => { setShowMenu(false); Alert.alert("Delete", "Delete message (not implemented)"); };
  const handleForward = () => { setShowMenu(false); Alert.alert("Forward", "Forward message (not implemented)"); };
  const handleInfo = () => { setShowMenu(false); Alert.alert("Info", `Sent: ${item.timestamp}`); };

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
          onPress={() => onLongPress && onLongPress(item)}
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
                <Image source={{ uri: item.image }} style={styles.messageImage as any} />
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
                {item.images.map((imageUri, index) => (
                  <View key={index} style={styles.mediaGridItem}>
                    <TouchableOpacity 
                      onPress={() => { setModalImageIndex(index); setShowImageModal(true); }}
                      activeOpacity={0.8}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Image source={{ uri: imageUri }} style={styles.multipleMediaImage as any} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={() => handleDownloadMedia(imageUri, 'image')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Download size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            {item.videos && item.videos.length > 0 && (
              <View style={styles.multipleMediaGrid}>
                {item.videos.map((videoUri, index) => (
                  <View key={index} style={styles.mediaGridItem}>
                    <TouchableOpacity 
                      onPress={() => { setModalVideoIndex(index); setShowVideoModal(true); }}
                      activeOpacity={0.8}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <View style={{ position: "relative" }}>
                        <Video
                          source={{ uri: videoUri }}
                          style={styles.multipleMediaVideo as any}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                          useNativeControls={false}
                          isLooping={false}
                        />
                        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
                          <Play size={16} color="#fff" style={{ opacity: 0.8 }} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={() => handleDownloadMedia(videoUri, 'video')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Download size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            {item.audios && item.audios.length > 0 && (
              <View style={styles.multipleMediaGrid}>
                {item.audios.map((audioUri, index) => (
                  <View key={index} style={styles.mediaGridItem}>
                    <TouchableOpacity 
                      onPress={() => playAudio(audioUri)} 
                      style={styles.audioGridItem}
                      activeOpacity={0.7}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <View style={[styles.audioPreview, { backgroundColor: colors.primary }]}>
                        <Music2 size={20} color="white" />
                      </View>
                      <View style={styles.audioInfo}>
                        <VoiceNoteWaveform 
                          isPlaying={isPlaying} 
                          color={colors.chatroom.primary} 
                          height={16} 
                          width={32} 
                        />
                        <Text style={[styles.audioText, { color: isSender ? colors.senderText : colors.receiverText }]}> 
                          Audio {index + 1}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={() => handleDownloadMedia(audioUri, 'audio')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Download size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            {/* Media indicators for new messages without media URIs */}
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
            {item.messageType === "audio" && audioUri ? (
              <TouchableOpacity 
                onPress={() => playAudio(audioUri)} 
                style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}
                activeOpacity={0.7}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <VoiceNoteWaveform 
                  isPlaying={isPlaying} 
                  color={colors.chatroom.primary} 
                  height={18} 
                  width={40} 
                />
                <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText, marginLeft: 8 }]}> 
                  {isPlaying ? "⏹ Stop Voice Note" : "▶️ Play Voice Note"} 
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Image Modal for existing images */}
            <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => setShowImageModal(false)}>
              <TouchableWithoutFeedback onPress={() => setShowImageModal(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
                  {(() => {
                    const images = item.images || (item.image ? [item.image] : []);
                    const currentImage = images[modalImageIndex];
                    
                    if (!currentImage) return null;
                    
                    return (
                      <View style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                        <Image 
                          source={{ uri: currentImage }} 
                          style={{ width: "90%", height: "70%", borderRadius: 12 }} 
                          resizeMode="contain" 
                        />
                        {images.length > 1 && (
                          <View style={{ 
                            position: 'absolute', 
                            bottom: 50, 
                            flexDirection: 'row', 
                            gap: 10,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            padding: 10,
                            borderRadius: 20
                          }}>
                            <TouchableOpacity 
                              onPress={() => setModalImageIndex(Math.max(0, modalImageIndex - 1))}
                              disabled={modalImageIndex === 0}
                              style={{ opacity: modalImageIndex === 0 ? 0.5 : 1 }}
                            >
                              <Text style={{ color: 'white', fontSize: 18 }}>‹</Text>
                            </TouchableOpacity>
                            <Text style={{ color: 'white', fontSize: 14 }}>
                              {modalImageIndex + 1} / {images.length}
                            </Text>
                            <TouchableOpacity 
                              onPress={() => setModalImageIndex(Math.min(images.length - 1, modalImageIndex + 1))}
                              disabled={modalImageIndex === images.length - 1}
                              style={{ opacity: modalImageIndex === images.length - 1 ? 0.5 : 1 }}
                            >
                              <Text style={{ color: 'white', fontSize: 18 }}>›</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* Video Modal for existing videos */}
            <Modal visible={showVideoModal} transparent animationType="fade" onRequestClose={() => setShowVideoModal(false)}>
              <TouchableWithoutFeedback onPress={() => setShowVideoModal(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
                  {(() => {
                    const videos = item.videos || (item.video ? [item.video] : []);
                    const currentVideo = videos[modalVideoIndex];
                    
                    if (!currentVideo) return null;
                    
                    return (
                      <View style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                        <Video
                          source={{ uri: currentVideo }}
                          style={{ width: "90%", height: 300, borderRadius: 12 }}
                          resizeMode={ResizeMode.CONTAIN}
                          shouldPlay
                          useNativeControls
                        />
                        {videos.length > 1 && (
                          <View style={{ 
                            position: 'absolute', 
                            bottom: 50, 
                            flexDirection: 'row', 
                            gap: 10,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            padding: 10,
                            borderRadius: 20
                          }}>
                            <TouchableOpacity 
                              onPress={() => setModalVideoIndex(Math.max(0, modalVideoIndex - 1))}
                              disabled={modalVideoIndex === 0}
                              style={{ opacity: modalVideoIndex === 0 ? 0.5 : 1 }}
                            >
                              <Text style={{ color: 'white', fontSize: 18 }}>‹</Text>
                            </TouchableOpacity>
                            <Text style={{ color: 'white', fontSize: 14 }}>
                              {modalVideoIndex + 1} / {videos.length}
                            </Text>
                            <TouchableOpacity 
                              onPress={() => setModalVideoIndex(Math.min(videos.length - 1, modalVideoIndex + 1))}
                              disabled={modalVideoIndex === videos.length - 1}
                              style={{ opacity: modalVideoIndex === videos.length - 1 ? 0.5 : 1 }}
                            >
                              <Text style={{ color: 'white', fontSize: 18 }}>›</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: isSender ? 'flex-end' : 'flex-start',
              marginTop: 4
            }}>
              {isSender && (() => {
                const status = getMessageTick(item);
                let tickColor = isSender ? colors.senderText : '#999';
                if (status === "✓✓" && messageStatus[item.id] === "read") {
                  tickColor = '#25D366'; // green double tick for read
                }
                return (
                  <Text style={[styles.timestamp, { color: tickColor, marginRight: 4, fontSize: 11 }]}>{status}</Text>
                );
              })()}
              <Text style={[styles.timestamp, { 
                color: isSender ? colors.senderText : colors.receiverText,
                opacity: 0.7,
                fontSize: 11
              }]}> 
                {item.timestamp}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
});

const SOCKET_URL = API_URL.replace(/\/api$/, '');

// Add message grouping utility with unread support - Optimized version
const groupMessagesByDate = (messages: Message[] = [], userId?: string) => {
  const groups: { [key: string]: Message[] } = {};
  if (!Array.isArray(messages) || messages.length === 0) return groups;
  
  // Use a more efficient approach with Map for better performance
  const groupMap = new Map<string, Message[]>();
  
  // Pre-calculate dates for better performance
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayString = today.toDateString();
  const yesterdayString = yesterday.toDateString();
  
  // Separate unread and read messages in one pass
  const unreadMessages: Message[] = [];
  const readMessages: Message[] = [];
  
  for (const message of messages) {
    if (message.sender._id !== userId && !message.isRead) {
      unreadMessages.push(message);
    } else {
      readMessages.push(message);
    }
  }
  
  // Group unread messages if any exist
  if (unreadMessages.length > 0) {
    groupMap.set('Unread Messages', unreadMessages);
  }
  
  // Group read messages by date with optimized date checking
  for (const message of readMessages) {
    const date = message.createdAt ? new Date(message.createdAt) : new Date();
    const dateString = date.toDateString();
    
    let dateKey: string;
    if (dateString === todayString) {
      dateKey = 'Today';
    } else if (dateString === yesterdayString) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, []);
    }
    groupMap.get(dateKey)!.push(message);
  }
  
  // Convert Map back to object
  return Object.fromEntries(groupMap);
};

// Date separator component with unread support
const DateSeparator = ({ date, colors, isUnread = false }: { date: string; colors: any; isUnread?: boolean }) => (
  <View style={[styles.dateSeparator, isUnread && styles.unreadSeparator]}>
    <View style={[styles.dateLine, { backgroundColor: isUnread ? colors.primary : colors.chatroom.border }]} />
    <Text style={[
      styles.dateText, 
      { 
        color: isUnread ? colors.primary : colors.chatroom.secondary,
        fontWeight: isUnread ? 'bold' : '500'
      }
    ]}>
      {date ? String(date) : ''}
    </Text>
    <View style={[styles.dateLine, { backgroundColor: isUnread ? colors.primary : colors.chatroom.border }]} />
  </View>
);

const ChatScreen = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { user, token, api } = useAuth();
  const { colors } = useTheme();
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [drafts, setDrafts] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const flatListRef = useRef<FlatList<any>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const isAtBottom = useRef(true);
  const recording = useRef<Audio.Recording | null>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const colorScheme = useColorScheme();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<{id: string, username: string, fullName: string}[]>([]);
  const [messageStatus, setMessageStatus] = useState<{[key: string]: string}>({}); // { messageId: 'sent'|'delivered'|'read' }
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const isStoppingRef = useRef(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionsMessage, setActionsMessage] = useState<Message | null>(null);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecordingUser, setVoiceRecordingUser] = useState<{username: string, fullName: string} | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [forwardSelected, setForwardSelected] = useState<string[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [messageInfo, setMessageInfo] = useState<any>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const [showMenu, setShowMenu] = useState(false);

  // Add error state for better error handling
  const [chatError, setChatError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  
  // Add missing state variables
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [actionsY, setActionsY] = useState(0);
  const actionsAnim = useRef(new Animated.Value(0)).current;

  // --- Keyboard Handling ---
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
      // Scroll to bottom when keyboard appears
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, []);

  // --- App State Handling ---
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // App has come to foreground - reset any height adjustments
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        
        // Force layout recalculation
        setTimeout(() => {
          // Force a re-render by updating a state
          setKeyboardHeight(prev => prev);
          
          // Ensure FlatList is properly positioned
          if (activeChat && flatListRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
          
          // Additional delay for layout stabilization
          setTimeout(() => {
            if (activeChat && flatListRef.current) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }, 200);
        }, 100);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is going to background - clear keyboard state
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [activeChat]);



  // --- Layout Stabilization ---
  useEffect(() => {
    // Force layout recalculation when activeChat changes
    if (activeChat) {
      const timer = setTimeout(() => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        
        // Ensure proper scroll position
        if (flatListRef.current) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [activeChat]);



  // --- Media Pickers and Recording ---
  const handleImagePicker = async () => {
    if (!user) return;
    setShowAttachmentModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: true, // Enable multiple selection
        selectionLimit: 10, // Allow up to 10 media files
      });
      if (!result.canceled && result.assets.length > 0) {
        // Process all selected assets
        result.assets.forEach((asset) => {
          const isVideo = asset.mimeType?.startsWith('video') || asset.uri.toLowerCase().includes('.mp4') || asset.uri.toLowerCase().includes('.mov');
          
          // Add to drafts - don't auto-send
          addDraft({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Unique ID
            image: isVideo ? undefined : asset.uri,
            video: isVideo ? asset.uri : undefined,
            messageType: isVideo ? "video" : "image",
            sender: {
              _id: user.id,
              username: user.username,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isDraft: true,
          });
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleCameraPicker = async () => {
    if (!user) return;
    setShowAttachmentModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera permissions.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        // Add to drafts - don't auto-send
        addDraft({
          id: Date.now().toString(),
          image: result.assets[0].uri,
          messageType: "image",
          sender: {
            _id: user.id,
            username: user.username,
            fullName: user.fullName,
            profilePicture: user.profilePicture,
          },
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isDraft: true,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const handleVideoPicker = async () => {
    if (!user) return;
    setShowAttachmentModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true, // Enable multiple selection
        selectionLimit: 5, // Allow up to 5 videos
      });
      if (!result.canceled && result.assets.length > 0) {
        // Process all selected videos
        result.assets.forEach((asset) => {
          addDraft({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Unique ID
            video: asset.uri,
            messageType: "video",
            sender: {
              _id: user.id,
              username: user.username,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isDraft: true,
          });
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick video");
    }
  };

  const handleVideoRecording = async () => {
    if (!user) return;
    setShowAttachmentModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera permissions.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        // Add to drafts - don't auto-send
        addDraft({
          id: Date.now().toString(),
          video: result.assets[0].uri,
          messageType: "video",
          sender: {
            _id: user.id,
            username: user.username,
            fullName: user.fullName,
            profilePicture: user.profilePicture,
          },
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isDraft: true,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to record video");
    }
  };

  const handleAudioPicker = async () => {
    if (!user) return;
    setShowAttachmentModal(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true, // Enable multiple selection
        selectionLimit: 5, // Allow up to 5 audio files
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Process all selected assets
        result.assets.forEach((asset) => {
          // Check if the selected file is an audio file (by extension only)
          const isAudio = asset.uri.toLowerCase().includes('.mp3') ||
                         asset.uri.toLowerCase().includes('.m4a') ||
                         asset.uri.toLowerCase().includes('.wav') ||
                         asset.uri.toLowerCase().includes('.aac') ||
                         asset.uri.toLowerCase().includes('.ogg');
          
          if (isAudio) {
            // Add to drafts - don't auto-send
            addDraft({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Unique ID
              audio: asset.uri,
              messageType: "audio",
              sender: {
                _id: user.id,
                username: user.username,
                fullName: user.fullName,
                profilePicture: user.profilePicture,
              },
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isDraft: true,
            });
          } else {
            Alert.alert("Invalid File", "Please select an audio file (MP3, M4A, WAV, AAC, OGG)");
          }
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick audio");
    }
  };

  // --- Voice Note Controls ---
  const startRecording = async () => {
    handleVoiceRecording(true);
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
      // Use the default high quality preset
      await recordingObject.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingObject.startAsync();
      recording.current = recordingObject;
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      console.log("🎤 Started recording voice note");
    } catch (error) {
      console.error("❌ Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const pauseRecording = async () => {
    try {
      if (recording.current) {
        await recording.current.pauseAsync();
        setRecordingPaused(true);
        if (recordingTimer.current) clearInterval(recordingTimer.current);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pause recording");
    }
  };

  const resumeRecording = async () => {
    try {
      if (recording.current) {
        await recording.current.startAsync();
        setRecordingPaused(false);
        recordingTimer.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to resume recording");
    }
  };

  const stopRecording = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    let tempId = `temp-${Date.now()}`;
    if (!user) {
      isStoppingRef.current = false;
      setIsRecording(false);
      setRecordingPaused(false);
      setRecordingDuration(0);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      return;
    }
    let localMsg: Message;
    localMsg = {
      id: tempId,
      audio: recording.current?.getURI() || "",
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
    try {
      if (recording.current) {
        let uri = null;
        try {
          await recording.current.stopAndUnloadAsync();
          uri = recording.current.getURI();
        } catch (err) {
          console.error('❌ Failed to stop recording:', err);
          Alert.alert('Error', 'Failed to stop recording.');
        }
        if (uri && activeChat && user) {
          let messageType = 'audio';
          const fileType = uri.endsWith('.mp4') ? 'audio/mp4' : 'audio/m4a';
          const fileName = uri.split('/').pop() || 'chat-audio.m4a';
          console.log('Uploading voice note:', { uri, fileType, fileName });
          // Optimistically add local message
          localMsg = {
            id: tempId,
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
          setMessages((prev) => [...prev, localMsg]);
          // Upload
          const formData = new FormData();
          formData.append('messageType', messageType);
          formData.append('media', {
            uri,
            type: fileType,
            name: fileName,
          } as any);
          try {
            const response = await api.post(`/chats/${activeChat.id}`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${token}`,
              },
            });
            // Remove local draft and add real message
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            if (response.data?.chat) {
              setMessages((prev) => [...prev, {
                ...response.data.chat,
                id: response.data.chat._id,
                sender: response.data.chat.sender,
                timestamp: new Date(response.data.chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              }]);
              // Emit via socket for instant delivery
              if (socket) {
                socket.emit("send-message", {
                  ...response.data.chat,
                  id: response.data.chat._id,
                  chatId: activeChat.id,
                });
              }
            }
          } catch (error: any) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            console.error('❌ Failed to upload voice note:', error, error?.response);
            Alert.alert('Voice Note Upload Failed', error.response?.data?.message || error.message);
          }
        }
        recording.current = null;
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording.');
      console.error('❌ Error in stopRecording:', error);
    } finally {
      setIsRecording(false);
      setRecordingPaused(false);
      setRecordingDuration(0);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      isStoppingRef.current = false;
      handleVoiceRecording(false);
    }
  };

  const cancelRecording = () => {
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
    handleVoiceRecording(false);
    console.log("🗑️ Recording cancelled");
  };

  const deleteRecording = () => {
    Alert.alert(
      "Delete Recording",
      "Are you sure you want to delete this recording?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            cancelRecording();
            console.log("🗑️ Recording deleted");
          }
        }
      ]
    );
  };

  // --- Drafts ---
  const addDraft = (draft: Message) => {
    setDrafts((prev) => [...prev, draft]);
  };
  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  // --- Chat Logic ---
  useEffect(() => {
    if (token) fetchChats();
  }, [token]);

  // --- Initial Data Loading ---
  useEffect(() => {
    if (user && token) {
      // Add a small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        fetchChats();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, token]);

  useEffect(() => {
    if (!activeChat || !token) return;
    console.log("🔄 Active chat changed:", activeChat.id, activeChat.name);
    fetchMessages(activeChat.id);
    checkFollowStatus(activeChat.id);
  }, [activeChat, token]);

  const fetchChats = async () => {
    if (!token) {
      console.log("No token available for fetching chats");
      return;
    }
    
    setLoading(true);
    setChatError(null);
    
    try {
      console.log("📱 Fetching chats...");
      
      const response = await api.get("/chats");
      
      console.log("📱 Chats response:", response.status);
      
      const { chats: chatData } = response.data;
      
      // Validate response data
      if (!response.data || !Array.isArray(chatData)) {
        console.error("Invalid chat data format:", response.data);
        setChats([]);
        setChatError("Invalid response format");
        return;
      }
      
      // Handle case where user has no chats yet
      if (chatData.length === 0) {
        console.log("📱 User has no chats yet");
        setChats([]);
        return;
      }
      
      // Safely process chat data
      const sortedChats = chatData
        .filter((chat: any) => chat && typeof chat === 'object') // Filter out invalid chat objects
        .map((chat: ChatItem) => {
          try {
            return {
              id: chat.id || chat._id || '',
              name: chat.name || chat.username || 'Unknown User',
              fullName: chat.fullName || chat.name || 'Unknown User',
              lastMessage: chat.lastMessage || "No messages yet",
              lastMessageTime: chat.lastMessageTime || new Date().toISOString(),
              unreadCount: chat.unreadCount || 0,
              avatar: chat.avatar || getEmojiFromName(chat.name || 'Unknown User'),
            };
          } catch (error) {
            console.error("Error processing chat item:", error, chat);
            return null;
          }
        })
        .filter(Boolean) // Remove null items
        .sort((a: any, b: any) => {
          try {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          } catch (error) {
            console.error("Error sorting chats:", error);
            return 0;
          }
        });
      
      console.log("📱 Processed chats:", sortedChats.length);
      setChats(sortedChats);
    } catch (error: any) {
      console.error("📱 Fetch chats error:", error);
      setChatError(error.response?.data?.message || error.message || "Failed to load chats");
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    if (!token) return;
    setLoading(true);
    
    try {
      console.log("📱 Fetching messages for chat:", chatId);
      
      const response = await api.get(`/chats/${chatId}`);
      
      console.log("📱 Messages response:", response.status);
      
      const { messages: messageData } = response.data;
      
      if (!Array.isArray(messageData)) {
        console.error("Invalid message data format:", messageData);
        setMessages([]);
        return;
      }
      
      // Batch process messages for better performance
      const formattedMessages: Message[] = [];
      const newMessageStatus: {[key: string]: string} = {};
      
      // Process messages in batches to avoid blocking the UI
      const batchSize = 50;
      
      // Limit total messages to prevent memory issues
      const maxMessages = 1000;
      const limitedMessageData = messageData.slice(-maxMessages);
      for (let i = 0; i < limitedMessageData.length; i += batchSize) {
        const batch = limitedMessageData.slice(i, i + batchSize);
        
        batch.forEach((msg: any) => {
          // Only parse post comment messages when needed (lazy parsing)
          let messageType = msg.messageType || "text";
          let postData = undefined;
          
          // Only parse if it looks like a comment message (contains specific patterns)
          if (msg.message && (msg.message.includes('[img]') || msg.message.includes('Comment:'))) {
            const parsedMessage = parsePostCommentMessage(msg.message);
            if (parsedMessage.isPostComment) {
              messageType = "post-comment";
              postData = parsedMessage.postData;
            }
          }
          
          const message: Message = {
            id: msg._id,
            text: msg.message,
            image: msg.image,
            audio: msg.audio,
            video: msg.video,
            messageType,
            sender: msg.sender,
            timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            postData,
            isRead: msg.isRead || false,
            createdAt: msg.createdAt,
          };
          
          formattedMessages.push(message);
          
          // Batch message status updates
          if (message.sender._id === user?.id) {
            if (message.isRead) {
              newMessageStatus[message.id] = 'read';
            } else {
              newMessageStatus[message.id] = 'delivered';
            }
          }
        });
        
        // Allow UI to update between batches
        if (i + batchSize < messageData.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Batch update message status
      setMessageStatus(prev => ({ ...prev, ...newMessageStatus }));
      
      // Find the last read message for positioning
      const lastReadMsg = formattedMessages
        .filter((msg: Message) => msg.sender._id !== user?.id && msg.isRead)
        .pop();
      
      // Find unread messages for smart scrolling
      const unreadMessages = formattedMessages
        .filter((msg: Message) => msg.sender._id !== user?.id && !msg.isRead);
      
      setLastReadMessageId(lastReadMsg?.id || null);
      setMessages(formattedMessages);
      
      // Mark as read in background
      try {
        await api.post(`/chats/${chatId}/mark-as-read`);
        setChats((prev: ChatItem[]) => prev.map((chat: ChatItem) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)));
      } catch {}
      
      // Smart scrolling: Scroll to unread messages if any, otherwise to last read message or bottom
      setTimeout(() => {
        if (unreadMessages.length > 0) {
          // Scroll to first unread message
          const firstUnreadIndex = formattedMessages.findIndex((msg: Message) => msg.id === unreadMessages[0].id);
          if (firstUnreadIndex !== -1) {
            flatListRef.current?.scrollToIndex({
              index: firstUnreadIndex,
              animated: true,
              viewPosition: 0.3, // Show more messages above the unread section
            });
          }
        } else if (lastReadMsg && !isAtBottom.current) {
          const lastReadIndex = formattedMessages.findIndex((msg: Message) => msg.id === lastReadMsg.id);
          if (lastReadIndex !== -1) {
            flatListRef.current?.scrollToIndex({
              index: lastReadIndex,
              animated: true,
              viewPosition: 0.8, // Show some messages below
            });
          }
        } else {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
        setUnreadCount(0);
      }, 100);
    } catch (error: any) {
      console.error("📱 Fetch messages error:", error);
      // Silently handle errors - don't show error messages
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async (userId: string) => {
    if (!user || !token) return;
    try {
      const response = await api.post(`/users/${userId}/is-following`, {
        followerId: user.id,
      });
      setIsFollowing(response.data.isFollowing);
    } catch {}
  };

  // --- Socket.IO Setup ---
  useEffect(() => {
    try {
      console.log("🔌 Attempting to connect to socket:", SOCKET_URL);
      
      // Add additional safety checks
      if (!SOCKET_URL || SOCKET_URL === 'undefined') {
        console.error("🔌 Invalid SOCKET_URL:", SOCKET_URL);
        setSocketError("Invalid socket URL configuration");
        return;
      }
      
      const s: Socket = io(SOCKET_URL, { 
        transports: ["websocket"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true, // Force new connection to avoid stale connections
        autoConnect: true
      });
      
      setSocket(s);
      
      // Socket connection events
      s.on("connect", () => {
        console.log("🔌 Socket connected successfully");
        setSocketError(null);
        if (user) {
          s.emit("login", user.id);
          console.log("🔌 User logged in via socket:", {
            userId: user.id,
            username: user.username,
            fullName: user.fullName
          });
        }
      });
      
      s.on("connect_error", (error) => {
        console.error("🔌 Socket connection error:", error);
        setSocketError("Socket connection failed");
      });
      
      s.on("disconnect", (reason) => {
        console.log("🔌 Socket disconnected:", reason);
        if (reason === "io server disconnect") {
          // Server disconnected, try to reconnect
          s.connect();
        }
      });
      
      s.on("online-users", (users) => {
        try {
          setOnlineUsers(users);
        } catch (error) {
          console.error("Error processing online users:", error);
        }
      });
      
      return () => { 
        console.log("🔌 Cleaning up socket connection");
        s.disconnect(); 
      };
    } catch (error) {
      console.error("🔌 Error setting up socket:", error);
      setSocketError("Failed to setup socket connection");
    }
  }, [user]);

  // Join chat room and listen for events
  useEffect(() => {
    if (!socket || !activeChat) return;
    
    // CRITICAL FIX: Clear typing indicator when changing chats
    handleTyping(false);
    
    socket.emit("join-chat", activeChat.id);
    
    // Clear previous typing and voice recording states when changing chats
    setTypingUsers([]);
    setIsVoiceRecording(false);
    setVoiceRecordingUser(null);
    
    socket.on("typing", (data: { chatId: string, typing: {id: string, username: string, fullName: string}[] }) => {
      try {
        const { chatId, typing } = data;
        if (chatId === activeChat.id) {
          // Filter out current user from typing display - only show other users typing
          const otherTypingUsers = typing.filter(typingUser => {
            const typingUserId = String(typingUser.id);
            const currentUserId = String(user?.id);
            return typingUserId !== currentUserId;
          });
          setTypingUsers(otherTypingUsers);
        }
      } catch (error) {
        console.error("Error handling typing event:", error);
      }
    });
    socket.on("voice-recording", (data: { chatId: string, userId: string, username: string, fullName: string, isRecording: boolean }) => {
      // Only show voice recording indicator if it's from another user
      if (data.chatId === activeChat.id && data.userId !== user?.id) {
        setIsVoiceRecording(data.isRecording);
        if (data.isRecording) {
          setVoiceRecordingUser({
            username: data.username || data.fullName || 'User',
            fullName: data.fullName || data.username || 'User'
          });
        } else {
          setVoiceRecordingUser(null);
        }
      }
    });
    
    socket.on("new-message", (msg: Message & { chatId?: string }) => {
      try {
        if (msg.chatId === activeChat.id || msg.sender._id === activeChat.id) {
          setMessages((prev) => {
            // Avoid duplicate messages
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Scroll to bottom when new message arrives
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } catch (error) {
        console.error("Error handling new message event:", error);
      }
    });
    socket.on("message-status", (data: { messageId: string, status: string }) => {
      const { messageId, status } = data;
      setMessageStatus((prev) => ({ ...prev, [messageId]: status }));
    });
    return () => {
      socket.off("typing");
      socket.off("voice-recording");
      socket.off("new-message");
      socket.off("message-status");
      // CRITICAL FIX: Clear typing indicator when unmounting
      handleTyping(false);
      // Clear states when unmounting
      setTypingUsers([]);
      setIsVoiceRecording(false);
      setVoiceRecordingUser(null);
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, activeChat]);

  // Enhanced typing indicator handler with multiple filtering layers
  const handleTyping = (isTyping: boolean) => {
    if (socket && activeChat && user) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Ensure we have valid user data
      const username = user.username || user.fullName || 'User';
      const fullName = user.fullName || user.username || 'User';
      const typingData = { 
        chatId: activeChat.id, 
        userId: user.id, 
        username: username,
        fullName: fullName,
        isTyping 
      };
      socket.emit("typing", typingData);
      // Don't show typing indicator for current user locally
      if (!isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers([]);
        }, 2000); // Clear after 2 seconds of no typing
      }
    }
  };

  // Enhanced voice recording indicator with filtering
  const handleVoiceRecording = (isRecording: boolean) => {
    if (socket && activeChat && user) {
      const voiceData = { 
        chatId: activeChat.id, 
        userId: user.id, 
        username: user.username,
        fullName: user.fullName,
        isRecording 
      };
      console.log("🎤 Sending voice recording event:", voiceData);
      socket.emit("voice-recording", voiceData);
      
      // COPIOT FIX: Don't show voice recording indicator for current user locally
      if (isRecording) {
        console.log("🎤 Current user is recording - not showing local indicator");
      }
    }
  };

  // --- Send Message with text and media together ---
  let sendTimeout: NodeJS.Timeout | null = null;
  const handleSendMessage = async () => {
    if (sending) return;
    setSending(true);
    if (!activeChat || !user) { setSending(false); return; }
    if (!messageText.trim() && drafts.length === 0) { setSending(false); return; }

    try {
      // Send text and media together as one message
      if (drafts.length > 0) {
        // Handle multiple media files
        const formData = new FormData();
        
        // Add text if present
        if (messageText.trim()) {
          formData.append("message", messageText.trim());
        }
        
        // Process all drafts (multiple media files)
        const mediaFiles = drafts.map((draft, index) => {
          const mediaUri = draft.image || draft.video || draft.audio;
          let type = "image/jpeg";
          let name = `chat-media-${index}.jpg`;
          
          if (draft.messageType.includes("audio")) {
            type = "audio/m4a";
            name = `chat-audio-${index}.m4a`;
          } else if (draft.messageType.includes("video")) {
            type = "video/mp4";
            name = `chat-video-${index}.mp4`;
          }
          
          return {
            uri: mediaUri,
            type,
            name,
            messageType: draft.messageType
          };
        });
        
        // Add all media files to form data
        mediaFiles.forEach((media, index) => {
          if (media.uri) {
            formData.append(`media`, {
              uri: media.uri,
              type: media.type,
              name: media.name,
            } as any);
          }
        });
        
        // Use the first media type as the primary message type
        const primaryMessageType = mediaFiles[0]?.messageType || "image";
        formData.append("messageType", primaryMessageType);
        
        // Send the message and wait for response
        const response = await api.post(`/chats/${activeChat.id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        });

        // Add message to local state immediately for instant feedback
        if (response.data?.chat) {
          // Group media files by type
          const images = mediaFiles.filter(m => m.messageType === "image" && m.uri).map(m => m.uri!);
          const videos = mediaFiles.filter(m => m.messageType === "video" && m.uri).map(m => m.uri!);
          const audios = mediaFiles.filter(m => m.messageType === "audio" && m.uri).map(m => m.uri!);
          
          // Determine message type based on media count
          let finalMessageType = primaryMessageType;
          if (images.length + videos.length + audios.length > 1) {
            finalMessageType = "multiple-media";
          }
          
          const newMessage: Message = {
            id: response.data.chat._id,
            text: messageText.trim() || undefined,
            // Include media URIs for immediate display
            image: images.length === 1 ? images[0] : undefined,
            video: videos.length === 1 ? videos[0] : undefined,
            audio: audios.length === 1 ? audios[0] : undefined,
            images: images.length > 1 ? images : undefined,
            videos: videos.length > 1 ? videos : undefined,
            audios: audios.length > 1 ? audios : undefined,
            messageType: finalMessageType,
            sender: {
              _id: user.id,
              username: user.username,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            replyTo: replyingTo || undefined,
          };
          
          setMessages((prev) => [...prev, newMessage]);
        }

        // Show success notification
        setSuccessMessage("Message sent");
        setShowSuccessNotification(true);
        
      } else if (messageText.trim()) {
        // Send text-only message
        const response = await api.post(`/chats/${activeChat.id}`, {
          message: messageText.trim(),
          messageType: "text",
        }, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        // Add message to local state
        if (response.data?.chat) {
          const newMessage: Message = {
            id: response.data.chat._id,
            text: messageText.trim(),
            messageType: "text",
            sender: {
              _id: user.id,
              username: user.username,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            replyTo: replyingTo || undefined,
          };
          
          setMessages((prev) => [...prev, newMessage]);
        }
      }
      
      // Clear everything after successful send
      setDrafts([]);
      setMessageText("");
      setReplyingTo(null);
      handleTyping(false);
      
    } catch (error: any) {
      console.error("Failed to send message:", error);
      // Silently handle send errors
    } finally {
      if (sendTimeout) clearTimeout(sendTimeout);
      sendTimeout = setTimeout(() => setSending(false), 500); // debounce
    }
  };

  // --- Input UI Helpers ---
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };




    const renderTextWithLinks = (text: string, textColor?: string): any => {
    try {
      if (!text || typeof text !== 'string') {
        return <Text style={{ color: textColor }}> </Text>;
      }
      
      const parts = text.split(URL_REGEX);
      const elements: any[] = [];
      
      parts.forEach((part, index) => {
        if (!part) {
          elements.push(<Text key={`empty-${index}`} style={{ color: textColor }}> </Text>);
          return;
        }
        
        if (URL_REGEX.test(part)) {
          elements.push(
            <Text
              key={`link-${index}`}
              style={[styles.linkText, { color: colors.chatroom.link }]}
              onPress={() => Linking.openURL(part.startsWith("http") ? part : `https://${part}`)}
            >
              {part}
            </Text>
          );
        } else {
          elements.push(
            <Text key={`text-${index}`} style={{ color: textColor }}>{part}</Text>
          );
        }
      });
      
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {elements}
        </View>
      );
    } catch (error) {
      return <Text style={{ color: textColor || colors.text }}>Error rendering text</Text>;
    }
  };
  


  
  // --- Input Row Logic ---
  const renderInputRow = () => {
    return (
      <View style={[
        styles.inputContainer, 
        { 
          backgroundColor: colors.chatroom.background, 
          borderTopColor: colors.chatroom.border,
          paddingBottom: Platform.OS === 'ios' ? (isKeyboardVisible ? 30 : 8) : (isKeyboardVisible ? 20 : 0),
          paddingTop: isKeyboardVisible ? 12 : 8,
          marginBottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 10 : 5) : 0,
        }
      ]}>
        {replyingTo && (
          <View style={[styles.replyPreview, { backgroundColor: colors.replyPreview, borderLeftWidth: 4, borderLeftColor: colors.iconFg, borderRadius: 8, padding: 6 }]}> 
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text numberOfLines={1} style={{color: (replyingTo.sender && user && replyingTo.sender._id === user.id) ? colors.senderText : colors.receiverText, opacity: 0.6, fontStyle: 'italic', flex: 1, marginRight: 8}}>{replyingTo.text || '📷 Image'}</Text>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                style={{ padding: 4 }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={colors.iconFg} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Selected Media Preview */}
        {drafts.length > 0 && (
          <View style={styles.selectedMediaContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
              <Text style={{ color: colors.chatroom.text, fontSize: 14, fontWeight: '500' }}>
                {drafts.length} media file{drafts.length > 1 ? 's' : ''} selected
              </Text>
              <TouchableOpacity
                onPress={() => setDrafts([])}
                style={{ padding: 4 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.primary, fontSize: 14 }}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {drafts.map((draft, index) => (
                <View key={draft.id} style={styles.selectedMediaItem}>
                  {draft.image ? (
                    <Image source={{ uri: draft.image }} style={styles.selectedMediaPreview as any} />
                  ) : draft.video ? (
                    <View style={styles.selectedMediaPreview}>
                      <Video
                        source={{ uri: draft.video }}
                        style={{ width: 60, height: 60, borderRadius: 8 }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        useNativeControls={false}
                      />
                      <View style={styles.playIconOverlay}>
                        <Play size={16} color="white" />
                      </View>
                    </View>
                  ) : draft.audio ? (
                    <View style={[styles.selectedMediaPreview, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                      <Music2 size={24} color="white" />
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.removeSelectedMediaButton}
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
        )}
        
        {isRecording ? (
          <View style={[styles.inputRow, { justifyContent: "space-between", alignItems: "center" }]}> 
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
            <Text style={{ color: colors.chatroom.text, fontWeight: "bold", fontSize: 18 }}>
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
        ) : (
          <View style={[styles.inputRow, { minHeight: 52, maxHeight: 120, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 24, backgroundColor: colors.chatroom.inputBg, alignItems: 'center', margin: 0 }]}> {/* WhatsApp-like */}
            <TouchableOpacity
              onPress={() => setShowAttachmentModal(true)}
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
              onChangeText={(t) => { setMessageText(t); handleTyping(!!t); }}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            {messageText.trim().length > 0 ? (
              <TouchableOpacity
                style={[styles.mediaButton, { backgroundColor: colors.iconBg, opacity: sending ? 0.5 : 1 }]}
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
        )}
        
        {isVoiceRecording && voiceRecordingUser && (
          <View style={{ 
            position: 'absolute', 
            left: 0, 
            right: 0, 
            bottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 120 : 100) : 60, 
            alignItems: 'center', 
            zIndex: 100 
          }}>
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15 }}>
              🎤 {(voiceRecordingUser.fullName && voiceRecordingUser.fullName !== 'Unknown User') ? voiceRecordingUser.fullName : (voiceRecordingUser.username && voiceRecordingUser.username !== 'Unknown') ? voiceRecordingUser.username : 'User'} is recording a voice note...
            </Text>
          </View>
        )}
        
        {typingUsers.length > 0 && (
          <View style={{ 
            paddingLeft: 16, 
            paddingBottom: isKeyboardVisible ? 8 : 4,
            position: 'absolute',
            bottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 120 : 100) : 60,
            left: 0,
            right: 0,
            zIndex: 5,
          }}>
            <Text style={{ color: colors.chatroom.secondary, fontStyle: 'italic' }}>
              {typingUsers.length === 1
                ? `${(typingUsers[0].fullName && typingUsers[0].fullName !== 'Unknown User') ? typingUsers[0].fullName : (typingUsers[0].username && typingUsers[0].username !== 'Unknown') ? typingUsers[0].username : 'User'} is typing...`
                : `${typingUsers.map(u => (u.fullName && u.fullName !== 'Unknown User') ? u.fullName : (u.username && u.username !== 'Unknown') ? u.username : 'User').join(', ')} are typing...`}
            </Text>
          </View>
        )}
        
        {/* COPIOT FIX: Final safety check - ensure typing indicator never shows current user */}
        {__DEV__ && typingUsers.some(u => u.id === user?.id) && (
          <View style={{ paddingLeft: 16, paddingBottom: 2 }}>
            <Text style={{ color: 'red', fontSize: 10 }}>
              ⚠️ BUG: Current user found in typing list! This should never happen.
            </Text>
          </View>
        )}
      </View>
    );
  };

  // --- Main Render ---
  const showScrollToBottom = isScrolledUp || unreadCount > 0;

  // --- Messages with drafts ---
  const allMessages = [...messages, ...drafts];

  // Prevent rendering if there are critical errors
  if (!user || !token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
          Authentication Required
        </Text>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#666' }}>
          Please log in to access the chat.
        </Text>
      </View>
    );
  }

  // Memoize the grouped messages data to prevent unnecessary re-computations
  const groupedMessagesData = useMemo(() => {
    try {
      const groups = groupMessagesByDate(allMessages, user?.id);
      const flatData: (Message | { type: 'date'; date: string })[] = [];
      
      Object.entries(groups).forEach(([date, dateMessages]) => {
        if (date && typeof date === 'string') {
          flatData.push({ type: 'date', date });
          if (Array.isArray(dateMessages)) {
            flatData.push(...dateMessages.filter(msg => msg && typeof msg === 'object'));
          }
        }
      });
      
      return flatData;
    } catch (error) {
      console.error("Error in groupedMessagesData:", error);
      return [];
    }
  }, [allMessages, user?.id]);

  // Test function to verify audio playback
  const testAudioPlayback = async () => {
    try {
      console.log("🧪 Testing audio playback with a test sound...");
      const testUri = "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav";
      // Note: This is just for testing - the actual playAudio function is in MessageItem component
      console.log("Test audio URI:", testUri);
    } catch (error) {
      console.error("❌ Test audio playback failed:", error);
    }
  };

  // Message status (ticks) - Improved with proper colors
  const getMessageTick = (msg: Message) => {
    const status = messageStatus[msg.id];
    if (status === "read") return "✓✓"; // double tick
    if (status === "delivered") return "✓✓"; // double tick
    if (status === "sent") return "✓"; // single tick
    return "";
  };

  const handleLongPressMessage = (message: Message) => {
    setActionsMessage(message);
    setShowActionsModal(true);
    Animated.timing(actionsAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };



  const closeActionsModal = () => {
    Animated.timing(actionsAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowActionsModal(false);
      setActionsMessage(null);
    });
  };


  const handleAction = async (action: string) => {
    if (!actionsMessage || !user || !token) return;
    
    switch (action) {
      case 'copy':
        if (actionsMessage.text) {
          Clipboard.setString(actionsMessage.text);
          ToastAndroid.show('Copied!', ToastAndroid.SHORT);
        }
        break;
        
      case 'forward':
        await fetchFollowers();
        setShowForwardModal(true);
        break;
        
      case 'delete':
        setShowDeleteModal(true);
        break;
        
      case 'edit':
        if (actionsMessage.sender._id === user.id) {
          setMessageText(actionsMessage.text || '');
          setTimeout(() => inputRef.current?.focus(), 100);
        } else {
          ToastAndroid.show('You can only edit your own messages', ToastAndroid.SHORT);
        }
        break;
        
      case 'info':
        try {
          const response = await api.get(`/chats/${actionsMessage.id}/info`);
          setMessageInfo(response.data);
          setShowInfoModal(true);
        } catch (error) {
          ToastAndroid.show('Failed to get message info', ToastAndroid.SHORT);
        }
        break;
        
      case 'reply':
        setReplyingTo(actionsMessage);
        break;
    }
    closeActionsModal();
  };




// Fetch followers for forward functionality
const fetchFollowers = async () => {
  if (!user || !token) return;
  try {
    const response = await api.get(`/users/${user.id}`);
    const userData = response.data.user;
    setFollowers(userData.followers || []);
  } catch (error) {
    console.error('Failed to fetch followers:', error);
  }
};

// Handle forward to selected users
const handleForward = async () => {
  if (!actionsMessage || !user || !token || forwardSelected.length === 0) return;
  try {
    for (const receiverId of forwardSelected) {
      await api.post(`/chats/${receiverId}/forward`, {
        messageId: actionsMessage.id
      });
    }
    ToastAndroid.show(`Forwarded to ${forwardSelected.length} user(s)`, ToastAndroid.SHORT);
    setShowForwardModal(false);
    setForwardSelected([]);
  } catch (error) {
    ToastAndroid.show('Failed to forward message', ToastAndroid.SHORT);
  }
};

// Handle delete message
const handleDelete = async (deleteForAll: boolean) => {
  if (!actionsMessage || !user || !token) return;
  try {
    const url = deleteForAll 
      ? `/chats/${actionsMessage.id}?all=true`
      : `/chats/${actionsMessage.id}`;
    await api.delete(url);
    setMessages(prev => prev.filter(msg => msg.id !== actionsMessage.id));
    ToastAndroid.show(
      deleteForAll ? 'Message deleted for everyone' : 'Message deleted for you', 
      ToastAndroid.SHORT
    );
    setShowDeleteModal(false);
  } catch (error) {
    ToastAndroid.show('Failed to delete message', ToastAndroid.SHORT);
  }
};

// Handle edit message
const handleEdit = async () => {
  if (!actionsMessage || !user || !token || !editText.trim()) return;
  try {
    await api.put(`/chats/${actionsMessage.id}`, {
      message: editText.trim()
    });
    setMessages(prev => prev.map(msg => 
      msg.id === actionsMessage.id 
        ? { ...msg, text: editText.trim() }
        : msg
    ));
    ToastAndroid.show('Message edited', ToastAndroid.SHORT);
    setIsEditing(false);
    setEditText('');
  } catch (error) {
    ToastAndroid.show('Failed to edit message', ToastAndroid.SHORT);
  }
};


  // Improved WhatsApp-like scroll to bottom icon
  const WhatsAppScrollToBottom = ({ color, size = 24 }: { color: string; size?: number }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: size, width: size }}>
      <View style={{ 
        width: size, 
        height: size, 
        borderRadius: size / 2, 
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      }}>
        <ChevronDown size={size * 0.6} color={color} style={{ marginTop: -1 }} />
      </View>
    </View>
  );

  // Scroll to bottom animation effect
  useEffect(() => {
    if (showScrollToBottom) {
      Animated.sequence([
        Animated.timing(scrollAnim, { toValue: -10, duration: 120, useNativeDriver: true }),
        Animated.timing(scrollAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [showScrollToBottom]);

    // Render messages with date grouping
      const renderMessageWithDate = ({ item, index }: { item: any; index: number }): any => {
    try {
      // Defensive: If item is not an object or is a string/array, always return a <Text> error
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return <Text style={{ color: 'red' }}>Invalid message data: {String(item)}</Text>;
      }
      
      // Handle date separator items
      if (item && 'type' in item && item.type === 'date') {
        return <DateSeparator date={item.date ? String(item.date) : ''} colors={colors} isUnread={item.date === 'Unread Messages'} />;
      }
      
      // Handle regular message items
      if (item && !('type' in item)) {
        // Ensure item has required properties
        if (!item.id || !item.sender) {
          return <Text style={{ color: 'red' }}>Invalid message structure</Text>;
        }
        
        return (
          <MessageItem
            item={item}
            user={user}
            colors={colors}
            handleSwipeGesture={(event, message) => {
              const { translationX, state } = event.nativeEvent || {};
              if (state === State.END && translationX > 50) {
                setReplyingTo(message);
              }
            }}
            renderTextWithLinks={renderTextWithLinks}
                                flatListRef={flatListRef}
            onRemoveDraft={item.isDraft ? removeDraft : undefined}
            onLongPress={handleLongPressMessage}
            selectedMessage={selectedMessage}
            getMessageTick={getMessageTick}
            messageStatus={messageStatus}
          />
        );
      }
      
      // Fallback for unsupported items
      return <Text style={{ color: colors.text }}>Unsupported message type</Text>;
    } catch (error) {
      console.error("Error in renderMessageWithDate:", error);
      return <Text style={{ color: 'red' }}>Render error: {String(error)}</Text>;
    }
  };

  // 1. Add new styles for WhatsApp-style actions modal and dropdown
  const getActionModalStyles = (colors: any) => StyleSheet.create({
    actionsModalOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      zIndex: 1000,
    },
    actionsModalContainer: {
      backgroundColor: colors.chatroom.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingTop: 18,
      paddingBottom: 8,
      paddingHorizontal: 8,
      minHeight: 140,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 10,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      width: '100%',
      marginBottom: 8,
    },
    actionButton: {
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 8,
      marginBottom: 4,
    },
    actionIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.chatroom.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.chatroom.border,
    },
    actionLabel: {
      fontSize: 12,
      color: colors.chatroom.text,
      textAlign: 'center',
      marginTop: 2,
      maxWidth: 60,
    },
    cancelButton: {
      marginTop: 8,
      marginBottom: 8,
      backgroundColor: colors.chatroom.background,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      width: '90%',
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: colors.chatroom.border,
    },
    cancelButtonText: {
      color: colors.chatroom.text,
      fontWeight: 'bold',
      fontSize: 16,
    },
    moreDropdown: {
      position: 'absolute',
      bottom: 120,
      right: 24,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 8,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      zIndex: 2000,
      minWidth: 180,
    },
    moreDropdownItem: {
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    moreDropdownText: {
      fontSize: 15,
      color: colors.text,
    },
  });

  // 2. Replace the old actions modal and dropdown with WhatsApp-style modal at the bottom
  // (Place this inside the ChatScreen render, replacing the old modal code)
  const actionModalStyles = getActionModalStyles(colors);

  // Theme-aware scroll to bottom button with double down arrows
  const ThemeAwareScrollToBottom = ({ size = 24 }: { size?: number }) => {
    const isDark = colors.chatroom.background === '#121B22' || colors.chatroom.background === '#15202B';
    
    return (
      <View style={{ 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: size, 
        width: size 
      }}>
        <View style={{ 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: isDark ? "#000" : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.25,
          shadowRadius: 4,
          elevation: 5,
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
        }}>
          {/* Double down arrows */}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <ChevronDown 
              size={size * 0.4} 
              color={isDark ? colors.primary : colors.primary} 
              style={{ marginTop: -2, marginBottom: -4 }} 
            />
            <ChevronDown 
              size={size * 0.4} 
              color={isDark ? colors.primary : colors.primary} 
              style={{ marginTop: -4 }} 
            />
          </View>
        </View>
      </View>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return "now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}wk`
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}month`
    return `${Math.floor(diffInSeconds / 31536000)}year`
  }

    // Defensive wrapper for FlatList renderItem
  function safeRenderItem(renderFn: (props: any) => any): (props: any) => any {
    return function(props: any): any {
      try {
        const result = renderFn(props);
        
        // If result is already a valid React element, return it
        if (result && typeof result === 'object' && 'type' in result) {
          return result;
        }
        
        // If result is a string, wrap it in Text
        if (typeof result === 'string') {
          return <Text style={{ color: colors.text }}>{result}</Text>;
        }
        
        // If result is an array, wrap it in a View
        if (Array.isArray(result)) {
          return <View>{result}</View>;
        }
        
        // If result is null/undefined, return empty Text
        if (result == null) {
          return <Text style={{ color: colors.text }}> </Text>;
        }
        
        // For any other case, return error Text
        return <Text style={{ color: 'red' }}>Invalid render: {String(result)}</Text>;
      } catch (error) {
        return <Text style={{ color: 'red' }}>Render error: {String(error)}</Text>;
      }
    };
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.chatroom.background, paddingTop: Platform.OS === 'ios' ? 32 : 0 }]}>
        <SuccessNotification
          visible={showSuccessNotification}
          message={successMessage}
          onHide={() => setShowSuccessNotification(false)}
          duration={2000}
          colors={colors}
        />
        
        {/* Error Display */}
        {(chatError || socketError) && (
          <View style={[styles.errorContainer, { backgroundColor: colors.error || '#ff6b6b' }]}>
            <Text style={[styles.errorText, { color: '#fff' }]}>
              {chatError || socketError}
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setChatError(null);
                setSocketError(null);
                if (token) fetchChats();
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: "rgba(0,0,0,0.1)" }]}>
            <ActivityIndicator size="large" color={colors.chatroom.text} />
          </View>
        )}

        {/* Attachment Modal */}
        <Modal
          visible={showAttachmentModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAttachmentModal(false)}
        >
          <TouchableOpacity
            style={[styles.attachmentModalOverlay, { backgroundColor: colors.overlay === 'black' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)' }]}
            activeOpacity={1}
            onPress={() => setShowAttachmentModal(false)}
          >
            <View style={[styles.attachmentModalContainer, { backgroundColor: colors.card }]}>
              <View style={styles.attachmentRow}>
                <View style={styles.attachmentButtonContainer}>
                  <TouchableOpacity 
                    style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} 
                    onPress={handleImagePicker}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Paperclip size={24} color={colors.iconFg} />
                  </TouchableOpacity>
                  <Text style={[styles.attachmentLabel, { color: colors.text }]}>Gallery</Text>
                </View>
                <View style={styles.attachmentButtonContainer}>
                  <TouchableOpacity 
                    style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} 
                    onPress={handleCameraPicker}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Camera size={24} color={colors.iconFg} />
                  </TouchableOpacity>
                  <Text style={[styles.attachmentLabel, { color: colors.text }]}>Camera</Text>
                </View>
                <View style={styles.attachmentButtonContainer}>
                  <TouchableOpacity 
                    style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} 
                    onPress={handleVideoPicker}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <VideoIcon size={24} color={colors.iconFg} />
                  </TouchableOpacity>
                  <Text style={[styles.attachmentLabel, { color: colors.text }]}>Video</Text>
                </View>
                <View style={styles.attachmentButtonContainer}>
                  <TouchableOpacity 
                    style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} 
                    onPress={handleVideoRecording}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <VideoIcon size={24} color={colors.iconFg} />
                  </TouchableOpacity>
                  <Text style={[styles.attachmentLabel, { color: colors.text }]}>Record</Text>
                </View>
                <View style={styles.attachmentButtonContainer}>
                  <TouchableOpacity 
                    style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} 
                    onPress={handleAudioPicker}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Music2 size={24} color={colors.iconFg} />
                  </TouchableOpacity>
                  <Text style={[styles.attachmentLabel, { color: colors.text }]}>Audio</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.attachmentClose, { backgroundColor: colors.iconBg }]}
                onPress={() => setShowAttachmentModal(false)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={colors.iconFg} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {showActionsModal && actionsMessage && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={closeActionsModal}
          >
            <TouchableWithoutFeedback onPress={closeActionsModal}>
              <View style={actionModalStyles.actionsModalOverlay}>
                <TouchableWithoutFeedback>
                  <Animated.View style={[actionModalStyles.actionsModalContainer, { transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }], opacity: actionsAnim }] }>
                    <View style={actionModalStyles.actionsRow}>
                      <TouchableOpacity 
                        style={actionModalStyles.actionButton} 
                        onPress={() => handleAction('star')}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={actionModalStyles.actionIconCircle}>
                          <Star size={24} color={colors.primary} />
                        </View>
                        <Text style={actionModalStyles.actionLabel}>Star</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={actionModalStyles.actionButton} 
                        onPress={() => handleAction('copy')}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={actionModalStyles.actionIconCircle}>
                          <Copy size={24} color={colors.primary} />
                        </View>
                        <Text style={actionModalStyles.actionLabel}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={actionModalStyles.actionButton} 
                        onPress={() => handleAction('delete')}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={actionModalStyles.actionIconCircle}>
                          <Trash2 size={24} color={colors.primary} />
                        </View>
                        <Text style={actionModalStyles.actionLabel}>Delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={actionModalStyles.actionButton} 
                        onPress={() => handleAction('forward')}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={actionModalStyles.actionIconCircle}>
                          <Share2 size={24} color={colors.primary} />
                        </View>
                        <Text style={actionModalStyles.actionLabel}>Forward</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={actionModalStyles.actionButton} 
                        onPress={() => handleAction('reply')}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={actionModalStyles.actionIconCircle}>
                          <Reply size={24} color={colors.primary} />
                        </View>
                        <Text style={actionModalStyles.actionLabel}>Reply</Text>
                      </TouchableOpacity>
                      {actionsMessage?.sender._id === user?.id && (
                        <TouchableOpacity 
                          style={actionModalStyles.actionButton} 
                          onPress={() => handleAction('info')}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <View style={actionModalStyles.actionIconCircle}>
                            <Info size={24} color={colors.primary} />
                          </View>
                          <Text style={actionModalStyles.actionLabel}>Info</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        style={actionModalStyles.actionButton} 
                        onPress={() => setShowMenu(true)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={actionModalStyles.actionIconCircle}>
                          <MoreVertical size={24} color={colors.primary} />
                        </View>
                        <Text style={actionModalStyles.actionLabel}>More</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                      style={actionModalStyles.cancelButton} 
                      onPress={closeActionsModal}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={actionModalStyles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    {showMenu && (
                      <View style={actionModalStyles.moreDropdown}>
                        <TouchableOpacity 
                          style={actionModalStyles.moreDropdownItem} 
                          onPress={() => { setShowMenu(false); handleAction('pin'); }}
                          activeOpacity={0.7}
                        >
                          <Text style={actionModalStyles.moreDropdownText}>Pin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={actionModalStyles.moreDropdownItem} 
                          onPress={() => { setShowMenu(false); handleAction('add_note'); }}
                          activeOpacity={0.7}
                        >
                          <Text style={actionModalStyles.moreDropdownText}>Add text to note</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={actionModalStyles.moreDropdownItem} 
                          onPress={() => { setShowMenu(false); handleAction('quick_reply'); }}
                          activeOpacity={0.7}
                        >
                          <Text style={actionModalStyles.moreDropdownText}>Add quick reply</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Animated.View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}

        {!activeChat ? (
          <>
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.backButton, { backgroundColor: colors.iconBackBg }]}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft color={colors.iconBack} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
              <View style={styles.headerRight} />
            </View>
            <FlatList
              data={chats}
              renderItem={safeRenderItem(({ item }: any) => 
                <TouchableOpacity
                  style={[styles.chatItem, { backgroundColor: colors.background }]}
                  onPress={() => setActiveChat(item)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.avatar, { backgroundColor: item.avatar.startsWith("http") ? "transparent" : colors.icon }]}>
                    {item.avatar.startsWith("http") ? (
                      <Image source={{ uri: item.avatar }} style={styles.avatarImage as any} />
                    ) : (
                      <Text style={[styles.emojiText, { color: colors.text }]}>{getEmojiFromName(item.name)}</Text>
                    )}
                  </View>
                  <View style={styles.chatInfo}>
                    <View style={styles.chatNameRow}>
                      <Text style={[styles.chatName, { color: colors.text }]}>{item.fullName || item.name}</Text>
                      {(() => {
                        const { isVerified, isPremiumVerified } = getUserVerificationStatus(item.id)
                        return <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={10} />
                      })()}
                    </View>
                    <Text style={[styles.chatUsername, { color: colors.grey }]}>@{item.name}</Text>
                    <Text style={[styles.chatLastMessage, { color: colors.grey }]} numberOfLines={1}>
                      {item.lastMessage}
                    </Text>
                  </View>
                  <View style={styles.chatMeta}>
                    <Text style={[styles.chatTime, { color: colors.grey }]}>
                      {new Date(item.lastMessageTime).toLocaleDateString()}
                    </Text>
                    {item.unreadCount > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.unreadText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.chatList}
              refreshing={loading}
              onRefresh={fetchChats}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    No conversations yet. Start chatting with someone!
                  </Text>
                  {!loading && chats.length === 0 && (
                    <Text style={[styles.emptyText, { color: colors.grey, fontSize: 14, marginTop: 10 }]}>
                      Start a conversation by following someone or commenting on their posts!
                    </Text>
                  )}
                </View>
              }
              showsVerticalScrollIndicator={true}
            />
          </>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.chatroom.background }}>
            <ImageBackground
              source={colors.chatroom.backgroundImage}
              style={{ flex: 1 }}
              resizeMode="cover"
            >
              <View style={{ flex: 1 }}>
                <View
                  style={[
                    styles.chatRoomHeader,
                    { 
                      backgroundColor: colors.chatroom.background, 
                      borderBottomColor: colors.chatroom.border, 
                      paddingTop: Platform.OS === 'ios' ? 44 : 0, 
                      minHeight: 60, 
                      alignItems: 'center',
                      flexShrink: 0, // Prevent header from shrinking
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setActiveChat(null);
                      setMessages([]);
                      setIsFollowing(false);
                      setReplyingTo(null);
                      setDrafts([]);
                      setUnreadCount(0);
                      setIsScrolledUp(false);
                      isAtBottom.current = true;
                    }}
                    style={[styles.backButton, { backgroundColor: colors.iconBackBg }]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ArrowLeft color={colors.iconBack} />
                  </TouchableOpacity>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: activeChat.avatar.startsWith("http") ? colors.transparent : colors.icon },
                    ]}
                  >
                    {activeChat.avatar.startsWith("http") ? (
                      <Image source={{ uri: activeChat.avatar }} style={styles.headerAvatar as any} />
                    ) : (
                      <Text style={[styles.emojiText, { color: colors.chatroom.text }]}>{String(activeChat.avatar)}</Text>
                    )}
                  </View>
                  <View style={styles.headerChatInfo}>
                    <View style={styles.headerChatNameRow}>
                      <Text style={[styles.headerChatName, { color: colors.text }]}>{(activeChat.fullName || activeChat.name).split(' ')[0]}</Text>
                      {(() => {
                        const { isVerified, isPremiumVerified } = getUserVerificationStatus(activeChat.id)
                        return <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={10} />
                      })()}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      if (!activeChat || !user) return;
                      try {
                        const endpoint = isFollowing ? "unfollow" : "follow";
                        await api.post(`/users/${activeChat.id}/${endpoint}`, { followerId: user.id });
                        setIsFollowing(!isFollowing);
                        Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${activeChat.name}`);
                      } catch (error: any) {
                        Alert.alert("Error", error.response?.data?.message || "Failed to update follow status");
                      }
                    }}
                    style={[
                      styles.followButton,
                      {
                        backgroundColor: isFollowing ? colors.chatroom.border : colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                    activeOpacity={0.8}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    {isFollowing ? <UserCheck size={16} color={colors.text} /> : <UserPlus size={16} color="white" />}
                  </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  style={{ flex: 1 }}
                  keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
                  enabled={true}
                >
                  <FlatList
                    ref={flatListRef}
                    data={groupedMessagesData || []}
                    renderItem={safeRenderItem(({ item }: any) => 
                      renderMessageWithDate({ item, index: item?.id || 0 })
                    )}
                    keyExtractor={(item: any, index: number) => {
                      try {
                        if (item && 'type' in item && item.type === 'date') {
                          return `date-${item.date}-${index}`;
                        }
                        return item && item.id ? `${item.id}-${index}` : `message-${Date.now()}-${index}`;
                      } catch (error) {
                        console.error("Error in keyExtractor:", error);
                        return `fallback-${index}`;
                      }
                    }}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={true}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    initialNumToRender={20}
                    getItemLayout={(data, index) => ({
                      length: 80, // Approximate height of each message item
                      offset: 80 * index,
                      index,
                    })}
                    onContentSizeChange={() => {
                      if (isAtBottom.current) {
                        flatListRef.current?.scrollToEnd({ animated: true });
                        setUnreadCount(0);
                      }
                    }}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                      listener: (event: any) => {
                        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                        const offsetY = contentOffset.y;
                        const contentHeight = contentSize.height;
                        const visibleHeight = layoutMeasurement.height;
                        const isBottom = offsetY >= contentHeight - visibleHeight - 10;
                        isAtBottom.current = isBottom;
                        setIsScrolledUp(!isBottom && offsetY > 50);
                        if (isBottom) setUnreadCount(0);
                      },
                      useNativeDriver: false,
                    })}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    onScrollToIndexFailed={({ index, highestMeasuredFrameIndex }) => {
                      // Scroll to the highest measured index, then try again after a short delay
                      flatListRef.current?.scrollToIndex({
                        index: highestMeasuredFrameIndex,
                        animated: true,
                      });
                      setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index, animated: true });
                      }, 100);
                    }}
                    ListEmptyComponent={
                      loading ? (
                        <View style={styles.emptyContainer}>
                          <ActivityIndicator size="large" color={colors.chatroom.text} />
                          <Text style={[styles.emptyText, { color: colors.chatroom.text, marginTop: 16 }]}>
                            Loading messages...
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.emptyContainer}>
                          <Text style={[styles.emptyText, { color: colors.chatroom.text }]}>
                            No messages yet. Start the conversation!
                          </Text>
                        </View>
                      )
                    }
                  />

                  {showScrollToBottom && (
                    <Animated.View style={{
                      position: 'absolute',
                      bottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 140 : 120) : 80,
                      right: 16,
                      zIndex: 10,
                      opacity: showScrollToBottom ? 1 : 0,
                      transform: [{ translateY: scrollAnim }],
                    }}>
                      <TouchableOpacity 
                        style={[styles.scrollToBottom, { 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                          elevation: 5,
                        }]} 
                        onPress={() => {
                          flatListRef.current?.scrollToEnd({ animated: true });
                          setIsScrolledUp(false);
                          setUnreadCount(0);
                          isAtBottom.current = true;
                        }}
                        activeOpacity={0.8}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <ThemeAwareScrollToBottom size={24} />
                      </TouchableOpacity>
                      {unreadCount > 0 && (
                        <View style={[styles.unreadBadge, { 
                          backgroundColor: colors.primary, 
                          position: "absolute", 
                          top: -8, 
                          right: -8,
                          minWidth: 20,
                          height: 20,
                          borderRadius: 10,
                        }]}> 
                          <Text style={[styles.unreadText, { fontSize: 12 }]}>{unreadCount}</Text> 
                        </View>
                      )}
                    </Animated.View>
                  )}

                  {renderInputRow()}
                </KeyboardAvoidingView>
              </View>
            </ImageBackground>
          </View>
        )}

        
      </View>

      {showForwardModal && (
  <Modal visible transparent animationType="slide" onRequestClose={() => setShowForwardModal(false)}>
    <TouchableWithoutFeedback onPress={() => setShowForwardModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: 320, maxHeight: 400 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: colors.text }}>
            Forward to (max 5):
          </Text>
          <FlatList
            data={followers}
            keyExtractor={item => item._id}
            renderItem={safeRenderItem(({ item }: any) => 
              <TouchableOpacity
                onPress={() => {
                  if (forwardSelected.includes(item._id)) {
                    setForwardSelected(forwardSelected.filter(id => id !== item._id));
                  } else if (forwardSelected.length < 5) {
                    setForwardSelected([...forwardSelected, item._id]);
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4, padding: 8 }}
              >
                <View style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: 12, 
                  borderWidth: 2, 
                  borderColor: colors.primary, 
                  backgroundColor: forwardSelected.includes(item._id) ? colors.primary : 'transparent', 
                  marginRight: 8 
                }} />
                <Text style={{ color: colors.text }}>{item.fullName || item.username}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 200 }}
          />
          <TouchableOpacity
            style={{ 
              marginTop: 16, 
              backgroundColor: colors.primary, 
              borderRadius: 8, 
              padding: 10, 
              alignItems: 'center' 
            }}
            onPress={handleForward}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Forward</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
)}

{showDeleteModal && (
  <Modal visible transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
    <TouchableWithoutFeedback onPress={() => setShowDeleteModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: 280 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: colors.text }}>
            Delete message?
          </Text>
          <TouchableOpacity
            style={{ 
              marginBottom: 12, 
              backgroundColor: colors.error, 
              borderRadius: 8, 
              padding: 10, 
              alignItems: 'center' 
            }}
            onPress={() => handleDelete(false)}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete for me</Text>
          </TouchableOpacity>
          {actionsMessage?.sender._id === user?.id && (
            <TouchableOpacity
              style={{ 
                backgroundColor: colors.primary, 
                borderRadius: 8, 
                padding: 10, 
                alignItems: 'center' 
              }}
              onPress={() => handleDelete(true)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete for everyone</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
)}

{showInfoModal && messageInfo && (
  <Modal visible transparent animationType="fade" onRequestClose={() => setShowInfoModal(false)}>
    <TouchableWithoutFeedback onPress={() => setShowInfoModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: 280 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: colors.text }}>
            Message Info
          </Text>
          <Text style={{ color: colors.text, marginBottom: 4 }}>
            Sent: {new Date(messageInfo.sentAt).toLocaleString()}
          </Text>
          <Text style={{ color: colors.text, marginBottom: 4 }}>
            Status: {messageInfo.isRead ? 'Read' : 'Delivered'}
          </Text>
        </View>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
)}

      </GestureHandlerRootView>
    );
};

const styles: import("react-native").StyleSheet.NamedStyles<any> = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 12,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 40,
  },
  chatList: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  emojiText: {
    fontSize: 22,
  },
  chatInfo: {
    flex: 1,
    paddingRight: 10,
  },
  chatNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  chatName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  chatUsername: {
    fontSize: 14,
  },
  chatLastMessage: {
    fontSize: 14,
  },
  chatMeta: {
    alignItems: "flex-end",
  },
  chatTime: {
    fontSize: 12,
  },
  unreadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: "center",
  },
  unreadText: {
    fontSize: 12,
    fontWeight: "500",
    color: "white",
  },
  chatRoomHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#075E54",
    backgroundColor: "#075E54",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerChatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerChatNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  headerChatName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  messageList: {
    padding: 16,
    paddingBottom: 20,
  },
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
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#dcf8c6",
    borderBottomRightRadius: 4,
    marginLeft: 40,
    marginRight: 0,
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    marginRight: 40,
    marginLeft: 0,
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
  linkText: {
    textDecorationLine: "underline",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
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
  replyPreviewText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  replyCloseButton: {
    padding: 4,
  },
  inputContainer: {
    padding: 4,
    borderTopWidth: 0.3,
    width: "100%",
    flexShrink: 0, // Prevent shrinking
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
    backgroundColor: "#000", // fallback, will be overridden by theme
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedImagePreview: {
    width: 36,
    height: 36,
    borderRadius: 8,
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
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },

  scrollToBottom: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedMediaContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  selectedMediaItem: {
    position: "relative",
  },
  selectedMediaPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  removeSelectedMediaButton: {
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
  playIconOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -8 }, { translateY: -8 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  attachmentModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  attachmentModalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 32,
    paddingTop: 20,
    paddingHorizontal: 16,
    width: "100%",
  },
  attachmentRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  attachmentButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  attachmentButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#000", // fallback, will be overridden by theme
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  attachmentLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 60,
  },
  attachmentClose: {
    alignSelf: "center",
    marginTop: 12,
    padding: 12,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  moreMenuIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    alignSelf: "flex-end",
    padding: 4,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  unreadSeparator: {
    marginVertical: 20,
    paddingVertical: 8,
  },
  dateLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  // Post Comment Preview Styles
  postPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  postDetailsContainer: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
  },
  postLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  postCaption: {
    fontSize: 14,
    marginBottom: 2,
  },
  postTimestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
  commentContainer: {
    padding: 8,
    borderRadius: 8,
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentText: {
    fontSize: 14,
    marginTop: 2,
  },
  // Multiple Media Styles
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
  // Error handling styles
  errorContainer: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ChatScreen;



