import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Animated,
  Dimensions,
  Modal,
  ImageBackground,
  TouchableWithoutFeedback,
  useColorScheme,
  Easing,
  Clipboard,
  ToastAndroid,
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
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Audio, Video, ResizeMode } from "expo-av";
import { Linking } from "react-native";
import io, { Socket } from "socket.io-client";

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
  messageType:
    | "text"
    | "image"
    | "text-image"
    | "post-comment"
    | "audio"
    | "video"
    | "text-audio"
    | "text-video";
  sender: { _id: string; username: string; fullName: string; profilePicture?: string };
  timestamp: string;
  replyTo?: Message;
  postData?: {
    image: string;
    caption: string;
    timestamp: string;
  };
  isDraft?: boolean; // for local draft preview
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

  const imgMatch = text.match(/\[img\](.*?)\[\/img\]/);
  const faintMatch = text.match(/\[faint\](.*?)\[\/faint\]/);
  const commentMatch = text.match(/Comment: (.*)/);

  if (imgMatch && faintMatch && commentMatch) {
    const imageUrl = imgMatch[1];
    const postDetails = faintMatch[1];
    const comment = commentMatch[1];
    const parts = postDetails.split(" (");
    const caption = parts[0];
    const originalCaption = parts[1] ? parts[1].replace(")", "") : caption;

    return {
      isPostComment: true,
      postData: {
        image: imageUrl,
        caption: caption,
        originalCaption: originalCaption,
        createdAt: "2 days ago",
      },
      comment: comment,
    };
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
}) => (
  <View style={{backgroundColor: colors.commentCard, borderRadius: 12, padding: 10, marginVertical: 4}}>
    <View style={styles.postPreviewContainer}>
      <Image source={{ uri: postData.image }} style={styles.postPreviewImage as any} />
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

const MessageItem = ({
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
}: {
  item: Message;
  user: any;
  colors: any;
  handleSwipeGesture: (event: any, message: Message) => void;
  renderTextWithLinks: (text: string) => any;
  flatListRef: React.RefObject<FlatList<any>>;
  onRemoveDraft?: (id: string) => void;
  onLongPress?: (message: Message) => void;
  selectedMessage?: Message | null;
  getMessageTick: (msg: Message) => string;
}) => {
  if (!user) return null;
  const translateX = useRef(new Animated.Value(0)).current;
  const panRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Support for multiple images (extend Message type if needed)
  const images = Array.isArray(item.image) ? item.image.filter(Boolean) : item.image ? [item.image] : [];

  // For video/audio URIs
  const videoUri = item.video || "";
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
          onLongPress={isSender ? () => onLongPress && onLongPress(item) : undefined}
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
                  {item.replyTo.text || '📷 Image'}
                </Text>
              </View>
            )}

            {/* Images Grid */}
            {images.length > 1 ? (
              <FlatList
                data={images}
                numColumns={2}
                keyExtractor={(uri, idx) => uri + idx}
                renderItem={({ item: img, index }) => (
                  img ? (
                    <TouchableOpacity
                      onPress={() => { setModalImageIndex(index); setShowImageModal(true); }}
                      style={{ flex: 1, margin: 2 }}
                    >
                      <Image source={{ uri: img }} style={[styles.messageImage as any, { aspectRatio: 1, width: 120 }]} />
                    </TouchableOpacity>
                  ) : null
                )}
                style={{ marginVertical: 4 }}
                scrollEnabled={false}
              />
            ) : images.length === 1 && images[0] ? (
              <TouchableOpacity onPress={() => { setModalImageIndex(0); setShowImageModal(true); }}>
                <Image source={{ uri: images[0] }} style={styles.messageImage as any} />
              </TouchableOpacity>
            ) : null}

            {/* Image Modal */}
            <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => setShowImageModal(false)}>
              <TouchableWithoutFeedback onPress={() => setShowImageModal(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
                  {images[modalImageIndex] ? (
                    <Image source={{ uri: images[modalImageIndex] }} style={{ width: "90%", height: "70%", borderRadius: 12 }} resizeMode="contain" />
                  ) : null}
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* Video Display */}
            {item.messageType === "video" && videoUri ? (
              <TouchableOpacity onPress={() => setShowVideoModal(true)}>
                <View style={{ position: "relative" }}>
                  <Video
                    source={{ uri: videoUri }}
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
            ) : null}
            {/* Video Modal */}
            <Modal visible={showVideoModal} transparent animationType="fade" onRequestClose={() => setShowVideoModal(false)}>
              <TouchableWithoutFeedback onPress={() => setShowVideoModal(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
                  {videoUri ? (
                    <Video
                      source={{ uri: videoUri }}
                      style={{ width: "90%", height: 300, borderRadius: 12 }}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay
                      useNativeControls
                    />
                  ) : null}
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* Audio, text, and other message types remain unchanged below */}
            {item.messageType === "audio" && audioUri ? (
              <TouchableOpacity onPress={() => playAudio(audioUri)} style={{ flexDirection: "row", alignItems: "center" }}>
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
            {item.messageType === "text-audio" && audioUri && item.text ? (
              <>
                <TouchableOpacity onPress={() => playAudio(audioUri)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <VoiceNoteWaveform 
                    isPlaying={isPlaying} 
                    color={colors.chatroom.primary} 
                    height={16} 
                    width={32} 
                  />
                  <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText }]}> 
                    {isPlaying ? "⏹ Stop" : "▶️ Play"} 
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText }]}> 
                  {renderTextWithLinks(item.text || "")} 
                </Text>
              </>
            ) : null}
            {item.messageType === "text-image" && item.image && item.text ? (
              <>
                <TouchableOpacity>
                  <Image source={{ uri: item.image }} style={styles.messageImage as any} />
                </TouchableOpacity>
                <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText }]}>
                  {renderTextWithLinks(item.text || "")}
                </Text>
              </>
            ) : item.messageType === "text-video" && item.video && item.text ? (
              <>
                <Video
                  source={{ uri: item.video }}
                  style={styles.messageVideo}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                />
                <Text style={[styles.messageText, { color: colors.receiverText }]}>🎥 Video</Text>
                <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText }]}>
                  {renderTextWithLinks(item.text || "")}
                </Text>
              </>
            ) : item.messageType === "text" && item.text ? (
              <Text style={[styles.messageText, { color: isSender ? colors.senderText : colors.receiverText }]}>
                {renderTextWithLinks(item.text || "")}
              </Text>
            ) : null}

            <Text style={[styles.timestamp, { color: isSender ? colors.senderText : colors.receiverText }]}>{item.timestamp} {getMessageTick(item)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

const SOCKET_URL = "http://192.168.11.253:3000"; // Update to your server's IP/port

const ChatScreen = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { user, token, api } = useAuth();
  const { colors } = useTheme();
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [messageStatus, setMessageStatus] = useState<{[key: string]: string}>({}); // { messageId: 'sent'|'delivered'|'read' }
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const isStoppingRef = useRef(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionsMessage, setActionsMessage] = useState<Message | null>(null);
  const [actionsY, setActionsY] = useState(0);
  const actionsAnim = useRef(new Animated.Value(0)).current;
// Add state for more options functionality
const [showForwardModal, setShowForwardModal] = useState(false);
const [forwardSelected, setForwardSelected] = useState<string[]>([]);
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [showInfoModal, setShowInfoModal] = useState(false);
const [messageInfo, setMessageInfo] = useState<any>(null);
const [editText, setEditText] = useState('');
const [isEditing, setIsEditing] = useState(false);
const [followers, setFollowers] = useState<any[]>([]);

  // const [showForwardModal, setShowForwardModal] = useState(false);
  // const [forwardSelected, setForwardSelected] = useState<string[]>([]);
  // const [showDeleteModal, setShowDeleteModal] = useState(false);
  // const [showInfoModal, setShowInfoModal] = useState(false);
  // const [messageInfo, setMessageInfo] = useState<any>(null);
  // const [editText, setEditText] = useState('');
  // const [isEditing, setIsEditing] = useState(false);
  // const [followers, setFollowers] = useState<any[]>([]);

  // // Fetch followers for forward functionality
  // const fetchFollowers = async () => {
  //   if (!user || !token) return;
  //   try {
  //     const response = await api.get(`/users/${user.id}`);
  //     const userData = response.data.user;
  //     setFollowers(userData.followers || []);
  //   } catch (error) {
  //     console.error('Failed to fetch followers:', error);
  //   }
  // };

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
      });
      if (!result.canceled && result.assets[0]) {
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
      });
      if (!result.canceled && result.assets[0]) {
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
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        addDraft({
          id: Date.now().toString(),
          audio: result.assets[0].uri,
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
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick audio");
    }
  };

  // --- Voice Note Controls ---
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
            setError(error.response?.data?.message || `Failed to send voice note: ${error.message}`);
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

  useEffect(() => {
    if (!activeChat || !token) return;
    fetchMessages(activeChat.id);
    checkFollowStatus(activeChat.id);
  }, [activeChat, token]);

  const fetchChats = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await api.get("/chats");
      const { chats: chatData } = response.data;
      const sortedChats = chatData
        .map((chat: ChatItem) => ({
          id: chat.id,
          name: chat.name,
          fullName: chat.fullName,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.lastMessageTime,
          unreadCount: chat.unreadCount,
          avatar: chat.avatar || getEmojiFromName(chat.name),
        }))
        .sort((a: any, b: any) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      setChats(sortedChats);
      setError(null);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to fetch chats");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await api.get(`/chats/${chatId}`);
      const { messages: messageData } = response.data;
      const formattedMessages = messageData.map((msg: any) => {
        const parsedMessage = parsePostCommentMessage(msg.message || "");
        const message = {
          id: msg._id,
          text: msg.message,
          image: msg.image,
          audio: msg.audio,
          video: msg.video,
          messageType: parsedMessage.isPostComment
            ? "post-comment"
            : msg.messageType || "text",
          sender: msg.sender,
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          postData: parsedMessage.isPostComment ? parsedMessage.postData : undefined,
        };
        
        // Debug audio messages
        if (msg.audio) {
          console.log("🎵 Found audio message:", {
            id: msg._id,
            audio: msg.audio,
            messageType: msg.messageType,
            sender: msg.sender?.username
          });
        }
        
        return message;
      });
      setMessages(formattedMessages);
      try {
        await api.post(`/chats/${chatId}/mark-as-read`);
        setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)));
      } catch {}
      setError(null);
      if (isAtBottom.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
          setUnreadCount(0);
        }, 100);
      } else {
        setUnreadCount(formattedMessages.length);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to fetch messages");
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
    const s: Socket = io(SOCKET_URL, { transports: ["websocket"] });
    setSocket(s);
    if (user) s.emit("login", user.id);
    s.on("online-users", setOnlineUsers);
    return () => { s.disconnect(); };
  }, [user]);

  // Join chat room and listen for events
  useEffect(() => {
    if (!socket || !activeChat) return;
    socket.emit("join-chat", activeChat.id);
    socket.on("typing", (data: { chatId: string, typing: string[] }) => {
      const { chatId, typing } = data;
      if (chatId === activeChat.id) setTypingUsers(typing);
    });
    socket.on("new-message", (msg: Message & { chatId?: string }) => {
      if (msg.chatId === activeChat.id) {
        // Check if this message is from the current user to avoid duplicates
        const isOwnMessage = msg.sender._id === user?.id;
        setMessages((prev) => {
          // If it's our own message, replace the temporary one with the server response
          if (isOwnMessage) {
            const filtered = prev.filter(m => m.id !== msg.id);
            return [...filtered, msg];
          } else {
            // If it's from another user, add it normally
            return [...prev, msg];
          }
        });
      }
    });
    socket.on("message-status", (data: { messageId: string, status: string }) => {
      const { messageId, status } = data;
      setMessageStatus((prev) => ({ ...prev, [messageId]: status }));
    });
    return () => {
      socket.off("typing");
      socket.off("new-message");
      socket.off("message-status");
    };
  }, [socket, activeChat]);

  // Typing indicator
  const handleTyping = (isTyping: boolean) => {
    if (socket && activeChat && user) {
      socket.emit("typing", { chatId: activeChat.id, userId: user.id, isTyping });
    }
  };

  // Send message via socket
  const handleSendMessage = async () => {
    if (!activeChat || !user) return;
    if (!messageText.trim() && drafts.length === 0) return;

    // Send all drafts first
    for (const draft of drafts) {
      let messageType = draft.messageType;
      let mediaUri = draft.image || draft.video || draft.audio || null;
      const formData = new FormData();
      formData.append("messageType", messageType);
      if (mediaUri) {
        let type = "image/jpeg";
        let name = "chat-image.jpg";
        if (messageType.includes("audio")) {
          type = "audio/m4a";
          name = "chat-audio.m4a";
        } else if (messageType.includes("video")) {
          type = "video/mp4";
          name = "chat-video.mp4";
        }
        formData.append("media", {
          uri: mediaUri,
          type,
          name,
        } as any);
      }
      try {
        const response = await api.post(`/chats/${activeChat.id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        });
        // The server will emit a socket event with the saved message
        // We don't need to add it to messages here as it will come via socket
      } catch (error: any) {
        setError(error.response?.data?.message || `Failed to send media: ${error.message}`);
      }
    }
    setDrafts([]);

    // Then send text message if any
    if (messageText.trim()) {
      try {
        // Send text message to server via API
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
        const newMessage: Message = {
          id: response.data?.chat?._id || Date.now().toString(),
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
        
        // Add message to local state immediately for instant feedback
        setMessages((prev) => [...prev, newMessage]);
        
        // The server will emit the socket event after saving to database
        setMessageText("");
        setReplyingTo(null);
      } catch (error: any) {
        console.error("Failed to send text message:", error);
        setError(error.response?.data?.message || `Failed to send message: ${error.message}`);
      }
    }
  };

  // --- Input UI Helpers ---
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // --- UI Renderers ---
  const renderTextWithLinks = (text: string) => {
    const parts = text.split(URL_REGEX);
    return parts.map((part, index) => {
      if (URL_REGEX.test(part)) {
        return (
          <Text
            key={index}
            style={[styles.linkText, { color: colors.chatroom.link }]}
            onPress={() => Linking.openURL(part.startsWith("http") ? part : `https://${part}`)}
          >
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  // --- Input Row Logic ---
  const renderInputRow = () => {
    if (isRecording) {
      return (
        <View style={[styles.inputRow, { justifyContent: "space-between", alignItems: "center" }]}> 
          <TouchableOpacity
            onPress={deleteRecording}
            style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
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
          >
            {recordingPaused ? (
              <Play size={20} color={colors.iconFg} />
            ) : (
              <Pause size={20} color={colors.iconFg} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={stopRecording} style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}> 
            <Send size={20} color={colors.iconFg} />
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.inputRow}>
        {/* Attachment Icon */}
        <TouchableOpacity
          onPress={() => setShowAttachmentModal(true)}
          style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
        >
          <Paperclip size={20} color={colors.iconFg} />
        </TouchableOpacity>
        {/* Text Input */}
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.chatroom.inputBg,
              color: colors.chatroom.inputText,
              borderColor: colors.chatroom.inputBorder,
              flex: 1,
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
        {/* Action Button: Mic or Send */}
        {messageText.trim().length > 0 ? (
          <TouchableOpacity
            style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
            activeOpacity={0.7}
            onPress={handleSendMessage}
          >
            <Send size={20} color={colors.iconFg} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.mediaButton, { backgroundColor: colors.iconBg }]}
            activeOpacity={0.7}
            onPress={startRecording}
          >
            <Mic size={20} color={colors.iconFg} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // --- Main Render ---
  const showScrollToBottom = isScrolledUp || unreadCount > 0;

  // --- Messages with drafts ---
  const allMessages = [...messages, ...drafts];

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

  // Message status (ticks)
  const getMessageTick = (msg: Message) => {
    const status = messageStatus[msg.id];
    if (status === "read") return "✔✔"; // blue double tick
    if (status === "delivered") return "✔✔"; // grey double tick
    if (status === "sent") return "✔"; // grey single tick
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
          setEditText(actionsMessage.text || '');
          setIsEditing(true);
        } else {
          ToastAndroid.show('You can only edit your own messages', ToastAndroid.SHORT);
        }
        break;
        
      case 'info':
        try {
          const response = await api.get(`/api/chats/${actionsMessage.id}/info`);
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


  // const handleAction = async (action: string) => {
  //   if (!actionsMessage || !user || !token) return;
    
  //   switch (action) {
  //     case 'copy':
  //       if (actionsMessage.text) {
  //         Clipboard.setString(actionsMessage.text);
  //         ToastAndroid.show('Copied!', ToastAndroid.SHORT);
  //       }
  //       break;
        
  //     case 'forward':
  //       await fetchFollowers();
  //       setShowForwardModal(true);
  //       break;
        
  //     case 'delete':
  //       setShowDeleteModal(true);
  //       break;
        
  //     case 'edit':
  //       if (actionsMessage.sender._id === user.id) {
  //         setEditText(actionsMessage.text || '');
  //         setIsEditing(true);
  //       } else {
  //         ToastAndroid.show('You can only edit your own messages', ToastAndroid.SHORT);
  //       }
  //       break;
        
  //     case 'info':
  //       try {
  //         const response = await api.get(`/chats/${actionsMessage.id}/info`);
  //         setMessageInfo(response.data);
  //         setShowInfoModal(true);
  //       } catch (error) {
  //         ToastAndroid.show('Failed to get message info', ToastAndroid.SHORT);
  //       }
  //       break;
        
  //     case 'reply':
  //       setReplyingTo(actionsMessage);
  //       break;
  //   }
  //   closeActionsModal();
  // };


// Fetch followers for forward functionality
const fetchFollowers = async () => {
  if (!user || !token) return;
  try {
    const response = await api.get(`/api/users/${user.id}`);
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
      await api.post(`/api/chats/${receiverId}/forward`, {
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
      ? `/api/chats/${actionsMessage.id}?all=true`
      : `/api/chats/${actionsMessage.id}`;
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
    await api.put(`/api/chats/${actionsMessage.id}`, {
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


  // Handle forward to selected users
  // const handleForward = async () => {
  //   if (!actionsMessage || !user || !token || forwardSelected.length === 0) return;
    
  //   try {
  //     for (const receiverId of forwardSelected) {
  //       await api.post(`/chats/${receiverId}/forward`, {
  //         messageId: actionsMessage.id
  //       });
  //     }
  //     ToastAndroid.show(`Forwarded to ${forwardSelected.length} user(s)`, ToastAndroid.SHORT);
  //     setShowForwardModal(false);
  //     setForwardSelected([]);
  //   } catch (error) {
  //     ToastAndroid.show('Failed to forward message', ToastAndroid.SHORT);
  //   }
  // };

  // // Handle delete message
  // const handleDelete = async (deleteForAll: boolean) => {
  //   if (!actionsMessage || !user || !token) return;
    
  //   try {
  //     const url = deleteForAll 
  //       ? `/chats/${actionsMessage.id}?all=true`
  //       : `/chats/${actionsMessage.id}`;
      
  //     await api.delete(url);
      
  //     // Remove from local state
  //     setMessages(prev => prev.filter(msg => msg.id !== actionsMessage.id));
      
  //     ToastAndroid.show(
  //       deleteForAll ? 'Message deleted for everyone' : 'Message deleted for you', 
  //       ToastAndroid.SHORT
  //     );
  //     setShowDeleteModal(false);
  //   } catch (error) {
  //     ToastAndroid.show('Failed to delete message', ToastAndroid.SHORT);
  //   }
  // };

  // // Handle edit message
  // const handleEdit = async () => {
  //   if (!actionsMessage || !user || !token || !editText.trim()) return;
    
  //   try {
  //     await api.put(`/chats/${actionsMessage.id}`, {
  //       message: editText.trim()
  //     });
      
  //     // Update in local state
  //     setMessages(prev => prev.map(msg => 
  //       msg.id === actionsMessage.id 
  //         ? { ...msg, text: editText.trim() }
  //         : msg
  //     ));
      
  //     ToastAndroid.show('Message edited', ToastAndroid.SHORT);
  //     setIsEditing(false);
  //     setEditText('');
  //   } catch (error) {
  //     ToastAndroid.show('Failed to edit message', ToastAndroid.SHORT);
  //   }
  // };

  // Custom WhatsApp-like double down V icon for scroll to bottom
  const WhatsAppDoubleDown = ({ color, size = 24 }: { color: string; size?: number }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: size, width: size }}>
      <ChevronDown size={size} color={color} style={{ marginTop: -2 }} />
      <ChevronDown size={size} color={color} style={{ marginTop: -10 }} />
    </View>
  );

  // In the scroll to bottom button, use WhatsAppDoubleDown and add bounce animation
  const scrollAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showScrollToBottom) {
      Animated.sequence([
        Animated.timing(scrollAnim, { toValue: -10, duration: 120, useNativeDriver: true }),
        Animated.timing(scrollAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [showScrollToBottom]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.chatroom.background }]}>
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
            style={styles.attachmentModalOverlay}
            activeOpacity={1}
            onPress={() => setShowAttachmentModal(false)}
          >
            <View style={styles.attachmentModalContainer}>
              <View style={styles.attachmentRow}>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} onPress={handleImagePicker}>
                  <Paperclip size={20} color={colors.iconFg} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} onPress={handleCameraPicker}>
                  <Camera size={20} color={colors.iconFg} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} onPress={handleVideoPicker}>
                  <VideoIcon size={20} color={colors.iconFg} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} onPress={handleVideoRecording}>
                  <VideoIcon size={20} color={colors.iconFg} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: colors.iconBg }]} onPress={handleAudioPicker}>
                  <Music2 size={20} color={colors.iconFg} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.attachmentClose}
                onPress={() => setShowAttachmentModal(false)}
              >
                <X size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {showActionsModal && actionsMessage && (
          <Animated.View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: colors.chatroom.background,
            paddingTop: 40,
            paddingBottom: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: actionsAnim,
            transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
            borderBottomWidth: 1,
            borderBottomColor: colors.chatroom.border,
          }}>
            <Text style={{ flex: 1, color: colors.text, fontWeight: 'bold', fontSize: 16 }} numberOfLines={1}>
              {actionsMessage.text || '[Media]'}
            </Text>
            <TouchableOpacity onPress={closeActionsModal} style={{ marginLeft: 12 }}>
              <X size={20} color={colors.iconFg} />
            </TouchableOpacity>
          </Animated.View>
        )}
        {showActionsModal && (
          <TouchableWithoutFeedback onPress={closeActionsModal}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}>
              <Animated.View style={{
                position: 'absolute',
                top: 60,
                left: 0,
                right: 0,
                zIndex: 201,
                flexDirection: 'row',
                justifyContent: 'space-around',
                backgroundColor: colors.chatroom.background,
                paddingVertical: 12,
                opacity: actionsAnim,
                borderBottomWidth: 1,
                borderBottomColor: colors.chatroom.border,
              }}>
                <TouchableOpacity onPress={() => handleAction('copy')}><Copy size={22} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('forward')}><Share2 size={22} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('delete')}><Trash2 size={22} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('edit')}><Edit size={22} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('info')}><Info size={22} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('reply')}><Reply size={22} color={colors.primary} /></TouchableOpacity>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        )}

        {!activeChat ? (
          <>
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.backButton, { backgroundColor: colors.iconBackBg }]}
              >
                <ArrowLeft color={colors.iconBack} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
              <View style={styles.headerRight} />
            </View>
            <FlatList
              data={chats}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.chatItem, { backgroundColor: colors.background }]}
                  onPress={() => setActiveChat(item)}
                >
                  <View style={[styles.avatar, { backgroundColor: item.avatar.startsWith("http") ? "transparent" : colors.icon }]}>
                    {item.avatar.startsWith("http") ? (
                      <Image source={{ uri: item.avatar }} style={styles.avatarImage as any} />
                    ) : (
                      <Text style={[styles.emojiText, { color: colors.text }]}>{item.avatar}</Text>
                    )}
                  </View>
                  <View style={styles.chatInfo}>
                    <Text style={[styles.chatName, { color: colors.text }]}>{item.fullName || item.name}</Text>
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
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    {error ? error : "No conversations yet. Start chatting with someone!"}
                  </Text>
                  {error && (
                    <TouchableOpacity
                      onPress={() => fetchChats()}
                      style={[styles.retryButton, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              showsVerticalScrollIndicator={true}
            />
          </>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[styles.container, { flex: 1 }]}
            keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 80}
          >
            <ImageBackground
              source={colors.chatroom.backgroundImage}
              style={{ flex: 1 }}
              resizeMode="cover"
            >
              <View
                style={[
                  styles.chatRoomHeader,
                  { backgroundColor: colors.chatroom.background, borderBottomColor: colors.chatroom.border },
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
                    <Text style={[styles.emojiText, { color: colors.chatroom.text }]}>{activeChat.avatar}</Text>
                  )}
                </View>
                <View style={styles.headerChatInfo}>
                  <Text style={[styles.headerChatName, { color: colors.text }]}>{activeChat.fullName || activeChat.name}</Text>
                  <Text style={[styles.headerChatUsername, { color: colors.grey }]}>@{activeChat.name}</Text>
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
                >
                  {isFollowing ? <UserCheck size={16} color={colors.text} /> : <UserPlus size={16} color="white" />}
                </TouchableOpacity>
              </View>

              <FlatList
                ref={flatListRef}
                data={allMessages}
                renderItem={({ item }) => (
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
                    flatListRef={flatListRef as React.RefObject<FlatList<any>>}
                    onRemoveDraft={item.isDraft ? removeDraft : undefined}
                    onLongPress={handleLongPressMessage}
                    selectedMessage={selectedMessage}
                    getMessageTick={getMessageTick}
                  />
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={true}
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
              />

              {showScrollToBottom && (
                <Animated.View style={{
                  position: 'absolute',
                  bottom: 80,
                  right: 16,
                  zIndex: 10,
                  opacity: showScrollToBottom ? 1 : 0,
                  transform: [{ translateY: scrollAnim }],
                }}>
                  <TouchableOpacity style={styles.scrollToBottom} onPress={() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                    setIsScrolledUp(false);
                    setUnreadCount(0);
                    isAtBottom.current = true;
                  }}>
                    <WhatsAppDoubleDown color={colors.primary} size={24} />
                  </TouchableOpacity>
                  {unreadCount > 0 && (
                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary, position: "absolute", top: -8, right: -8 }]}> <Text style={styles.unreadText}>{unreadCount}</Text> </View>
                  )}
                </Animated.View>
              )}

              <View style={[styles.inputContainer, { backgroundColor: colors.chatroom.background, borderTopColor: colors.chatroom.border }]}>
                {replyingTo && (
                  <View style={[styles.replyPreview, { backgroundColor: colors.replyPreview, borderLeftWidth: 4, borderLeftColor: colors.iconFg, borderRadius: 8, padding: 6 }]}> 
                    <Text numberOfLines={1} style={{color: (replyingTo.sender && user && replyingTo.sender._id === user.id) ? colors.senderText : colors.receiverText, opacity: 0.6, fontStyle: 'italic'}}>{replyingTo.text || '📷 Image'}</Text>
                  </View>
                )}
                {renderInputRow()}
              </View>

              {typingUsers.length > 0 && (
                <View style={{ paddingLeft: 16, paddingBottom: 4 }}>
                  <Text style={{ color: colors.chatroom.secondary, fontStyle: 'italic' }}>
                    {typingUsers.length === 1
                      ? `${typingUsers[0]} is typing...`
                      : `${typingUsers.join(', ')} are typing...`}
                  </Text>
                </View>
              )}
            </ImageBackground>
          </KeyboardAvoidingView>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)} style={styles.dismissError}>
              <Text style={[styles.dismissText, { color: colors.primary }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>



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
            renderItem={({ item }) => (
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

{isEditing && (
  <Modal visible transparent animationType="fade" onRequestClose={() => setIsEditing(false)}>
    <TouchableWithoutFeedback onPress={() => setIsEditing(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: 280 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: colors.text }}>
            Edit Message
          </Text>
          <TextInput
            value={editText}
            onChangeText={setEditText}
            style={{ 
              borderWidth: 1, 
              borderColor: colors.primary, 
              borderRadius: 8, 
              padding: 8, 
              color: colors.text, 
              marginBottom: 12,
              backgroundColor: colors.background
            }}
            multiline
            placeholder="Edit your message..."
            placeholderTextColor={colors.placeholder}
          />
          <TouchableOpacity
            style={{ 
              backgroundColor: colors.primary, 
              borderRadius: 8, 
              padding: 10, 
              alignItems: 'center' 
            }}
            onPress={handleEdit}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
)}

      {/* {showForwardModal && (
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
                  renderItem={({ item }) => (
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

      {isEditing && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setIsEditing(false)}>
          <TouchableWithoutFeedback onPress={() => setIsEditing(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: 280 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: colors.text }}>
                  Edit Message
                </Text>
                <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  style={{ 
                    borderWidth: 1, 
                    borderColor: colors.primary, 
                    borderRadius: 8, 
                    padding: 8, 
                    color: colors.text, 
                    marginBottom: 12,
                    backgroundColor: colors.background
                  }}
                  multiline
                  placeholder="Edit your message..."
                  placeholderTextColor={colors.placeholder}
                />
                <TouchableOpacity
                  style={{ 
                    backgroundColor: colors.primary, 
                    borderRadius: 8, 
                    padding: 10, 
                    alignItems: 'center' 
                  }}
                  onPress={handleEdit}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )} */}



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
  headerChatName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  headerChatUsername: {
    fontSize: 14,
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
    alignSelf: "flex-end",
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
    padding: 8,
    borderTopWidth: 0.3,
    width: "100%",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    backgroundColor: "transparent",
    padding: 4,
    margin: 4,
    gap: 3,
  },
  mediaButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    position: "absolute",
    bottom: 140,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 5,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  dismissError: {
    marginLeft: 12,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollToBottom: {
    position: "absolute",
    bottom: 80,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(125, 122, 122, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
    paddingBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 24,
    width: "100%",
  },
  attachmentRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 12,
  },
  attachmentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000", // fallback, will be overridden by theme
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  attachmentLabel: {
    marginTop: 4,
    fontSize: 13,
    color: "#444",
  },
  attachmentClose: {
    alignSelf: "center",
    marginTop: 8,
    padding: 8,
  },
  moreMenuIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    alignSelf: "flex-end",
    padding: 4,
  },
});

export default ChatScreen;



