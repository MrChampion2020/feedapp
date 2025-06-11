
import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
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
  SafeAreaView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import { useFocusEffect } from "@react-navigation/native"
import { Audio } from "expo-av"
import {
  Heart,
  MessageCircle,
  Share as ShareIcon,
  MoreHorizontal,
  Eye,
  Plus,
  Bell,
  MessageSquare,
  Search,
  UserX,
  Ban,
  UserPlus,
  Trash2,
  MessageSquarePlus,
  X,
} from "lucide-react-native"
import VerifiedBadge from "../../components/VerifiedBadge"
import { getUserVerificationStatus } from "../../utils/userUtils"

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

interface Post {
  _id: string
  user: {
    _id: string
    username: string
    fullName: string
    profilePicture?: string
  }
  images: string[]
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
  navigation?: any
  onTabBarVisibilityChange?: (visible: boolean) => void
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

  // Comment modal state
  const [commentModalVisible, setCommentModalVisible] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [commentLoading, setCommentLoading] = useState(false)

  // Sound objects
  const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
  const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)
  const [sendSound, setSendSound] = useState<Audio.Sound | null>(null)

  // Animation values
  const [likeAnimations, setLikeAnimations] = useState<{
    [key: string]: Animated.Value
  }>({})
  const [likeCountAnimations, setLikeCountAnimations] = useState<{
    [key: string]: Animated.Value
  }>({})

  // Tab bar animation
  const scrollY = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)
  const tabBarTranslateY = useRef(new Animated.Value(0)).current

  // Comment input ref
  const commentInputRef = useRef<TextInput>(null)

  // Load sounds
  useEffect(() => {
    const loadSounds = async () => {
      try {
       const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
               const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
               const { sound: sendAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/send.mp3"))
        setLikeSound(likeAudio)
        setCommentSound(commentAudio)
        setSendSound(sendAudio)
      } catch (error) {
        console.log("Sound files not found, continuing without sounds:", error)
      }
    }

    loadSounds()

    return () => {
      likeSound?.unloadAsync()
      commentSound?.unloadAsync()
      sendSound?.unloadAsync()
    }
  }, [])

  const playSound = async (sound: Audio.Sound | null) => {
    try {
      if (sound) {
        await sound.replayAsync()
      }
    } catch (error) {
      console.log("Error playing sound:", error)
    }
  }

  const checkServerConnection = async () => {
    try {
      console.log("Checking server connection...")
      const response = await fetch("https://feeda.onrender.com/api/health", {
        method: "GET",
        timeout: 5000,
      })

      if (response.ok) {
        console.log("Server is reachable")
        return true
      } else {
        console.log("Server responded with error:", response.status)
        return false
      }
    } catch (error) {
      console.log("Server connection failed:", error)
      return false
    }
  }

  const fetchNotificationCounts = async () => {
    try {
      if (!isConnected) {
        console.log("No internet connection, skipping notification fetch")
        return
      }

      console.log("Fetching notification counts...")
      const [notificationsResponse, chatsResponse] = await Promise.all([
        api.get("/notifications?limit=1"),
        api.get("/chats"),
      ])

      setUnreadNotifications(notificationsResponse.data.unreadCount || 0)

      const totalUnreadMessages =
        chatsResponse.data.chats?.reduce((total: number, chat: any) => total + (chat.unreadCount || 0), 0) || 0
      setUnreadMessages(totalUnreadMessages)

      console.log("Notification counts fetched successfully")
    } catch (error: any) {
      console.log("Error fetching notification counts:", error.response?.status, error.message)
    }
  }

  // Track post view when it appears in feed
  const trackPostView = async (postId: string) => {
    try {
      if (!user || !token) return

      // Call the API to increment view count
      await api.get(`/posts/${postId}`)

      // Update local state to reflect the view
      setPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, views: (post.views || 0) + 1 } : post)))
    } catch (error) {
      console.log("Error tracking post view:", error)
    }
  }

  const fetchPosts = async (pageNum = 1, isRefresh = false) => {
    try {
      console.log(`Fetching posts - Page: ${pageNum}, Refresh: ${isRefresh}`)
      console.log("Current token:", token ? "Present" : "Missing")
      console.log("Current user:", user ? user.username : "Not logged in")
      console.log("Internet connected:", isConnected)

      if (!isConnected) {
        setError("No internet connection. Please check your network.")
        setLoading(false)
        setInitialLoad(false)
        return
      }

      if (!token || !user) {
        console.log("No token or user available, cannot fetch posts")
        setError("Please log in to view posts")
        setLoading(false)
        setInitialLoad(false)
        return
      }

      const serverReachable = await checkServerConnection()
      if (!serverReachable) {
        setError("Cannot connect to server. Please check if the server is running.")
        setLoading(false)
        setInitialLoad(false)
        return
      }

      if (pageNum === 1) {
        if (isRefresh) {
          setRefreshing(true)
        } else if (initialLoad) {
          setLoading(true)
        }
      } else {
        setLoadingMore(true)
      }

      const response = await api.get(`/posts?page=${pageNum}&limit=10&includeViral=true`)
      const { posts: newPosts, pagination } = response.data

      console.log(`Fetched ${newPosts.length} posts successfully`)

      // Initialize animation values for new posts
      const newLikeAnimations: { [key: string]: Animated.Value } = {}
      const newLikeCountAnimations: { [key: string]: Animated.Value } = {}

      newPosts.forEach((post: Post) => {
        const isLiked = user && post.likes.includes(user.id)
        newLikeAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
        newLikeCountAnimations[post._id] = new Animated.Value(post.likes.length)

        // Track view for each post that appears in feed
        trackPostView(post._id)
      })

      setLikeAnimations((prev) => ({ ...prev, ...newLikeAnimations }))
      setLikeCountAnimations((prev) => ({
        ...prev,
        ...newLikeCountAnimations,
      }))

      if (pageNum === 1) {
        setPosts(newPosts)
      } else {
        setPosts((prev) => [...prev, ...newPosts])
      }

      setHasMore(pagination?.hasNext || false)
      setPage(pageNum)
      setError(null)
    } catch (error: any) {
      console.log("Error fetching posts:", error.response?.status, error.message)

      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log("Authentication error, attempting token refresh...")
        try {
          await refreshToken()
          console.log("Token refreshed, retrying posts fetch...")

          const response = await api.get(`/posts?page=${pageNum}&limit=10&includeViral=true`)
          const { posts: newPosts, pagination } = response.data

          if (pageNum === 1) {
            setPosts(newPosts)
          } else {
            setPosts((prev) => [...prev, ...newPosts])
          }

          setHasMore(pagination?.hasNext || false)
          setPage(pageNum)
          setError(null)
          console.log("Posts fetched successfully after token refresh")
        } catch (refreshError: any) {
          console.log("Token refresh failed:", refreshError)
          const message = "Session expired. Please log in again."
          setError(message)
          Alert.alert("Session Expired", message, [
            {
              text: "Login",
              onPress: () => {
                logout()
                navigation?.navigate("Login")
              },
            },
          ])
        }
      } else if (error.code === "NETWORK_ERROR" || error.message === "Network Error") {
        setError("Network error. Please check your connection and server status.")
      } else {
        const message = error.response?.data?.message || "Failed to load posts"
        setError(message)
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
      console.log("HomeScreen focused, checking auth state...")
      console.log("Token available:", !!token)
      console.log("User available:", !!user)
      console.log("Internet connected:", isConnected)

      if (token && user) {
        console.log("Auth state valid, fetching data...")
        // Only show loading on initial load, not when returning from other screens
        if (posts.length === 0) {
          fetchPosts(1)
        } else {
          // Just refresh data silently when returning
          fetchPosts(1, true)
        }
        fetchNotificationCounts()
      } else {
        console.log("Auth state invalid, redirecting to login...")
        setError("Please log in to continue")
        navigation?.navigate("Login")
      }
    }, [token, user, isConnected]),
  )

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y
      const diff = currentScrollY - lastScrollY.current

      if (diff > 5 && currentScrollY > 100) {
        Animated.timing(tabBarTranslateY, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }).start()
        onTabBarVisibilityChange?.(false)
      } else if (diff < -5) {
        Animated.timing(tabBarTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start()
        onTabBarVisibilityChange?.(true)
      }

      lastScrollY.current = currentScrollY

      if (activeDropdownPostId) {
        setActiveDropdownPostId(null)
      }
    },
  })

  const handleRefresh = () => {
    console.log("Refreshing posts...")
    if (!isConnected) {
      Alert.alert("No Connection", "Please check your internet connection")
      return
    }
    fetchPosts(1, true)
    fetchNotificationCounts()
  }

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && isConnected) {
      console.log("Loading more posts...")
      fetchPosts(page + 1)
    }
  }

  const handleLike = async (postId: string) => {
    if (!user || !token) {
      console.log("Cannot like post: no user or token")
      return
    }

    if (!isConnected) {
      Alert.alert("No Connection", "Please check your internet connection")
      return
    }

    try {
      console.log("Liking post:", postId)

      await playSound(likeSound)

      const post = posts.find((p) => p._id === postId)
      if (!post) return

      const isLiked = post.likes.includes(user.id)
      const newLikeCount = isLiked ? post.likes.length - 1 : post.likes.length + 1

      Animated.spring(likeAnimations[postId], {
        toValue: isLiked ? 0 : 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start()

      Animated.sequence([
        Animated.timing(likeCountAnimations[postId], {
          toValue: isLiked ? newLikeCount + 0.5 : newLikeCount - 0.5,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(likeCountAnimations[postId], {
          toValue: newLikeCount,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()

      setPosts((prev) =>
        prev.map((post) => {
          if (post._id === postId) {
            return {
              ...post,
              likes: isLiked ? post.likes.filter((id) => id !== user.id) : [...post.likes, user.id],
            }
          }
          return post
        }),
      )

      const response = await api.post(`/posts/${postId}/like`, {
        userId: user.id,
      })
      setPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, likes: response.data.likes } : post)))

      console.log("Post liked successfully")
    } catch (error: any) {
      console.log("Error liking post:", error.response?.status, error.message)
      Alert.alert("Error", "Failed to like post. Please try again.")
      fetchPosts(1)
    }
  }

  const handleCommentPress = (postId: string) => {
    setSelectedPostId(postId)
    setCommentModalVisible(true)
    setTimeout(() => {
      commentInputRef.current?.focus()
    }, 100)
  }



//   const handleComment = async () => {
//     if (!commentText.trim() || !user || !selectedPostId) return

//     try {
//       setCommentLoading(true)
//       await playSound(commentSound)
//       await playSound(sendSound)

//       const response = await api.post(`/posts/${selectedPostId}/comment`, {
//         text: commentText.trim(),
//       })

//       // Update the post's comment count in the local state
//       setPosts((prev) =>
//         prev.map((post) => {
//           if (post._id === selectedPostId) {
//             return {
//               ...post,
//               comments: [...post.comments, response.data.comment],
//             }
//           }
//           return post
//         }),
//       )

//       // Send chat notification to post owner if it's not the user's own post
//       const post = posts.find((p) => p._id === selectedPostId)
//       if (post && post.user._id !== user.id) {
//         try {
//           const captionPreview = post.caption
//             ? post.caption.length > 50
//               ? `${post.caption.substring(0, 47)}...`
//               : post.caption
//             : "No caption"
//           const chatMessage = `New comment on your post:
// [img]${post.images[0] || ""}[/img]
// [faint]${captionPreview} (${post.caption || ""})[/faint]
// Comment: ${commentText.trim()}`
//           await api.post(`/chats/${post.user._id}`, { message: chatMessage })
//           console.log(`Chat message sent to @${post.user.username}: ${chatMessage}`)
//         } catch (chatError) {
//           console.error("Error sending chat message:", chatError)
//         }
//       }

//       setCommentText("")
//       setCommentModalVisible(false)
//       setSelectedPostId(null)

//       Alert.alert("Success", "Comment added successfully!")
//     } catch (error: any) {
//       console.log("Error adding comment:", error.response?.status, error.message)
//       Alert.alert("Error", "Failed to add comment. Please try again.")
//     } finally {
//       setCommentLoading(false)
//     }
//   }

const handleComment = async () => {
  if (!commentText.trim() || !user || !selectedPostId) return;

  try {
    setCommentLoading(true);
    await playSound(commentSound);
    await playSound(sendSound);

    // Post the comment
    const response = await api.post(`/posts/${selectedPostId}/comment`, {
      text: commentText.trim(),
    });

    // Update the post's comment count in the local state
    setPosts((prev) =>
      prev.map((post) => {
        if (post._id === selectedPostId) {
          return {
            ...post,
            comments: [...post.comments, response.data.comment],
          };
        }
        return post;
      }),
    );

    // Send chat notification to post owner if it's not the user's own post
    const post = posts.find((p) => p._id === selectedPostId);
    if (post && post.user._id !== user.id) {
      try {
        const captionPreview = post.caption
          ? post.caption.length > 50
            ? `${post.caption.substring(0, 47)}...`
            : post.caption
          : "No caption";
        const chatMessage = `New comment on your post:\n\n${captionPreview}\n\nComment: ${commentText.trim()}`;
        const chatResponse = await api.post(`/chats/${post.user._id}`, {
          message: chatMessage,
          messageType: "text", // Explicitly set messageType
          postId: selectedPostId, // Include postId for reference
        });
        console.log(`Chat message sent to @${post.user.username}: ${chatMessage}`);
      } catch (chatError: any) {
        console.error("Error sending chat message:", {
          status: chatError.response?.status,
          message: chatError.response?.data?.message || chatError.message,
        });
        // Optionally show an alert to inform the user
        Alert.alert("Warning", "Comment posted, but failed to send chat notification.");
      }
    }

    setCommentText("");
    setCommentModalVisible(false);
    setSelectedPostId(null);

    Alert.alert("Success", "Comment added successfully!");
  } catch (error: any) {
    console.error("Error adding comment:", {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });

    // Handle token refresh for 401/403 errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      try {
        await refreshToken();
        // Retry comment posting
        const response = await api.post(`/posts/${selectedPostId}/comment`, {
          text: commentText.trim(),
        });
        setPosts((prev) =>
          prev.map((post) => {
            if (post._id === selectedPostId) {
              return {
                ...post,
                comments: [...post.comments, response.data.comment],
              };
            }
            return post;
          }),
        );
        setCommentText("");
        setCommentModalVisible(false);
        setSelectedPostId(null);
        Alert.alert("Success", "Comment added successfully!");
      } catch (refreshError: any) {
        console.error("Token refresh failed:", refreshError);
        Alert.alert("Session Expired", "Please log in again.", [
          {
            text: "Login",
            onPress: () => {
              logout();
              navigation?.navigate("Login");
            },
          },
        ]);
      }
    } else {
      Alert.alert("Error", "Failed to add comment. Please try again.");
    }
  } finally {
    setCommentLoading(false);
  }
};




  const handlePostPress = (post: Post) => {
    navigation?.navigate("PostView", { post })
  }

  const handleShare = async (post: Post) => {
    try {
      const shareContent = {
        message: `${post.caption || "Check out this post!"} by @${post.user.username}`,
        url: post.images?.[0] || "",
      }
      await Share.share(shareContent)
    } catch (error) {
      console.log("Error sharing post:", error)
    }
  }

  const handleHashtagPress = (hashtag: string) => {
    // Navigate to SearchScreen with hashtag parameter
    navigation?.navigate("Search", {
      initialQuery: `#${hashtag}`,
      initialType: "hashtags",
      activeHashtag: hashtag,
    })
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
            console.log("Error blocking user:", error)
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
      console.log("Error following user:", error)
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
            console.log("Error deleting post:", error)
            Alert.alert("Error", "Failed to delete post")
          }
        },
      },
    ])
  }

  const handleOpenChat = (userId: string) => {
    navigation?.navigate("Chat", { userId })
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

    return postDate.toLocaleDateString()
  }

  const renderPostImages = (post: Post) => {
    if (!post.images || post.images.length === 0) return null

    // Single image display
    if (post.images.length === 1) {
      return (
        <View style={styles.imageContainer}>
          <TouchableOpacity onPress={() => handlePostPress(post)}>
            <Image source={{ uri: post.images[0] }} style={styles.postImage} />
          </TouchableOpacity>
        </View>
      )
    }

    // Multiple images display (grid layout)
    return (
      <View style={styles.imageContainer}>
        <View style={styles.imageGrid}>
          {post.images.slice(0, 4).map((image, index) => {
            // Different layouts based on number of images
            const isFirstImage = index === 0
            const isLastVisible = index === 3 && post.images.length > 4

            // Calculate dimensions based on number of images
            let imageStyle
            if (post.images.length === 2) {
              imageStyle = [styles.gridImage, { width: "49%", height: 200 }]
            } else if (post.images.length === 3) {
              if (isFirstImage) {
                imageStyle = [styles.gridImage, { width: "100%", height: 200, marginBottom: 2 }]
              } else {
                imageStyle = [styles.gridImage, { width: "49%", height: 150 }]
              }
            } else {
              // 4 or more images
              imageStyle = [styles.gridImage, { width: "49%", height: 150 }]
            }

            return (
              <TouchableOpacity key={index} style={imageStyle} onPress={() => handlePostPress(post)}>
                <Image source={{ uri: image }} style={styles.fullImage} />

                {/* Show count of remaining images */}
                {isLastVisible && (
                  <View style={styles.moreImagesOverlay}>
                    <Text style={styles.moreImagesText}>+{post.images.length - 4}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    )
  }

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = user && item.likes?.includes(user.id)
    const mainImage = item.images?.[0]
    const isOwnPost = user?.id === item.user._id

    // Get verification status
    const { isVerified, isPremiumVerified } = getUserVerificationStatus(item.user._id)

    if (!likeAnimations[item._id]) {
      likeAnimations[item._id] = new Animated.Value(isLiked ? 1 : 0)
    }
    if (!likeCountAnimations[item._id]) {
      likeCountAnimations[item._id] = new Animated.Value(item.likes.length)
    }

    const heartScale = likeAnimations[item._id].interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.3, 1],
    })

    return (
      <TouchableOpacity
        style={[
          styles.postContainer,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            borderLeftWidth: item.isViral ? 3 : 0,
            borderLeftColor: item.isViral ? "#FF6B35" : "transparent",
          },
        ]}
        onPress={() => handlePostPress(item)}
        activeOpacity={0.95}
      >
        {/* Fixed viral badge - properly wrapped in Text component */}
        {item.isViral && (
          <View style={[styles.viralBadge, { backgroundColor: "#FF6B35" }]}>
            <Text style={styles.viralBadgeText}>🔥 Viral</Text>
          </View>
        )}

        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => navigation?.navigate("UserProfile", { userId: item.user._id })}
            style={styles.userInfoContainer}
          >
            <Image
              source={{
                uri: item.user.profilePicture || "https://via.placeholder.com/40",
              }}
              style={styles.profileImage}
            />
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={[styles.fullName, { color: colors.text }]}>{item.user.fullName}</Text>
                <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={14} />
                <Text style={[styles.username, { color: colors.text }]}>@{item.user.username}</Text>
                <Text style={[styles.timestamp, { color: colors.text }]}>{"·"}</Text>
                <Text style={[styles.timestamp, { color: colors.text }]}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View>
            <TouchableOpacity style={styles.moreButton} onPress={() => handleMorePress(item._id)}>
              <MoreHorizontal size={20} color={colors.icon} />
            </TouchableOpacity>

            {activeDropdownPostId === item._id && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {isOwnPost ? (
                  <TouchableOpacity
                    style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleDeletePost(item._id)}
                  >
                    <Trash2 size={16} color="#FF3B30" />
                    <Text style={[styles.dropdownText, { color: "#FF3B30" }]}>Delete Post</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleBlockUser(item.user._id)}
                    >
                      <UserX size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Block User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleBlockPost(item._id)}
                    >
                      <Ban size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Hide Post</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleFollowUser(item.user._id)}
                    >
                      <UserPlus size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Follow User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.dropdownItem]} onPress={() => handleOpenChat(item.user._id)}>
                      <MessageSquarePlus size={16} color={colors.text} />
                      <Text style={[styles.dropdownText, { color: colors.text }]}>Message</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {item.caption ? (
          <View style={styles.captionContainer}>
            <Text style={[styles.caption, { color: colors.text }]}>
              {item.caption.split(/(\s+)/).map((word, index) => {
                if (word.startsWith("#")) {
                  return (
                    <Text
                      key={index}
                      style={[styles.hashtag, { color: colors.hashtag }]}
                      onPress={() => handleHashtagPress(word.substring(1))}
                    >
                      {word}
                    </Text>
                  )
                }
                return (
                  <Text key={index} style={{ color: colors.text }}>
                    {word}
                  </Text>
                )
              })}
            </Text>
          </View>
        ) : null}

        {/* Render all post images */}
        {renderPostImages(item)}

        <View style={styles.actionsContainer}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation()
                handleCommentPress(item._id)
              }}
              style={styles.actionButton}
            >
              <MessageCircle size={20} color={colors.icon} />
              <Text style={[styles.actionCount, { color: colors.text }]}>{item.comments?.length || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation()
                handleLike(item._id)
              }}
              style={styles.actionButton}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart size={20} color={colors.text} fill={isLiked ? colors.like : colors.text} />
              </Animated.View>
              <Animated.Text
                style={[
                  styles.actionCount,
                  {
                    color: isLiked ? colors.like : colors.text,
                    opacity: isLiked ? 1 : 0.6,
                    transform: [{ scale: isLiked ? 1.1 : 1 }],
                  },
                ]}
              >
                {item.likes?.length || 0}
              </Animated.Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation()
                handleShare(item)
              }}
              style={styles.actionButton}
            >
              <ShareIcon size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.viewsContainer}>
            <Eye size={16} color={colors.text} />
            <Text style={[styles.viewsText, { color: colors.text }]}>{item.views || 0}</Text>
            {item.viralScore && (
              <Text style={[styles.viralScore, { color: "#FF6B35" }]}>
                <Text style={{ color: colors.text }}>{"•"}</Text> {item.viralScore}🔥
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderHeader = () => (
    <SafeAreaView style={[styles.headerSafeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Text
            style={[
              styles.headerTitle,
              {
                color: colors.text,
                fontFamily: "cursive",
                fontSize: 30,
                fontWeight: "bold",
                textShadowColor: "#00000033",
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 2,
              },
            ]}
          >
            Feeda
          </Text>
          <View style={styles.headerIcons}>
            {/* <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("UploadFeed")}>
              <Plus size={24} color={colors.text} />
            </TouchableOpacity> */}

            <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("Search")}>
              <Search size={24} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("Notifications")}>
              <Bell size={24} color={colors.text} />
              {unreadNotifications > 0 && (
                <View style={[styles.badge, { backgroundColor: "#E91E63" }]}>
                  <Text style={styles.badgeText}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("Chat")}>
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
    </SafeAreaView>
  )

  const renderFooter = () => {
    if (!loadingMore) return null
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.text }]}>
        {error ? error : "No posts yet. Start following people or create your first post!"}
      </Text>
      {error && (
        <TouchableOpacity
          onPress={() => fetchPosts(1)}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
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
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.card}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCommentModalVisible(false)
          setSelectedPostId(null)
          setCommentText("")
        }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.commentModal, { backgroundColor: colors.card }]}>
            <View style={styles.commentModalHeader}>
              <Text style={[styles.commentModalTitle, { color: colors.text }]}>Add Comment</Text>
              <TouchableOpacity
                onPress={() => {
                  setCommentModalVisible(false)
                  setSelectedPostId(null)
                  setCommentText("")
                }}
                style={styles.closeButton}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.commentInputContainer}>
              <Image
                source={{
                  uri: user?.profilePicture || "https://via.placeholder.com/32",
                }}
                style={styles.commentProfileImage}
              />
              <TextInput
                ref={commentInputRef}
                style={[
                  styles.commentTextInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
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
              {/* <TouchableOpacity
                onPress={() => {
                  setCommentModalVisible(false)
                  setSelectedPostId(null)
                  setCommentText("")
                }}
                style={[styles.cancelButton, { borderColor: colors.border }]}
              >
                 <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text> *
              </TouchableOpacity> */}


              <TouchableOpacity
                onPress={handleComment}
                style={[
                  styles.postCommentButton,
                  {
                    backgroundColor: commentText.trim() ? colors.primary : colors.border,
                  },
                ]}
                disabled={!commentText.trim() || commentLoading}
              >
                {commentLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.postCommentButtonText}>Refeed</Text>
                )}
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
    marginBottom: 30,
    paddingTop: 20,
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
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
    marginTop: 9,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  },
  postImage: {
    width: "100%",
    height: screenWidth - 0 - 0,
    borderRadius: 10,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridImage: {
    marginBottom: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  fullImage: {
    width: "100%",
    height: "100%",
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
 
 // Comment Modal Styles
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
    justifyContent: "space-between",
    gap: 6,
    maxWidth: "80%",
    margin: "auto"
  },
  cancelButton: {
    flex: 1,
    borderWidth: 0.3,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    maxWidth: "40%"

  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  postCommentButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    maxWidth: "40%"
    
  },
  postCommentButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
})

export default HomeScreen



























// import type React from "react"
// import { useState, useCallback, useRef, useEffect } from "react"
// import {
//   View,
//   FlatList,
//   Text,
//   StyleSheet,
//   Image,
//   TouchableOpacity,
//   Share,
//   RefreshControl,
//   ActivityIndicator,
//   Animated,
//   Dimensions,
//   StatusBar,
//   Alert,
//   SafeAreaView,
//   TextInput,
//   Modal,
//   KeyboardAvoidingView,
//   Platform,
// } from "react-native"
// import { useAuth, api } from "../../contexts/AuthContext"
// import { useTheme } from "../../contexts/ThemeContext"
// import { useFocusEffect } from "@react-navigation/native"
// import { Audio } from "expo-av"
// import {
//   Heart,
//   MessageCircle,
//   Share as ShareIcon,
//   MoreHorizontal,
//   Eye,
//   Plus,
//   Bell,
//   MessageSquare,
//   Search,
//   UserX,
//   Ban,
//   UserPlus,
//   Trash2,
//   MessageSquarePlus,
//   X,
// } from "lucide-react-native"

// const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

// interface Post {
//   _id: string
//   user: {
//     _id: string
//     username: string
//     fullName: string
//     profilePicture?: string
//   }
//   images: string[]
//   caption: string
//   likes: string[]
//   comments: any[]
//   views: number
//   hashtags: string[]
//   viralScore?: number
//   isViral?: boolean
//   createdAt: string
// }

// interface HomeScreenProps {
//   navigation?: any
//   onTabBarVisibilityChange?: (visible: boolean) => void
// }

// const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, onTabBarVisibilityChange }) => {
//   const { user, token, refreshToken, logout, isConnected } = useAuth()
//   const { colors, theme } = useTheme()
//   const [posts, setPosts] = useState<Post[]>([])
//   const [loading, setLoading] = useState(false)
//   const [refreshing, setRefreshing] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [page, setPage] = useState(1)
//   const [hasMore, setHasMore] = useState(true)
//   const [loadingMore, setLoadingMore] = useState(false)
//   const [unreadNotifications, setUnreadNotifications] = useState(0)
//   const [unreadMessages, setUnreadMessages] = useState(0)
//   const [activeDropdownPostId, setActiveDropdownPostId] = useState<string | null>(null)
//   const [initialLoad, setInitialLoad] = useState(true)

//   // Comment modal state
//   const [commentModalVisible, setCommentModalVisible] = useState(false)
//   const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
//   const [commentText, setCommentText] = useState("")
//   const [commentLoading, setCommentLoading] = useState(false)

//   // Sound objects
//   const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
//   const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)
//   const [sendSound, setSendSound] = useState<Audio.Sound | null>(null)

//   // Animation values
//   const [likeAnimations, setLikeAnimations] = useState<{
//     [key: string]: Animated.Value
//   }>({})
//   const [likeCountAnimations, setLikeCountAnimations] = useState<{
//     [key: string]: Animated.Value
//   }>({})

//   // Tab bar animation
//   const scrollY = useRef(new Animated.Value(0)).current
//   const lastScrollY = useRef(0)
//   const tabBarTranslateY = useRef(new Animated.Value(0)).current

//   // Comment input ref
//   const commentInputRef = useRef<TextInput>(null)

//   // Load sounds
//   useEffect(() => {
//     const loadSounds = async () => {
//       try {
//         const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
//         const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
//         const { sound: sendAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/send.mp3"))
//         setLikeSound(likeAudio)
//         setCommentSound(commentAudio)
//         setSendSound(sendAudio)
//       } catch (error) {
//         console.log("Sound files not found, continuing without sounds:", error)
//       }
//     }

//     loadSounds()

//     return () => {
//       likeSound?.unloadAsync()
//       commentSound?.unloadAsync()
//       sendSound?.unloadAsync()
//     }
//   }, [])

//   const playSound = async (sound: Audio.Sound | null) => {
//     try {
//       if (sound) {
//         await sound.replayAsync()
//       }
//     } catch (error) {
//       console.log("Error playing sound:", error)
//     }
//   }

//   const checkServerConnection = async () => {
//     try {
//       console.log("Checking server connection...")
//       const response = await fetch("https://feeda.onrender.com/api/health", {
//         method: "GET",
//         timeout: 5000,
//       })

//       if (response.ok) {
//         console.log("Server is reachable")
//         return true
//       } else {
//         console.log("Server responded with error:", response.status)
//         return false
//       }
//     } catch (error) {
//       console.log("Server connection failed:", error)
//       return false
//     }
//   }

//   const fetchNotificationCounts = async () => {
//     try {
//       if (!isConnected) {
//         console.log("No internet connection, skipping notification fetch")
//         return
//       }

//       console.log("Fetching notification counts...")
//       const [notificationsResponse, chatsResponse] = await Promise.all([
//         api.get("/notifications?limit=1"),
//         api.get("/chats"),
//       ])

//       setUnreadNotifications(notificationsResponse.data.unreadCount || 0)

//       const totalUnreadMessages =
//         chatsResponse.data.chats?.reduce((total: number, chat: any) => total + (chat.unreadCount || 0), 0) || 0
//       setUnreadMessages(totalUnreadMessages)

//       console.log("Notification counts fetched successfully")
//     } catch (error: any) {
//       console.log("Error fetching notification counts:", error.response?.status, error.message)
//     }
//   }

//   // Track post view when it appears in feed
//   const trackPostView = async (postId: string) => {
//     try {
//       if (!user || !token) return

//       // Call the API to increment view count
//       await api.get(`/posts/${postId}`)

//       // Update local state to reflect the view
//       setPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, views: (post.views || 0) + 1 } : post)))
//     } catch (error) {
//       console.log("Error tracking post view:", error)
//     }
//   }

//   const fetchPosts = async (pageNum = 1, isRefresh = false) => {
//     try {
//       console.log(`Fetching posts - Page: ${pageNum}, Refresh: ${isRefresh}`)
//       console.log("Current token:", token ? "Present" : "Missing")
//       console.log("Current user:", user ? user.username : "Not logged in")
//       console.log("Internet connected:", isConnected)

//       if (!isConnected) {
//         setError("No internet connection. Please check your network.")
//         setLoading(false)
//         setInitialLoad(false)
//         return
//       }

//       if (!token || !user) {
//         console.log("No token or user available, cannot fetch posts")
//         setError("Please log in to view posts")
//         setLoading(false)
//         setInitialLoad(false)
//         return
//       }

//       const serverReachable = await checkServerConnection()
//       if (!serverReachable) {
//         setError("Cannot connect to server. Please check if the server is running.")
//         setLoading(false)
//         setInitialLoad(false)
//         return
//       }

//       if (pageNum === 1) {
//         if (isRefresh) {
//           setRefreshing(true)
//         } else if (initialLoad) {
//           setLoading(true)
//         }
//       } else {
//         setLoadingMore(true)
//       }

//       const response = await api.get(`/posts?page=${pageNum}&limit=10&includeViral=true`)
//       const { posts: newPosts, pagination } = response.data

//       console.log(`Fetched ${newPosts.length} posts successfully`)

//       // Initialize animation values for new posts
//       const newLikeAnimations: { [key: string]: Animated.Value } = {}
//       const newLikeCountAnimations: { [key: string]: Animated.Value } = {}

//       newPosts.forEach((post: Post) => {
//         const isLiked = user && post.likes.includes(user.id)
//         newLikeAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
//         newLikeCountAnimations[post._id] = new Animated.Value(post.likes.length)

//         // Track view for each post that appears in feed
//         trackPostView(post._id)
//       })

//       setLikeAnimations((prev) => ({ ...prev, ...newLikeAnimations }))
//       setLikeCountAnimations((prev) => ({
//         ...prev,
//         ...newLikeCountAnimations,
//       }))

//       if (pageNum === 1) {
//         setPosts(newPosts)
//       } else {
//         setPosts((prev) => [...prev, ...newPosts])
//       }

//       setHasMore(pagination?.hasNext || false)
//       setPage(pageNum)
//       setError(null)
//     } catch (error: any) {
//       console.log("Error fetching posts:", error.response?.status, error.message)

//       if (error.response?.status === 401 || error.response?.status === 403) {
//         console.log("Authentication error, attempting token refresh...")
//         try {
//           await refreshToken()
//           console.log("Token refreshed, retrying posts fetch...")

//           const response = await api.get(`/posts?page=${pageNum}&limit=10&includeViral=true`)
//           const { posts: newPosts, pagination } = response.data

//           if (pageNum === 1) {
//             setPosts(newPosts)
//           } else {
//             setPosts((prev) => [...prev, ...newPosts])
//           }

//           setHasMore(pagination?.hasNext || false)
//           setPage(pageNum)
//           setError(null)
//           console.log("Posts fetched successfully after token refresh")
//         } catch (refreshError: any) {
//           console.log("Token refresh failed:", refreshError)
//           const message = "Session expired. Please log in again."
//           setError(message)
//           Alert.alert("Session Expired", message, [
//             {
//               text: "Login",
//               onPress: () => {
//                 logout()
//                 navigation?.navigate("Login")
//               },
//             },
//           ])
//         }
//       } else if (error.code === "NETWORK_ERROR" || error.message === "Network Error") {
//         setError("Network error. Please check your connection and server status.")
//       } else {
//         const message = error.response?.data?.message || "Failed to load posts"
//         setError(message)
//       }
//     } finally {
//       setLoading(false)
//       setRefreshing(false)
//       setLoadingMore(false)
//       setInitialLoad(false)
//     }
//   }

//   useFocusEffect(
//     useCallback(() => {
//       console.log("HomeScreen focused, checking auth state...")
//       console.log("Token available:", !!token)
//       console.log("User available:", !!user)
//       console.log("Internet connected:", isConnected)

//       if (token && user) {
//         console.log("Auth state valid, fetching data...")
//         // Only show loading on initial load, not when returning from other screens
//         if (posts.length === 0) {
//           fetchPosts(1)
//         } else {
//           // Just refresh data silently when returning
//           fetchPosts(1, true)
//         }
//         fetchNotificationCounts()
//       } else {
//         console.log("Auth state invalid, redirecting to login...")
//         setError("Please log in to continue")
//         navigation?.navigate("Login")
//       }
//     }, [token, user, isConnected]),
//   )

//   const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
//     useNativeDriver: false,
//     listener: (event: any) => {
//       const currentScrollY = event.nativeEvent.contentOffset.y
//       const diff = currentScrollY - lastScrollY.current

//       if (diff > 5 && currentScrollY > 100) {
//         Animated.timing(tabBarTranslateY, {
//           toValue: 100,
//           duration: 200,
//           useNativeDriver: true,
//         }).start()
//         onTabBarVisibilityChange?.(false)
//       } else if (diff < -5) {
//         Animated.timing(tabBarTranslateY, {
//           toValue: 0,
//           duration: 200,
//           useNativeDriver: true,
//         }).start()
//         onTabBarVisibilityChange?.(true)
//       }

//       lastScrollY.current = currentScrollY

//       if (activeDropdownPostId) {
//         setActiveDropdownPostId(null)
//       }
//     },
//   })

//   const handleRefresh = () => {
//     console.log("Refreshing posts...")
//     if (!isConnected) {
//       Alert.alert("No Connection", "Please check your internet connection")
//       return
//     }
//     fetchPosts(1, true)
//     fetchNotificationCounts()
//   }

//   const handleLoadMore = () => {
//     if (!loadingMore && hasMore && isConnected) {
//       console.log("Loading more posts...")
//       fetchPosts(page + 1)
//     }
//   }

//   const handleLike = async (postId: string) => {
//     if (!user || !token) {
//       console.log("Cannot like post: no user or token")
//       return
//     }

//     if (!isConnected) {
//       Alert.alert("No Connection", "Please check your internet connection")
//       return
//     }

//     try {
//       console.log("Liking post:", postId)

//       await playSound(likeSound)

//       const post = posts.find((p) => p._id === postId)
//       if (!post) return

//       const isLiked = post.likes.includes(user.id)
//       const newLikeCount = isLiked ? post.likes.length - 1 : post.likes.length + 1

//       Animated.spring(likeAnimations[postId], {
//         toValue: isLiked ? 0 : 1,
//         friction: 3,
//         tension: 40,
//         useNativeDriver: true,
//       }).start()

//       Animated.sequence([
//         Animated.timing(likeCountAnimations[postId], {
//           toValue: isLiked ? newLikeCount + 0.5 : newLikeCount - 0.5,
//           duration: 150,
//           useNativeDriver: true,
//         }),
//         Animated.timing(likeCountAnimations[postId], {
//           toValue: newLikeCount,
//           duration: 150,
//           useNativeDriver: true,
//         }),
//       ]).start()

//       setPosts((prev) =>
//         prev.map((post) => {
//           if (post._id === postId) {
//             return {
//               ...post,
//               likes: isLiked ? post.likes.filter((id) => id !== user.id) : [...post.likes, user.id],
//             }
//           }
//           return post
//         }),
//       )

//       const response = await api.post(`/posts/${postId}/like`, {
//         userId: user.id,
//       })
//       setPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, likes: response.data.likes } : post)))

//       console.log("Post liked successfully")
//     } catch (error: any) {
//       console.log("Error liking post:", error.response?.status, error.message)
//       Alert.alert("Error", "Failed to like post. Please try again.")
//       fetchPosts(1)
//     }
//   }

//   const handleCommentPress = (postId: string) => {
//     setSelectedPostId(postId)
//     setCommentModalVisible(true)
//     setTimeout(() => {
//       commentInputRef.current?.focus()
//     }, 100)
//   }

//   const handleComment = async () => {
//     if (!commentText.trim() || !user || !selectedPostId) return

//     try {
//       setCommentLoading(true)
//       await playSound(commentSound)
//       await playSound(sendSound)

//       const response = await api.post(`/posts/${selectedPostId}/comment`, {
//         text: commentText.trim(),
//       })

//       // Update the post's comment count in the local state
//       setPosts((prev) =>
//         prev.map((post) => {
//           if (post._id === selectedPostId) {
//             return {
//               ...post,
//               comments: [...post.comments, response.data.comment],
//             }
//           }
//           return post
//         }),
//       )

//       // Send chat notification to post owner if it's not the user's own post
//       const post = posts.find((p) => p._id === selectedPostId)
//       if (post && post.user._id !== user.id) {
//         try {
//           const captionPreview = post.caption
//             ? post.caption.length > 50
//               ? `${post.caption.substring(0, 47)}...`
//               : post.caption
//             : "No caption"
//           const chatMessage = `New comment on your post:\n[img]${post.images[0] || ""}[/img]\n[faint]${captionPreview} (${post.caption || ""})[/faint]\nComment: ${commentText.trim()}`
//           await api.post(`/chats/${post.user._id}`, { message: chatMessage })
//           console.log(`Chat message sent to @${post.user.username}: ${chatMessage}`)
//         } catch (chatError) {
//           console.error("Error sending chat message:", chatError)
//         }
//       }

//       setCommentText("")
//       setCommentModalVisible(false)
//       setSelectedPostId(null)

//       Alert.alert("Success", "Comment added successfully!")
//     } catch (error: any) {
//       console.log("Error adding comment:", error.response?.status, error.message)
//       Alert.alert("Error", "Failed to add comment. Please try again.")
//     } finally {
//       setCommentLoading(false)
//     }
//   }

//   const handlePostPress = (post: Post) => {
//     navigation?.navigate("PostView", { post })
//   }

//   const handleShare = async (post: Post) => {
//     try {
//       const shareContent = {
//         message: `${post.caption || "Check out this post!"} by @${post.user.username}`,
//         url: post.images?.[0] || "",
//       }
//       await Share.share(shareContent)
//     } catch (error) {
//       console.log("Error sharing post:", error)
//     }
//   }

//   const handleHashtagPress = (hashtag: string) => {
//     // Navigate to SearchScreen with hashtag parameter
//     navigation?.navigate("Search", {
//       initialQuery: `#${hashtag}`,
//       initialType: "hashtags",
//       activeHashtag: hashtag,
//     })
//   }

//   const handleMorePress = (postId: string) => {
//     setActiveDropdownPostId(activeDropdownPostId === postId ? null : postId)
//   }

//   const handleBlockUser = (userId: string) => {
//     Alert.alert("Block User", "Are you sure you want to block this user? You won't see their posts anymore.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Block",
//         style: "destructive",
//         onPress: async () => {
//           try {
//             setPosts((prev) => prev.filter((post) => post.user._id !== userId))
//             setActiveDropdownPostId(null)
//             Alert.alert("Success", "User blocked successfully")
//           } catch (error) {
//             console.log("Error blocking user:", error)
//             Alert.alert("Error", "Failed to block user")
//           }
//         },
//       },
//     ])
//   }

//   const handleBlockPost = (postId: string) => {
//     Alert.alert("Hide Post", "Are you sure you want to hide this post?", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Hide",
//         onPress: () => {
//           setPosts((prev) => prev.filter((post) => post._id !== postId))
//           setActiveDropdownPostId(null)
//         },
//       },
//     ])
//   }

//   const handleFollowUser = async (userId: string) => {
//     try {
//       if (!isConnected) {
//         Alert.alert("No Connection", "Please check your internet connection")
//         return
//       }

//       await api.post(`/users/${userId}/follow`, { followerId: user?.id })
//       Alert.alert("Success", "You are now following this user")
//       setActiveDropdownPostId(null)
//     } catch (error) {
//       console.log("Error following user:", error)
//       Alert.alert("Error", "Failed to follow user")
//     }
//   }

//   const handleDeletePost = async (postId: string) => {
//     Alert.alert("Delete Post", "Are you sure you want to delete this post? This action cannot be undone.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Delete",
//         style: "destructive",
//         onPress: async () => {
//           try {
//             if (!isConnected) {
//               Alert.alert("No Connection", "Please check your internet connection")
//               return
//             }

//             await api.delete(`/posts/${postId}`)
//             setPosts((prev) => prev.filter((post) => post._id !== postId))
//             setActiveDropdownPostId(null)
//             Alert.alert("Success", "Post deleted successfully")
//           } catch (error) {
//             console.log("Error deleting post:", error)
//             Alert.alert("Error", "Failed to delete post")
//           }
//         },
//       },
//     ])
//   }

//   const handleOpenChat = (userId: string) => {
//     navigation?.navigate("Chat", { userId })
//     setActiveDropdownPostId(null)
//   }

//   const formatTimeAgo = (dateString: string) => {
//     const now = new Date()
//     const postDate = new Date(dateString)
//     const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000)

//     if (diffInSeconds < 60) return "now"
//     if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
//     if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
//     if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`

//     return postDate.toLocaleDateString()
//   }

//   const renderPost = ({ item }: { item: Post }) => {
//     const isLiked = user && item.likes?.includes(user.id)
//     const mainImage = item.images?.[0]
//     const isOwnPost = user?.id === item.user._id

//     if (!likeAnimations[item._id]) {
//       likeAnimations[item._id] = new Animated.Value(isLiked ? 1 : 0)
//     }
//     if (!likeCountAnimations[item._id]) {
//       likeCountAnimations[item._id] = new Animated.Value(item.likes.length)
//     }

//     const heartScale = likeAnimations[item._id].interpolate({
//       inputRange: [0, 0.5, 1],
//       outputRange: [1, 1.3, 1],
//     })

//     return (
//       <TouchableOpacity
//         style={[
//           styles.postContainer,
//           {
//             backgroundColor: colors.card,
//             borderBottomColor: colors.border,
//             borderLeftWidth: item.isViral ? 3 : 0,
//             borderLeftColor: item.isViral ? "#FF6B35" : "transparent",
//           },
//         ]}
//         onPress={() => handlePostPress(item)}
//         activeOpacity={0.95}
//       >
//         {/* Fixed viral badge - properly wrapped in Text component */}
//         {item.isViral && (
//           <View style={[styles.viralBadge, { backgroundColor: "#FF6B35" }]}>
//             <Text style={styles.viralBadgeText}>🔥 VIRAL</Text>
//           </View>
//         )}

//         <View style={styles.postHeader}>
//           <TouchableOpacity
//             onPress={() => navigation?.navigate("UserProfile", { userId: item.user._id })}
//             style={styles.userInfoContainer}
//           >
//             <Image
//               source={{
//                 uri: item.user.profilePicture || "https://via.placeholder.com/40",
//               }}
//               style={styles.profileImage}
//             />
//             <View style={styles.userInfo}>
//               <View style={styles.userNameRow}>
//                 <Text style={[styles.fullName, { color: colors.text }]}>{item.user.fullName}</Text>
//                 <Text style={[styles.username, { color: colors.text }]}>@{item.user.username}</Text>
//                 <Text style={[styles.timestamp, { color: colors.text }]}>{"·"}</Text>
//                 <Text style={[styles.timestamp, { color: colors.text }]}>{formatTimeAgo(item.createdAt)}</Text>
//               </View>
//             </View>
//           </TouchableOpacity>

//           <View>
//             <TouchableOpacity style={styles.moreButton} onPress={() => handleMorePress(item._id)}>
//               <MoreHorizontal size={20} color={colors.icon} />
//             </TouchableOpacity>

//             {activeDropdownPostId === item._id && (
//               <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
//                 {isOwnPost ? (
//                   <TouchableOpacity
//                     style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
//                     onPress={() => handleDeletePost(item._id)}
//                   >
//                     <Trash2 size={16} color="#FF3B30" />
//                     <Text style={[styles.dropdownText, { color: "#FF3B30" }]}>Delete Post</Text>
//                   </TouchableOpacity>
//                 ) : (
//                   <>
//                     <TouchableOpacity
//                       style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
//                       onPress={() => handleBlockUser(item.user._id)}
//                     >
//                       <UserX size={16} color={colors.text} />
//                       <Text style={[styles.dropdownText, { color: colors.text }]}>Block User</Text>
//                     </TouchableOpacity>
//                     <TouchableOpacity
//                       style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
//                       onPress={() => handleBlockPost(item._id)}
//                     >
//                       <Ban size={16} color={colors.text} />
//                       <Text style={[styles.dropdownText, { color: colors.text }]}>Hide Post</Text>
//                     </TouchableOpacity>
//                     <TouchableOpacity
//                       style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
//                       onPress={() => handleFollowUser(item.user._id)}
//                     >
//                       <UserPlus size={16} color={colors.text} />
//                       <Text style={[styles.dropdownText, { color: colors.text }]}>Follow User</Text>
//                     </TouchableOpacity>
//                     <TouchableOpacity style={[styles.dropdownItem]} onPress={() => handleOpenChat(item.user._id)}>
//                       <MessageSquarePlus size={16} color={colors.text} />
//                       <Text style={[styles.dropdownText, { color: colors.text }]}>Message</Text>
//                     </TouchableOpacity>
//                   </>
//                 )}
//               </View>
//             )}
//           </View>
//         </View>

//         {item.caption ? (
//           <View style={styles.captionContainer}>
//             <Text style={[styles.caption, { color: colors.text }]}>
//               {item.caption.split(/(\s+)/).map((word, index) => {
//                 if (word.startsWith("#")) {
//                   return (
//                     <Text
//                       key={index}
//                       style={[styles.hashtag, { color: colors.hashtag }]}
//                       onPress={() => handleHashtagPress(word.substring(1))}
//                     >
//                       {word}
//                     </Text>
//                   )
//                 }
//                 return (
//                   <Text key={index} style={{ color: colors.text }}>
//                     {word}
//                   </Text>
//                 )
//               })}
//             </Text>
//           </View>
//         ) : null}

//         {mainImage && (
//           <View style={styles.imageContainer}>
//             <Image source={{ uri: mainImage }} style={styles.postImage} />
//           </View>
//         )}

//         <View style={styles.actionsContainer}>
//           <View style={styles.actionButtons}>
//             <TouchableOpacity
//               onPress={(e) => {
//                 e.stopPropagation()
//                 handleCommentPress(item._id)
//               }}
//               style={styles.actionButton}
//             >
//               <MessageCircle size={20} color={colors.icon} />
//               <Text style={[styles.actionCount, { color: colors.text }]}>{item.comments?.length || 0}</Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               onPress={(e) => {
//                 e.stopPropagation()
//                 handleLike(item._id)
//               }}
//               style={styles.actionButton}
//             >
//               <Animated.View style={{ transform: [{ scale: heartScale }] }}>
//                 <Heart size={20} color={colors.text} fill={isLiked ? colors.like : colors.text} />
//               </Animated.View>
//               <Animated.Text
//                 style={[
//                   styles.actionCount,
//                   {
//                     color: isLiked ? colors.like : colors.text,
//                     opacity: isLiked ? 1 : 0.6,
//                     transform: [{ scale: isLiked ? 1.1 : 1 }],
//                   },
//                 ]}
//               >
//                 {item.likes?.length || 0}
//               </Animated.Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               onPress={(e) => {
//                 e.stopPropagation()
//                 handleShare(item)
//               }}
//               style={styles.actionButton}
//             >
//               <ShareIcon size={20} color={colors.icon} />
//             </TouchableOpacity>
//           </View>

//           <View style={styles.viewsContainer}>
//             <Eye size={16} color={colors.text} />
//             <Text style={[styles.viewsText, { color: colors.text }]}>{item.views || 0}</Text>
//             {item.viralScore && (
//               <Text style={[styles.viralScore, { color: "#FF6B35" }]}>
//                 <Text style={{ color: colors.text }}>{"•"}</Text> {item.viralScore}🔥
//               </Text>
//             )}
//           </View>
//         </View>
//       </TouchableOpacity>
//     )
//   }

//   const renderHeader = () => (
//     <SafeAreaView style={[styles.headerSafeArea, { backgroundColor: colors.background }]}>
//       <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />
//       <View
//         style={[
//           styles.header,
//           {
//             backgroundColor: colors.background,
//             borderBottomColor: colors.border,
//           },
//         ]}
//       >
//         <View style={styles.headerContent}>
//           <Text
//             style={[
//               styles.headerTitle,
//               {
//                 color: colors.text,
//                 fontFamily: "cursive",
//                 fontSize: 38,
//                 fontWeight: "bold",
//                 textShadowColor: "#00000033",
//                 textShadowOffset: { width: 0, height: 2 },
//                 textShadowRadius: 2,
//               },
//             ]}
//           >
//             Feeda
//           </Text>
//           <View style={styles.headerIcons}>
//             <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("UploadFeed")}>
//               <Plus size={24} color={colors.text} />
//             </TouchableOpacity>

//             <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("Search")}>
//               <Search size={24} color={colors.text} />
//             </TouchableOpacity>

//             <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("Notifications")}>
//               <Bell size={24} color={colors.text} />
//               {unreadNotifications > 0 && (
//                 <View style={[styles.badge, { backgroundColor: "#E91E63" }]}>
//                   <Text style={styles.badgeText}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</Text>
//                 </View>
//               )}
//             </TouchableOpacity>

//             <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate("Chat")}>
//               <MessageSquare size={24} color={colors.text} />
//               {unreadMessages > 0 && (
//                 <View style={[styles.badge, { backgroundColor: "#E91E63" }]}>
//                   <Text style={styles.badgeText}>{unreadMessages > 99 ? "99+" : unreadMessages}</Text>
//                 </View>
//               )}
//             </TouchableOpacity>
//           </View>
//         </View>
//       </View>
//     </SafeAreaView>
//   )

//   const renderFooter = () => {
//     if (!loadingMore) return null
//     return (
//       <View style={styles.loadingMore}>
//         <ActivityIndicator size="small" color={colors.primary} />
//       </View>
//     )
//   }

//   const renderEmpty = () => (
//     <View style={styles.emptyContainer}>
//       <Text style={[styles.emptyText, { color: colors.text }]}>
//         {error ? error : "No posts yet. Start following people or create your first post!"}
//       </Text>
//       {error && (
//         <TouchableOpacity
//           onPress={() => fetchPosts(1)}
//           style={[styles.retryButton, { backgroundColor: colors.primary }]}
//         >
//           <Text style={styles.retryText}>Retry</Text>
//         </TouchableOpacity>
//       )}
//     </View>
//   )

//   if (loading && initialLoad) {
//     return (
//       <View style={[styles.container, { backgroundColor: colors.background }]}>
//         {renderHeader()}
//         <View style={styles.centerLoading}>
//           <ActivityIndicator size="large" color={colors.primary} />
//           <Text style={[styles.loadingText, { color: colors.text }]}>Loading posts...</Text>
//         </View>
//       </View>
//     )
//   }

//   return (
//     <View style={[styles.container, { backgroundColor: colors.background }]}>
//       {renderHeader()}
//       <FlatList
//         data={posts}
//         renderItem={renderPost}
//         keyExtractor={(item) => item._id}
//         contentContainerStyle={styles.list}
//         refreshControl={
//           <RefreshControl
//             refreshing={refreshing}
//             onRefresh={handleRefresh}
//             colors={[colors.primary]}
//             tintColor={colors.primary}
//             progressBackgroundColor={colors.card}
//           />
//         }
//         onEndReached={handleLoadMore}
//         onEndReachedThreshold={0.1}
//         ListFooterComponent={renderFooter}
//         ListEmptyComponent={renderEmpty}
//         showsVerticalScrollIndicator={false}
//         onScroll={handleScroll}
//         scrollEventThrottle={16}
//       />

//       {/* Comment Modal */}
//       <Modal
//         visible={commentModalVisible}
//         transparent
//         animationType="slide"
//         onRequestClose={() => {
//           setCommentModalVisible(false)
//           setSelectedPostId(null)
//           setCommentText("")
//         }}
//       >
//         <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
//           <View style={[styles.commentModal, { backgroundColor: colors.card }]}>
//             <View style={styles.commentModalHeader}>
//               <Text style={[styles.commentModalTitle, { color: colors.text }]}>Add Comment</Text>
//               <TouchableOpacity
//                 onPress={() => {
//                   setCommentModalVisible(false)
//                   setSelectedPostId(null)
//                   setCommentText("")
//                 }}
//                 style={styles.closeButton}
//               >
//                 <X size={24} color={colors.text} />
//               </TouchableOpacity>
//             </View>

//             <View style={styles.commentInputContainer}>
//               <Image
//                 source={{
//                   uri: user?.profilePicture || "https://via.placeholder.com/32",
//                 }}
//                 style={styles.commentProfileImage}
//               />
//               <TextInput
//                 ref={commentInputRef}
//                 style={[
//                   styles.commentTextInput,
//                   {
//                     color: colors.text,
//                     borderColor: colors.border,
//                     backgroundColor: colors.background,
//                   },
//                 ]}
//                 placeholder="Write a comment..."
//                 placeholderTextColor={colors.grey}
//                 value={commentText}
//                 onChangeText={setCommentText}
//                 multiline
//                 maxLength={500}
//                 autoFocus
//               />
//             </View>

//             <View style={styles.commentModalActions}>
//               <TouchableOpacity
//                 onPress={() => {
//                   setCommentModalVisible(false)
//                   setSelectedPostId(null)
//                   setCommentText("")
//                 }}
//                 style={[styles.cancelButton, { borderColor: colors.border }]}
//               >
//                 <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 onPress={handleComment}
//                 style={[
//                   styles.postCommentButton,
//                   {
//                     backgroundColor: commentText.trim() ? colors.primary : colors.border,
//                   },
//                 ]}
//                 disabled={!commentText.trim() || commentLoading}
//               >
//                 {commentLoading ? (
//                   <ActivityIndicator size="small" color="white" />
//                 ) : (
//                   <Text style={styles.postCommentButtonText}>Post</Text>
//                 )}
//               </TouchableOpacity>
//             </View>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>
//     </View>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     marginBottom: 30,
//     paddingTop: 30,
//   },
//   headerSafeArea: {
//     zIndex: 1000,
//   },
//   header: {
//     height: 70,
//     justifyContent: "center",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     elevation: 2,
//     shadowColor: "#000",
//     shadowOffset: {
//       width: 0,
//       height: 1,
//     },
//     shadowOpacity: 0.1,
//     shadowRadius: 2,
//   },
//   headerContent: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     width: "100%",
//     height: "100%",
//   },
//   headerTitle: {
//     fontSize: 22,
//     fontWeight: "bold",
//     letterSpacing: 0.5,
//   },
//   headerIcons: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },
//   iconButton: {
//     padding: 8,
//     position: "relative",
//     borderRadius: 20,
//     minWidth: 40,
//     minHeight: 40,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   badge: {
//     position: "absolute",
//     top: 4,
//     right: 4,
//     minWidth: 18,
//     height: 18,
//     borderRadius: 9,
//     justifyContent: "center",
//     alignItems: "center",
//     paddingHorizontal: 4,
//   },
//   badgeText: {
//     color: "white",
//     fontSize: 10,
//     fontWeight: "bold",
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   centerLoading: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   loadingText: {
//     marginTop: 10,
//     fontSize: 16,
//   },
//   postContainer: {
//     padding: 15,
//     borderBottomWidth: 0.3,
//     position: "relative",
//   },
//   viralBadge: {
//     position: "absolute",
//     top: 10,
//     right: 10,
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 12,
//     zIndex: 1,
//   },
//   viralBadgeText: {
//     color: "white",
//     fontSize: 10,
//     fontWeight: "bold",
//   },
//   postHeader: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },
//   userInfoContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     flex: 1,
//   },
//   profileImage: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//   },
//   userInfo: {
//     marginLeft: 10,
//     flex: 1,
//   },
//   userNameRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     flexWrap: "wrap",
//   },
//   fullName: {
//     fontSize: 16,
//     fontWeight: "bold",
//     marginRight: 4,
//   },
//   username: {
//     fontSize: 14,
//     marginRight: 4,
//   },
//   timestamp: {
//     fontSize: 12,
//     marginLeft: 4,
//   },
//   moreButton: {
//     padding: 8,
//     zIndex: 2,
//   },
//   dropdownMenu: {
//     position: "absolute",
//     right: 0,
//     top: 40,
//     width: 180,
//     borderRadius: 8,
//     borderWidth: 1,
//     zIndex: 10,
//     elevation: 5,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//   },
//   dropdownItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 12,
//     borderBottomWidth: 0.5,
//   },
//   dropdownText: {
//     marginLeft: 10,
//     fontSize: 14,
//   },
//   captionContainer: {
//     marginTop: 10,
//     marginLeft: 50,
//   },
//   caption: {
//     fontSize: 16,
//     lineHeight: 22,
//   },
//   hashtag: {
//     fontWeight: "bold",
//   },
//   imageContainer: {
//     marginTop: 10,
//     marginLeft: 50,
//   },
//   postImage: {
//     width: screenWidth - 30 - 50,
//     height: screenWidth - 30 - 50,
//     borderRadius: 10,
//   },
//   actionsContainer: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     marginTop: 10,
//     marginLeft: 50,
//   },
//   actionButtons: {
//     flexDirection: "row",
//   },
//   actionButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginRight: 15,
//     paddingVertical: 4,
//   },
//   actionCount: {
//     marginLeft: 5,
//     fontSize: 12,
//   },
//   viewsContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   viewsText: {
//     marginLeft: 5,
//     fontSize: 12,
//   },
//   viralScore: {
//     marginLeft: 5,
//     fontSize: 12,
//     fontWeight: "bold",
//   },
//   list: {
//     paddingBottom: 100,
//   },
//   loadingMore: {
//     paddingVertical: 20,
//     alignItems: "center",
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     padding: 20,
//   },
//   emptyText: {
//     fontSize: 16,
//     textAlign: "center",
//   },
//   retryButton: {
//     marginTop: 20,
//     paddingVertical: 10,
//     paddingHorizontal: 20,
//     borderRadius: 10,
//   },
//   retryText: {
//     color: "white",
//     fontSize: 16,
//   },
//   // Comment Modal Styles
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: "rgba(0, 0, 0, 0.5)",
//     justifyContent: "flex-end",
//   },
//   commentModal: {
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//     padding: 20,
//     maxHeight: "40%",
//   },
//   commentModalHeader: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     marginBottom: 5,
//   },
//   commentModalTitle: {
//     fontSize: 18,
//     fontWeight: "bold",
//   },
//   closeButton: {
//     padding: 4,
//   },
//   commentInputContainer: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     marginBottom: 5,
//   },
//   commentProfileImage: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     marginRight: 12,
//   },
//   commentTextInput: {
//     flex: 1,
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingHorizontal: 8,
//     paddingVertical: 8,
//     fontSize: 16,
//     minHeight: 50,
//     textAlignVertical: "top",
//   },
//   commentModalActions: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     gap: 6,
//     maxWidth: "80%",
//     margin: "auto"
//   },
//   cancelButton: {
//     flex: 1,
//     borderWidth: 0.3,
//     borderRadius: 12,
//     paddingVertical: 8,
//     alignItems: "center",
//     maxWidth: "40%"

//   },
//   cancelButtonText: {
//     fontSize: 12,
//     fontWeight: "600",
//   },
//   postCommentButton: {
//     flex: 1,
//     borderRadius: 12,
//     paddingVertical: 12,
//     alignItems: "center",
//     maxWidth: "40%"
    
//   },
//   postCommentButtonText: {
//     color: "white",
//     fontSize: 12,
//     fontWeight: "600",
//   },
// })

// export default HomeScreen



// // import type React from "react";
// // import { useState, useCallback, useRef, useEffect } from "react";
// // import {
// //   View,
// //   FlatList,
// //   Text,
// //   StyleSheet,
// //   Image,
// //   TouchableOpacity,
// //   Share,
// //   RefreshControl,
// //   ActivityIndicator,
// //   Animated,
// //   Dimensions,
// //   StatusBar,
// //   Alert,
// //   SafeAreaView,
// // } from "react-native";
// // import { useAuth, api } from "../../contexts/AuthContext";
// // import { useTheme } from "../../contexts/ThemeContext";
// // import { useFocusEffect } from "@react-navigation/native";
// // import { Audio } from "expo-av";
// // import {
// //   Heart,
// //   MessageCircle,
// //   Share as ShareIcon,
// //   MoreHorizontal,
// //   Eye,
// //   Plus,
// //   Bell,
// //   MessageSquare,
// //   Search,
// //   UserX,
// //   Ban,
// //   UserPlus,
// //   Trash2,
// //   MessageSquarePlus,
// // } from "lucide-react-native";
// // // import SimpleFeedaLogo from "../../components/SimpleFeedaLogo";

// // const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// // interface Post {
// //   _id: string;
// //   user: {
// //     _id: string;
// //     username: string;
// //     fullName: string;
// //     profilePicture?: string;
// //   };
// //   images: string[];
// //   caption: string;
// //   likes: string[];
// //   comments: any[];
// //   views: number;
// //   hashtags: string[];
// //   viralScore?: number;
// //   isViral?: boolean;
// //   createdAt: string;
// // }

// // interface HomeScreenProps {
// //   navigation?: any;
// //   onTabBarVisibilityChange?: (visible: boolean) => void;
// // }

// // const HomeScreen: React.FC<HomeScreenProps> = ({
// //   navigation,
// //   onTabBarVisibilityChange,
// // }) => {
// //   const { user, token, refreshToken, logout, isConnected } = useAuth();
// //   const { colors, theme } = useTheme();
// //   const [posts, setPosts] = useState<Post[]>([]);
// //   const [loading, setLoading] = useState(false);
// //   const [refreshing, setRefreshing] = useState(false);
// //   const [error, setError] = useState<string | null>(null);
// //   const [page, setPage] = useState(1);
// //   const [hasMore, setHasMore] = useState(true);
// //   const [loadingMore, setLoadingMore] = useState(false);
// //   const [unreadNotifications, setUnreadNotifications] = useState(0);
// //   const [unreadMessages, setUnreadMessages] = useState(0);
// //   const [activeDropdownPostId, setActiveDropdownPostId] = useState<
// //     string | null
// //   >(null);
// //   const [initialLoad, setInitialLoad] = useState(true);

// //   // Sound objects
// //   const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null);
// //   const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null);
// //   const [sendSound, setSendSound] = useState<Audio.Sound | null>(null);

// //   // Animation values
// //   const [likeAnimations, setLikeAnimations] = useState<{
// //     [key: string]: Animated.Value;
// //   }>({});
// //   const [likeCountAnimations, setLikeCountAnimations] = useState<{
// //     [key: string]: Animated.Value;
// //   }>({});

// //   // Tab bar animation
// //   const scrollY = useRef(new Animated.Value(0)).current;
// //   const lastScrollY = useRef(0);
// //   const tabBarTranslateY = useRef(new Animated.Value(0)).current;



// //   // Load sounds
// //   useEffect(() => {
// //     const loadSounds = async () => {
// //       try {
// //         const { sound: likeAudio } = await Audio.Sound.createAsync(
// //           require("../../assets/sounds/like.mp3")
// //         );
// //         const { sound: commentAudio } = await Audio.Sound.createAsync(
// //           require("../../assets/sounds/comment.mp3")
// //         );
// //         const { sound: sendAudio } = await Audio.Sound.createAsync(
// //           require("../../assets/sounds/send.mp3")
// //         );
// //         setLikeSound(likeAudio);
// //         setCommentSound(commentAudio);
// //         setSendSound(sendAudio);
// //       } catch (error) {
// //         console.log("Sound files not found, continuing without sounds:", error);
// //       }
// //     };

// //     loadSounds();

// //     return () => {
// //       likeSound?.unloadAsync();
// //       commentSound?.unloadAsync();
// //       sendSound?.unloadAsync();
// //     };
// //   }, []);

// //   const playSound = async (sound: Audio.Sound | null) => {
// //     try {
// //       if (sound) {
// //         await sound.replayAsync();
// //       }
// //     } catch (error) {
// //       console.log("Error playing sound:", error);
// //     }
// //   };

// //   const checkServerConnection = async () => {
// //     try {
// //       console.log("Checking server connection...");
// //       const response = await fetch("https://feeda.onrender.com/api/health", {
// //         method: "GET",
// //         timeout: 5000,
// //       });

// //       if (response.ok) {
// //         console.log("Server is reachable");
// //         return true;
// //       } else {
// //         console.log("Server responded with error:", response.status);
// //         return false;
// //       }
// //     } catch (error) {
// //       console.log("Server connection failed:", error);
// //       return false;
// //     }
// //   };

// //   const fetchNotificationCounts = async () => {
// //     try {
// //       if (!isConnected) {
// //         console.log("No internet connection, skipping notification fetch");
// //         return;
// //       }

// //       console.log("Fetching notification counts...");
// //       const [notificationsResponse, chatsResponse] = await Promise.all([
// //         api.get("/notifications?limit=1"),
// //         api.get("/chats"),
// //       ]);

// //       setUnreadNotifications(notificationsResponse.data.unreadCount || 0);

// //       const totalUnreadMessages =
// //         chatsResponse.data.chats?.reduce(
// //           (total: number, chat: any) => total + (chat.unreadCount || 0),
// //           0
// //         ) || 0;
// //       setUnreadMessages(totalUnreadMessages);

// //       console.log("Notification counts fetched successfully");
// //     } catch (error: any) {
// //       console.log(
// //         "Error fetching notification counts:",
// //         error.response?.status,
// //         error.message
// //       );
// //     }
// //   };

// //   const fetchPosts = async (pageNum = 1, isRefresh = false) => {
// //     try {
// //       console.log(`Fetching posts - Page: ${pageNum}, Refresh: ${isRefresh}`);
// //       console.log("Current token:", token ? "Present" : "Missing");
// //       console.log("Current user:", user ? user.username : "Not logged in");
// //       console.log("Internet connected:", isConnected);

// //       if (!isConnected) {
// //         setError("No internet connection. Please check your network.");
// //         setLoading(false);
// //         setInitialLoad(false);
// //         return;
// //       }

// //       if (!token || !user) {
// //         console.log("No token or user available, cannot fetch posts");
// //         setError("Please log in to view posts");
// //         setLoading(false);
// //         setInitialLoad(false);
// //         return;
// //       }

// //       const serverReachable = await checkServerConnection();
// //       if (!serverReachable) {
// //         setError(
// //           "Cannot connect to server. Please check if the server is running."
// //         );
// //         setLoading(false);
// //         setInitialLoad(false);
// //         return;
// //       }

// //       if (pageNum === 1) {
// //         if (isRefresh) {
// //           setRefreshing(true);
// //         } else if (initialLoad) {
// //           setLoading(true);
// //         }
// //       } else {
// //         setLoadingMore(true);
// //       }

// //       const response = await api.get(
// //         `/posts?page=${pageNum}&limit=10&includeViral=true`
// //       );
// //       const { posts: newPosts, pagination } = response.data;

// //       console.log(`Fetched ${newPosts.length} posts successfully`);

// //       // Initialize animation values for new posts
// //       const newLikeAnimations: { [key: string]: Animated.Value } = {};
// //       const newLikeCountAnimations: { [key: string]: Animated.Value } = {};

// //       newPosts.forEach((post: Post) => {
// //         const isLiked = user && post.likes.includes(user.id);
// //         newLikeAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0);
// //         newLikeCountAnimations[post._id] = new Animated.Value(
// //           post.likes.length
// //         );
// //       });

// //       setLikeAnimations((prev) => ({ ...prev, ...newLikeAnimations }));
// //       setLikeCountAnimations((prev) => ({
// //         ...prev,
// //         ...newLikeCountAnimations,
// //       }));

// //       if (pageNum === 1) {
// //         setPosts(newPosts);
// //       } else {
// //         setPosts((prev) => [...prev, ...newPosts]);
// //       }

// //       setHasMore(pagination?.hasNext || false);
// //       setPage(pageNum);
// //       setError(null);
// //     } catch (error: any) {
// //       console.log(
// //         "Error fetching posts:",
// //         error.response?.status,
// //         error.message
// //       );

// //       if (error.response?.status === 401 || error.response?.status === 403) {
// //         console.log("Authentication error, attempting token refresh...");
// //         try {
// //           await refreshToken();
// //           console.log("Token refreshed, retrying posts fetch...");

// //           const response = await api.get(
// //             `/posts?page=${pageNum}&limit=10&includeViral=true`
// //           );
// //           const { posts: newPosts, pagination } = response.data;

// //           if (pageNum === 1) {
// //             setPosts(newPosts);
// //           } else {
// //             setPosts((prev) => [...prev, ...newPosts]);
// //           }

// //           setHasMore(pagination?.hasNext || false);
// //           setPage(pageNum);
// //           setError(null);
// //           console.log("Posts fetched successfully after token refresh");
// //         } catch (refreshError: any) {
// //           console.log("Token refresh failed:", refreshError);
// //           const message = "Session expired. Please log in again.";
// //           setError(message);
// //           Alert.alert("Session Expired", message, [
// //             {
// //               text: "Login",
// //               onPress: () => {
// //                 logout();
// //                 navigation?.navigate("Login");
// //               },
// //             },
// //           ]);
// //         }
// //       } else if (
// //         error.code === "NETWORK_ERROR" ||
// //         error.message === "Network Error"
// //       ) {
// //         setError(
// //           "Network error. Please check your connection and server status."
// //         );
// //       } else {
// //         const message = error.response?.data?.message || "Failed to load posts";
// //         setError(message);
// //       }
// //     } finally {
// //       setLoading(false);
// //       setRefreshing(false);
// //       setLoadingMore(false);
// //       setInitialLoad(false);
// //     }
// //   };

// //   useFocusEffect(
// //     useCallback(() => {
// //       console.log("HomeScreen focused, checking auth state...");
// //       console.log("Token available:", !!token);
// //       console.log("User available:", !!user);
// //       console.log("Internet connected:", isConnected);

// //       if (token && user) {
// //         console.log("Auth state valid, fetching data...");
// //         // Only show loading on initial load, not when returning from other screens
// //         if (posts.length === 0) {
// //           fetchPosts(1);
// //         } else {
// //           // Just refresh data silently when returning
// //           fetchPosts(1, true);
// //         }
// //         fetchNotificationCounts();
// //       } else {
// //         console.log("Auth state invalid, redirecting to login...");
// //         setError("Please log in to continue");
// //         navigation?.navigate("Login");
// //       }
// //     }, [token, user, isConnected])
// //   );

// //   const handleScroll = Animated.event(
// //     [{ nativeEvent: { contentOffset: { y: scrollY } } }],
// //     {
// //       useNativeDriver: false,
// //       listener: (event: any) => {
// //         const currentScrollY = event.nativeEvent.contentOffset.y;
// //         const diff = currentScrollY - lastScrollY.current;

// //         if (diff > 5 && currentScrollY > 100) {
// //           Animated.timing(tabBarTranslateY, {
// //             toValue: 100,
// //             duration: 200,
// //             useNativeDriver: true,
// //           }).start();
// //           onTabBarVisibilityChange?.(false);
// //         } else if (diff < -5) {
// //           Animated.timing(tabBarTranslateY, {
// //             toValue: 0,
// //             duration: 200,
// //             useNativeDriver: true,
// //           }).start();
// //           onTabBarVisibilityChange?.(true);
// //         }

// //         lastScrollY.current = currentScrollY;

// //         if (activeDropdownPostId) {
// //           setActiveDropdownPostId(null);
// //         }
// //       },
// //     }
// //   );

// //   const handleRefresh = () => {
// //     console.log("Refreshing posts...");
// //     if (!isConnected) {
// //       Alert.alert("No Connection", "Please check your internet connection");
// //       return;
// //     }
// //     fetchPosts(1, true);
// //     fetchNotificationCounts();
// //   };

// //   const handleLoadMore = () => {
// //     if (!loadingMore && hasMore && isConnected) {
// //       console.log("Loading more posts...");
// //       fetchPosts(page + 1);
// //     }
// //   };

// //   const handleLike = async (postId: string) => {
// //     if (!user || !token) {
// //       console.log("Cannot like post: no user or token");
// //       return;
// //     }

// //     if (!isConnected) {
// //       Alert.alert("No Connection", "Please check your internet connection");
// //       return;
// //     }

// //     try {
// //       console.log("Liking post:", postId);

// //       await playSound(likeSound);

// //       const post = posts.find((p) => p._id === postId);
// //       if (!post) return;

// //       const isLiked = post.likes.includes(user.id);
// //       const newLikeCount = isLiked
// //         ? post.likes.length - 1
// //         : post.likes.length + 1;

// //       Animated.spring(likeAnimations[postId], {
// //         toValue: isLiked ? 0 : 1,
// //         friction: 3,
// //         tension: 40,
// //         useNativeDriver: true,
// //       }).start();

// //       Animated.sequence([
// //         Animated.timing(likeCountAnimations[postId], {
// //           toValue: isLiked ? newLikeCount + 0.5 : newLikeCount - 0.5,
// //           duration: 150,
// //           useNativeDriver: true,
// //         }),
// //         Animated.timing(likeCountAnimations[postId], {
// //           toValue: newLikeCount,
// //           duration: 150,
// //           useNativeDriver: true,
// //         }),
// //       ]).start();

// //       setPosts((prev) =>
// //         prev.map((post) => {
// //           if (post._id === postId) {
// //             return {
// //               ...post,
// //               likes: isLiked
// //                 ? post.likes.filter((id) => id !== user.id)
// //                 : [...post.likes, user.id],
// //             };
// //           }
// //           return post;
// //         })
// //       );

// //       const response = await api.post(`/posts/${postId}/like`, {
// //         userId: user.id,
// //       });
// //       setPosts((prev) =>
// //         prev.map((post) =>
// //           post._id === postId ? { ...post, likes: response.data.likes } : post
// //         )
// //       );

// //       console.log("Post liked successfully");
// //     } catch (error: any) {
// //       console.log("Error liking post:", error.response?.status, error.message);
// //       Alert.alert("Error", "Failed to like post. Please try again.");
// //       fetchPosts(1);
// //     }
// //   };

// //   const handlePostPress = (post: Post) => {
// //     navigation?.navigate("PostView", { post });
// //   };

// //   const handleShare = async (post: Post) => {
// //     try {
// //       const shareContent = {
// //         message: `${post.caption || "Check out this post!"} by @${
// //           post.user.username
// //         }`,
// //         url: post.images?.[0] || "",
// //       };
// //       await Share.share(shareContent);
// //     } catch (error) {
// //       console.log("Error sharing post:", error);
// //     }
// //   };

// //   const handleHashtagPress = (hashtag: string) => {
// //     // Navigate to SearchScreen with hashtag parameter
// //     navigation?.navigate("Search", {
// //       initialQuery: `#${hashtag}`,
// //       initialType: "hashtags",
// //       activeHashtag: hashtag,
// //     });
// //   };

// //   const handleMorePress = (postId: string) => {
// //     setActiveDropdownPostId(activeDropdownPostId === postId ? null : postId);
// //   };

// //   const handleBlockUser = (userId: string) => {
// //     Alert.alert(
// //       "Block User",
// //       "Are you sure you want to block this user? You won't see their posts anymore.",
// //       [
// //         { text: "Cancel", style: "cancel" },
// //         {
// //           text: "Block",
// //           style: "destructive",
// //           onPress: async () => {
// //             try {
// //               setPosts((prev) =>
// //                 prev.filter((post) => post.user._id !== userId)
// //               );
// //               setActiveDropdownPostId(null);
// //               Alert.alert("Success", "User blocked successfully");
// //             } catch (error) {
// //               console.log("Error blocking user:", error);
// //               Alert.alert("Error", "Failed to block user");
// //             }
// //           },
// //         },
// //       ]
// //     );
// //   };

// //   const handleBlockPost = (postId: string) => {
// //     Alert.alert("Hide Post", "Are you sure you want to hide this post?", [
// //       { text: "Cancel", style: "cancel" },
// //       {
// //         text: "Hide",
// //         onPress: () => {
// //           setPosts((prev) => prev.filter((post) => post._id !== postId));
// //           setActiveDropdownPostId(null);
// //         },
// //       },
// //     ]);
// //   };

// //   const handleFollowUser = async (userId: string) => {
// //     try {
// //       if (!isConnected) {
// //         Alert.alert("No Connection", "Please check your internet connection");
// //         return;
// //       }

// //       await api.post(`/users/${userId}/follow`, { followerId: user?.id });
// //       Alert.alert("Success", "You are now following this user");
// //       setActiveDropdownPostId(null);
// //     } catch (error) {
// //       console.log("Error following user:", error);
// //       Alert.alert("Error", "Failed to follow user");
// //     }
// //   };

// //   const handleDeletePost = async (postId: string) => {
// //     Alert.alert(
// //       "Delete Post",
// //       "Are you sure you want to delete this post? This action cannot be undone.",
// //       [
// //         { text: "Cancel", style: "cancel" },
// //         {
// //           text: "Delete",
// //           style: "destructive",
// //           onPress: async () => {
// //             try {
// //               if (!isConnected) {
// //                 Alert.alert(
// //                   "No Connection",
// //                   "Please check your internet connection"
// //                 );
// //                 return;
// //               }

// //               await api.delete(`/posts/${postId}`);
// //               setPosts((prev) => prev.filter((post) => post._id !== postId));
// //               setActiveDropdownPostId(null);
// //               Alert.alert("Success", "Post deleted successfully");
// //             } catch (error) {
// //               console.log("Error deleting post:", error);
// //               Alert.alert("Error", "Failed to delete post");
// //             }
// //           },
// //         },
// //       ]
// //     );
// //   };

// //   const handleOpenChat = (userId: string) => {
// //     navigation?.navigate("Chat", { userId });
// //     setActiveDropdownPostId(null);
// //   };

// //   const formatTimeAgo = (dateString: string) => {
// //     const now = new Date();
// //     const postDate = new Date(dateString);
// //     const diffInSeconds = Math.floor(
// //       (now.getTime() - postDate.getTime()) / 1000
// //     );

// //     if (diffInSeconds < 60) return "now";
// //     if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
// //     if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
// //     if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;

// //     return postDate.toLocaleDateString();
// //   };

// //   const renderPost = ({ item }: { item: Post }) => {
// //     const isLiked = user && item.likes?.includes(user.id);
// //     const mainImage = item.images?.[0];
// //     const isOwnPost = user?.id === item.user._id;

// //     if (!likeAnimations[item._id]) {
// //       likeAnimations[item._id] = new Animated.Value(isLiked ? 1 : 0);
// //     }
// //     if (!likeCountAnimations[item._id]) {
// //       likeCountAnimations[item._id] = new Animated.Value(item.likes.length);
// //     }

// //     const heartScale = likeAnimations[item._id].interpolate({
// //       inputRange: [0, 0.5, 1],
// //       outputRange: [1, 1.3, 1],
// //     });

// //     return (
// //       <TouchableOpacity
// //         style={[
// //           styles.postContainer,
// //           {
// //             backgroundColor: colors.card,
// //             borderBottomColor: colors.border,
// //             borderLeftWidth: item.isViral ? 3 : 0,
// //             borderLeftColor: item.isViral ? "#FF6B35" : "transparent",
// //           },
// //         ]}
// //         onPress={() => handlePostPress(item)}
// //         activeOpacity={0.95}
// //       >
// //         {/* Fixed viral badge - properly wrapped in Text component */}
// //         {item.isViral && (
// //           <View style={[styles.viralBadge, { backgroundColor: "#FF6B35" }]}>
// //             <Text style={styles.viralBadgeText}>🔥 VIRAL</Text>
// //           </View>
// //         )}

// //         <View style={styles.postHeader}>
// //           <TouchableOpacity
// //             onPress={() =>
// //               navigation?.navigate("UserProfile", { userId: item.user._id })
// //             }
// //             style={styles.userInfoContainer}
// //           >
// //             <Image
// //               source={{
// //                 uri:
// //                   item.user.profilePicture || "https://via.placeholder.com/40",
// //               }}
// //               style={styles.profileImage}
// //             />
// //             <View style={styles.userInfo}>
// //               <View style={styles.userNameRow}>
// //                 <Text style={[styles.fullName, { color: colors.text }]}>
// //                   {item.user.fullName}
// //                 </Text>
// //                 <Text style={[styles.username, { color: colors.text }]}>
// //                   @{item.user.username}
// //                 </Text>
// //                 <Text style={[styles.timestamp, { color: colors.text }]}>
// //                   {"·"}
// //                 </Text>
// //                 <Text style={[styles.timestamp, { color: colors.text }]}>
// //                   {formatTimeAgo(item.createdAt)}
// //                 </Text>
// //               </View>
// //             </View>
// //           </TouchableOpacity>

// //           <View>
// //             <TouchableOpacity
// //               style={styles.moreButton}
// //               onPress={() => handleMorePress(item._id)}
// //             >
// //               <MoreHorizontal size={20} color={colors.icon} />
// //             </TouchableOpacity>

// //             {activeDropdownPostId === item._id && (
// //               <View
// //                 style={[
// //                   styles.dropdownMenu,
// //                   { backgroundColor: colors.card, borderColor: colors.border },
// //                 ]}
// //               >
// //                 {isOwnPost ? (
// //                   <TouchableOpacity
// //                     style={[
// //                       styles.dropdownItem,
// //                       { borderBottomColor: colors.border },
// //                     ]}
// //                     onPress={() => handleDeletePost(item._id)}
// //                   >
// //                     <Trash2 size={16} color="#FF3B30" />
// //                     <Text style={[styles.dropdownText, { color: "#FF3B30" }]}>
// //                       Delete Post
// //                     </Text>
// //                   </TouchableOpacity>
// //                 ) : (
// //                   <>
// //                     <TouchableOpacity
// //                       style={[
// //                         styles.dropdownItem,
// //                         { borderBottomColor: colors.border },
// //                       ]}
// //                       onPress={() => handleBlockUser(item.user._id)}
// //                     >
// //                       <UserX size={16} color={colors.text} />
// //                       <Text
// //                         style={[styles.dropdownText, { color: colors.text }]}
// //                       >
// //                         Block User
// //                       </Text>
// //                     </TouchableOpacity>
// //                     <TouchableOpacity
// //                       style={[
// //                         styles.dropdownItem,
// //                         { borderBottomColor: colors.border },
// //                       ]}
// //                       onPress={() => handleBlockPost(item._id)}
// //                     >
// //                       <Ban size={16} color={colors.text} />
// //                       <Text
// //                         style={[styles.dropdownText, { color: colors.text }]}
// //                       >
// //                         Hide Post
// //                       </Text>
// //                     </TouchableOpacity>
// //                     <TouchableOpacity
// //                       style={[
// //                         styles.dropdownItem,
// //                         { borderBottomColor: colors.border },
// //                       ]}
// //                       onPress={() => handleFollowUser(item.user._id)}
// //                     >
// //                       <UserPlus size={16} color={colors.text} />
// //                       <Text
// //                         style={[styles.dropdownText, { color: colors.text }]}
// //                       >
// //                         Follow User
// //                       </Text>
// //                     </TouchableOpacity>
// //                     <TouchableOpacity
// //                       style={[styles.dropdownItem]}
// //                       onPress={() => handleOpenChat(item.user._id)}
// //                     >
// //                       <MessageSquarePlus size={16} color={colors.text} />
// //                       <Text
// //                         style={[styles.dropdownText, { color: colors.text }]}
// //                       >
// //                         Message
// //                       </Text>
// //                     </TouchableOpacity>
// //                   </>
// //                 )}
// //               </View>
// //             )}
// //           </View>
// //         </View>

// //         {item.caption ? (
// //           <View style={styles.captionContainer}>
// //             <Text style={[styles.caption, { color: colors.text }]}>
// //               {item.caption.split(/(\s+)/).map((word, index) => {
// //                 if (word.startsWith("#")) {
// //                   return (
// //                     <Text
// //                       key={index}
// //                       style={[styles.hashtag, { color: colors.hashtag }]}
// //                       onPress={() => handleHashtagPress(word.substring(1))}
// //                     >
// //                       {word}
// //                     </Text>
// //                   );
// //                 }
// //                 return (
// //                   <Text key={index} style={{ color: colors.text }}>
// //                     {word}
// //                   </Text>
// //                 );
// //               })}
// //             </Text>
// //           </View>
// //         ) : null}

// //         {mainImage && (
// //           <View style={styles.imageContainer}>
// //             <Image source={{ uri: mainImage }} style={styles.postImage} />
// //           </View>
// //         )}

// //         <View style={styles.actionsContainer}>
// //           <View style={styles.actionButtons}>
// //             <TouchableOpacity
// //               onPress={(e) => {
// //                 e.stopPropagation();
// //                 handlePostPress(item);
// //               }}
// //               style={styles.actionButton}
// //             >
// //               <MessageCircle size={20} color={colors.icon} />
// //               <Text style={[styles.actionCount, { color: colors.text }]}>
// //                 {item.comments?.length || 0}
// //               </Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               onPress={(e) => {
// //                 e.stopPropagation();
// //                 handleLike(item._id);
// //               }}
// //               style={styles.actionButton}
// //             >
// //               <Animated.View style={{ transform: [{ scale: heartScale }] }}>
// //                 <Heart
// //                   size={20}
// //                   color={colors.text}
// //                   fill={isLiked ? colors.like : colors.text}
// //                 />
// //               </Animated.View>
// //               <Animated.Text
// //                 style={[
// //                   styles.actionCount,
// //                   {
// //                     color: isLiked ? colors.like : colors.text,
// //                     opacity: isLiked ? 1 : 0.6,
// //                     transform: [{ scale: isLiked ? 1.1 : 1 }],
// //                   },
// //                 ]}
// //               >
// //                 {item.likes?.length || 0}
// //               </Animated.Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               onPress={(e) => {
// //                 e.stopPropagation();
// //                 handleShare(item);
// //               }}
// //               style={styles.actionButton}
// //             >
// //               <ShareIcon size={20} color={colors.icon} />
// //             </TouchableOpacity>
// //           </View>

// //           <View style={styles.viewsContainer}>
// //             <Eye size={16} color={colors.text} />
// //             <Text style={[styles.viewsText, { color: colors.text }]}>
// //               {item.views || 0}
// //             </Text>
// //             <Text style={[styles.viralScore, { color: "#FF6B35" }]}>
// //               {"•"} {item.viralScore}🔥
// //             </Text>
// //           </View>
// //         </View>
// //       </TouchableOpacity>
// //     );
// //   };

// //   const renderHeader = () => (
// //     <SafeAreaView
// //       style={[styles.headerSafeArea, { backgroundColor: colors.background }]}
// //     >
// //       <StatusBar
// //         barStyle={theme === "dark" ? "light-content" : "dark-content"}
// //         backgroundColor={colors.background}
// //       />
// //       <View
// //         style={[
// //           styles.header,
// //           {
// //             backgroundColor: colors.background,
// //             borderBottomColor: colors.border,
// //           },
// //         ]}
// //       >
// //         <View style={styles.headerContent}>
// //           ||{" "}
// //           <Text
// //             style={[
// //               styles.headerTitle,
// //               {
// //                 color: colors.text,
// //                 fontFamily: "cursive",
// //                 fontSize: 38,
// //                 fontWeight: "bold",
// //                 textShadowColor: "#00000033",
// //                 textShadowOffset: { width: 0, height: 2 },
// //                 textShadowRadius: 2,
// //               },
// //             ]}
// //           >
// //             Feeda
// //           </Text>
// //           <View style={styles.headerIcons}>
// //             <TouchableOpacity
// //               style={styles.iconButton}
// //               onPress={() => navigation?.navigate("UploadFeed")}
// //             >
// //               <Plus size={24} color={colors.text} />
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               style={styles.iconButton}
// //               onPress={() => navigation?.navigate("Search")}
// //             >
// //               <Search size={24} color={colors.text} />
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               style={styles.iconButton}
// //               onPress={() => navigation?.navigate("Notifications")}
// //             >
// //               <Bell size={24} color={colors.text} />
// //               {unreadNotifications > 0 && (
// //                 <View style={[styles.badge, { backgroundColor: "#E91E63" }]}>
// //                   <Text style={styles.badgeText}>
// //                     {unreadNotifications > 99 ? "99+" : unreadNotifications}
// //                   </Text>
// //                 </View>
// //               )}
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               style={styles.iconButton}
// //               onPress={() => navigation?.navigate("Chat")}
// //             >
// //               <MessageSquare size={24} color={colors.text} />
// //               {unreadMessages > 0 && (
// //                 <View style={[styles.badge, { backgroundColor: "#E91E63" }]}>
// //                   <Text style={styles.badgeText}>
// //                     {unreadMessages > 99 ? "99+" : unreadMessages}
// //                   </Text>
// //                 </View>
// //               )}
// //             </TouchableOpacity>
// //           </View>
// //         </View>
// //       </View>
// //     </SafeAreaView>
// //   );

// //   const renderFooter = () => {
// //     if (!loadingMore) return null;
// //     return (
// //       <View style={styles.loadingMore}>
// //         <ActivityIndicator size="small" color={colors.primary} />
// //       </View>
// //     );
// //   };

// //   const renderEmpty = () => (
// //     <View style={styles.emptyContainer}>
// //       <Text style={[styles.emptyText, { color: colors.text }]}>
// //         {error
// //           ? error
// //           : "No posts yet. Start following people or create your first post!"}
// //       </Text>
// //       {error && (
// //         <TouchableOpacity
// //           onPress={() => fetchPosts(1)}
// //           style={[styles.retryButton, { backgroundColor: colors.primary }]}
// //         >
// //           <Text style={styles.retryText}>Retry</Text>
// //         </TouchableOpacity>
// //       )}
// //     </View>
// //   );

// //   if (loading && initialLoad) {
// //     return (
// //       <View style={[styles.container, { backgroundColor: colors.background }]}>
// //         {renderHeader()}
// //         <View style={styles.centerLoading}>
// //           <ActivityIndicator size="large" color={colors.primary} />
// //           <Text style={[styles.loadingText, { color: colors.text }]}>
// //             Loading posts...
// //           </Text>
// //         </View>
// //       </View>
// //     );
// //   }

// //   return (
// //     <View style={[styles.container, { backgroundColor: colors.background }]}>
// //       {renderHeader()}
// //       <FlatList
// //         data={posts}
// //         renderItem={renderPost}
// //         keyExtractor={(item) => item._id}
// //         contentContainerStyle={styles.list}
// //         refreshControl={
// //           <RefreshControl
// //             refreshing={refreshing}
// //             onRefresh={handleRefresh}
// //             colors={[colors.primary]}
// //             tintColor={colors.primary}
// //             progressBackgroundColor={colors.card}
// //           />
// //         }
// //         onEndReached={handleLoadMore}
// //         onEndReachedThreshold={0.1}
// //         ListFooterComponent={renderFooter}
// //         ListEmptyComponent={renderEmpty}
// //         showsVerticalScrollIndicator={false}
// //         onScroll={handleScroll}
// //         scrollEventThrottle={16}
// //       />
// //     </View>
// //   );
// // };

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //     marginBottom: 30,
// //     paddingTop: 30,
// //   },
// //   headerSafeArea: {
// //     zIndex: 1000,
// //   },
// //   header: {
// //     height: 70,
// //     justifyContent: "center",
// //     alignItems: "center",
// //     // borderBottomWidth: 0.3,
// //     paddingHorizontal: 16,
// //     elevation: 2,
// //     shadowColor: "#000",
// //     shadowOffset: {
// //       width: 0,
// //       height: 1,
// //     },
// //     shadowOpacity: 0.1,
// //     shadowRadius: 2,
// //   },
// //   headerContent: {
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //     width: "100%",
// //     height: "100%",
// //   },
// //   headerTitle: {
// //     fontSize: 22,
// //     fontWeight: "bold",
// //     letterSpacing: 0.5,
// //   },
// //   headerIcons: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 8,
// //   },
// //   iconButton: {
// //     padding: 8,
// //     position: "relative",
// //     borderRadius: 20,
// //     minWidth: 40,
// //     minHeight: 40,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   badge: {
// //     position: "absolute",
// //     top: 4,
// //     right: 4,
// //     minWidth: 18,
// //     height: 18,
// //     borderRadius: 9,
// //     justifyContent: "center",
// //     alignItems: "center",
// //     paddingHorizontal: 4,
// //   },
// //   badgeText: {
// //     color: "white",
// //     fontSize: 10,
// //     fontWeight: "bold",
// //   },
// //   loadingContainer: {
// //     flex: 1,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   centerLoading: {
// //     flex: 1,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   loadingText: {
// //     marginTop: 10,
// //     fontSize: 16,
// //   },
// //   postContainer: {
// //     padding: 15,
// //     borderBottomWidth: 0.3,
// //     position: "relative",
// //   },
// //   viralBadge: {
// //     position: "absolute",
// //     top: 10,
// //     right: 10,
// //     paddingHorizontal: 8,
// //     paddingVertical: 4,
// //     borderRadius: 12,
// //     zIndex: 1,
// //   },
// //   viralBadgeText: {
// //     color: "white",
// //     fontSize: 10,
// //     fontWeight: "bold",
// //   },
// //   postHeader: {
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //   },
// //   userInfoContainer: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     flex: 1,
// //   },
// //   profileImage: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //   },
// //   userInfo: {
// //     marginLeft: 10,
// //     flex: 1,
// //   },
// //   userNameRow: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     flexWrap: "wrap",
// //   },
// //   fullName: {
// //     fontSize: 16,
// //     fontWeight: "bold",
// //     marginRight: 4,
// //   },
// //   username: {
// //     fontSize: 14,
// //     marginRight: 4,
// //   },
// //   timestamp: {
// //     fontSize: 12,
// //     marginLeft: 4,
// //   },
// //   moreButton: {
// //     padding: 8,
// //     zIndex: 2,
// //   },
// //   dropdownMenu: {
// //     position: "absolute",
// //     right: 0,
// //     top: 40,
// //     width: 180,
// //     borderRadius: 8,
// //     borderWidth: 1,
// //     zIndex: 10,
// //     elevation: 5,
// //     shadowColor: "#000",
// //     shadowOffset: { width: 0, height: 2 },
// //     shadowOpacity: 0.25,
// //     shadowRadius: 3.84,
// //   },
// //   dropdownItem: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     padding: 12,
// //     borderBottomWidth: 0.5,
// //   },
// //   dropdownText: {
// //     marginLeft: 10,
// //     fontSize: 14,
// //   },
// //   captionContainer: {
// //     marginTop: 10,
// //     marginLeft: 50,
// //   },
// //   caption: {
// //     fontSize: 16,
// //     lineHeight: 22,
// //   },
// //   hashtag: {
// //     fontWeight: "bold",
// //   },
// //   imageContainer: {
// //     marginTop: 10,
// //     marginLeft: 50,
// //   },
// //   postImage: {
// //     width: screenWidth - 30 - 50,
// //     height: screenWidth - 30 - 50,
// //     borderRadius: 10,
// //   },
// //   actionsContainer: {
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //     marginTop: 10,
// //     marginLeft: 50,
// //   },
// //   actionButtons: {
// //     flexDirection: "row",
// //   },
// //   actionButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     marginRight: 15,
// //     paddingVertical: 4,
// //   },
// //   actionCount: {
// //     marginLeft: 5,
// //     fontSize: 12,
// //   },
// //   viewsContainer: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //   },
// //   viewsText: {
// //     marginLeft: 5,
// //     fontSize: 12,
// //   },
// //   viralScore: {
// //     marginLeft: 5,
// //     fontSize: 12,
// //     fontWeight: "bold",
// //   },
// //   list: {
// //     paddingBottom: 100,
// //   },
// //   loadingMore: {
// //     paddingVertical: 20,
// //     alignItems: "center",
// //   },
// //   emptyContainer: {
// //     flex: 1,
// //     justifyContent: "center",
// //     alignItems: "center",
// //     padding: 20,
// //   },
// //   emptyText: {
// //     fontSize: 16,
// //     textAlign: "center",
// //   },
// //   retryButton: {
// //     marginTop: 20,
// //     paddingVertical: 10,
// //     paddingHorizontal: 20,
// //     borderRadius: 10,
// //   },
// //   retryText: {
// //     color: "white",
// //     fontSize: 16,
// //   },
// // });

// // export default HomeScreen;
