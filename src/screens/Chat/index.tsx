import { useState, useEffect, useRef } from "react"
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
  Linking,
  Dimensions,
} from "react-native"
import { PanGestureHandler, State, GestureHandlerRootView } from "react-native-gesture-handler"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import type { RootStackParamList } from "../../types/navigation"
import { ArrowLeft, UserPlus, UserCheck, Send, X, Reply, Image as ImageIcon, Camera } from "lucide-react-native"
import * as ImagePicker from "expo-image-picker"
import { Audio } from "expo-audio"

type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">

interface ChatItem {
  id: string
  name: string
  fullName: string
  avatar: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}

interface Message {
  id: string
  text?: string
  image?: string
  messageType: "text" | "image" | "text-image" | "post-comment"
  sender: { _id: string; username: string; fullName: string; profilePicture?: string }
  timestamp: string
  replyTo?: Message
  postData?: {
    image: string
    caption: string
    timestamp: string
  }
}

const { width: screenWidth } = Dimensions.get("window")

const URL_REGEX = /(https?:\/\/www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g

const getEmojiFromName = (name: string) => {
  const firstLetter = name.charAt(0).toUpperCase()
  const emojiMap: { [key: string]: string } = {
    A: "😀", B: "😂", C: "😊", D: "👍", E: "❤️", F: "😎", G: "🎉", H: "🌟", I: "🌈",
    J: "💡", K: "🔥", L: "🌹", M: "🎶", N: "🌍", O: "🚀", P: "💕", Q: "🌺", R: "🎵",
    S: "🌞", T: "🍎", U: "🌴", V: "🐱", W: "🐶", X: "🐼", Y: "🐰", Z: "🐸",
  }
  return emojiMap[firstLetter] || "👤"
}

const parsePostCommentMessage = (text: string) => {
  if (!text) return { isPostComment: false, text }

  const imgMatch = text.match(/\[img\](.*?)\[\/img\]/)
  const faintMatch = text.match(/\[faint\](.*?)\[\/faint\]/)
  const commentMatch = text.match(/Comment: (.*)/)

  if (imgMatch && faintMatch && commentMatch) {
    const imageUrl = imgMatch[1]
    const postDetails = faintMatch[1]
    const comment = commentMatch[1]
    const parts = postDetails.split(" (")
    const caption = parts[0]
    const originalCaption = parts[1] ? parts[1].replace(")", "") : caption

    return {
      isPostComment: true,
      postData: {
        image: imageUrl,
        caption: caption,
        originalCaption: originalCaption,
        createdAt: "2days ago",
      },
      comment: comment,
    }
  }

  return { isPostComment: false, text }
}

const PostCommentPreview = ({ postData, comment, colors }: { postData: any; comment: string; colors: any }) => (
  <View style={[styles.postCommentContainer, { backgroundColor: colors.chatPrimary }]}>
    <View style={styles.postPreviewContainer}>
      <Image source={{ uri: postData.image }} style={styles.postPreviewImage} />
      <View style={[styles.postDetailsContainer, { backgroundColor: colors.chatcom }]}>
        <Text style={[styles.postLabel, { color: colors.text }]}>Post:</Text>
        <Text style={[styles.postCaption, { color: colors.text }]} numberOfLines={1}>
          {postData.caption}
        </Text>
        <Text style={[styles.postTimestamp, { color: colors.chatText }]}>{postData.timestamp}</Text>
      </View>
    </View>
    <View style={[styles.commentContainer, { backgroundColor: colors.chatrec }]}>
      <Text style={[styles.commentLabel, { color: colors.chatText }]}>Comment: </Text>
      <Text style={[styles.commentText, { color: colors.chatText }]}>{comment}</Text>
    </View>
  </View>
)

const MessageItem = ({
  item,
  user,
  colors,
  handleSwipeGesture,
  renderTextWithLinks,
}: {
  item: Message
  user: any
  colors: any
  handleSwipeGesture: (event: any, message: Message) => void
  renderTextWithLinks: (text: string) => any
}) => {
  const translateX = useRef(new Animated.Value(0)).current

  const onGestureEvent = (event: any) => {
    const translationX = event.nativeEvent.translationX || 0
    if (translationX >= 0) {
      translateX.setValue(translationX)
    } else {
      translateX.setValue(0)
    }
  }

  const onHandlerStateChange = (event: any) => {
    const { translationX, state } = event.nativeEvent || {}

    if (typeof translationX !== "number") {
      return
    }

    if (translationX < 0) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
      return
    }

    if (state === State.END && translationX > 50) {
      handleSwipeGesture(event, item)
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
    } else if (state === State.END) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
    }
  }

  const parsedMessage = item.text ? parsePostCommentMessage(item.text) : { isPostComment: false, text: "" }

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-10, 10]}
      activeOffsetY={[-10, 10]}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <View
          style={[
            styles.messageBubble,
            item.sender._id === user?.id ? styles.userMessage : styles.otherMessage,
            {
              backgroundColor: parsedMessage.isPostComment
                ? colors.chatPrimary
                : item.sender._id === user?.id
                  ? colors.chatPrimary
                  : colors.chatCard,
            },
          ]}
        >
          {item.replyTo && (
            <View style={[styles.replyContainer, { borderLeftColor: colors.primary }]}>
              <Reply size={16} color={colors.chatSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.replyText, { color: colors.text }]} numberOfLines={1}>
                {item.replyTo.text || "📷 Image"}
              </Text>
            </View>
          )}

          {parsedMessage.isPostComment ? (
            <PostCommentPreview postData={parsedMessage.postData} comment={parsedMessage.comment} colors={colors} />
          ) : item.messageType === "image" && item.image ? (
            <TouchableOpacity onPress={() => console.log("Image pressed - could open full screen view")}>
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </TouchableOpacity>
          ) : item.messageType === "text-image" && item.image && item.text ? (
            <>
              <TouchableOpacity onPress={() => console.log("Image pressed - could open full screen view")}>
                <Image source={{ uri: item.image }} style={styles.messageImage} />
              </TouchableOpacity>
              <Text style={[styles.messageText, { color: item.sender._id === user?.id ? colors.chatText : colors.chatText }]}>
                {renderTextWithLinks(item.text || "")}
              </Text>
            </>
          ) : (
            <Text style={[styles.messageText, { color: item.sender._id === user?.id ? colors.chatText : colors.chatText }]}>
              {renderTextWithLinks(item.text || "")}
            </Text>
          )}

          <Text
            style={[
              styles.timestamp,
              { color: item.sender._id === user?.id ? colors.grey : colors.chatSecondary },
            ]}
          >
            {item.timestamp}
          </Text>
        </View>
      </Animated.View>
    </PanGestureHandler>
  )
}

const ChatScreen = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>()
  const { user, token, refreshToken } = useAuth()
  const { colors } = useTheme()
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null)
  const [messageText, setMessageText] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [chats, setChats] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [sendSound, setSendSound] = useState<Audio.AudioPlayer | null>(null)
  const [receiveSound, setReceiveSound] = useState<Audio.AudioPlayer | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const sendSnd = Audio.createAudioPlayer({
          source: { uri: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" },
        })
        const receiveSnd = Audio.createAudioPlayer({
          source: { uri: "https://www.soundjay.com/misc/sounds/bell-ringing-04.wav" },
        })
        setSendSound(sendSnd)
        setReceiveSound(receiveSnd)
      } catch (error) {
        console.log("Error loading sounds:", error)
      }
    }
    loadSounds()

    return () => {
      sendSound?.remove()
      receiveSound?.remove()
    }
  }, [])

  const playSound = async (type: "send" | "receive") => {
    try {
      if (type === "send" && sendSound) {
        await sendSound.play()
      } else if (type === "receive" && receiveSound) {
        await receiveSound.play()
      }
    } catch (error) {
      console.log("Error playing sound:", error)
    }
  }

  const fetchChats = async () => {
    if (!token) return

    setLoading(true)
    try {
      const response = await api.get("/chats")
      const { chats: chatData } = response.data

      const sortedChats = chatData
        .map((chat: ChatItem) => ({
          ...chat,
          avatar: chat.avatar || getEmojiFromName(chat.name),
        }))
        .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

      setChats(sortedChats)
      setError(null)
    } catch (error: any) {
      console.error("Error fetching chats:", error)
      if (error.response?.status === 401) {
        try {
          await refreshToken()
          const response = await api.get("/chats")
          const { chats: chatData } = response.data
          const sortedChats = chatData
            .map((chat: ChatItem) => ({
              ...chat,
              avatar: chat.avatar || getEmojiFromName(chat.name),
            }))
            .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
          setChats(sortedChats)
          setError(null)
        } catch (refreshError) {
          setError("Session expired. Please log in again.")
        }
      } else {
        setError(error.response?.data?.message || "Failed to fetch chats")
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (chatId: string) => {
    if (!token) return

    setLoading(true)
    try {
      console.log("Fetching messages for chatId:", chatId)
      const response = await api.get(`/chats/${chatId}`)
      const { messages: messageData } = response.data

      const formattedMessages = messageData.map((msg: any) => {
        const parsedMessage = parsePostCommentMessage(msg.message || "")

        return {
          id: msg._id,
          text: msg.message,
          image: msg.image,
          messageType: parsedMessage.isPostComment ? "post-comment" : msg.messageType || "text",
          sender: msg.sender,
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          postData: parsedMessage.isPostComment ? parsedMessage.postData : undefined,
        }
      })

      setMessages(formattedMessages)

      try {
        console.log("Marking messages as read for chatId:", chatId)
        const url = `/chats/${chatId}/mark-as-read`
        console.log("Constructed URL:", url)
        await api.post(url)
        setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)))
      } catch (readError) {
        console.log("Error marking messages as read:", readError)
      }

      setError(null)
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    } catch (error: any) {
      console.error("Error fetching messages:", error)
      if (error.response?.status === 401) {
        try {
          await refreshToken()
          const response = await api.get(`/chats/${chatId}`)
          const { messages: messageData } = response.data
          const formattedMessages = messageData.map((msg: any) => {
            const parsedMessage = parsePostCommentMessage(msg.message || "")

            return {
              id: msg._id,
              text: msg.message,
              image: msg.image,
              messageType: parsedMessage.isPostComment ? "post-comment" : msg.messageType || "text",
              sender: msg.sender,
              timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              postData: parsedMessage.isPostComment ? parsedMessage.postData : undefined,
            }
          })
          setMessages(formattedMessages)
          setError(null)
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true })
          }, 100)
        } catch (refreshError) {
          setError("Session expired. Please log in again.")
        }
      } else {
        setError(error.response?.data?.message || "Failed to fetch messages")
      }
    } finally {
      setLoading(false)
    }
  }

  const checkFollowStatus = async (userId: string) => {
    if (!user || !token) return

    try {
      const response = await api.post(`/users/${userId}/is-following`, {
        followerId: user.id,
      })
      setIsFollowing(response.data.isFollowing)
    } catch (error: any) {
      console.error("Error checking follow status:", error)
      if (error.response?.status === 401) {
        try {
          await refreshToken()
          const response = await api.post(`/users/${userId}/is-following`, {
            followerId: user.id,
          })
          setIsFollowing(response.data.isFollowing)
        } catch (refreshError) {
          console.error("Error checking follow status after refresh:")
        }
      }
    }
  }

  useEffect(() => {
    if (token) {
      fetchChats()
    }
  }, [token])

  useEffect(() => {
    if (!activeChat || !token) return
    fetchMessages(activeChat.id)
    checkFollowStatus(activeChat.id)
  }, [activeChat, token])

  const handleSendMessage = async (messageType: "text" | "image" | "text-image" = "text", imageUri?: string) => {
    if ((!messageText.trim() && !imageUri && messageType === "text") || !activeChat || !user) {
      console.log("Invalid input: No text or image provided for text message")
      return
    }

    if (imageUri && (!imageUri.trim() || !imageUri.startsWith("file://"))) {
      console.error("Invalid image URI:", imageUri)
      setError("Invalid image selected. Please choose a valid image.")
      return
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText.trim() ? messageText : undefined,
      image: imageUri,
      messageType: imageUri ? (messageText.trim() ? "text-image" : "image") : "text",
      sender: {
        _id: user.id,
        username: user.username,
        fullName: user.fullName,
        profilePicture: user.profilePicture,
      },
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      replyTo: replyingTo || undefined,
    }

    try {
      let messageToSend = messageText.trim()
      if (replyingTo) {
        messageToSend = `Replying to "${replyingTo.text || "image"}": ${messageText.trim()}`
      }

      const formData = new FormData()
      if (messageToSend) formData.append("message", messageToSend)
      formData.append("messageType", newMessage.messageType)

      if (imageUri) {
        console.log("Appending image with URI:", imageUri)
        formData.append("image", {
          uri: imageUri,
          type: "image/jpeg",
          name: "chat-image.jpg",
        } as any)
      }

      console.log("Sending FormData with messageType:", newMessage.messageType)
      console.log("Message:", messageToSend)
      console.log("Image URI:", imageUri)

      const response = await api.post(`/chats/${activeChat.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      console.log("API Response:", response.data)

      setMessages((prev) => [...prev, newMessage])
      setMessageText("")
      setSelectedImage(null)
      setReplyingTo(null)

      await playSound("send")

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)

      setChats((prev) =>
        prev
          .map((chat) =>
            chat.id === activeChat.id
              ? {
                  ...chat,
                  lastMessage: imageUri
                    ? messageText.trim()
                      ? `${messageText} (with image)`
                      : "📷 Image"
                    : messageText,
                  lastMessageTime: new Date().toISOString(),
                }
              : chat
          )
          .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
      )
      setError(null)
    } catch (error: any) {
      console.error("Error sending message:", error)
      console.error("Error response:", error.response?.data)
      console.error("Status:", error.response?.status)
      if (error.response?.status === 401) {
        try {
          await refreshToken()
          const formData = new FormData()
          if (messageToSend) formData.append("message", messageToSend)
          formData.append("messageType", newMessage.messageType)
          if (imageUri) {
            formData.append("image", {
              uri: imageUri,
              type: "image/jpeg",
              name: "chat-image.jpg",
            } as any)
          }
          const response = await api.post(`/chats/${activeChat.id}`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          })
          setMessages((prev) => [...prev, newMessage])
          setMessageText("")
          setSelectedImage(null)
          setReplyingTo(null)
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true })
          }, 100)
          setChats((prev) =>
            prev
              .map((chat) =>
                chat.id === activeChat.id
                  ? {
                      ...chat,
                      lastMessage: imageUri
                        ? messageText.trim()
                          ? `${messageText} (with image)`
                          : "📷 Image"
                        : messageText,
                      lastMessageTime: new Date().toISOString(),
                    }
                  : chat
              )
              .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
          )
          setError(null)
        } catch (refreshError) {
          setError("Session expired. Please log in again.")
        }
      } else {
        setError(error.response?.data?.message || `Failed to send message: ${error.message}`)
      }
    }
  }

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to send images.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image")
    }
  }

  const handleCameraPicker = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera permissions to take photos.")
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error taking photo:", error)
      Alert.alert("Error", "Failed to take photo")
    }
  }

  const handleFollow = async () => {
    if (!activeChat || !user) return

    try {
      const endpoint = isFollowing ? "unfollow" : "follow"
      await api.post(`/users/${activeChat.id}/${endpoint}`, {
        followerId: user.id,
      })

      setIsFollowing(!isFollowing)
      Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${activeChat.name}`)
    } catch (error: any) {
      console.error("Error following/unfollowing user:", error)
      if (error.response?.status === 401) {
        try {
          await refreshToken()
          const endpoint = isFollowing ? "unfollow" : "follow"
          await api.post(`/users/${activeChat.id}/${endpoint}`, {
            followerId: user.id,
          })
          setIsFollowing(!isFollowing)
          Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${activeChat.name}`)
        } catch (refreshError) {
          Alert.alert("Error", "Session expired. Please log in again.")
        }
      } else {
        Alert.alert("Error", error.response?.data?.message || "Failed to update follow status")
      }
    }
  }

  const handleBackToChats = () => {
    setActiveChat(null)
    setMessages([])
    setIsFollowing(false)
    setReplyingTo(null)
    setSelectedImage(null)
  }

  const handleSwipeGesture = (event: any, message: Message) => {
    const { translationX, state } = event.nativeEvent || {}
    if (state === State.END && translationX > 50) {
      setReplyingTo(message)
    }
  }

  const handleLinkPress = async (url: string) => {
    try {
      let formattedUrl = url
      if (url.startsWith("www.") && !url.startsWith("http://") && !url.startsWith("https://")) {
        formattedUrl = `https://${url}`
      } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
        formattedUrl = `https://${url}`
      }
      const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:\/[-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/
      if (!urlRegex.test(formattedUrl)) {
        console.error("Invalid URL format:", formattedUrl)
        Alert.alert("Error", "The URL format is invalid.")
        return
      }
      console.log("Attempting to open URL:", formattedUrl)
      if (Platform.OS === "android" && formattedUrl.startsWith("https://")) {
        console.log("Bypassing canOpenURL on Android for HTTPS URL:", formattedUrl)
        await Linking.openURL(formattedUrl)
      } else {
        const supported = await Linking.canOpenURL(formattedUrl)
        if (supported) {
          await Linking.openURL(formattedUrl)
        } else {
          console.error("URL not supported:", formattedUrl)
          Alert.alert("Error", "This URL cannot be opened on your device.")
        }
      }
    } catch (error) {
      console.error("Error opening URL:", error)
      Alert.alert("Error", `Failed to open the URL: ${error.message}`)
    }
  }

  const renderTextWithLinks = (text: string) => {
    const parts = text.split(URL_REGEX)
    return parts.map((part, index) => {
      if (URL_REGEX.test(part)) {
        return (
          <Text key={index} style={styles.linkText} onPress={() => handleLinkPress(part)} style={{ color: colors.chatLink, textDecorationLine: "none" }}>
            {part}
          </Text>
        )
      }
      return part
    })
  }

  const renderChatItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: colors.background }]}
      onPress={() => setActiveChat(item)}
    >
      <View style={[styles.avatar, { backgroundColor: item.avatar.startsWith("http") ? "transparent" : colors.icon }]}>
        {item.avatar.startsWith("http") ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
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
  )

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageItem
      item={item}
      user={user}
      colors={colors}
      handleSwipeGesture={handleSwipeGesture}
      renderTextWithLinks={renderTextWithLinks}
    />
  )

  const renderEmpty = () => (
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
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.chatBackground }]}>
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: "rgba(0,0,0,0.1)" }]}>
            <ActivityIndicator size="large" color={colors.text} />
          </View>
        )}

        {!activeChat ? (
          <>
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.backButton, { backgroundColor: colors.primary }]}
              >
                <ArrowLeft size={20} color="white" />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
              <View style={styles.headerRight} />
            </View>

            <FlatList
              data={chats}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.chatList}
              ListEmptyComponent={renderEmpty}
              showsVerticalScrollIndicator={true}
            />
          </>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[styles.container, { marginBottom: -5 }]}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 60}
          >
            <View
              style={[styles.chatRoomHeader, { backgroundColor: colors.chatBackground, borderBottomColor: colors.chatBorder }]}
            >
              <TouchableOpacity
                onPress={handleBackToChats}
                style={[styles.backButton, { backgroundColor: colors.primary }]}
              >
                <ArrowLeft size={20} color="white" />
              </TouchableOpacity>

              <View
                style={[styles.avatar, { backgroundColor: activeChat.avatar.startsWith("http") ? colors.transparent : colors.chatIcon }]}
              >
                {activeChat.avatar.startsWith("http") ? (
                  <Image source={{ uri: activeChat.avatar }} style={styles.headerAvatar} />
                ) : (
                  <Text style={[styles.emojiText, { color: colors.chatText }]}>{activeChat.avatar}</Text>
                )}
              </View>

              <View style={styles.headerChatInfo}>
                <Text style={[styles.headerChatName, { color: colors.text }]}>
                  {activeChat.fullName || activeChat.name}
                </Text>
                <Text style={[styles.headerChatUsername, { color: colors.grey }]}>@{activeChat.name}</Text>
              </View>

              <TouchableOpacity
                onPress={handleFollow}
                style={[styles.followButton, {
                  backgroundColor: isFollowing ? colors.chatBorder : colors.text,
                  borderColor: colors.chatPrimary,
                }]}
              >
                {isFollowing ? <UserCheck size={16} color={colors.chatText} /> : <UserPlus size={16} color="white" />}
              </TouchableOpacity>
            </View>





            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={true}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <View
              style={[styles.inputContainer, { backgroundColor: colors.transparent, borderTopColor: colors.chatBorder }]}
            >
              {replyingTo && (
                <View style={[styles.replyPreview, { backgroundColor: colors.chatCard, borderLeftColor: colors.chatSecondary }]}>
                  <View style={styles.replyPreviewContent}>
                    <Reply size={16} color={colors.chatSecondary} />
                    <Text style={[styles.replyPreviewText, { color: colors.text }]} numberOfLines={1}>
                      Refeed: {replyingTo.text || "📷 Image"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseButton}>
                    <X size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.inputRow}>
                <TouchableOpacity
                  onPress={handleImagePicker}
                  style={[styles.mediaButton, { backgroundColor: colors.chatPrimary }]}
                >
                  <ImageIcon size={20} color={colors.chatIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCameraPicker}
                  style={[styles.mediaButton, { backgroundColor: colors.chatPrimary }]}
                >
                  <Camera size={20} color={colors.chatIcon} />
                </TouchableOpacity>

                {selectedImage && <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />}

                <TextInput
                  style={[styles.input, { backgroundColor: colors.transparent, color: colors.text, borderColor: colors.chatBorder }]}
                  placeholder="Type a feed"
                  placeholderTextColor={colors.grey}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendButton, {
                    backgroundColor: messageText.trim() || selectedImage ? colors.chatPrimary : colors.chatBorder,
                  }]}
                  onPress={() =>
                    handleSendMessage(
                      selectedImage ? (messageText.trim() ? "text-image" : "image") : "text",
                      selectedImage,
                    )
                  }
                  disabled={!messageText.trim() && !selectedImage}
                >
                  <Send size={18} color={messageText.trim() || selectedImage ? colors.text : colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.chatCard }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)} style={styles.dismissError}>
              <Text style={[styles.dismissText, { color: colors.chatPrimary }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    height: "auto",
    marginBottom: 110,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 40,
  },
  chatList: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  emojiText: {
    fontSize: 24,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  chatUsername: {
    fontSize: 14,
    marginBottom: 2,
  },
  chatLastMessage: {
    fontSize: 14,
  },
  chatMeta: {
    alignItems: "flex-end",
  },
  chatTime: {
    fontSize: 12,
    marginBottom: 4,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 20,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerChatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerChatName: {
    fontSize: 16,
    fontWeight: "600",
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
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 4,
  },
  linkText: {
    textDecorationLine: "underline",
  },
  timestamp: {
    fontSize: 10,
    alignSelf: "flex-end",
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 8,
    paddingVertical: 4,
  },
  replyText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  postCommentContainer: {
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 250,
  },
  postPreviewContainer: {
    flexDirection: "row",
    height: 120,
  },
  postPreviewImage: {
    width: 120,
    height: 120,
    borderTopLeftRadius: 12,
  },
  postDetailsContainer: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  postLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  postCaption: {
    fontSize: 14,
    flex: 1,
  },
  postTimestamp: {
    fontSize: 12,
    fontWeight: "600",
  },
  commentContainer: {
    padding: 12,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  commentText: {
    fontSize: 14,
    marginTop: 2,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedImagePreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
})

export default ChatScreen






// import { useState, useEffect, useRef } from "react"
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   SafeAreaView,
//   FlatList,
//   TextInput,
//   KeyboardAvoidingView,
//   Platform,
//   ActivityIndicator,
//   Image,
//   Alert,
//   Animated,
//   Linking,
//   Dimensions,
// } from "react-native"
// import { PanGestureHandler, State, GestureHandlerRootView } from "react-native-gesture-handler"
// import { useNavigation } from "@react-navigation/native"
// import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
// import { useAuth, api } from "../../contexts/AuthContext"
// import { useTheme } from "../../contexts/ThemeContext"
// import type { RootStackParamList } from "../../types/navigation"
// import { ArrowLeft, UserPlus, UserCheck, Send, X, Reply, Image as ImageIcon, Camera } from "lucide-react-native"
// import * as ImagePicker from "expo-image-picker"
// import { Audio } from "expo-audio"

// type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">

// interface ChatItem {
//   id: string
//   name: string
//   fullName: string
//   avatar: string
//   lastMessage: string
//   lastMessageTime: string
//   unreadCount: number
// }

// interface Message {
//   id: string
//   text?: string
//   image?: string
//   messageType: "text" | "image" | "text-image" | "post-comment"
//   sender: { _id: string; username: string; fullName: string; profilePicture?: string }
//   timestamp: string
//   replyTo?: Message
//   postData?: {
//     image: string
//     caption: string
//     timestamp: string
//   }
// }

// const { width: screenWidth } = Dimensions.get("window")

// // // URL detection regex
// // const URL_REGEX = /(https?:\/\/www\.[^\s]+\.[a-zA-Z]{2,}|www\.[^\s]+\.[a-zA-Z]{2,})/g;
// // Updated URL detection regex to include optional paths
// const URL_REGEX = /(https?:\/\/www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;


// const getEmojiFromName = (name: string) => {
//   const firstLetter = name.charAt(0).toUpperCase()
//   const emojiMap: { [key: string]: string } = {
//     A: "😀",
//     B: "😂",
//     C: "😊",
//     D: "👍",
//     E: "❤️",
//     F: "😎",
//     G: "🎉",
//     H: "🌟",
//     I: "🌈",
//     J: "💡",
//     K: "🔥",
//     L: "🌹",
//     M: "🎶",
//     N: "🌍",
//     O: "🚀",
//     P: "💕",
//     Q: "🌺",
//     R: "🎵",
//     S: "🌞",
//     T: "🍎",
//     U: "🌴",
//     V: "🐱",
//     W: "🐶",
//     X: "🐼",
//     Y: "🐰",
//     Z: "🐸",
//   }
//   return emojiMap[firstLetter] || "👤"
// }

// // Parse custom message format for post comments
// const parsePostCommentMessage = (text: string) => {
//   if (!text) return { isPostComment: false, text }

//   const imgMatch = text.match(/\[img\](.*?)\[\/img\]/)
//   const faintMatch = text.match(/\[faint\](.*?)\[\/faint\]/)
//   const commentMatch = text.match(/Comment: (.*)/)

//   if (imgMatch && faintMatch && commentMatch) {
//     const imageUrl = imgMatch[1]
//     const postDetails = faintMatch[1]
//     const comment = commentMatch[1]

//     // Extract caption and original caption from faint text
//     const parts = postDetails.split(" (")
//     const caption = parts[0]
//     const originalCaption = parts[1] ? parts[1].replace(")", "") : caption

//     return {
//       isPostComment: true,
//       postData: {
//         image: imageUrl,
//         caption: caption,
//         originalCaption: originalCaption,
//         createdAt: "2days ago", // You can make this dynamic
//       },
//       comment: comment,
//     }
//   }

//   return { isPostComment: false, text }
// }

// const PostCommentPreview = ({ postData, comment, colors }: { postData: any; comment: string; colors: any }) => (
//   <View style={[styles.postCommentContainer, { backgroundColor: colors.primary }]}>
//     <View style={styles.postPreviewContainer}>
//       <Image source={{ uri: postData.image }} style={styles.postPreviewImage} />
//       <View style={[styles.postDetailsContainer, { backgroundColor: colors.lightgrey }]}>
//         <Text style={styles.postLabel}>Post:</Text>
//         <Text style={styles.postCaption} numberOfLines={1}>
//           {postData.caption}
//         </Text>
//         <Text style={[styles.postTimestamp, {color: colors.lightgrey}]}>{postData.timestamp}</Text>
//       </View>
//     </View>
//     <View style={[styles.commentContainer, { backgroundColor: colors.chatcom }]}>
//       <Text style={styles.commentLabel}>Comment: </Text>
//       <Text style={styles.commentText}>{comment}</Text>
//     </View>
//   </View>
// )




// const MessageItem = ({
//   item,
//   user,
//   colors,
//   handleSwipeGesture,
//   renderTextWithLinks,
// }: {
//   item: Message
//   user: any
//   colors: any
//   handleSwipeGesture: (event: any, message: Message) => void
//   renderTextWithLinks: (text: string) => any
// }) => {
//   const translateX = useRef(new Animated.Value(0)).current

//   const onGestureEvent = (event: any) => {
//     const translationX = event.nativeEvent.translationX || 0
//     if (translationX >= 0) {
//       translateX.setValue(translationX)
//     } else {
//       translateX.setValue(0)
//     }
//   }

//   const onHandlerStateChange = (event: any) => {
//     const { translationX, state } = event.nativeEvent || {}

//     if (typeof translationX !== "number") {
//       return
//     }

//     if (translationX < 0) {
//       Animated.spring(translateX, {
//         toValue: 0,
//         useNativeDriver: true,
//       }).start()
//       return
//     }

//     if (state === State.END && translationX > 50) {
//       handleSwipeGesture(event, item)
//       Animated.spring(translateX, {
//         toValue: 0,
//         useNativeDriver: true,
//       }).start()
//     } else if (state === State.END) {
//       Animated.spring(translateX, {
//         toValue: 0,
//         useNativeDriver: true,
//       }).start()
//     }
//   }

//   // Parse the message to check if it's a post comment
//   const parsedMessage = item.text ? parsePostCommentMessage(item.text) : { isPostComment: false, text: "" }

//   return (
//     <PanGestureHandler
//       onGestureEvent={onGestureEvent}
//       onHandlerStateChange={onHandlerStateChange}
//       activeOffsetX={[-10, 10]}
//       activeOffsetY={[-10, 10]}
//     >
//       <Animated.View style={{ transform: [{ translateX }] }}>
//         <View
//           style={[
//             styles.messageBubble,
//             item.sender._id === user?.id ? styles.userMessage : styles.otherMessage,
//             {
//               backgroundColor: parsedMessage.isPostComment
//                 ? colors.primary
//                 : item.sender._id === user?.id
//                   ? colors.primary
//                   : colors.card,
//             },
//           ]}
//         >
//           {item.replyTo && (
//             <View style={[styles.replyContainer, { borderLeftColor: colors.border }]}>
//               <Reply size={16} color={colors.placeholder} style={{ marginRight: 6 }} />
//               <Text style={[styles.replyText, { color: colors.placeholder }]} numberOfLines={1}>
//                 {item.replyTo.text || "📷 Image"}
//               </Text>
//             </View>
//           )}

//           {parsedMessage.isPostComment ? (
//             <PostCommentPreview postData={parsedMessage.postData} comment={parsedMessage.comment} colors={colors} />
//           ) : item.messageType === "image" && item.image ? (
//             <TouchableOpacity onPress={() => console.log("Image pressed - could open full screen view")}>
//               <Image source={{ uri: item.image }} style={styles.messageImage} />
//             </TouchableOpacity>
//           ) : item.messageType === "text-image" && item.image && item.text ? (
//             <>
//               <TouchableOpacity onPress={() => console.log("Image pressed - could open full screen view")}>
//                 <Image source={{ uri: item.image }} style={styles.messageImage} />
//               </TouchableOpacity>
//               <Text style={[styles.messageText, { color: item.sender._id === user?.id ? "white" : colors.text }]}>
//                 {renderTextWithLinks(item.text || "")}
//               </Text>
//             </>
//           ) : (
//             <Text style={[styles.messageText, { color: item.sender._id === user?.id ? "white" : colors.text }]}>
//               {renderTextWithLinks(item.text || "")}
//             </Text>
//           )}

//           <Text
//             style={[
//               styles.timestamp,
//               { color: item.sender._id === user?.id ? "rgba(255,255,255,0.7)" : colors.placeholder },
//             ]}
//           >
//             {item.timestamp}
//           </Text>
//         </View>
//       </Animated.View>
//     </PanGestureHandler>
//   )
// }

// const ChatScreen = () => {
//   const navigation = useNavigation<ChatScreenNavigationProp>()
//   const { user, token, refreshToken } = useAuth()
//   const { colors } = useTheme()
//   const [activeChat, setActiveChat] = useState<ChatItem | null>(null)
//   const [messageText, setMessageText] = useState("")
//   const [messages, setMessages] = useState<Message[]>([])
//   const [chats, setChats] = useState<ChatItem[]>([])
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [isFollowing, setIsFollowing] = useState(false)
//   const [replyingTo, setReplyingTo] = useState<Message | null>(null)
//   const [sendSound, setSendSound] = useState<Audio.AudioPlayer | null>(null)
//   const [receiveSound, setReceiveSound] = useState<Audio.AudioPlayer | null>(null)
//   const [selectedImage, setSelectedImage] = useState<string | null>(null)
//   const flatListRef = useRef<FlatList>(null)

//   // Load sounds
//   useEffect(() => {
//     const loadSounds = async () => {
//       try {
//         // Create simple notification sounds using data URIs or local files
//         const sendSnd = Audio.createAudioPlayer({
//           source: { uri: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" },
//         })
//         const receiveSnd = Audio.createAudioPlayer({
//           source: { uri: "https://www.soundjay.com/misc/sounds/bell-ringing-04.wav" },
//         })
//         setSendSound(sendSnd)
//         setReceiveSound(receiveSnd)
//       } catch (error) {
//         console.log("Error loading sounds:", error)
//       }
//     }
//     loadSounds()

//     return () => {
//       // Cleanup sounds
//       sendSound?.remove()
//       receiveSound?.remove()
//     }
//   }, [])

//   const playSound = async (type: "send" | "receive") => {
//     try {
//       if (type === "send" && sendSound) {
//         await sendSound.play()
//       } else if (type === "receive" && receiveSound) {
//         await receiveSound.play()
//       }
//     } catch (error) {
//       console.log("Error playing sound:", error)
//     }
//   }

//   const fetchChats = async () => {
//     if (!token) return

//     setLoading(true)
//     try {
//       const response = await api.get("/chats")
//       const { chats: chatData } = response.data

//       const sortedChats = chatData
//         .map((chat: ChatItem) => ({
//           ...chat,
//           avatar: chat.avatar || getEmojiFromName(chat.name),
//         }))
//         .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

//       setChats(sortedChats)
//       setError(null)
//     } catch (error: any) {
//       console.error("Error fetching chats:", error)
//       if (error.response?.status === 401) {
//         try {
//           await refreshToken()
//           const response = await api.get("/chats")
//           const { chats: chatData } = response.data
//           const sortedChats = chatData
//             .map((chat: ChatItem) => ({
//               ...chat,
//               avatar: chat.avatar || getEmojiFromName(chat.name),
//             }))
//             .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
//           setChats(sortedChats)
//           setError(null)
//         } catch (refreshError) {
//           setError("Session expired. Please log in again.")
//         }
//       } else {
//         setError(error.response?.data?.message || "Failed to fetch chats")
//       }
//     } finally {
//       setLoading(false)
//     }
//   }



//   const fetchMessages = async (chatId: string) => {
//     if (!token) return

//     setLoading(true)
//     try {
//       // Add logging to confirm the value of chatId
//       console.log("Fetching messages for chatId:", chatId)

//       const response = await api.get(`/chats/${chatId}`)
//       const { messages: messageData } = response.data

//       const formattedMessages = messageData.map((msg: any) => {
//         const parsedMessage = parsePostCommentMessage(msg.message || "")

//         return {
//           id: msg._id,
//           text: msg.message,
//           image: msg.image,
//           messageType: parsedMessage.isPostComment ? "post-comment" : msg.messageType || "text",
//           sender: msg.sender,
//           timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
//           postData: parsedMessage.isPostComment ? parsedMessage.postData : undefined,
//         }
//       })



//       setMessages(formattedMessages)



//       // Mark messages as read
//       try {
//         console.log("Marking messages as read for chatId:", chatId)
//         const url = `/chats/${chatId}/mark-as-read` // Construct the URL
//         console.log("Constructed URL:", url) // Log the URL
//         await api.post(url)
//         // await api.post(`/chats/${chatId}/mark-read`)

//         // Update local chat list to remove unread count
//         setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)))
//       } catch (readError) {
//         console.log("Error marking messages as read:", readError)
//       }

//       setError(null)
//       setTimeout(() => {
//         flatListRef.current?.scrollToEnd({ animated: true })
//       }, 100)
//     } catch (error: any) {
//       console.error("Error fetching messages:", error)
//       if (error.response?.status === 401) {
//         try {
//           await refreshToken()
//           const response = await api.get(`/chats/${chatId}`)
//           const { messages: messageData } = response.data
//           const formattedMessages = messageData.map((msg: any) => {
//             const parsedMessage = parsePostCommentMessage(msg.message || "")

//             return {
//               id: msg._id,
//               text: msg.message,
//               image: msg.image,
//               messageType: parsedMessage.isPostComment ? "post-comment" : msg.messageType || "text",
//               sender: msg.sender,
//               timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
//               postData: parsedMessage.isPostComment ? parsedMessage.postData : undefined,
//             }
//           })
//           setMessages(formattedMessages)
//           setError(null)
//           setTimeout(() => {
//             flatListRef.current?.scrollToEnd({ animated: true })
//           }, 100)
//         } catch (refreshError) {
//           setError("Session expired. Please log in again.")
//         }
//       } else {
//         setError(error.response?.data?.message || "Failed to fetch messages")
//       }
//     } finally {
//       setLoading(false)
//     }
//   }



//   const checkFollowStatus = async (userId: string) => {
//     if (!user || !token) return

//     try {
//       const response = await api.post(`/users/${userId}/is-following`, {
//         followerId: user.id,
//       })
//       setIsFollowing(response.data.isFollowing)
//     } catch (error: any) {
//       console.error("Error checking follow status:", error)
//       if (error.response?.status === 401) {
//         try {
//           await refreshToken()
//           const response = await api.post(`/users/${userId}/is-following`, {
//             followerId: user.id,
//           })
//           setIsFollowing(response.data.isFollowing)
//         } catch (refreshError) {
//           console.error("Error checking follow status after refresh:", refreshError)
//         }
//       }
//     }
//   }




//   useEffect(() => {
//     if (token) {
//       fetchChats()
//     }
//   }, [token])

//   useEffect(() => {
//     if (!activeChat || !token) return
//     fetchMessages(activeChat.id)
//     checkFollowStatus(activeChat.id)
//   }, [activeChat, token])






// const handleSendMessage = async (messageType: "text" | "image" | "text-image" = "text", imageUri?: string) => {
//   if ((!messageText.trim() && !imageUri && messageType === "text") || !activeChat || !user) {
//     console.log("Invalid input: No text or image provided for text message");
//     return;
//   }

//   // Validate imageUri
//   if (imageUri && (!imageUri.trim() || !imageUri.startsWith("file://"))) {
//     console.error("Invalid image URI:", imageUri);
//     setError("Invalid image selected. Please choose a valid image.");
//     return;
//   }

//   const newMessage: Message = {
//     id: Date.now().toString(),
//     text: messageText.trim() ? messageText : undefined,
//     image: imageUri,
//     messageType: imageUri ? (messageText.trim() ? "text-image" : "image") : "text",
//     sender: {
//       _id: user.id,
//       username: user.username,
//       fullName: user.fullName,
//       profilePicture: user.profilePicture,
//     },
//     timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
//     replyTo: replyingTo || undefined,
//   };

//   try {
//     let messageToSend = messageText.trim();
//     if (replyingTo) {
//       messageToSend = `Replying to "${replyingTo.text || "image"}": ${messageText.trim()}`;
//     }

//     const formData = new FormData();
//     if (messageToSend) formData.append("message", messageToSend);
//     formData.append("messageType", newMessage.messageType);

//     if (imageUri) {
//       console.log("Appending image with URI:", imageUri);
//       formData.append("image", {
//         uri: imageUri,
//         type: "image/jpeg",
//         name: "chat-image.jpg",
//       } as any);
//     }

//     console.log("Sending FormData with messageType:", newMessage.messageType);
//     console.log("Message:", messageToSend);
//     console.log("Image URI:", imageUri);

//     const response = await api.post(`/chats/${activeChat.id}`, formData, {
//       headers: {
//         "Content-Type": "multipart/form-data",
//       },
//     });

//     console.log("API Response:", response.data);

//     setMessages((prev) => [...prev, newMessage]);
//     setMessageText("");
//     setSelectedImage(null);
//     setReplyingTo(null);

//     await playSound("send");

//     setTimeout(() => {
//       flatListRef.current?.scrollToEnd({ animated: true });
//     }, 100);

//     setChats((prev) =>
//       prev
//         .map((chat) =>
//           chat.id === activeChat.id
//             ? {
//                 ...chat,
//                 lastMessage: imageUri
//                   ? messageText.trim()
//                     ? `${messageText} (with image)`
//                     : "📷 Image"
//                   : messageText,
//                 lastMessageTime: new Date().toISOString(),
//               }
//             : chat
//         )
//         .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
//     );
//     setError(null);
//   } catch (error: any) {
//     console.error("Error sending message:", error);
//     console.error("Error response:", error.response?.data);
//     console.error("Status:", error.response?.status);
//     if (error.response?.status === 401) {
//       try {
//         await refreshToken();
//         // Retry the request
//         const formData = new FormData();
//         if (messageToSend) formData.append("message", messageToSend);
//         formData.append("messageType", newMessage.messageType);
//         if (imageUri) {
//           formData.append("image", {
//             uri: imageUri,
//             type: "image/jpeg",
//             name: "chat-image.jpg",
//           } as any);
//         }
//         const response = await api.post(`/chats/${activeChat.id}`, formData, {
//           headers: {
//             "Content-Type": "multipart/form-data",
//           },
//         });
//         setMessages((prev) => [...prev, newMessage]);
//         setMessageText("");
//         setSelectedImage(null);
//         setReplyingTo(null);
//         setTimeout(() => {
//           flatListRef.current?.scrollToEnd({ animated: true });
//         }, 100);
//         setChats((prev) =>
//           prev
//             .map((chat) =>
//               chat.id === activeChat.id
//                 ? {
//                     ...chat,
//                     lastMessage: imageUri
//                       ? messageText.trim()
//                         ? `${messageText} (with image)`
//                         : "📷 Image"
//                       : messageText,
//                     lastMessageTime: new Date().toISOString(),
//                   }
//                 : chat
//             )
//             .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
//         );
//         setError(null);
//       } catch (refreshError) {
//         setError("Session expired. Please log in again.");
//       }
//     } else {
//       setError(error.response?.data?.message || `Failed to send message: ${error.message}`);
//     }
//   }
// };




//   const handleImagePicker = async () => {
//     try {
//       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
//       if (status !== "granted") {
//         Alert.alert("Permission needed", "Please grant camera roll permissions to send images.")
//         return
//       }

//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         allowsEditing: false,
//         // aspect: [4, 3],
//         quality: 0.8,
//       })

//       if (!result.canceled && result.assets[0]) {
//         setSelectedImage(result.assets[0].uri)
//       }
//     } catch (error) {
//       console.error("Error picking image:", error)
//       Alert.alert("Error", "Failed to pick image")
//     }
//   }




//   const handleCameraPicker = async () => {
//     try {
//       const { status } = await ImagePicker.requestCameraPermissionsAsync()
//       if (status !== "granted") {
//         Alert.alert("Permission needed", "Please grant camera permissions to take photos.")
//         return
//       }

//       const result = await ImagePicker.launchCameraAsync({
//         allowsEditing: false,
//         // aspect: [4, 3],
//         quality: 0.8,
//       })

//       if (!result.canceled && result.assets[0]) {
//         setSelectedImage(result.assets[0].uri)
//       }
//     } catch (error) {
//       console.error("Error taking photo:", error)
//       Alert.alert("Error", "Failed to take photo")
//     }
//   }



//   const handleFollow = async () => {
//     if (!activeChat || !user) return

//     try {
//       const endpoint = isFollowing ? "unfollow" : "follow"
//       await api.post(`/users/${activeChat.id}/${endpoint}`, {
//         followerId: user.id,
//       })

//       setIsFollowing(!isFollowing)
//       Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${activeChat.name}`)
//     } catch (error: any) {
//       console.error("Error following/unfollowing user:", error)
//       if (error.response?.status === 401) {
//         try {
//           await refreshToken()
//           const endpoint = isFollowing ? "unfollow" : "follow"
//           await api.post(`/users/${activeChat.id}/${endpoint}`, {
//             followerId: user.id,
//           })
//           setIsFollowing(!isFollowing)
//           Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${activeChat.name}`)
//         } catch (refreshError) {
//           Alert.alert("Error", "Session expired. Please log in again.")
//         }
//       } else {
//         Alert.alert("Error", error.response?.data?.message || "Failed to update follow status")
//       }
//     }
//   }




//   const handleBackToChats = () => {
//     setActiveChat(null)
//     setMessages([])
//     setIsFollowing(false)
//     setReplyingTo(null)
//     setSelectedImage(null)
//   }



//   const handleSwipeGesture = (event: any, message: Message) => {
//     const { translationX, state } = event.nativeEvent || {}
//     if (state === State.END && translationX > 50) {
//       setReplyingTo(message)
//     }
//   }




// const handleLinkPress = async (url: string) => {
//   try {
//     let formattedUrl = url;
//     if (url.startsWith("www.") && !url.startsWith("http://") && !url.startsWith("https://")) {
//       formattedUrl = `https://${url}`;
//     } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
//       formattedUrl = `https://${url}`;
//     }
//     // Updated validation regex to include optional paths
//     const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:\/[-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/;
//     if (!urlRegex.test(formattedUrl)) {
//       console.error("Invalid URL format:", formattedUrl);
//       Alert.alert("Error", "The URL format is invalid.");
//       return;
//     }
//     console.log("Attempting to open URL:", formattedUrl);
//     if (Platform.OS === "android" && formattedUrl.startsWith("https://")) {
//       console.log("Bypassing canOpenURL on Android for HTTPS URL:", formattedUrl);
//       await Linking.openURL(formattedUrl);
//     } else {
//       const supported = await Linking.canOpenURL(formattedUrl);
//       if (supported) {
//         await Linking.openURL(formattedUrl);
//       } else {
//         console.error("URL not supported:", formattedUrl);
//         Alert.alert("Error", "This URL cannot be opened on your device.");
//       }
//     }
//   } catch (error) {
//     console.error("Error opening URL:", error);
//     Alert.alert("Error", `Failed to open the URL: ${error.message}`);
//   }
// };








//   const renderTextWithLinks = (text: string) => {
//   const parts = text.split(URL_REGEX);
//   return parts.map((part, index) => {
//     if (URL_REGEX.test(part)) {
//       return (
//         <Text key={index} style={styles.linkText} onPress={() => handleLinkPress(part)} style={{color: colors.link, textDecorationLine: "none"}}>
//           {part}
//         </Text>
//       );
//     }
//     return part;
//   });
// };




//   const renderChatItem = ({ item }: { item: ChatItem }) => (
//     <TouchableOpacity
//       style={[styles.chatItem, { backgroundColor: colors.background }]}
//       onPress={() => setActiveChat(item)}
//     >
//       <View style={[styles.avatar, { backgroundColor: item.avatar.startsWith("http") ? "transparent" : colors.icon }]}>
//         {item.avatar.startsWith("http") ? (
//           <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
//         ) : (
//           <Text style={[styles.emojiText, { color: colors.text }]}>{item.avatar}</Text>
//         )}
//       </View>
//       <View style={styles.chatInfo}>
//         <Text style={[styles.chatName, { color: colors.text }]}>{item.fullName || item.name}</Text>
//         <Text style={[styles.chatUsername, { color: colors.grey }]}>@{item.name}</Text>
//         <Text style={[styles.chatLastMessage, { color: colors.grey }]} numberOfLines={1}>
//           {item.lastMessage}
//         </Text>
//       </View>
//       <View style={styles.chatMeta}>
//         <Text style={[styles.chatTime, { color: colors.placeholder }]}>
//           {new Date(item.lastMessageTime).toLocaleDateString()}
//         </Text>
//         {item.unreadCount > 0 && (
//           <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
//             <Text style={styles.unreadText}>{item.unreadCount}</Text>
//           </View>
//         )}
//       </View>
//     </TouchableOpacity>
//   )



//   const renderMessage = ({ item }: { item: Message }) => (
//     <MessageItem
//       item={item}
//       user={user}
//       colors={colors}
//       handleSwipeGesture={handleSwipeGesture}
//       renderTextWithLinks={renderTextWithLinks}
//     />
//   )


  
//   const renderEmpty = () => (
//     <View style={styles.emptyContainer}>
//       <Text style={[styles.emptyText, { color: colors.text }]}>
//         {error ? error : "No conversations yet. Start chatting with someone!"}
//       </Text>
//       {error && (
//         <TouchableOpacity
//           onPress={() => fetchChats()}
//           style={[styles.retryButton, { backgroundColor: colors.primary }]}
//         >
//           <Text style={styles.retryText}>Retry</Text>
//         </TouchableOpacity>
//       )}
//     </View>
//   )

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
//         {loading && (
//           <View style={styles.loadingOverlay}>
//             <ActivityIndicator size="large" color={colors.primary} />
//           </View>
//         )}

//         {!activeChat ? (
//           <>
//             <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
//               <TouchableOpacity
//                 onPress={() => navigation.goBack()}
//                 style={[styles.backButton, { backgroundColor: colors.primary }]}
//               >
//                 <ArrowLeft size={20} color="white" />
//               </TouchableOpacity>
//               <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
//               <View style={styles.headerRight} />
//             </View>

//             <FlatList
//               data={chats}
//               renderItem={renderChatItem}
//               keyExtractor={(item) => item.id}
//               contentContainerStyle={styles.chatList}
//               ListEmptyComponent={renderEmpty}
//               showsVerticalScrollIndicator={true}
//             />
//           </>
//         ) : (
//           <KeyboardAvoidingView
//             behavior={Platform.OS === "ios" ? "padding" : "height"}
//             style={[styles.container, { marginBottom: -5 }]}
//             keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 60}
//           >
//             <View
//               style={[styles.chatRoomHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
//             >
//               <TouchableOpacity
//                 onPress={handleBackToChats}
//                 style={[styles.backButton, { backgroundColor: colors.primary }]}
//               >
//                 <ArrowLeft size={20} color="white" />
//               </TouchableOpacity>

//               <View
//                 style={[
//                   styles.avatar,
//                   { backgroundColor: activeChat.avatar.startsWith("http") ? "transparent" : colors.icon },
//                 ]}
//               >
//                 {activeChat.avatar.startsWith("http") ? (
//                   <Image source={{ uri: activeChat.avatar }} style={styles.headerAvatar} />
//                 ) : (
//                   <Text style={[styles.emojiText, { color: colors.text }]}>{activeChat.avatar}</Text>
//                 )}
//               </View>

//               <View style={styles.headerChatInfo}>
//                 <Text style={[styles.headerChatName, { color: colors.text }]}>
//                   {activeChat.fullName || activeChat.name}
//                 </Text>
//                 <Text style={[styles.headerChatUsername, { color: colors.text }]}>@{activeChat.name}</Text>
//               </View>

//               <TouchableOpacity
//                 onPress={handleFollow}
//                 style={[
//                   styles.followButton,
//                   {
//                     backgroundColor: isFollowing ? colors.border : colors.primary,
//                     borderColor: colors.primary,
//                   },
//                 ]}
//               >
//                 {isFollowing ? <UserCheck size={16} color={colors.text} /> : <UserPlus size={16} color="white" />}
//               </TouchableOpacity>
//             </View>

//             <FlatList
//               ref={flatListRef}
//               data={messages}
//               renderItem={renderMessage}
//               keyExtractor={(item) => item.id}
//               contentContainerStyle={styles.messageList}
//               showsVerticalScrollIndicator={true}
//               onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
//             />

//             <View
//               style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}
//             >
//               {replyingTo && (
//                 <View style={[styles.replyPreview, { backgroundColor: colors.card, borderLeftColor: colors.primary }]}>
//                   <View style={styles.replyPreviewContent}>
//                     <Reply size={16} color={colors.primary} />
//                     <Text style={[styles.replyPreviewText, { color: colors.text }]} numberOfLines={1}>
//                       Replying to: {replyingTo.text || "📷 Image"}
//                     </Text>
//                   </View>
//                   <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseButton}>
//                     <X size={16} color={colors.text} />
//                   </TouchableOpacity>
//                 </View>
//               )}
//               <View style={styles.inputRow}>
//                 <TouchableOpacity
//                   onPress={handleImagePicker}
//                   style={[styles.mediaButton, { backgroundColor: colors.card }]}
//                 >
//                   <ImageIcon size={20} color={colors.icon} />
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                   onPress={handleCameraPicker}
//                   style={[styles.mediaButton, { backgroundColor: colors.card }]}
//                 >
//                   <Camera size={20} color={colors.icon} />
//                 </TouchableOpacity>

//                 {selectedImage && <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />}

//                 <TextInput
//                   style={[
//                     styles.input,
//                     { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
//                   ]}
//                   placeholder="Type a message"
//                   placeholderTextColor={colors.text}
//                   value={messageText}
//                   onChangeText={setMessageText}
//                   multiline
//                 />
//                 <TouchableOpacity
//                   style={[
//                     styles.sendButton,
//                     { backgroundColor: messageText.trim() || selectedImage ? colors.primary : colors.border },
//                   ]}
//                   onPress={() =>
//                     handleSendMessage(
//                       selectedImage ? (messageText.trim() ? "text-image" : "image") : "text",
//                       selectedImage,
//                     )
//                   }
//                   disabled={!messageText.trim() && !selectedImage}
//                 >
//                   <Send size={18} color={messageText.trim() || selectedImage ? "white" : colors.text} />
//                 </TouchableOpacity>
//               </View>
//             </View>
//           </KeyboardAvoidingView>
//         )}

//         {error && (
//           <View style={[styles.errorContainer, { backgroundColor: colors.card }]}>
//             <Text style={[styles.errorText, { color: "red" }]}>{error}</Text>
//             <TouchableOpacity onPress={() => setError(null)} style={styles.dismissError}>
//               <Text style={[styles.dismissText, { color: colors.primary }]}>Dismiss</Text>
//             </TouchableOpacity>
//           </View>
//         )}
//       </SafeAreaView>
//     </GestureHandlerRootView>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     paddingTop: 20,
//     height: "auto",
//     marginBottom: 110,
//   },
//   loadingOverlay: {
//     position: "absolute",
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: "rgba(0,0,0,0.1)",
//     zIndex: 1000,
//   },
//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     paddingVertical: 16,
//     borderBottomWidth: 0.5,
//   },
//   backButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 5,
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//   },
//   headerRight: {
//     width: 40,
//   },
//   chatList: {
//     paddingHorizontal: 16,
//     flexGrow: 1,
//   },
//   chatItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 16,
//     borderRadius: 8,
//     marginBottom: 8,
//   },
//   avatar: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     marginRight: 12,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   avatarImage: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//   },
//   emojiText: {
//     fontSize: 24,
//   },
//   chatInfo: {
//     flex: 1,
//   },
//   chatName: {
//     fontSize: 16,
//     fontWeight: "600",
//     marginBottom: 2,
//   },
//   chatUsername: {
//     fontSize: 14,
//     marginBottom: 2,
//   },
//   chatLastMessage: {
//     fontSize: 14,
//   },
//   chatMeta: {
//     alignItems: "flex-end",
//   },
//   chatTime: {
//     fontSize: 12,
//     marginBottom: 4,
//   },
//   unreadBadge: {
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 12,
//     minWidth: 20,
//     alignItems: "center",
//   },
//   unreadText: {
//     fontSize: 12,
//     fontWeight: "500",
//     color: "white",
//   },
//   chatRoomHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     paddingVertical: 16,
//     borderBottomWidth: 1,
//   },
//   headerAvatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//   },
//   headerChatInfo: {
//     flex: 1,
//     marginLeft: 12,
//   },
//   headerChatName: {
//     fontSize: 16,
//     fontWeight: "600",
//   },
//   headerChatUsername: {
//     fontSize: 14,
//   },
//   followButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 16,
//     borderWidth: 1,
//   },
//   messageList: {
//     padding: 16,
//     flexGrow: 1,
//   },
//   messageBubble: {
//     maxWidth: "85%",
//     padding: 12,
//     borderRadius: 16,
//     marginBottom: 16,
//   },
//   userMessage: {
//     alignSelf: "flex-end",
//     borderBottomRightRadius: 4,
//   },
//   otherMessage: {
//     alignSelf: "flex-start",
//     borderBottomLeftRadius: 4,
//   },
//   messageText: {
//     fontSize: 14,
//     marginBottom: 4,
//   },
//   messageImage: {
//     width: 200,
//     height: 150,
//     borderRadius: 8,
//     marginBottom: 4,
//   },
//   linkText: {
//     textDecorationLine: "none",
//   },
//   timestamp: {
//     fontSize: 10,
//     alignSelf: "flex-end",
//   },
//   replyContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     borderLeftWidth: 3,
//     paddingLeft: 8,
//     marginBottom: 8,
//     paddingVertical: 4,
//   },
//   replyText: {
//     fontSize: 12,
//     fontStyle: "italic",
//   },
//   // Post Comment Styles
//   postCommentContainer: {
//     borderRadius: 12,
//     overflow: "hidden",
//     minWidth: 250,
//   },
//   postPreviewContainer: {
//     flexDirection: "row",
//     height: 120,
//   },
//   postPreviewImage: {
//     width: 120,
//     height: 120,
//     borderTopLeftRadius: 12,
//   },
//   postDetailsContainer: {
//     flex: 1,
//     padding: 12,
//     justifyContent: "space-between",
//   },
//   postLabel: {
//     color: "white",
//     fontSize: 16,
//     fontWeight: "bold",
//     marginBottom: 4,
//   },
//   postCaption: {
//     color: "white",
//     fontSize: 14,
//     flex: 1,
//   },
//   postTimestamp: {
//     color: "white",
//     fontSize: 12,
//     fontWeight: "600",
//   },
//   commentContainer: {
//     padding: 12,
//     backgroundColor: "rgba(255,255,255,0.1)",
//   },
//   commentLabel: {
//     color: "white",
//     fontSize: 14,
//     fontWeight: "600",
//   },
//   commentText: {
//     color: "white",
//     fontSize: 14,
//     marginTop: 2,
//   },
//   inputContainer: {
//     padding: 16,
//     borderTopWidth: 1,
//   },
//   replyPreview: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     padding: 12,
//     marginBottom: 8,
//     borderRadius: 8,
//     borderLeftWidth: 3,
//   },
//   replyPreviewContent: {
//     flexDirection: "row",
//     alignItems: "center",
//     flex: 1,
//   },
//   replyPreviewText: {
//     marginLeft: 8,
//     fontSize: 14,
//     flex: 1,
//   },
//   replyCloseButton: {
//     padding: 4,
//   },
//   inputRow: {
//     flexDirection: "row",
//     alignItems: "flex-end",
//     gap: 8,
//   },
//   mediaButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   selectedImagePreview: {
//     width: 40,
//     height: 40,
//     borderRadius: 8,
//   },
//   input: {
//     flex: 1,
//     minHeight: 40,
//     maxHeight: 100,
//     borderRadius: 20,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     borderWidth: 1,
//     textAlignVertical: "top",
//   },
//   sendButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     padding: 40,
//   },
//   emptyText: {
//     fontSize: 16,
//     textAlign: "center",
//     marginBottom: 20,
//   },
//   retryButton: {
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//     borderRadius: 20,
//   },
//   retryText: {
//     color: "white",
//     fontSize: 16,
//     fontWeight: "600",
//   },
//   errorContainer: {
//     position: "absolute",
//     bottom: 140,
//     left: 16,
//     right: 16,
//     padding: 12,
//     borderRadius: 8,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     elevation: 5,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 4,
//   },
//   errorText: {
//     flex: 1,
//     fontSize: 14,
//   },
//   dismissError: {
//     marginLeft: 12,
//   },
//   dismissText: {
//     fontSize: 14,
//     fontWeight: "600",
//   },
// })

// export default ChatScreen


