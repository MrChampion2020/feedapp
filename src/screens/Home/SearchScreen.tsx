
import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Alert,
  Share,
  Animated,
  Pressable,
} from "react-native"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import {
  Search,
  TrendingUp,
  Hash,
  User,
  Clock,
  X,
  ArrowLeft,
  MessageCircle,
  Heart,
  Share as ShareIcon,
  Eye,
  MoreHorizontal,
  UserX,
  Ban,
  UserPlus,
  Trash2,
  MessageSquarePlus,
  Volume2,
  VolumeX,
} from "lucide-react-native"
import { useNavigation } from "@react-navigation/native"
import { Audio, Video, ResizeMode } from "expo-av"
import VerifiedBadge from "../../components/VerifiedBadge"
import { getUserVerificationStatus } from "../../utils/userUtils"
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

interface SearchResult {
  users: any[]
  posts: any[]
  hashtags: any[]
  total: number
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

interface SearchScreenProps {
  navigation: any
  route?: {
    params?: {
      initialQuery?: string
      initialType?: string
      activeHashtag?: string
    }
  }
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

const SearchScreen: React.FC<SearchScreenProps> = ({ route }) => {
  const navigation = useNavigation()
  const { user, token, refreshToken, logout, isConnected } = useAuth()
  const { colors, theme } = useTheme()

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

  const [searchQuery, setSearchQuery] = useState(route?.params?.initialQuery || "")
  const [searchType, setSearchType] = useState(route?.params?.initialType || "all")
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [], hashtags: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [trendingHashtags, setTrendingHashtags] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [showHistory, setShowHistory] = useState(true)
  const [activeHashtag, setActiveHashtag] = useState(route?.params?.activeHashtag || null)

  const [activeTab, setActiveTab] = useState("search") // 'search' or 'trending'
  const [trendingPosts, setTrendingPosts] = useState([])
  const [loadingTrending, setLoadingTrending] = useState(false)
  
  // Added missing state variables
  const [activeDropdownPostId, setActiveDropdownPostId] = useState<string | null>(null)
  const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
  const [likeAnimations, setLikeAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [likeCountAnimations, setLikeCountAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [likeBounceAnimations, setLikeBounceAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [likeColorAnimations, setLikeColorAnimations] = useState<{ [key: string]: Animated.Value }>({})
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null)

  const searchInputRef = useRef<TextInput>(null)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
        setLikeSound(likeAudio)
      } catch (error) {
        console.log("Sound files not found, continuing without sounds:", error)
      }
    }
    loadSounds()
    
    fetchTrendingHashtags()
    fetchSearchHistory()

    if (route?.params?.initialQuery) {
      performSearch(route.params.initialQuery, route?.params?.initialType || "all")
      if (route?.params?.activeHashtag) {
        setActiveHashtag(route.params.activeHashtag)
      }
    }
    
    return () => {
      likeSound?.unloadAsync()
    }
  }, [])

  const playSound = async (sound: Audio.Sound | null) => {
    try {
      if (sound) await sound.replayAsync()
    } catch (error) {
      console.log("Error playing sound:", error)
    }
  }

  const fetchTrendingHashtags = async () => {
    try {
      const response = await api.get("/trending-hashtags?timeframe=24h&limit=20")
      setTrendingHashtags(response.data.hashtags || [])
    } catch (error) {
      console.error("Error fetching trending hashtags:", error)
    }
  }

  const fetchSearchHistory = async () => {
    try {
      const response = await api.get("/search/history")
      setSearchHistory(response.data.history || [])
    } catch (error) {
      console.error("Error fetching search history:", error)
    }
  }

  const performSearch = async (query: string, type = "all") => {
    if (!query.trim()) {
      setResults({ users: [], posts: [], hashtags: [], total: 0 })
      setShowHistory(true)
      return
    }

    setLoading(true)
    setShowHistory(false)

    try {
      const response = await api.get(`/search?q=${encodeURIComponent(query)}&type=${type}&limit=20`)
      const searchResults = response.data.results
      
      // Initialize like animations for posts
      if (searchResults.posts && searchResults.posts.length > 0) {
        const newLikeAnimations: { [key: string]: Animated.Value } = {}
        const newLikeCountAnimations: { [key: string]: Animated.Value } = {}
        const newLikeBounceAnimations: { [key: string]: Animated.Value } = {}
        const newLikeColorAnimations: { [key: string]: Animated.Value } = {}
        
        searchResults.posts.forEach((post: any) => {
          const isLiked = user && post.likes.includes(user.id)
          newLikeAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
          newLikeCountAnimations[post._id] = new Animated.Value(post.likes.length)
          newLikeBounceAnimations[post._id] = new Animated.Value(1)
          newLikeColorAnimations[post._id] = new Animated.Value(isLiked ? 1 : 0)
        })
        
        setLikeAnimations((prev) => ({ ...prev, ...newLikeAnimations }))
        setLikeCountAnimations((prev) => ({ ...prev, ...newLikeCountAnimations }))
        setLikeBounceAnimations((prev) => ({ ...prev, ...newLikeBounceAnimations }))
        setLikeColorAnimations((prev) => ({ ...prev, ...newLikeColorAnimations }))
      }
      
      setResults(searchResults)
    } catch (error) {
      console.error("Error performing search:", error)
      Alert.alert("Error", "Failed to perform search. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (text: string) => {
    setSearchQuery(text)

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }

    searchTimeout.current = setTimeout(() => {
      performSearch(text, searchType)
    }, 500)
  }

  const handleSearchTypeChange = (type: string) => {
    setSearchType(type)
    if (searchQuery.trim()) {
      performSearch(searchQuery, type)
    }
  }

  const handleHistoryItemPress = (item: any) => {
    setSearchQuery(item.query)
    setSearchType(item.type)
    performSearch(item.query, item.type)
  }

  const handleHashtagPress = (hashtag: string) => {
    const query = hashtag.startsWith("#") ? hashtag : `#${hashtag}`
    setSearchQuery(query)
    setSearchType("hashtags")
    setActiveHashtag(hashtag)
    performSearch(query, "hashtags")
  }

  const handleUserPress = (userId: string) => {
    (navigation as any).navigate("UserProfile", { userId })
  }

  const handlePostPress = (post: any) => {
    (navigation as any).navigate("PostView", { post, activeHashtag })
  }

  const handleLike = async (postId: string) => {
    if (!user || !token || !isConnected) {
      Alert.alert("No Connection", "Please check your internet connection")
      return
    }
    try {
      await playSound(likeSound)
      const post = results.posts.find((p) => p._id === postId)
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

      setResults((prev) => ({
        ...prev,
        posts: prev.posts.map((post) =>
          post._id === postId
            ? { ...post, likes: isLiked ? post.likes.filter((id: string) => id !== user.id) : [...post.likes, user.id] }
            : post
        )
      }))
      const response = await api.post(`/posts/${postId}/like`, { userId: user.id })
      setResults((prev) => ({
        ...prev,
        posts: prev.posts.map((post) => (post._id === postId ? { ...post, likes: response.data.likes } : post))
      }))
    } catch (error) {
      Alert.alert("Error", "Failed to like post. Please try again.")
    }
  }

  const handleShare = async (post: any) => {
    try {
      // Create a deep link to the post
      const appUrl = "https://feeda.app" // Replace with your actual app URL
      const postUrl = `${appUrl}/post/${post._id}`
      
      // Create share message with app link
      const shareMessage = `${post.caption || "Check out this post!"} by @${post.user.username}\n\nView on Feeda: ${postUrl}`
      
      await Share.share({
        message: shareMessage,
        url: post.media?.[0]?.url || postUrl, // Use post URL as fallback if no media
        title: `Post by @${post.user.username}`,
      })
    } catch (error) {
      console.log("Error sharing post:", error)
    }
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
            setResults((prev) => ({
              ...prev,
              posts: prev.posts.filter((post) => post.user._id !== userId)
            }))
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
          setResults((prev) => ({
            ...prev,
            posts: prev.posts.filter((post) => post._id !== postId)
          }))
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
            setResults((prev) => ({
              ...prev,
              posts: prev.posts.filter((post) => post._id !== postId)
            }))
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
    (navigation as any).navigate("Chat", { userId })
    setActiveDropdownPostId(null)
  }

  const clearSearchHistory = async () => {
    try {
      await api.delete("/search/history")
      setSearchHistory([])
      Alert.alert("Success", "Search history cleared")
    } catch (error) {
      console.error("Error clearing search history:", error)
      Alert.alert("Error", "Failed to clear search history")
    }
  }

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

  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const mostVisibleItem = viewableItems[0].item as Post
      setVisiblePostId(mostVisibleItem._id)
    } else {
      setVisiblePostId(null)
    }
  }).current

  const renderSearchTypes = () => {
    const searchTypes = [
      { key: "all", label: "All", icon: Search },
      { key: "users", label: "Users", icon: User },
      { key: "posts", label: "Posts", icon: MessageCircle },
      { key: "hashtags", label: "Hashtags", icon: Hash },
    ]

    return (
      <View style={styles.searchTypesContainer}>
        <FlatList
          data={searchTypes}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const IconComponent = item.icon
            const isActive = searchType === item.key

            return (
              <TouchableOpacity
                style={[
                  styles.searchTypeButton,
                  {
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSearchTypeChange(item.key)}
              >
                <IconComponent size={16} color={isActive ? "white" : colors.text} />
                <Text style={[styles.searchTypeText, { color: isActive ? "white" : colors.text }]}>{item.label}</Text>
              </TouchableOpacity>
            )
          }}
        />
      </View>
    )
  }

  const fetchHashtagPosts = async (hashtag: string) => {
    setLoadingTrending(true)
    setActiveHashtag(hashtag)
    try {
      const response = await api.get(`/search?q=${encodeURIComponent("#" + hashtag)}&type=hashtags&limit=20`)
      setTrendingPosts(response.data.results.posts || [])
    } catch (error) {
      console.error("Error fetching hashtag posts:", error)
      Alert.alert("Error", "Failed to load posts for this hashtag")
    } finally {
      setLoadingTrending(false)
    }
  }

  const renderTrendingHashtags = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TrendingUp size={20} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Hashtags</Text>
      </View>
      <FlatList
        data={trendingHashtags.slice(0, 10)}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: any, index) => `search-trending-${index}`}
        renderItem={({ item, index }: { item: any; index: number }) => {
          const isActive = activeHashtag === item.hashtag
          return (
            <TouchableOpacity
              style={[
                styles.trendingHashtagButton,
                {
                  backgroundColor: isActive ? colors.primary : colors.card,
                  borderColor: isActive ? colors.primary : colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
              onPress={() => handleHashtagPress(item.hashtag)}
            >
              <Text style={[styles.hashtagText, { color: isActive ? "white" : colors.primary }]}>#{item.hashtag}</Text>
              <Text style={[styles.hashtagCount, { color: isActive ? "white" : colors.text }]}>
                {item.count} posts
              </Text>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )

  const renderSearchHistory = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Clock size={20} color={colors.icon} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Searches</Text>
        {searchHistory.length > 0 && (
          <TouchableOpacity onPress={clearSearchHistory}>
            <Text style={[styles.clearText, { color: colors.primary }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      {searchHistory.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.text }]}>No recent searches</Text>
      ) : (
        <FlatList
          data={(searchHistory || []).slice(0, 10)}
          keyExtractor={(item: any, index) => `${item.query}-${item.type}-${index}`}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={[styles.historyItem, { borderBottomColor: colors.border }]}
              onPress={() => handleHistoryItemPress(item)}
            >
              <View style={styles.historyItemContent}>
                <Search size={16} color={colors.icon} />
                <Text style={[styles.historyQuery, { color: colors.text }]}>{item.query}</Text>
                <Text style={[styles.historyType, { color: colors.text }]}>in {item.type}</Text>
              </View>
              <Text style={[styles.historyTime, { color: colors.text }]}>{formatTimeAgo(item.timestamp)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )

  const renderUserResult = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: colors.border }]}
      onPress={() => handleUserPress(item._id)}
    >
      <Image source={{ uri: item.profilePicture || "https://via.placeholder.com/40" }} style={styles.userAvatar} />
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={[styles.userName, { color: colors.text }]}>{item.fullName}</Text>
          {(() => {
            const { isVerified, isPremiumVerified } = getUserVerificationStatus(item._id)
            return <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={12} />
          })()}
        </View>
        <Text style={[styles.userUsername, { color: colors.text }]}>@{item.username}</Text>
        <Text style={[styles.userStats, { color: colors.text }]}>
          {item.followersCount} followers • {item.followingCount} following
        </Text>
      </View>
    </TouchableOpacity>
  )

  const renderPostResult = ({ item }: { item: any }) => {
    const isLiked = user && item.likes?.includes(user.id)
    const isOwnPost = user?.id === item.user._id
    const { isVerified, isPremiumVerified } = getUserVerificationStatus(item.user._id)
    
    // Create interpolated values for animations with safety checks
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
    const heartColor = likeColorAnimations[item._id]?.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.text, colors.like]
    }) as any || (isLiked ? colors.like : colors.text)

    // Transform images and videos into media array
    const images = (item.images || []).map((url: any) => {
      if (typeof url !== "string" || !url) return null
      return { url, type: "image" }
    }).filter((media: Media | null) => media !== null)
    
    const videos = (item.videos || []).map((url: any) => {
      if (typeof url !== "string" || !url) return null
      return { url, type: "video" }
    }).filter((media: Media | null) => media !== null)
    
    const media = [...images, ...videos] as Media[]

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
            onPress={() => (navigation as any).navigate("UserProfile", { userId: item.user._id })} 
            style={styles.userInfoContainer}
            activeOpacity={0.8}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Image source={{ uri: item.user.profilePicture || "https://via.placeholder.com/40" }} style={styles.profileImage} />
            <View style={styles.userInfo}>
              
                          <View style={styles.userNameRow}>
                <Text style={[styles.fullName, { color: colors.text }]}>{item.user.fullName}</Text>
                <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={12} />
              <Text style={[styles.username, { color: colors.text, marginLeft: 8 }]}>@{item.user.username}</Text>
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
            <Text style={[styles.caption, { color: colors.text }]}>
              {item.caption.split(/(\s+)/).map((word: string, index: number) =>
                word.startsWith("#") ? (
                  <Text key={index} style={[styles.hashtag, { color: colors.hashtag }]} onPress={() => handleHashtagPress(word.substring(1))}>
                    {word}
                  </Text>
                ) : (
                  <Text key={index} style={{ color: colors.text }}>{word}</Text>
                )
              )}
            </Text>
          </View>
        )}
        
        {/* Modern Media Display */}
        {media.length > 0 && (
          <View style={styles.mediaContainer}>
            {media.length === 1 ? (
              <TouchableOpacity 
                onPress={() => handlePostPress(item)}
                activeOpacity={0.95}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <MediaItem
                  media={media[0]}
                  postId={item._id}
                  style={styles.singleMedia}
                  onPress={() => handlePostPress(item)}
                  isVisible={visiblePostId === item._id}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.multiMediaContainer}>
                <FlatList
                  data={media}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(mediaItem, index) => `${item._id}-${index}`}
                  renderItem={({ item: mediaItem, index }) => (
                    <View style={styles.scrollableMediaWrapper}>
                      <TouchableOpacity
                        onPress={() => handlePostPress(item)}
                        activeOpacity={0.95}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      >
                        <MediaItem
                          media={mediaItem}
                          postId={item._id}
                          style={styles.scrollableMedia}
                          onPress={() => handlePostPress(item)}
                          isVisible={visiblePostId === item._id && index === 0}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {/* Media indicators for multiple media */}
                {media.length > 1 && (
                  <View style={styles.mediaIndicators}>
                    {media.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.mediaIndicator,
                          { backgroundColor: index === 0 ? colors.primary : 'rgba(255, 255, 255, 0.5)' }
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        
        <View style={styles.actionsContainer}>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              onPress={(e) => { e.stopPropagation(); handlePostPress(item) }} 
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
                  color={isLiked ? "#E91E63" : getCountColor(item.likes?.length || 0, colors.text)} 
                  fill={isLiked ? "#E91E63" : "transparent"} 
                />
              </Animated.View>
              <Animated.Text style={[
                styles.actionCount, 
                { 
                  color: isLiked ? "#E91E63" : getCountColor(item.likes?.length || 0, colors.text), 
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

  const renderHashtagResult = ({ item }: { item: any }) => {
    const isActive = activeHashtag === item.hashtag
    return (
      <TouchableOpacity
        style={[
          styles.resultItem,
          {
            borderBottomColor: colors.border,
            backgroundColor: isActive ? colors.primary + "10" : "transparent",
          },
        ]}
        onPress={() => handleHashtagPress(item.hashtag)}
      >
        <Hash size={20} color={isActive ? colors.primary : colors.icon} />
        <View style={styles.hashtagResultContent}>
          <Text style={[styles.hashtagText, { color: isActive ? colors.primary : colors.text }]}>#{item.hashtag}</Text>
          <Text style={[styles.hashtagCount, { color: colors.text }]}>{item.count} posts</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderResults = () => {
    const allResults = [
      ...(results.users || []).map((user) => ({ ...user, type: "user" })),
      ...(results.posts || []).map((post) => ({ ...post, type: "post" })),
      ...(results.hashtags || []).map((hashtag) => ({ ...hashtag, type: "hashtag" })),
    ]

    return (
      <FlatList
        data={allResults}
        keyExtractor={(item, index) => `${item.type}-${item._id || item.hashtag}-${index}`}
        renderItem={({ item }) => {
          if (item.type === "user") return renderUserResult({ item })
          if (item.type === "post") return renderPostResult({ item })
          if (item.type === "hashtag") return renderHashtagResult({ item })
          return null
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.placeholder }]}>No results found</Text>
          </View>
        }
        contentContainerStyle={styles.resultsContainer}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{
          minimumViewTime: 300,
          itemVisiblePercentThreshold: 70,
        }}
      />
    )
  }

  const renderTrendingContent = () => {
    // If we have an active hashtag and posts, show the posts feed
    if (activeHashtag && (trendingPosts || []).length > 0) {
      return (
        <View style={styles.hashtagFeedContainer}>
          <View style={[styles.hashtagFeedHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.backToTrendingButton}
              onPress={() => {
                setActiveHashtag(null)
                setTrendingPosts([])
              }}
            >
              <ArrowLeft size={20} color={colors.text} />
              <Text style={[styles.backToTrendingText, { color: colors.text }]}>Back to Trending</Text>
            </TouchableOpacity>
            <Text style={[styles.hashtagFeedTitle, { color: colors.text }]}>#{activeHashtag}</Text>
            <Text style={[styles.hashtagFeedSubtitle, { color: colors.text }]}>
              {(trendingPosts || []).length} posts
            </Text>
          </View>

          {loadingTrending ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>Loading posts...</Text>
            </View>
          ) : (
            <FlatList
              data={trendingPosts || []}
              keyExtractor={(item, index) => `search-trending-${item._id}-${index}`}
              renderItem={renderPostResult}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.hashtagFeedList}
              onViewableItemsChanged={handleViewableItemsChanged}
              viewabilityConfig={{
                minimumViewTime: 300,
                itemVisiblePercentThreshold: 70,
              }}
            />
          )}
        </View>
      )
    }

    // Default trending hashtags view
    return (
      <View style={styles.trendingContent}>
        <Text style={[styles.trendingSubtitle, { color: colors.text }]}>
          Trending hashtags in the last 24 hours
        </Text>

        <FlatList
          data={trendingHashtags || []}
          keyExtractor={(item, index) => `search-trending-list-${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.trendingItem, { borderBottomColor: colors.border }]}
              onPress={() => fetchHashtagPosts((item as any).hashtag)}
            >
              <View style={styles.trendingRank}>
                <Text style={[styles.rankNumber, { color: colors.primary }]}>{index + 1}</Text>
              </View>

              <View style={styles.trendingInfo}>
                <Text style={[styles.trendingHashtagText, { color: colors.text }]}>#{(item as any).hashtag}</Text>
                <Text style={[styles.trendingStats, { color: colors.text }]}>{(item as any).count} posts</Text>
              </View>

              <View style={styles.trendingIndicator}>
                <TrendingUp size={16} color="#FF6B35" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <TrendingUp size={48} color={colors.placeholder} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No trending hashtags right now</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* Fixed Header with Tabs */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {activeTab === "search" ? (
          <View style={styles.searchContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              ref={searchInputRef}
              style={[
                styles.searchInput,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
              ]}
              placeholder="Search users, posts, hashtags..."
              placeholderTextColor={colors.text}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery("")}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.trendingHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab("search")}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.trendingTitle, { color: colors.text }]}>Trending</Text>
          </View>
        )}

        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "search" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab("search")}
          >
            <Search size={20} color={activeTab === "search" ? colors.primary : colors.icon} />
            <Text style={[styles.tabText, { color: activeTab === "search" ? colors.primary : colors.text }]}>
              Search
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "trending" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => {
              setActiveTab("trending")
              fetchTrendingHashtags()
            }}
          >
            <TrendingUp size={20} color={activeTab === "trending" ? colors.primary : colors.icon} />
            <Text style={[styles.tabText, { color: activeTab === "trending" ? colors.primary : colors.text }]}>
              Trending
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "search" && renderSearchTypes()}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === "search" ? (
          <>
            {showHistory && !loading ? (
              <FlatList
                data={[{ type: "trending" }, { type: "history" }]}
                keyExtractor={(item) => item.type}
                renderItem={({ item }) => {
                  if (item.type === "trending") return renderTrendingHashtags()
                  if (item.type === "history") return renderSearchHistory()
                  return null
                }}
                showsVerticalScrollIndicator={false}
              />
            ) : null}

            {!showHistory && !loading && results.total > 0 ? renderResults() : null}

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>Searching...</Text>
              </View>
            )}

            {!showHistory && !loading && results.total === 0 && searchQuery.trim() && (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No results found for "{searchQuery}"
                </Text>
              </View>
            )}
          </>
        ) : (
          renderTrendingContent()
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 90,
    paddingTop: 2,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  clearButton: {
    padding: 5,
    marginLeft: 10,
  },
  searchTypesContainer: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  searchTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  searchTypeText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  section: {
    marginVertical: 15,
    paddingHorizontal: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 10,
  },
  clearText: {
    fontSize: 16,
    fontWeight: "500",
  },
  trendingHashtagButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    minWidth: 100,
  },
  hashtagText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  hashtagCount: {
    fontSize: 12,
    marginTop: 4,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  historyQuery: {
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  historyType: {
    fontSize: 14,
    marginLeft: 5,
  },
  historyTime: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  resultsContainer: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    fontSize: 14,
    fontWeight: "500",
    marginRight: 6,
  },
  verifiedBadge: {
    fontSize: 10,
    color: "#1DA1F2",
    marginLeft: 2,
  },
  userUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  userStats: {
    fontSize: 12,
    marginTop: 4,
  },
  postUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postContent: {
    flex: 1,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  postUserName: {
    fontSize: 14,
    fontWeight: "bold",
  },
  postUsername: {
    fontSize: 14,
    marginLeft: 5,
  },
  postText: {
    fontSize: 15,
    lineHeight: 20,
  },
  hashtagResultContent: {
    flex: 1,
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 15,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  trendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  trendingTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 15,
  },
  trendingContent: {
    flex: 1,
    paddingHorizontal: 15,
  },
  trendingSubtitle: {
    fontSize: 14,
    marginVertical: 15,
    opacity: 0.7,
  },
  trendingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  trendingRank: {
    width: 40,
    alignItems: "center",
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: "bold",
  },
  trendingInfo: {
    flex: 1,
    marginLeft: 15,
  },
  trendingHashtagText: {
    fontSize: 18,
    fontWeight: "600",
  },
  trendingStats: {
    fontSize: 14,
    marginTop: 2,
  },
  trendingIndicator: {
    padding: 8,
  },
  hashtagPostsSection: {
    marginTop: 20,
    borderTopWidth: 1,
    paddingTop: 20,
  },
  hashtagPostsList: {
    maxHeight: 400,
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  postContainer: {
    padding: 15,
    borderBottomWidth: 1,
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
  fullName: {
    fontSize: 14,
    fontWeight: "500",
    marginRight: 6,
    padding: 5
  },
  username: {
    fontSize: 13,
    marginRight: 4,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 4,
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
  },
  postImage: {
    width: screenWidth - 30 - 50,
    height: 200,
    borderRadius: 10,
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
  hashtagFeedContainer: {
    flex: 1,
  },
  hashtagFeedHeader: {
    padding: 15,
    borderBottomWidth: 1,
  },
  backToTrendingButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backToTrendingText: {
    marginLeft: 8,
    fontSize: 16,
  },
  hashtagFeedTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  hashtagFeedSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  hashtagFeedList: {
    paddingBottom: 20,
  },
  // Modern media display styles
  mediaContainer: {
    marginTop: 10,
    marginLeft: 50,
    width: screenWidth - 30 - 50,
    borderRadius: 8,
    overflow: 'hidden',
  },
  singleMedia: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  multiMediaContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  scrollableMediaWrapper: {
    width: screenWidth - 30 - 50,
    height: 300,
  },
  scrollableMedia: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  mediaIndicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  mediaIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // MediaItem component styles
  mediaItemContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 5,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#000',
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
  // Added missing styles for viral features and dropdown
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
  viralScore: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "bold",
  },
})

export default SearchScreen

