

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Share,
  Animated,
} from "react-native"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import { getUserVerificationStatus } from "../../utils/userUtils"
import VerifiedBadge from "../../components/VerifiedBadge"
import SuccessNotification from "../../components/SuccessNotification"
import { Audio, Video, ResizeMode } from "expo-av"
import {
  Heart,
  MessageCircle,
  ArrowLeft,
  UserPlus,
  UserCheck,
  Send,
  Reply as ReplyIcon,
  X as CloseIcon,
  Share as ShareIcon,
  Download,
  MoreHorizontal,
  Image as ImageIcon,
  Camera,
} from "lucide-react-native"
import * as ImagePicker from "expo-image-picker"
import * as FileSystem from "expo-file-system"
import * as MediaLibrary from "expo-media-library"
import { FlatList } from "react-native"

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

interface Comment {
  _id: string
  user: {
    _id: string
    username: string
    fullName: string
    profilePicture?: string
  }
  text: string
  image?: string
  likes: string[]
  replies: {
    _id: string
    user: {
      _id: string
      username: string
      fullName: string
      profilePicture?: string
    }
    text: string
    image?: string
    likes: string[]
    createdAt: string
  }[]
  createdAt: string
}

interface Media {
  url: string
  type: 'image' | 'video'
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
  comments: Comment[]
  views: number
  hashtags: string[]
  createdAt: string
}

interface PostViewProps {
  route: {
    params: {
      post?: Post
      postId?: string
      activeHashtag?: string
      openComment?: boolean
    }
  }
  navigation: any
}

const PostView: React.FC<PostViewProps> = ({ route, navigation }) => {
  const { post: initialPost, postId, activeHashtag, openComment } = route.params
  const { user, token, refreshToken } = useAuth()
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

  const [post, setPost] = useState<Post | null>(initialPost || null)
  const [loading, setLoading] = useState(!initialPost)
  const [commentText, setCommentText] = useState("")
  const [replyText, setReplyText] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [isMediaModalVisible, setIsMediaModalVisible] = useState(false)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
  const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)

  const commentInputRef = useRef<TextInput>(null)
  const replyInputRef = useRef<TextInput>(null)
  const videoRefs = useRef<(Video | null)[]>([])

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
        const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
        setLikeSound(likeAudio)
        setCommentSound(commentAudio)
      } catch (error) {
        console.error("Error loading sounds:", error)
      }
    }

    loadSounds()

    return () => {
      likeSound?.unloadAsync()
      commentSound?.unloadAsync()
    }
  }, [])

  useEffect(() => {
    if (openComment && commentInputRef.current) {
      setTimeout(() => commentInputRef.current?.focus(), 300);
    }
  }, [openComment]);

  const playSound = async (sound: Audio.Sound | null) => {
    try {
      if (sound) {
        await sound.replayAsync()
      }
    } catch (error) {
      console.log("Error playing sound:", error)
    }
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

  const fetchPostById = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/posts/${id}`)
      const fetchedPost = response.data.post

      if (!fetchedPost) {
        throw new Error("Post not found")
      }

      fetchedPost.media = (fetchedPost.images || []).map((url: any) => {
        if (typeof url !== 'string' || !url) {
          return null
        }
        return {
          url,
          type: url.match(/\.(mp4|mov|avi)$/i) ? 'video' : 'image'
        }
      }).filter((media: Media | null) => media !== null) as Media[]
      delete fetchedPost.images

      setPost(fetchedPost)
      checkFollowingStatus(fetchedPost.user._id)
    } catch (error) {
      console.error("Error fetching post by ID:", error)
      setError("Failed to load post. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const checkFollowingStatus = async (userId?: string) => {
    if (!post && !userId) return
    const postUserId = userId || post?.user._id

    if (postUserId === user?.id) return

    try {
      const response = await api.post(`/users/${postUserId}/is-following`, {
        followerId: user?.id,
      })
      setIsFollowing(response.data.isFollowing)
    } catch (error) {
      console.error("Error checking follow status:", error)
    }
  }

  useEffect(() => {
    if (postId && !initialPost) {
      fetchPostById(postId)
    } else if (initialPost) {
      const transformedPost = {
        ...initialPost,
        media: (initialPost.media || []).map((item: any) => {
          const url = typeof item === 'string' ? item : item?.url
          if (typeof url !== 'string' || !url) {
            return null
          }
          return {
            url,
            type: (url.match(/\.(mp4|mov|avi)$/i) ? 'video' : 'image') as 'image' | 'video'
          }
        }).filter((media: any) => media !== null) as Media[]
      }
      setPost(transformedPost)
      checkFollowingStatus()
    }
  }, [postId, initialPost])

  const handleLike = async () => {
    if (!post || !user) return

    try {
      const isLiked = post.likes.includes(user.id)
      const endpoint = isLiked ? "unlike" : "like"

      await api.post(`/posts/${post._id}/${endpoint}`, {
        userId: user.id,
      })

      setPost((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          likes: isLiked ? prev.likes.filter((id) => id !== user.id) : [...prev.likes, user.id],
        }
      })

      if (!isLiked) {
        await playSound(likeSound)
      }
    } catch (error) {
      console.error("Error liking post:", error)
      Alert.alert("Error", "Failed to like post")
    }
  }

  const handleReply = async (commentId: string) => {
    if (!replyText.trim()) return
    if (!post || !user) return

    try {
      const response = await api.post(`/posts/${post._id}/comments/${commentId}/reply`, {
        text: replyText.trim(),
        userId: user.id,
      })

      const newReply = response.data.reply

      setPost((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          comments: prev.comments.map((comment) =>
            comment._id === commentId ? { ...comment, replies: [...comment.replies, newReply] } : comment,
          ),
        }
      })

      setReplyText("")
      setReplyingTo(null)
      await playSound(commentSound)
    } catch (error) {
      console.error("Error adding reply:", error)
      Alert.alert("Error", "Failed to add reply")
    }
  }

  const handleLikeComment = async (commentId: string) => {
    if (!user || !post) return

    try {
      await playSound(likeSound)
      const response = await api.post(`/posts/${post._id}/comments/${commentId}/like`, {
        userId: user.id,
      })

      setPost((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          comments: prev.comments.map((comment) =>
            comment._id === commentId ? { ...comment, likes: response.data.likes } : comment,
          ),
        }
      })
    } catch (error) {
      console.error("Error liking comment:", error)
    }
  }

  const handleComment = async () => {
    if (!commentText.trim() && !selectedMedia) return
    if (!post || !user) return

    try {
      await playSound(commentSound)

      const formData = new FormData()
      if (commentText.trim()) {
        formData.append("text", commentText.trim())
      }
      formData.append("userId", user.id)

      if (selectedMedia) {
        // Determine file type and name based on the selected image
        const isVideo = selectedMedia.toLowerCase().includes('.mp4') || selectedMedia.toLowerCase().includes('.mov')
        const fileType = isVideo ? 'video/mp4' : 'image/jpeg'
        const fileName = isVideo ? 'comment-video.mp4' : 'comment-image.jpg'
        
        formData.append("media", {
          uri: selectedMedia,
          type: fileType,
          name: fileName,
        } as any)
      }

      // Background upload - don't await, let it happen in background
      api.post(`/posts/${post._id}/comment`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }).then((response) => {
        const newComment = response.data.comment

        setPost((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            comments: [...prev.comments, newComment],
          }
        })
      }).catch((error: any) => {
        console.error("Background comment upload failed:", error);
        // Don't show error to user for background uploads
      })

      if (post.user._id !== user.id) {
        try {
          const captionPreview = post.caption
            ? post.caption.length > 50
              ? `${post.caption.substring(0, 47)}...`
              : post.caption
            : "No caption"
          const chatMessage = `New comment on your post:\n\n${captionPreview}\n\nComment: ${commentText.trim()}`
          const chatResponse = await api.post(
            `/chats/${post.user._id}`,
            {
              message: chatMessage,
              messageType: "text",
              postId: post._id,
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
            },
          )

        } catch (chatError: any) {
          console.error("Error sending chat message:", {
            status: chatError.response?.status || "Unknown",
            message: chatError.response?.data?.message || chatError.message || "Unknown error",
            errorCode: chatError.response?.data?.error || "Unknown",
          })
          Alert.alert("Success", "Comment posted, but failed to send chat notification to owner.")
        }
      }

      setCommentText("")
      setSelectedMedia(null)
      setSuccessMessage("Comment added")
      setShowSuccessNotification(true)
    } catch (error: any) {
      console.error("Error adding comment:", {
        status: error.response?.status || "Unknown",
        message: error.response?.data?.message || error.message || "Failed to post comment",
        errorCode: error.response?.data?.error || "Unknown",
      })

      if (error.response?.status === 401 || error.response?.status === 403) {
        try {
          await refreshToken()
          // Background retry upload
          api.post(`/posts/${post._id}/comment`, {
            text: commentText.trim(),
          }, {
            headers: {
              "Content-Type": "application/json",
            },
          }).then((retryResponse) => {
            const newComment = retryResponse.data.comment

            setPost((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                comments: [...prev.comments, newComment],
              }
            })
          }).catch((retryError: any) => {
            console.error("Background retry comment upload failed:", retryError);
          })

          if (post.user._id !== user.id) {
            try {
              const captionPreview = post.caption
                ? post.caption.length > 50
                  ? `${post.caption.substring(0, 47)}...`
                  : post.caption
                : "No caption"
              const chatMessage = `New comment on your post:\n\n${captionPreview}\n\nComment: ${commentText.trim()}`
              const chatResponse = await api.post(
                `/chats/${post.user._id}`,
                {
                  message: chatMessage,
                  messageType: "text",
                  postId: post._id,
                },
                {
                  headers: {
                    "Content-Type": "application/json",
                  },
                },
              )

            } catch (chatError: any) {
              console.error("Error sending chat message after retry:", {
                status: chatError.response?.status || "Unknown",
                message: chatError.response?.data?.message || chatError.message || "Unknown error",
                errorCode: chatError.response?.data?.error || "Unknown",
              })
              Alert.alert("Success", "Comment posted, but failed to send chat notification after retrying.")
            }
          }

          setCommentText("")
          setSelectedMedia(null)
          setSuccessMessage("Comment added")
          setShowSuccessNotification(true)
        } catch (refreshError: any) {
          console.error("Token refresh failed:", refreshError)
          Alert.alert("Session Expired", "Please log in again.", [
            {
              text: "Login",
              onPress: () => {
                // Assuming logout is defined elsewhere or will be added
                // navigation.navigate("Login")
              },
            },
          ])
        }
      } else {
        Alert.alert("Error", "Failed to add comment. Please try again.")
      }
    }
  }

  const handleFollow = async () => {
    if (!post || !user) return

    try {
      const endpoint = isFollowing ? "unfollow" : "follow"
      await api.post(`/users/${post.user._id}/${endpoint}`, {
        followerId: user.id,
      })

      setIsFollowing(!isFollowing)
      Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${post.user.username}`)
    } catch (error) {
      console.error("Error following/unfollowing user:", error)
      Alert.alert("Error", "Failed to update follow status")
    }
  }

  const handleShare = async () => {
    if (!post) return

    try {
      const result = await Share.share({
        message: `Check out this post by @${post.user.username}: ${post.caption}`,
        url: `https://yourapp.com/post/${post._id}`,
      })

      if (result.action === Share.sharedAction) {
      }
    } catch (error) {
      console.error("Error sharing post:", error)
      Alert.alert("Error", "Failed to share post")
    }
  }

  const handleDownloadMedia = async (mediaUrl: string, type: 'image' | 'video') => {
    if (!mediaUrl) {
      Alert.alert("Error", "No media URL provided")
      return
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant media library permissions to download media.")
        return
      }

      const extension = type === 'video' ? '.mp4' : '.jpg'
      const filename = `post_media_${Date.now()}${extension}`
      const fileUri = FileSystem.documentDirectory + filename

      const downloadResult = await FileSystem.downloadAsync(mediaUrl, fileUri)

      if (downloadResult.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri)
        await MediaLibrary.createAlbumAsync("Downloaded", asset, false)
        Alert.alert("Success", `${type.charAt(0).toUpperCase() + type.slice(1)} downloaded to your gallery!`)
      } else {
        throw new Error("Download failed")
      }
    } catch (error) {
      console.error(`Error downloading ${type}:`, error)
      Alert.alert("Error", `Failed to download ${type}`)
    }
  }

  const handleMediaPicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to send media.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        setSelectedMedia(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking media:", error)
      Alert.alert("Error", "Failed to pick media")
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
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        setSelectedMedia(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error taking photo:", error)
      Alert.alert("Error", "Failed to take photo")
    }
  }

  const openMediaModal = (index: number) => {
    setCurrentMediaIndex(index)
    setIsMediaModalVisible(true)
  }

  const renderMedia = (item: Media, index: number) => {
    if (!item.url || typeof item.url !== 'string') {
      return null
    }

    return (
      <View key={index} style={styles.mediaWrapper}>
        {item.type === 'video' ? (
          <Video
            ref={(ref) => {
              if (videoRefs.current) {
                videoRefs.current[index] = ref
              }
            }}
            source={{ uri: item.url }}
            style={styles.postVideo}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            shouldPlay={index === currentMediaIndex}
            onError={(error) => console.error(`Video failed to load: ${item.url}`, error)}
            onLoad={() => console.log(`Video loaded: ${item.url}`)}
          />
        ) : (
          <TouchableOpacity onPress={() => openMediaModal(index)}>
            <Image
              source={{ uri: item.url }}
              style={styles.postImage}
              onError={() => console.error(`Image failed to load: ${item.url}`)}
              onLoad={() => console.log(`Image loaded: ${item.url}`)}
            />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  const renderComment = ({ item: comment }: { item: Comment }) => {
    const isCommentLiked = user && comment.likes?.includes(user?.id || "")

    return (
      <View style={[styles.commentItem, { borderBottomColor: colors.border }]}>
        <Image
          source={{ uri: comment.user.profilePicture || "/placeholder.svg?height=40&width=40" }}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <View style={styles.commentUsernameRow}>
              <Text style={[styles.commentUsername, { color: colors.text }]}>{comment.user.username}</Text>
              <View style={styles.commentBadgeSpacing}>
                {(() => {
                  const { isVerified, isPremiumVerified } = getUserVerificationStatus(comment.user._id)
                  return <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={12} />
                })()}
              </View>
            </View>
            <View style={styles.commentTimeContainer}>
              <Text style={[styles.commentTime, { color: colors.secondary }]}>
                {formatTimeAgo(comment.createdAt)}
              </Text>
            </View>
          </View>
          {comment.image && (
            <View style={styles.commentMediaContainer}>
              {comment.image.toLowerCase().includes('.mp4') || comment.image.toLowerCase().includes('.mov') ? (
                <Video
                  source={{ uri: comment.image }}
                  style={styles.commentVideo}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                />
              ) : (
                <Image source={{ uri: comment.image }} style={styles.commentImage} />
              )}
            </View>
          )}
          <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity
              onPress={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
              style={styles.replyButton}
            >
              <ReplyIcon size={16} color={colors.secondary} />
              <Text style={[styles.replyButtonText, { color: colors.secondary }]}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleLikeComment(comment._id)} style={styles.commentActionButton}>
              <Heart
                size={16}
                color={isCommentLiked ? "#E91E63" : colors.secondary}
                fill={isCommentLiked ? "#E91E63" : "none"}
              />
              <Text style={[styles.replyButtonText, { color: isCommentLiked ? "#E91E63" : colors.secondary }]}>
                {comment.likes?.length || 0}
              </Text>
            </TouchableOpacity>
          </View>

          {comment.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {comment.replies.map((reply) => (
                <View key={reply._id} style={styles.replyItem}>
                  <Image
                    source={{ uri: reply.user.profilePicture || "/placeholder.svg?height=30&width=30" }}
                    style={styles.replyAvatar}
                  />
                  <View style={styles.replyContent}>
                    <Text style={[styles.replyUsername, { color: colors.text }]}>{reply.user.username}</Text>
                    <Text style={[styles.replyText, { color: colors.text }]}>{reply.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {replyingTo === comment._id && (
            <View style={[styles.replyInputContainer, { backgroundColor: colors.card }]}>
              <TextInput
                ref={replyInputRef}
                style={[styles.replyInput, { color: colors.text }]}
                placeholder="Write a reply..."
                placeholderTextColor={colors.grey}
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <TouchableOpacity
                onPress={() => handleReply(comment._id)}
                style={[styles.replySubmitButton, { backgroundColor: colors.primary }]}
              >
                <Send size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading post...</Text>
        </View>
      </View>
    )
  }

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Post not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const isLiked = post && user && post.likes.includes(user.id)

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SuccessNotification
        visible={showSuccessNotification}
        message={successMessage}
        onHide={() => setShowSuccessNotification(false)}
        duration={2000}
        colors={colors}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
          <TouchableOpacity onPress={() => setShareModalVisible(true)}>
            <MoreHorizontal size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.postHeader}>
            <Image
              source={{ uri: post.user.profilePicture || "/placeholder.svg?height=50&width=50" }}
              style={styles.userAvatar}
            />
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={[styles.username, { color: colors.text }]}>{post.user.username}</Text>
                <View style={styles.userBadgeSpacing}>
                  {(() => {
                    const { isVerified, isPremiumVerified } = getUserVerificationStatus(post.user._id)
                    return <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={16} />
                  })()}
                </View>
                <Text style={[styles.fullName, { color: colors.secondary, marginLeft: 12 }]}>{post.user.fullName}</Text>
              </View>
            </View>
            {post.user._id !== user?.id && (
              <TouchableOpacity
                onPress={handleFollow}
                style={[
                  styles.followButton,
                  {
                    backgroundColor: isFollowing ? colors.background : colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                {isFollowing ? <UserCheck size={16} color={colors.primary} /> : <UserPlus size={16} color="white" />}
                <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : "white" }]}>
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {(post.media || []).length > 0 ? (
            <View style={styles.mediaContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth)
                  setCurrentMediaIndex(index)
                  videoRefs.current.forEach((video, idx) => {
                    if (video && idx !== index) {
                      video.pauseAsync().catch((e) => console.error(`Pause error for video ${idx}:`, e))
                    }
                  })
                }}
              >
                {(post.media || []).map((item, index) => renderMedia(item, index))}
              </ScrollView>
              {(post.media || []).length > 1 && (
                <View style={styles.mediaIndicator}>
                  {(post.media || []).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.indicatorDot,
                        { backgroundColor: index === currentMediaIndex ? colors.primary : colors.border },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.textOnlyContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.caption, { color: colors.text, textAlign: 'left', padding: 20 }]}>{post.caption}</Text>
            </View>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
              <Heart
                size={24}
                color={isLiked ? "#E91E63" : getCountColor((post.likes || []).length, colors.text)}
                fill={isLiked ? "#E91E63" : "none"}
              />
              <Text style={[
                styles.actionText, 
                { 
                  color: isLiked ? "#E91E63" : getCountColor((post.likes || []).length, colors.text),
                  opacity: isLiked ? 1 : 0.6,
                }
              ]}>
                {formatNumber((post.likes || []).length)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.actionButton}>
              <MessageCircle size={24} color={getCountColor((post.comments || []).length, colors.text)} />
              <Text style={[styles.actionText, { color: getCountColor((post.comments || []).length, colors.text) }]}>
                {formatNumber((post.comments || []).length)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <ShareIcon size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.captionContainer}>
            {(post.media || []).length > 0 && (
              <Text style={[styles.caption, { color: colors.text }]}>{post.caption}</Text>
            )}
            <Text style={[styles.postTime, { color: colors.secondary }]}>
              {formatTimeAgo(post.createdAt)}
            </Text>
          </View>

          <View style={styles.commentsContainer}>
            <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
            <FlatList
              data={post.comments || []}
              renderItem={renderComment}
              keyExtractor={(item, index) => `postview-${item._id}-${index}`}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={[styles.noCommentsText, { color: colors.secondary }]}>No comments yet</Text>
              }
            />
          </View>
        </ScrollView>

        <View
          style={[styles.commentInputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}
        >
          {selectedMedia && (
            <View style={styles.selectedImageContainer}>
              {selectedMedia.toLowerCase().includes('.mp4') || selectedMedia.toLowerCase().includes('.mov') ? (
                <Video
                  source={{ uri: selectedMedia }}
                  style={styles.selectedImagePreview}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                />
              ) : (
                <Image source={{ uri: selectedMedia }} style={styles.selectedImagePreview} />
              )}
              <TouchableOpacity onPress={() => setSelectedMedia(null)} style={styles.removeImageButton}>
                <CloseIcon size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity
              onPress={handleMediaPicker}
              style={[styles.mediaButton, { backgroundColor: colors.card }]}
            >
              <ImageIcon size={20} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCameraPicker}
              style={[styles.mediaButton, { backgroundColor: colors.card }]}
            >
              <Camera size={20} color={colors.icon} />
            </TouchableOpacity>
            <TextInput
              ref={commentInputRef}
              style={[styles.commentInput, { backgroundColor: colors.card, color: colors.text }]}
              placeholder="Add a comment..."
              placeholderTextColor={colors.grey}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              onPress={handleComment}
              style={[
                styles.commentSubmitButton,
                { backgroundColor: commentText.trim() || selectedMedia ? colors.primary : colors.border },
              ]}
              disabled={!commentText.trim() && !selectedMedia}
            >
              <Send size={20} color={commentText.trim() || selectedMedia ? "white" : colors.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={isMediaModalVisible} transparent animationType="fade">
          <View style={styles.mediaModalContainer}>
            <TouchableOpacity style={styles.mediaModalClose} onPress={() => setIsMediaModalVisible(false)}>
              <CloseIcon size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaModalDownload}
              onPress={() => handleDownloadMedia(
                (post.media || [])[currentMediaIndex]?.url || '',
                (post.media || [])[currentMediaIndex]?.type || 'image'
              )}
            >
              <Download size={24} color="white" />
            </TouchableOpacity>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth)
                setCurrentMediaIndex(index)
                videoRefs.current.forEach((video, idx) => {
                  if (video && idx !== index) {
                    video.pauseAsync().catch((e) => console.error(`Modal pause error for video ${idx}:`, e))
                  }
                })
              }}
            >
              {(post.media || []).map((item, index) => (
                <View key={index} style={styles.fullScreenMedia}>
                  {!item.url || typeof item.url !== 'string' ? (
                    <Text style={[styles.errorText, { color: 'white' }]}>Media not available</Text>
                  ) : item.type === 'video' ? (
                    <Video
                      ref={(ref) => {
                        if (videoRefs.current) {
                          videoRefs.current[index] = ref
                        }
                      }}
                      source={{ uri: item.url }}
                      style={styles.fullScreenVideo}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      isLooping
                      shouldPlay={index === currentMediaIndex}
                      onError={(error) => console.error(`Modal video failed: ${item.url}`, error)}
                      onLoad={() => console.log(`Modal video loaded: ${item.url}`)}
                    />
                  ) : (
                    <Image
                      source={{ uri: item.url }}
                      style={styles.fullScreenImage}
                      resizeMode="contain"
                      onError={() => console.error(`Modal image failed: ${item.url}`)}
                      onLoad={() => console.log(`Modal image loaded: ${item.url}`)}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={shareModalVisible} transparent animationType="slide">
          <View style={styles.shareModalContainer}>
            <View style={[styles.shareModalContent, { backgroundColor: colors.background }]}>
              <Text style={[styles.shareModalTitle, { color: colors.text }]}>Share Post</Text>
              <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
                <ShareIcon size={24} color={colors.text} />
                <Text style={[styles.shareOptionText, { color: colors.text }]}>Share via...</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDownloadMedia(
                  (post.media || [])[0]?.url || '',
                  (post.media || [])[0]?.type || 'image'
                )}
                style={styles.shareOption}
                disabled={(post.media || []).length === 0}
              >
                <Download size={24} color={(post.media || []).length > 0 ? colors.text : colors.secondary} />
                <Text
                  style={[
                    styles.shareOptionText,
                    { color: (post.media || []).length > 0 ? colors.text : colors.secondary },
                  ]}
                >
                  Download Media
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShareModalVisible(false)} style={styles.shareCancel}>
                <Text style={[styles.shareCancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 50,
    paddingTop: 2,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
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
    flexWrap: "wrap",
  },
  username: {
    fontSize: 13,
    fontWeight: "600",
  },
  fullName: {
    fontSize: 14,
    fontWeight: 500,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  followButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  mediaContainer: {
    position: "relative",
    width: screenWidth,
    height: screenWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 8,
  },
  mediaWrapper: {
    width: screenWidth,
    height: screenWidth,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  postVideo: {
    width: screenWidth,
    height: screenWidth,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  postImage: {
    width: screenWidth,
    height: screenWidth,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  mediaIndicator: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  caption: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  postTime: {
    fontSize: 12,
  },
  commentsContainer: {
    paddingHorizontal: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  commentItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  commentUsernameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  commentBadgeSpacing: {
    marginLeft: 4, // Add some space between username and badge
  },
  commentTimeContainer: {
    flex: 1, // Allow time to take available space
  },
  commentTime: {
    fontSize: 12,
  },
  commentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginVertical: 8,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyButtonText: {
    marginLeft: 4,
    fontSize: 12,
  },
  repliesContainer: {
    marginTop: 12,
    paddingLeft: 16,
  },
  replyItem: {
    flexDirection: "row",
    marginBottom: 8,
  },
  replyAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyUsername: {
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    lineHeight: 16,
  },
  replyInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
  replyInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  replySubmitButton: {
    padding: 8,
    borderRadius: 16,
    marginLeft: 8,
  },
  noCommentsText: {
    textAlign: "center",
    fontSize: 14,
    padding: 20,
  },
  commentInputContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  selectedImageContainer: {
    position: "relative",
    marginBottom: 8,
  },
  selectedImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageButton: {
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
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  commentSubmitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaModalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  mediaModalDownload: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 1,
    padding: 10,
  },
  fullScreenMedia: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: screenWidth,
    height: screenHeight,
  },
  fullScreenVideo: {
    width: screenWidth,
    height: screenHeight,
  },
  shareModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  shareModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  shareOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  shareOptionText: {
    marginLeft: 16,
    fontSize: 16,
  },
  shareCancel: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 8,
  },
  shareCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  commentActionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  textOnlyContainer: {
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 8,
  },
  userBadgeSpacing: {
    marginLeft: 12, // Add some space between username and badge
  },
  commentMediaContainer: {
    width: '100%',
    height: 150, // Fixed height for media preview
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 8,
    backgroundColor: '#000', // Ensure background is dark for video
  },
  commentVideo: {
    width: '100%',
    height: '100%',
  },
})

export default PostView;


