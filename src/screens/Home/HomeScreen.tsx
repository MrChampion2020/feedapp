import type React from "react"
import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Share,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import { useFocusEffect } from "@react-navigation/native"
import { Audio, Video, ResizeMode } from "expo-av"
import {
  Heart,
  MessageCircle,
  Share as ShareIcon,
  MoreHorizontal,
  Eye,
  Bell,
  MessageSquare,
  Search,
  UserX,
  Ban,
  UserPlus,
  Trash2,
  MessageSquarePlus,
  X,
  Volume2,
  VolumeX,
} from "lucide-react-native"
import VerifiedBadge from "../../components/VerifiedBadge"
import { getUserVerificationStatus } from "../../utils/userUtils"
import { colors as appColors } from "../../constants/colors";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

interface Media {
  url: string
  type: "image" | "video"
}

interface Post {
  _id: string
  user: {
    _id: string
    username: string
    fullName: string
    profilePicture?: string
  }
  media: Media[]
  caption: string
  likes: string[]
  comments: any[]
  views: number
  hashtags: string[]
  viralScore?: number
  isViral?: boolean
  createdAt: string
}

interface HomeScreenProps {
  navigation: any
  onTabBarVisibilityChange?: (visible: boolean) => void
}

interface MediaItemProps {
  media: Media
  postId: string
  style?: any
  onPress: () => void
  isLastVisible?: boolean
  moreImagesCount?: number
  isVisible: boolean
}

const MediaItem: React.FC<MediaItemProps> = ({ media, postId, style, onPress, isLastVisible, moreImagesCount, isVisible }) => {
  const { colors } = useTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const videoRef = useRef<Video>(null)

  useEffect(() => {
    if (media.type === "video" && videoRef.current) {
      if (isVisible) {
        videoRef.current.playAsync().then(() => setIsPlaying(true)).catch((error) => console.error(`Play failed for post ${postId}:`, error))
      } else {
        videoRef.current.pauseAsync().then(() => setIsPlaying(false)).catch((error) => console.error(`Pause failed for post ${postId}:`, error))
      }
    }
  }, [isVisible, media.type])

  const handlePress = () => {
    if (media.type === "video") {
      if (isPlaying) {
        videoRef.current?.pauseAsync().then(() => setIsPlaying(false))
      } else {
        videoRef.current?.playAsync().then(() => setIsPlaying(true))
      }
    } else {
      onPress()
    }
  }

  const handleLongPress = () => {
    if (media.type === "video") {
      setShowControls(true)
      setTimeout(() => setShowControls(false), 3000) // Hide controls after 3s
    }
  }

  const toggleMute = () => {
    setIsMuted((prev) => !prev)
  }

  return (
    <Pressable style={style} onPress={handlePress} onLongPress={handleLongPress}>
      {media.type === "video" ? (
        <View style={styles.mediaContainer}>
          <Video
            ref={videoRef}
            source={{ uri: media.url }}
            style={styles.fullImage}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={showControls}
            isMuted={isMuted}
            isLooping
            shouldPlay={isVisible && isPlaying}
            onError={(error) => console.error(`Video failed for post ${postId}:`, error)}
            onLoad={() => console.log(`Video loaded for post ${postId}: ${media.url}`)}
          />
          {!isPlaying && (
            <TouchableOpacity style={styles.playButton} onPress={() => videoRef.current?.playAsync().then(() => setIsPlaying(true))}>
              <Text style={styles.playButtonText}>▶</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
            {isMuted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      ) : (
        <Image
          source={{ uri: media.url }}
          style={styles.fullImage}
          onError={() => console.error(`Image failed for post ${postId}: ${media.url}`)}
        />
      )}
      {isLastVisible && moreImagesCount !== undefined && (
        <View style={styles.moreImagesOverlay}>
          <Text style={styles.moreImagesText}>+{moreImagesCount}</Text>
        </View>
      )}
    </Pressable>
  )
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, onTabBarVisibilityChange }) => {
  const { user, token, refreshToken, logout, isConnected } = useAuth()
  const { colors, theme } = useTheme()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [activeDropdownPostId, setActiveDropdownPostId] = useState<string | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const [commentModalVisible, setCommentModalVisible] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [commentLoading, setCommentLoading] = useState(false)
  const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
  const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)

  const [likeAnimations, setLikeAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [likeCountAnimations, setLikeCountAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [likeBounceAnimations, setLikeBounceAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [likeColorAnimations, setLikeColorAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null)
  const scrollY = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)
  const tabBarTranslateY = useRef(new Animated.Value(0)).current
  const commentInputRef = useRef<TextInput>(null)
  const likeAnimationsRef = useRef<{ [key: string]: Animated.Value }>({})
  const likeColorAnimationsRef = useRef<{ [key: string]: Animated.Value }>({})
  const likeCountAnimationsRef = useRef<{ [key: string]: Animated.Value }>({})
  const likeBounceAnimationsRef = useRef<{ [key: string]: Animated.Value }>({})
  const [initializedPosts, setInitializedPosts] = useState<Set<string>>(new Set())
  const [expandedPosts, setExpandedPosts] = useState<{ [postId: string]: boolean }>({});

  useEffect(() => {
    const loadSounds = async () => {
      try {
              const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
      const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
        setLikeSound(likeAudio)
        setCommentSound(commentAudio)
      } catch (error) {
        console.log("Sound files not found, continuing without sounds:", error)
      }
    }
    loadSounds()
    return () => {
      likeSound?.unloadAsync()
      commentSound?.unloadAsync()
    }
  }, [])

  const playSound = async (sound: Audio.Sound | null) => {
    try {
      if (sound) await sound.replayAsync()
    } catch (error) {
      console.log("Error playing sound:", error)
    }
  }

  const checkServerConnection = async () => {
    try {
      await api.get('/health');
      return true;
    } catch (error) {
      console.log("Server connection failed:", error)
      return false;
    }
  }

  const fetchNotificationCounts = async () => {
    try {
      if (!isConnected) return
      const [notificationsResponse, chatsResponse] = await Promise.all([
        api.get("/notifications?limit=1"),
        api.get("/chats"),
      ])
      setUnreadNotifications(notificationsResponse.data.unreadCount || 0)
      setUnreadMessages(chatsResponse.data.chats?.reduce((total: number, chat: any) => total + (chat.unreadCount || 0), 0) || 0)
    } catch (error) {
      console.log("Error fetching notification counts:", error)
    }
  }

  const trackPostView = async (postId: string) => {
    try {
      if (!user || !token) return
      await api.get(`/posts/${postId}`)
      setPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, views: (post.views || 0) + 1 } : post)))
    } catch (error) {
      console.log("Error tracking post view:", error)
    }
  }

  const fetchPosts = async (pageNum = 1, isRefresh = false) => {
    try {
      if (!isConnected) {
        setError("No internet connection. Please check your network.")
        setLoading(false)
        setInitialLoad(false)
        return
      }
      if (!token || !user) {
        setError("Please log in to view posts")
        setLoading(false)
        setInitialLoad(false)
        return
      }
      if (!(await checkServerConnection())) {
        setError("Cannot connect to server. Please check if the server is running.")
        setLoading(false)
        setInitialLoad(false)
        return
      }
      if (pageNum === 1) {
        if (isRefresh) setRefreshing(true)
        else if (initialLoad) setLoading(true)
      } else {
        setLoadingMore(true)
      }
      const response = await api.get(`/posts?page=${pageNum}&limit=10&includeViral=true`)
      const { posts: newPosts, pagination } = response.data
      const transformedPosts = newPosts.map((post: any) => {
        // Combine images and videos into media array
        const images = (post.images || []).map((url: any) => {
          if (typeof url !== "string" || !url) {
            return null
          }
          return { url, type: "image" }
        }).filter((media: Media | null) => media !== null)
        
        const videos = (post.videos || []).map((url: any) => {
          if (typeof url !== "string" || !url) {
            return null
          }
          return { url, type: "video" }
        }).filter((media: Media | null) => media !== null)
        
        const media = [...images, ...videos] as Media[]
        return { ...post, media }
      })
      const newLikeAnimations: { [key: string]: Animated.Value } = {}
      const newLikeCountAnimations: { [key: string]: Animated.Value } = {}
      const newLikeBounceAnimations: { [key: string]: Animated.Value } = {}
      const newLikeColorAnimations: { [key: string]: Animated.Value } = {}
      transformedPosts.forEach((post: Post) => {
        const isLiked = user && post.likes.includes(user.id)
        newLikeAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
        newLikeCountAnimations[post._id] = new Animated.Value(post.likes.length)
        newLikeBounceAnimations[post._id] = new Animated.Value(1)
        newLikeColorAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
        trackPostView(post._id)
      })
      setLikeAnimations((prev) => ({ ...prev, ...newLikeAnimations }))
      setLikeCountAnimations((prev) => ({ ...prev, ...newLikeCountAnimations }))
      setLikeBounceAnimations((prev) => ({ ...prev, ...newLikeBounceAnimations }))
      setLikeColorAnimations((prev) => ({ ...prev, ...newLikeColorAnimations }))
      if (pageNum === 1) setPosts(transformedPosts)
      else setPosts((prev) => [...prev, ...transformedPosts])
      setHasMore(pagination?.hasNext || false)
      setPage(pageNum)
      setError(null)
    } catch (error: any) {
      console.error("Error fetching posts:", error)
      if (error.response?.status === 401 || error.response?.status === 403) {
        try {
          await refreshToken()
          const response = await api.get(`/posts?page=${pageNum}&limit=10&includeViral=true`)
          const { posts: newPosts, pagination } = response.data
          const transformedPosts = newPosts.map((post: any) => {
            const images = (post.images || []).map((url: any) => {
              if (typeof url !== "string" || !url) return null
              return { url, type: "image" }
            }).filter((media: Media | null) => media !== null)
            const videos = (post.videos || []).map((url: any) => {
              if (typeof url !== "string" || !url) return null
              return { url, type: "video" }
            }).filter((media: Media | null) => media !== null)
            const media = [...images, ...videos] as Media[]
            return { ...post, media }
          })
          
          // Create animations for retry posts (same logic as main fetch)
          const newLikeAnimations: { [key: string]: Animated.Value } = {}
          const newLikeCountAnimations: { [key: string]: Animated.Value } = {}
          const newLikeBounceAnimations: { [key: string]: Animated.Value } = {}
          const newLikeColorAnimations: { [key: string]: Animated.Value } = {}
          transformedPosts.forEach((post: Post) => {
            const isLiked = user && post.likes.includes(user.id)
            newLikeAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
            newLikeCountAnimations[post._id] = new Animated.Value(post.likes.length)
            newLikeBounceAnimations[post._id] = new Animated.Value(1)
            newLikeColorAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
            trackPostView(post._id)
          })
          setLikeAnimations((prev) => ({ ...prev, ...newLikeAnimations }))
          setLikeCountAnimations((prev) => ({ ...prev, ...newLikeCountAnimations }))
          setLikeBounceAnimations((prev) => ({ ...prev, ...newLikeBounceAnimations }))
          setLikeColorAnimations((prev) => ({ ...prev, ...newLikeColorAnimations }))
          
          if (pageNum === 1) setPosts(transformedPosts)
          else setPosts((prev) => [...prev, ...transformedPosts])
          setHasMore(pagination?.hasNext || false)
          setPage(pageNum)
          setError(null)
        } catch (refreshError) {
          setError("Session expired. Please log in again.")
          Alert.alert("Session Expired", "Please log in again.", [
            { text: "Login", onPress: () => { logout(); navigation.navigate("Login") } },
          ])
        }
      } else {
        setError(error.response?.data?.message || "Failed to load posts")
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
      setInitialLoad(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (token && user) {
        if (posts.length === 0) fetchPosts(1)
        else fetchPosts(1, true)
        fetchNotificationCounts()
      } else {
        setError("Please log in to continue")
        navigation.navigate("Login")
      }
    }, [token, user, isConnected])
  )

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y
      const diff = currentScrollY - lastScrollY.current
      if (diff > 5 && currentScrollY > 100) {
        Animated.timing(tabBarTranslateY, { toValue: 100, duration: 200, useNativeDriver: true }).start()
        onTabBarVisibilityChange?.(false)
      } else if (diff < -5) {
        Animated.timing(tabBarTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }).start()
        onTabBarVisibilityChange?.(true)
      }
      lastScrollY.current = currentScrollY
    },
  })

  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const mostVisibleItem = viewableItems[0].item as Post
      setVisiblePostId(mostVisibleItem._id)
    } else {
      setVisiblePostId(null)
    }
  }).current

  const handleRefresh = () => {
    if (!isConnected) {
      Alert.alert("No Connection", "Please check your internet connection")
      return
    }
    fetchPosts(1, true)
    fetchNotificationCounts()
  }

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && isConnected) fetchPosts(page + 1)
  }

  const handleLike = async (postId: string) => {
    if (!user || !token || !isConnected) {
      Alert.alert("No Connection", "Please check your internet connection")
      return
    }
    try {
      await playSound(likeSound)
      const post = posts.find((p) => p._id === postId)
      if (!post) return
      const isLiked = post.likes.includes(user.id)
      const newLikeCount = isLiked ? post.likes.length - 1 : post.likes.length + 1

      // Enhanced like animation sequence
      if (!isLiked) {
        // Like animation - complex sequence
        if (likeAnimations[postId] && likeBounceAnimations[postId] && likeColorAnimations[postId]) {
          Animated.parallel([
            // Scale and bounce animation
            Animated.sequence([
              Animated.spring(likeAnimations[postId], {
                toValue: 1,
                friction: 3,
                tension: 40,
                useNativeDriver: true,
              }),
              Animated.spring(likeBounceAnimations[postId], {
                toValue: 1.2,
                friction: 2,
                tension: 50,
                useNativeDriver: true,
              }),
              Animated.spring(likeBounceAnimations[postId], {
                toValue: 1,
                friction: 3,
                tension: 40,
                useNativeDriver: true,
              }),
            ]),
            // Color animation
            Animated.timing(likeColorAnimations[postId], {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }),
          ]).start()
        }
      } else {
        // Unlike animation
        if (likeAnimations[postId] && likeColorAnimations[postId]) {
          Animated.parallel([
            Animated.spring(likeAnimations[postId], {
              toValue: 0,
              friction: 3,
              tension: 40,
              useNativeDriver: true,
            }),
            Animated.timing(likeColorAnimations[postId], {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }),
          ]).start()
        }
      }

      // Like count animation
      if (likeCountAnimations[postId]) {
        Animated.sequence([
          Animated.timing(likeCountAnimations[postId], { 
            toValue: isLiked ? newLikeCount + 0.5 : newLikeCount - 0.5, 
            duration: 150, 
            useNativeDriver: true 
          }),
          Animated.timing(likeCountAnimations[postId], { 
            toValue: newLikeCount, 
            duration: 150, 
            useNativeDriver: true 
          }),
        ]).start()
      }

      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId
            ? { ...post, likes: isLiked ? post.likes.filter((id) => id !== user.id) : [...post.likes, user.id] }
            : post
        )
      )
      const response = await api.post(`/posts/${postId}/like`, { userId: user.id })
      setPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, likes: response.data.likes } : post)))
    } catch (error) {
      Alert.alert("Error", "Failed to like post. Please try again.")
      fetchPosts(1)
    }
  }

  const handleCommentPress = (postId: string) => {
    // Find the post object to pass to PostView
    const post = posts.find((p) => p._id === postId);
    navigation.navigate("PostView", { post, postId, openComment: true });
  };

  const handleComment = async () => {
    if (!commentText.trim() || !user || !selectedPostId) return
    try {
      setCommentLoading(true)
      await playSound(commentSound)

      const response = await api.post(`/posts/${selectedPostId}/comment`, { text: commentText.trim() })
      setPosts((prev) =>
        prev.map((post) =>
          post._id === selectedPostId ? { ...post, comments: [...post.comments, response.data.comment] } : post
        )
      )
      const post = posts.find((p) => p._id === selectedPostId)
      if (post && post.user._id !== user.id) {
        try {
          const captionPreview = post.caption ? (post.caption.length > 50 ? `${post.caption.substring(0, 47)}...` : post.caption) : "No caption"
          const chatMessage = `New comment on your post:\n\n${captionPreview}\n\nComment: ${commentText.trim()}`
          await api.post(`/chats/${post.user._id}`, { message: chatMessage, messageType: "text", postId: selectedPostId })
        } catch (chatError) {
          Alert.alert("Warning", "Comment posted, but failed to send chat notification.")
        }
      }
      setCommentText("")
      setCommentModalVisible(false)
      setSelectedPostId(null)
      Alert.alert("Success", "Comment added successfully!")
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        try {
          await refreshToken()
          const response = await api.post(`/posts/${selectedPostId}/comment`, { text: commentText.trim() })
          setPosts((prev) =>
            prev.map((post) =>
              post._id === selectedPostId ? { ...post, comments: [...post.comments, response.data.comment] } : post
            )
          )
          setCommentText("")
          setCommentModalVisible(false)
          setSelectedPostId(null)
          Alert.alert("Success", "Comment added successfully!")
        } catch (refreshError) {
          Alert.alert("Session Expired", "Please log in again.", [
            { text: "Login", onPress: () => { logout(); navigation.navigate("Login") } },
          ])
        }
      } else {
        Alert.alert("Error", "Failed to add comment. Please try again.")
      }
    } finally {
      setCommentLoading(false)
    }
  }

  const handlePostPress = (post: Post) => {
    navigation.navigate("PostView", { post })
  }

  const handleShare = async (post: Post) => {
    try {
      // Create a deep link to the post
      const appUrl = "https://feeda.app" // Replace with your actual app URL
      const postUrl = `${appUrl}/post/${post._id}`
      
      // Create share message with app link
      const shareMessage = `${post.caption || "Check out this post!"} by @${post.user.username}\n\nView on Feeda: ${postUrl}`
      
      await Share.share({
        message: shareMessage,
        url: post.media[0]?.url || postUrl, // Use post URL as fallback if no media
        title: `Post by @${post.user.username}`,
      })
    } catch (error) {
      console.log("Error sharing post:", error)
    }
  }

  const handleHashtagPress = (hashtag: string) => {
    navigation.navigate("Search", { initialQuery: `#${hashtag}`, initialType: "hashtags", activeHashtag: hashtag })
  }

  const handleMorePress = (postId: string) => {
    setActiveDropdownPostId(activeDropdownPostId === postId ? null : postId)
  }

  const handleBlockUser = (userId: string) => {
    Alert.alert("Block User", "Are you sure you want to block this user? You won't see their posts anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            setPosts((prev) => prev.filter((post) => post.user._id !== userId))
            setActiveDropdownPostId(null)
            Alert.alert("Success", "User blocked successfully")
          } catch (error) {
            Alert.alert("Error", "Failed to block user")
          }
        },
      },
    ])
  }

  const handleBlockPost = (postId: string) => {
    Alert.alert("Hide Post", "Are you sure you want to hide this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Hide",
        onPress: () => {
          setPosts((prev) => prev.filter((post) => post._id !== postId))
          setActiveDropdownPostId(null)
        },
      },
    ])
  }

  const handleFollowUser = async (userId: string) => {
    try {
      if (!isConnected) {
        Alert.alert("No Connection", "Please check your internet connection")
        return
      }
      await api.post(`/users/${userId}/follow`, { followerId: user?.id })
      Alert.alert("Success", "You are now following this user")
      setActiveDropdownPostId(null)
    } catch (error) {
      Alert.alert("Error", "Failed to follow user")
    }
  }

  const handleDeletePost = async (postId: string) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (!isConnected) {
              Alert.alert("No Connection", "Please check your internet connection")
              return
            }
            await api.delete(`/posts/${postId}`)
            setPosts((prev) => prev.filter((post) => post._id !== postId))
            setActiveDropdownPostId(null)
            Alert.alert("Success", "Post deleted successfully")
          } catch (error) {
            Alert.alert("Error", "Failed to delete post")
          }
        },
      },
    ])
  }

  const handleOpenChat = (userId: string) => {
    navigation.navigate("Chat", { userId })
    setActiveDropdownPostId(null)
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const postDate = new Date(dateString)
    const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000)
    
    if (diffInSeconds < 60) return "now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}wk`
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}month`
    return `${Math.floor(diffInSeconds / 31536000)}year`
  }

  // Format numbers with K, M, B suffixes
  const formatNumber = (num: number) => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B`
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  // Get color based on count
  const getCountColor = (count: number, baseColor: string) => {
    if (count >= 1000) {
      // Use different gold colors based on theme for better visibility
      return theme === "dark" ? "#FFD700" : "#DAA520" // Light gold for dark theme, dark gold for light theme
    }
    return baseColor
  }

  const renderPostImages = (post: Post) => {
    if (!post.media || post.media.length === 0) {
      return (
        <View style={styles.imageContainer}>
          {/* Removed 'No media available' comment as requested */}
        </View>
      )
    }
    
    if (post.media.length === 1) {
      return (
        <View style={styles.imageContainer}>
          <MediaItem
            media={post.media[0]}
            postId={post._id}
            style={styles.postImage}
            onPress={() => handlePostPress(post)}
            isVisible={visiblePostId === post._id}
          />
        </View>
      )
    }
    
    // Multiple media - use scrollable approach
    return (
      <View style={styles.imageContainer}>
        <FlatList
          data={post.media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${post._id}-${index}`}
          renderItem={({ item: media, index }) => (
            <View style={styles.scrollableMediaWrapper}>
              <MediaItem
                media={media}
                postId={post._id}
                style={styles.scrollableMedia}
                onPress={() => handlePostPress(post)}
                isVisible={visiblePostId === post._id && index === 0} // Only first video auto-plays
              />
            </View>
          )}
          style={styles.scrollableMediaContainer}
        />
        {/* Media indicators for multiple media */}
        {post.media.length > 1 && (
          <View style={styles.mediaIndicators}>
            {post.media.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.mediaIndicator,
                  {
                    backgroundColor: index === 0 ? colors.primary : colors.border,
                    opacity: index === 0 ? 1 : 0.5,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    )
  }

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = user && item.likes?.includes(user.id)
    const isOwnPost = user?.id === item.user._id
    const { isVerified, isPremiumVerified } = getUserVerificationStatus(item.user._id)
    
    // Use theme-aware text color for heartColor
    const themeTextColor = theme === 'dark' ? '#fff' : '#000';
    const heartScale = likeAnimations[item._id]?.interpolate({ 
      inputRange: [0, 0.5, 1], 
      outputRange: [1, 1.3, 1] 
    }) || new Animated.Value(1)
    
    const heartBounce = likeBounceAnimations[item._id] || new Animated.Value(1)
    
    // Ensure color animation exists and is properly initialized
    if (!likeColorAnimations[item._id]) {
      const isLiked = user && item.likes?.includes(user.id)
      likeColorAnimations[item._id] = new Animated.Value(isLiked ? 1 : 0)
    }
    
    // Use animated color interpolation to persist the like state
    const heartColor = isLiked ? appColors.like : themeTextColor;
    
    const isExpanded = expandedPosts[item._id];
    
    // Split caption into hashtags and non-hashtag text
    const words = item.caption ? item.caption.split(/(\s+)/) : [];
    const hashtags = words.filter(w => w.startsWith('#'));
    const nonHashtagText = words.filter(w => !w.startsWith('#')).join('');
    
    return (
      <TouchableOpacity
        style={[styles.postContainer, { backgroundColor: colors.card, borderBottomColor: colors.border, borderLeftWidth: item.isViral ? 3 : 0, borderLeftColor: item.isViral ? "#FF6B35" : "transparent" }]}
        onPress={() => handlePostPress(item)}
        activeOpacity={0.95}
      >
        {item.isViral && (
          <View style={[styles.viralBadge, { backgroundColor: "#FF6B35" }]}>
            <Text style={styles.viralBadgeText}>🔥 Viral</Text>
          </View>
        )}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            onPress={() => navigation.navigate("UserProfile", { userId: item.user._id })} 
            style={styles.userInfoContainer}
            activeOpacity={0.8}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Image source={{ uri: item.user.profilePicture || "https://via.placeholder.com/40" }} style={styles.profileImage} />
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={[styles.fullName, { color: colors.text, fontSize: 14, fontWeight: "500" }]}>{item.user.fullName}</Text>
                <VerifiedBadge size={20} style={{ marginLeft: 2 }} />
                <Text style={[styles.username, { color: colors.text, marginLeft: 4, fontSize: 13 }]}>@{item.user.username}</Text>
                <Text style={[styles.timestamp, { color: colors.text }]}>·</Text>
                <Text style={[styles.timestamp, { color: colors.text }]}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View>
            <TouchableOpacity 
              style={styles.moreButton} 
              onPress={() => handleMorePress(item._id)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreHorizontal size={20} color={colors.icon} />
            </TouchableOpacity>
            {activeDropdownPostId === item._id && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {isOwnPost ? (
                  <TouchableOpacity 
                    style={[styles.dropdownItem, { borderBottomColor: colors.border }]} 
                    onPress={() => handleDeletePost(item._id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#FF3B30" />
                    <Text style={[styles.dropdownText, { color: "#FF3B30" }]}>Delete Post</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]} 
                      onPress={() => handleBlockUser(item.user._id)}
                      activeOpacity={0.7}
                    >
                      <UserX size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Block User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]} 
                      onPress={() => handleBlockPost(item._id)}
                      activeOpacity={0.7}
                    >
                      <Ban size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Hide Post</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]} 
                      onPress={() => handleFollowUser(item.user._id)}
                      activeOpacity={0.7}
                    >
                      <UserPlus size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Follow User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.dropdownItem]} 
                      onPress={() => handleOpenChat(item.user._id)}
                      activeOpacity={0.7}
                    >
                      <MessageSquarePlus size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Message</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
        {item.caption && (
          <View style={styles.captionContainer}>
            {/* Non-hashtag text, limited to 5 lines unless expanded */}
            <Text
              style={[
                styles.caption,
                { color: colors.text, fontSize: 14, fontWeight: "400", lineHeight: 20 },
              ]}
              numberOfLines={isExpanded ? undefined : 5}
              ellipsizeMode="tail"
            >
              {nonHashtagText}
            </Text>
            {/* Show all hashtags always, below the text */}
            {hashtags.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
                {hashtags.map((word, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.hashtag,
                      { color: colors.hashtag, fontSize: 14, fontWeight: "400", marginRight: 6 },
                    ]}
                    onPress={() => handleHashtagPress(word.substring(1))}
                  >
                    {word}
                  </Text>
                ))}
              </View>
            )}
            {/* Show more/less link */}
            {!isExpanded && nonHashtagText.length > 120 && (
              <TouchableOpacity
                style={{ color: colors.primary, fontSize: 13, fontWeight: "500", marginTop: 2 }}
                onPress={() => setExpandedPosts((prev) => ({ ...prev, [item._id]: true }))}
              >
                <Text>Show more</Text>
              </TouchableOpacity>
            )}
            {isExpanded && nonHashtagText.length > 120 && (
              <TouchableOpacity
                style={{ color: colors.primary, fontSize: 13, fontWeight: "500", marginTop: 2 }}
                onPress={() => setExpandedPosts((prev) => ({ ...prev, [item._id]: false }))}
              >
                <Text>Show less</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {renderPostImages(item)}
        <View style={styles.actionsContainer}>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              onPress={(e) => { e.stopPropagation(); handleCommentPress(item._id) }} 
              style={styles.actionButton}
              activeOpacity={0.7}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <MessageCircle size={20} color={getCountColor(item.comments?.length || 0, colors.icon)} />
              <Text style={[styles.actionCount, { color: getCountColor(item.comments?.length || 0, colors.text) }]}>
                {formatNumber(item.comments?.length || 0)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={(e) => { e.stopPropagation(); handleLike(item._id) }} 
              style={styles.actionButton}
              activeOpacity={0.7}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <Animated.View style={{ 
                transform: [
                  { scale: heartScale && heartBounce ? Animated.multiply(heartScale, heartBounce) : 1 }
                ] 
              }}>
                <Heart 
                  size={20} 
                  color={heartColor} 
                  fill={isLiked ? appColors.like : "transparent"} 
                />
              </Animated.View>
              <Animated.Text style={[
                styles.actionCount, 
                { 
                  color: isLiked ? appColors.like : colors.text,
                  opacity: isLiked ? 1 : 0.6,
                  transform: [{ scale: isLiked ? 1.1 : 1 }] 
                }
              ]}>
                {formatNumber(item.likes?.length || 0)}
              </Animated.Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={(e) => { e.stopPropagation(); handleShare(item) }} 
              style={styles.actionButton}
              activeOpacity={0.7}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <ShareIcon size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <View style={styles.viewsContainer}>
            <Eye size={16} color={getCountColor(item.views || 0, colors.text)} />
            <Text style={[styles.viewsText, { color: getCountColor(item.views || 0, colors.text) }]}>
              {formatNumber(item.views || 0)}
            </Text>
            {item.viralScore && (
              <Text style={[styles.viralScore, { color: "#FF6B35" }]}>
                <Text style={{ color: colors.text }}>•</Text> {item.viralScore}🔥
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderHeader = () => (
    <View style={[styles.headerSafeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "cursive", fontSize: 30, fontWeight: "bold", textShadowColor: "#00000033", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 }]}>
            Feeda
          </Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => navigation.navigate("Search")}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Search size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => navigation.navigate("Notifications")}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Bell size={24} color={colors.text} />
              {unreadNotifications > 0 && (
                <View style={[styles.badge, { backgroundColor: "#E91E63" }]}>
                  <Text style={styles.badgeText}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => navigation.navigate("Chat")}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MessageSquare size={24} color={colors.text} />
              {unreadMessages > 0 && (
                <View style={[styles.badge, { backgroundColor: "#E91E63" }]}>
                  <Text style={styles.badgeText}>{unreadMessages > 99 ? "99+" : unreadMessages}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )

  const renderFooter = () => (loadingMore ? (
    <View style={styles.loadingMore}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  ) : null)

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.text }]}>{error ? error : "No posts yet. Start following people or create your first post!"}</Text>
      {error && (
        <TouchableOpacity onPress={() => fetchPosts(1)} style={[styles.retryButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  if (loading && initialLoad) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading posts...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item, index) => `home-${item._id}-${index}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} progressBackgroundColor={colors.card} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{
          minimumViewTime: 300,
          itemVisiblePercentThreshold: 70,
        }}
      />
      <Modal
        visible={commentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setCommentModalVisible(false); setSelectedPostId(null); setCommentText("") }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.commentModal, { backgroundColor: colors.card }]}>
            <View style={styles.commentModalHeader}>
              <Text style={[styles.commentModalTitle, { color: colors.text }]}>Add Comment</Text>
              <TouchableOpacity 
                onPress={() => { setCommentModalVisible(false); setSelectedPostId(null); setCommentText("") }} 
                style={styles.closeButton}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.commentInputContainer}>
              <Image source={{ uri: user?.profilePicture || "https://via.placeholder.com/32" }} style={styles.commentProfileImage} />
              <TextInput
                ref={commentInputRef}
                style={[styles.commentTextInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Write a comment..."
                placeholderTextColor={colors.grey}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                autoFocus
              />
            </View>
            <View style={styles.commentModalActions}>
              <TouchableOpacity 
                onPress={handleComment} 
                style={[styles.postCommentButton, { backgroundColor: commentText.trim() ? colors.primary : colors.border }]} 
                disabled={!commentText.trim() || commentLoading}
                activeOpacity={0.8}
              >
                {commentLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.postCommentButtonText}>Refeed</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 2,
  },
  headerSafeArea: {
    zIndex: 1000,
  },
  header: {
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  headerTitle: {
    marginTop: 2,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  headerIcons: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    position: "relative",
    borderRadius: 20,
    minWidth: 30,
    minHeight: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  postContainer: {
    padding: 15,
    borderBottomWidth: 0.3,
    position: "relative",
  },
  viralBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  viralBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userInfo: {
    marginLeft: 10,
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  fullName: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 4,
  },
  username: {
    fontSize: 14,
    marginLeft: 8,
    marginRight: 4,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 4,
  },
  moreButton: {
    padding: 8,
    zIndex: 2,
  },
  dropdownMenu: {
    position: "absolute",
    right: 0,
    top: 40,
    width: 180,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 0.3,
  },
  dropdownText: {
    marginLeft: 10,
    fontSize: 14,
  },
  captionContainer: {
    marginTop: 10,
    marginLeft: 50,
  },
  caption: {
    fontSize: 16,
    lineHeight: 22,
  },
  hashtag: {
    fontWeight: "bold",
  },
  imageContainer: {
    marginTop: 10,
    marginLeft: 50,
    width: screenWidth - 30 - 50,
    borderRadius: 5

  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 5,
  },
  postImage: {
    width: "100%",
    height: screenWidth - 30 - 5,
    borderRadius: 5,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridImage: {
    marginBottom: 2,
    borderRadius: 5,
    overflow: "hidden",
  },
  // Scrollable media styles
  scrollableMediaContainer: {
    width: screenWidth - 30 - 50,
    height: 300,
  },
  scrollableMediaWrapper: {
    width: screenWidth - 30 - 50,
    height: 300,
  },
  scrollableMedia: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  mediaIndicators: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  mediaIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#000',
  },
  moreImagesOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreImagesText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  playButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -30 }, { translateY: -30 }],
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonText: {
    fontSize: 30,
    color: "#fff",
  },
  muteButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    padding: 5,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 15,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginLeft: 50,
  },
  actionButtons: {
    flexDirection: "row",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
    paddingVertical: 4,
  },
  actionCount: {
    marginLeft: 5,
    fontSize: 12,
  },
  viewsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewsText: {
    marginLeft: 5,
    fontSize: 12,
  },
  viralScore: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "bold",
  },
  list: {
    paddingBottom: 100,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryText: {
    color: "white",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  commentModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "40%",
  },
  commentModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  commentModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 4,
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  commentProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentTextInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    minHeight: 50,
    textAlignVertical: "top",
  },
  commentModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  postCommentButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  postCommentButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
})

export default HomeScreen
















