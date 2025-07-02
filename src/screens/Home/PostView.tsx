
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
} from "react-native"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import { Audio, Video } from "expo-av"
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
import { FlatList, SafeAreaView } from "react-native"

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
    }
  }
  navigation: any
}

const PostView: React.FC<PostViewProps> = ({ route, navigation }) => {
  const { post: initialPost, postId, activeHashtag } = route.params
  const { user, token, refreshToken } = useAuth()
  const { colors, theme } = useTheme()

  const [post, setPost] = useState<Post | null>(initialPost || null)
  const [loading, setLoading] = useState(!initialPost)
  const [commentText, setCommentText] = useState("")
  const [replyText, setReplyText] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isMediaModalVisible, setIsMediaModalVisible] = useState(false)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)

  const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
  const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)

  const commentInputRef = useRef<TextInput>(null)
  const replyInputRef = useRef<TextInput>(null)
  const videoRefs = useRef<(Video | null)[]>([])

  useEffect(() => {
    console.log("PostView navigation params:", { postId, hasInitialPost: !!initialPost, activeHashtag, media: initialPost?.media })
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

  const playSound = async (sound: Audio.Sound | null) => {
    try {
      if (sound) {
        await sound.replayAsync()
      }
    } catch (error) {
      console.log("Error playing sound:", error)
    }
  }

  const fetchPostById = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      console.log("Fetching post by ID:", id)
      const response = await api.get(`/posts/${id}`)
      const fetchedPost = response.data.post

      if (!fetchedPost) {
        throw new Error("Post not found")
      }

      fetchedPost.media = (fetchedPost.images || []).map((url: any) => {
        if (typeof url !== 'string' || !url) {
          console.warn(`Invalid media URL in post ${id}:`, url)
          return null
        }
        return {
          url,
          type: url.match(/\.(mp4|mov|avi)$/i) ? 'video' : 'image'
        }
      }).filter((media: Media | null) => media !== null) as Media[]
      delete fetchedPost.images

      console.log("Fetched post media:", JSON.stringify(fetchedPost.media))
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
        media: (initialPost.media || initialPost.images || []).map((item: any) => {
          const url = typeof item === 'string' ? item : item?.url
          if (typeof url !== 'string' || !url) {
            console.warn(`Invalid media URL in initial post ${initialPost._id}:`, item)
            return null
          }
          return {
            url,
            type: url.match(/\.(mp4|mov|avi)$/i) ? 'video' : 'image'
          }
        }).filter((media: Media | null) => media !== null) as Media[]
      }
      delete transformedPost.images
      console.log("Initial post media:", JSON.stringify(transformedPost.media))
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
    if (!commentText.trim() && !selectedImage) return
    if (!post || !user) return

    try {
      await playSound(commentSound)

      const formData = new FormData()
      if (commentText.trim()) {
        formData.append("text", commentText.trim())
      }
      formData.append("userId", user.id)

      if (selectedImage) {
        formData.append("image", {
          uri: selectedImage,
          type: "image/jpeg",
          name: "comment-image.jpg",
        } as any)
      }

      const response = await api.post(`/posts/${post._id}/comment`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      const newComment = response.data.comment

      setPost((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          comments: [...prev.comments, newComment],
        }
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

          console.log(`Chat message sent to @${post.user.username}:`, chatResponse.data.chat)
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
      setSelectedImage(null)
      Alert.alert("Success", "Comment posted successfully!")
    } catch (error: any) {
      console.error("Error adding comment:", {
        status: error.response?.status || "Unknown",
        message: error.response?.data?.message || error.message || "Failed to post comment",
        errorCode: error.response?.data?.error || "Unknown",
      })

      if (error.response?.status === 401 || error.response?.status === 403) {
        try {
          await refreshToken()
          const retryResponse = await api.post(`/posts/${post._id}/comment`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          })

          const newComment = retryResponse.data.comment

          setPost((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              comments: [...prev.comments, newComment],
            }
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

              console.log(`Chat message sent to @${post.user.username}:`, chatResponse.data.chat)
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
          setSelectedImage(null)
          Alert.alert("Success", "Comment posted successfully!")
        } catch (refreshError: any) {
          console.error("Token refresh failed:", refreshError)
          Alert.alert("Session Expired", "Please log in again.", [
            {
              text: "Login",
              onPress: () => {
                logout()
                navigation.navigate("Login")
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
        console.log("Post shared successfully")
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

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to send images.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
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
        allowsEditing: true,
        aspect: [4, 3],
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

  const openMediaModal = (index: number) => {
    setCurrentMediaIndex(index)
    setIsMediaModalVisible(true)
  }

  const renderMedia = (item: Media, index: number) => {
    if (!item.url || typeof item.url !== 'string') {
      console.warn(`No valid media URL for item at index ${index} in post ${post?._id}:`, item)
      return (
        <View key={index} style={styles.mediaWrapper}>
          <Text style={[styles.errorText, { color: colors.text }]}>Media not available</Text>
        </View>
      )
    }

    console.log(`Rendering media item at index ${index} in post ${post?._id}:`, item)
    return (
      <View key={index} style={styles.mediaWrapper}>
        {item.type === 'video' ? (
          <Video
            ref={(ref) => (videoRefs.current[index] = ref)}
            source={{ uri: item.url }}
            style={styles.postVideo}
            useNativeControls
            resizeMode="contain"
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
            <Text style={[styles.commentUsername, { color: colors.text }]}>{comment.user.username}</Text>
            <Text style={[styles.commentTime, { color: colors.secondary }]}>
              {new Date(comment.createdAt).toLocaleDateString()}
            </Text>
          </View>
          {comment.image && <Image source={{ uri: comment.image }} style={styles.commentImage} />}
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
                color={isCommentLiked ? "#e74c3c" : colors.secondary}
                fill={isCommentLiked ? "#e74c3c" : "none"}
              />
              <Text style={[styles.replyButtonText, { color: colors.secondary }]}>
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading post...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Post not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
              <Text style={[styles.username, { color: colors.text }]}>{post.user.username}</Text>
              <Text style={[styles.fullName, { color: colors.secondary }]}>{post.user.fullName}</Text>
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

          {post.media.length > 0 ? (
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
                {post.media.map((item, index) => renderMedia(item, index))}
              </ScrollView>
              {post.media.length > 1 && (
                <View style={styles.mediaIndicator}>
                  {post.media.map((_, index) => (
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
            <View style={styles.mediaWrapper}>
              <Text style={[styles.errorText, { color: colors.text }]}>No media available</Text>
            </View>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
              <Heart
                size={24}
                color={post.likes.includes(user?.id || "") ? "#e74c3c" : colors.text}
                fill={post.likes.includes(user?.id || "") ? "#e74c3c" : "none"}
              />
              <Text style={[styles.actionText, { color: colors.text }]}>{post.likes.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.actionButton}>
              <MessageCircle size={24} color={colors.text} />
              <Text style={[styles.actionText, { color: colors.text }]}>{post.comments.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <ShareIcon size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.captionContainer}>
            <Text style={[styles.caption, { color: colors.text }]}>{post.caption}</Text>
            <Text style={[styles.postTime, { color: colors.secondary }]}>
              {new Date(post.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.commentsContainer}>
            <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
            <FlatList
              data={post.comments}
              renderItem={renderComment}
              keyExtractor={(item) => item._id}
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
          {selectedImage && (
            <View style={styles.selectedImageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />
              <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageButton}>
                <CloseIcon size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity
              onPress={handleImagePicker}
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
                { backgroundColor: commentText.trim() || selectedImage ? colors.primary : colors.border },
              ]}
              disabled={!commentText.trim() && !selectedImage}
            >
              <Send size={20} color={commentText.trim() || selectedImage ? "white" : colors.secondary} />
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
                post.media[currentMediaIndex]?.url || '',
                post.media[currentMediaIndex]?.type || 'image'
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
              {post.media.map((item, index) => (
                <View key={index} style={styles.fullScreenMedia}>
                  {!item.url || typeof item.url !== 'string' ? (
                    <Text style={[styles.errorText, { color: 'white' }]}>Media not available</Text>
                  ) : item.type === 'video' ? (
                    <Video
                      ref={(ref) => (videoRefs.current[index] = ref)}
                      source={{ uri: item.url }}
                      style={styles.fullScreenVideo}
                      useNativeControls
                      resizeMode="contain"
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
                  post.media[0]?.url || '',
                  post.media[0]?.type || 'image'
                )}
                style={styles.shareOption}
                disabled={post.media.length === 0}
              >
                <Download size={24} color={post.media.length > 0 ? colors.text : colors.secondary} />
                <Text
                  style={[
                    styles.shareOptionText,
                    { color: post.media.length > 0 ? colors.text : colors.secondary },
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 50,
    paddingTop: 15,
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
  username: {
    fontSize: 16,
    fontWeight: "600",
  },
  fullName: {
    fontSize: 14,
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
  },
  mediaWrapper: {
    width: screenWidth,
    height: screenWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  postImage: {
    width: screenWidth,
    height: screenWidth,
  },
  postVideo: {
    width: screenWidth,
    height: screenWidth,
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
  commentUsername: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
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
    fontWeight: "600",
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
})

export default PostView







// "use client"

// import type React from "react"
// import { useState, useEffect, useRef } from "react"
// import {
//   View,
//   Text,
//   Image,
//   TouchableOpacity,
//   TextInput,
//   Alert,
//   ActivityIndicator,
//   KeyboardAvoidingView,
//   Platform,
//   StyleSheet,
//   Modal,
//   ScrollView,
//   Dimensions,
//   Share,
// } from "react-native"
// import { useAuth, api } from "../../contexts/AuthContext"
// import { useTheme } from "../../contexts/ThemeContext"
// import { Audio } from "expo-av"
// import {
//   Heart,
//   MessageCircle,
//   ArrowLeft,
//   UserPlus,
//   UserCheck,
//   Send,
//   Reply as ReplyIcon,
//   X as CloseIcon,
//   Share as ShareIcon,
//   Download,
//   MoreHorizontal,
//   Image as ImageIcon,
//   Camera,
// } from "lucide-react-native"
// import * as ImagePicker from "expo-image-picker"
// import * as FileSystem from "expo-file-system"
// import * as MediaLibrary from "expo-media-library"
// import { FlatList, SafeAreaView } from "react-native"

// const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

// interface Comment {
//   _id: string
//   user: {
//     _id: string
//     username: string
//     fullName: string
//     profilePicture?: string
//   }
//   text: string
//   image?: string
//   likes: string[]
//   replies: {
//     _id: string
//     user: {
//       _id: string
//       username: string
//       fullName: string
//       profilePicture?: string
//     }
//     text: string
//     image?: string
//     likes: string[]
//     createdAt: string
//   }[]
//   createdAt: string
// }

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
//   comments: Comment[]
//   views: number
//   hashtags: string[]
//   createdAt: string
// }

// interface PostViewProps {
//   route: {
//     params: {
//       post?: Post
//       postId?: string
//       activeHashtag?: string
//     }
//   }
//   navigation: any
// }

// const PostView: React.FC<PostViewProps> = ({ route, navigation }) => {
//   const { post: initialPost, postId, activeHashtag } = route.params
//   const { user, token, refreshToken } = useAuth()
//   const { colors, theme } = useTheme()

//   const [post, setPost] = useState<Post | null>(initialPost || null)
//   const [loading, setLoading] = useState(!initialPost)
//   const [commentText, setCommentText] = useState("")
//   const [replyText, setReplyText] = useState("")
//   const [replyingTo, setReplyingTo] = useState<string | null>(null)
//   const [isFollowing, setIsFollowing] = useState(false)
//   const [shareModalVisible, setShareModalVisible] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [selectedImage, setSelectedImage] = useState<string | null>(null)
//   const [isImageModalVisible, setIsImageModalVisible] = useState(false)
//   const [currentImageIndex, setCurrentImageIndex] = useState(0)

//   const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
//   const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)

//   const commentInputRef = useRef<TextInput>(null)
//   const replyInputRef = useRef<TextInput>(null)

//   useEffect(() => {
//     const loadSounds = async () => {
//       try {
//         const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
//         const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
//         setLikeSound(likeAudio)
//         setCommentSound(commentAudio)
//       } catch (error) {
//         console.error("Error loading sounds:", error)
//       }
//     }

//     loadSounds()

//     return () => {
//       likeSound?.unloadAsync()
//       commentSound?.unloadAsync()
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

//   const fetchPostById = async (id: string) => {
//     try {
//       setLoading(true)
//       setError(null)
//       console.log("Fetching post by ID:", id)
//       const response = await api.get(`/posts/${id}`)
//       const fetchedPost = response.data.post

//       if (!fetchedPost) {
//         throw new Error("Post not found")
//       }

//       setPost(fetchedPost)
//       checkFollowingStatus(fetchedPost.user._id)
//     } catch (error) {
//       console.error("Error fetching post by ID:", error)
//       setError("Failed to load post. Please try again.")
//     } finally {
//       setLoading(false)
//     }
//   }

//   const checkFollowingStatus = async (userId?: string) => {
//     if (!post && !userId) return
//     const postUserId = userId || post?.user._id

//     if (postUserId === user?.id) return

//     try {
//       const response = await api.post(`/users/${postUserId}/is-following`, {
//         followerId: user?.id,
//       })
//       setIsFollowing(response.data.isFollowing)
//     } catch (error) {
//       console.error("Error checking follow status:", error)
//     }
//   }

//   useEffect(() => {
//     if (postId && !initialPost) {
//       fetchPostById(postId)
//     } else if (initialPost) {
//       checkFollowingStatus()
//     }
//   }, [postId, initialPost])

//   const handleLike = async () => {
//     if (!post || !user) return

//     try {
//       const isLiked = post.likes.includes(user.id)
//       const endpoint = isLiked ? "unlike" : "like"

//       await api.post(`/posts/${post._id}/${endpoint}`, {
//         userId: user.id,
//       })

//       setPost((prev) => {
//         if (!prev) return prev
//         return {
//           ...prev,
//           likes: isLiked ? prev.likes.filter((id) => id !== user.id) : [...prev.likes, user.id],
//         }
//       })

//       if (!isLiked) {
//         await playSound(likeSound)
//       }
//     } catch (error) {
//       console.error("Error liking post:", error)
//       Alert.alert("Error", "Failed to like post")
//     }
//   }

//   const handleReply = async (commentId: string) => {
//     if (!replyText.trim()) return
//     if (!post || !user) return

//     try {
//       // Fixed endpoint: using "comments" (plural) instead of "comment"
//       const response = await api.post(`/posts/${post._id}/comments/${commentId}/reply`, {
//         text: replyText.trim(),
//         userId: user.id,
//       })

//       const newReply = response.data.reply

//       setPost((prev) => {
//         if (!prev) return prev
//         return {
//           ...prev,
//           comments: prev.comments.map((comment) =>
//             comment._id === commentId ? { ...comment, replies: [...comment.replies, newReply] } : comment,
//           ),
//         }
//       })

//       setReplyText("")
//       setReplyingTo(null)
//       await playSound(commentSound)
//     } catch (error) {
//       console.error("Error adding reply:", error)
//       Alert.alert("Error", "Failed to add reply")
//     }
//   }

//   const handleLikeComment = async (commentId: string) => {
//     if (!user || !post) return

//     try {
//       await playSound(likeSound)

//       // Fixed endpoint: using "comments" (plural) instead of "comment"
//       const response = await api.post(`/posts/${post._id}/comments/${commentId}/like`, {
//         userId: user.id,
//       })

//       setPost((prev) => {
//         if (!prev) return prev
//         return {
//           ...prev,
//           comments: prev.comments.map((comment) =>
//             comment._id === commentId ? { ...comment, likes: response.data.likes } : comment,
//           ),
//         }
//       })
//     } catch (error) {
//       console.error("Error liking comment:", error)
//     }
//   }

  
  


// const handleComment = async () => {
//   if (!commentText.trim() && !selectedImage) return;
//   if (!post || !user) return;

//   try {
//     await playSound(commentSound);

//     const formData = new FormData();
//     if (commentText.trim()) {
//       formData.append("text", commentText.trim());
//     }
//     formData.append("userId", user.id);

//     if (selectedImage) {
//       formData.append("image", {
//         uri: selectedImage,
//         type: "image/jpeg",
//         name: "comment-image.jpg",
//       } as any);
//     }

//     const response = await api.post(`/posts/${post._id}/comment`, formData, {
//       headers: {
//         "Content-Type": "multipart/form-data",
//       },
//     });

//     const newComment = response.data.comment;

//     setPost((prev) => {
//       if (!prev) return prev;
//       return {
//         ...prev,
//         comments: [...prev.comments, newComment],
//       };
//     });

//     // Send chat notification to post owner if it's not the user's own post
//     if (post.user._id !== user.id) {
//       try {
//         const captionPreview = post.caption
//           ? post.caption.length > 50
//             ? `${post.caption.substring(0, 47)}...`
//             : post.caption
//           : "No caption";
//         const chatMessage = `New comment on your post:\n\n${captionPreview}\n\nComment: ${commentText.trim()}`;
//         const chatResponse = await api.post(
//           `/chats/${post.user._id}`,
//           {
//             message: chatMessage,
//             messageType: "text",
//             postId: post._id,
//           },
//           {
//             headers: {
//               "Content-Type": "application/json",
//             },
//           },
//         );

//         console.log(`Chat message sent to @${post.user.username}:`, chatResponse.data.chat);
//       } catch (chatError: any) {
//         console.error("Error sending chat message:", {
//           status: chatError.response?.status || "Unknown",
//           message: chatError.response?.data?.message || chatError.message || "Unknown error",
//           errorCode: chatError.response?.data?.error || "Unknown",
//         });
//         Alert.alert("Success", "Comment posted, but failed to send chat notification to owner.");
//       }
//     }

//     setCommentText("");
//     setSelectedImage(null);
//     Alert.alert("Success", "Comment posted successfully!");
//   } catch (error: any) {
//     console.error("Error adding comment:", {
//       status: error.response?.status || "Unknown",
//       message: error.response?.data?.message || error.message || "Failed to post comment",
//       errorCode: error.response?.data?.error || "Unknown",
//     });

//     // Handle token refresh for 401/403 errors
//     if (error.response?.status === 401 || error.response?.status === 403) {
//       try {
//         await refreshToken();
//         // Retry comment posting
//         const retryResponse = await api.post(`/posts/${post._id}/comment`, formData, {
//           headers: {
//             "Content-Type": "multipart/form-data",
//           },
//         });

//         const newComment = retryResponse.data.comment;

//         setPost((prev) => {
//           if (!prev) return prev;
//           return {
//             ...prev,
//             comments: [...prev.comments, newComment],
//           };
//         });

//         // Send chat notification after retry
//         if (post.user._id !== user.id) {
//           try {
//             const captionPreview = post.caption
//               ? post.caption.length > 50
//                 ? `${post.caption.substring(0, 47)}...`
//                 : post.caption
//               : "No caption";
//             const chatMessage = `New comment on your post:\n\n${captionPreview}\n\nComment: ${commentText.trim()}`;
//             const chatResponse = await api.post(
//               `/chats/${post.user._id}`,
//               {
//                 message: chatMessage,
//                 messageType: "text",
//                 postId: post._id,
//               },
//               {
//                 headers: {
//                   "Content-Type": "application/json",
//                 },
//               },
//             );

//             console.log(`Chat message sent to @${post.user.username}:`, chatResponse.data.chat);
//           } catch (chatError: any) {
//             console.error("Error sending chat message after retry:", {
//               status: chatError.response?.status || "Unknown",
//               message: chatError.response?.data?.message || chatError.message || "Unknown error",
//               errorCode: chatError.response?.data?.error || "Unknown",
//             });
//             Alert.alert("Success", "Comment posted, but failed to send chat notification after retrying.");
//           }
//         }

//         setCommentText("");
//         setSelectedImage(null);
//         Alert.alert("Success", "Comment posted successfully!");
//       } catch (refreshError: any) {
//         console.error("Token refresh failed:", refreshError);
//         Alert.alert("Session Expired", "Please log in again.", [
//           {
//             text: "Login",
//             onPress: () => {
//               logout();
//               navigation.navigate("Login");
//             },
//           },
//         ]);
//       }
//     } else {
//       Alert.alert("Error", "Failed to add comment. Please try again.");
//     }
//   }
// };


//   const handleFollow = async () => {
//     if (!post || !user) return

//     try {
//       const endpoint = isFollowing ? "unfollow" : "follow"
//       await api.post(`/users/${post.user._id}/${endpoint}`, {
//         followerId: user.id,
//       })

//       setIsFollowing(!isFollowing)
//       Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${post.user.username}`)
//     } catch (error) {
//       console.error("Error following/unfollowing user:", error)
//       Alert.alert("Error", "Failed to update follow status")
//     }
//   }

//   const handleShare = async () => {
//     if (!post) return

//     try {
//       const result = await Share.share({
//         message: `Check out this post by @${post.user.username}: ${post.caption}`,
//         url: `https://yourapp.com/post/${post._id}`,
//       })

//       if (result.action === Share.sharedAction) {
//         console.log("Post shared successfully")
//       }
//     } catch (error) {
//       console.error("Error sharing post:", error)
//       Alert.alert("Error", "Failed to share post")
//     }
//   }

//   const handleDownloadImage = async (imageUrl: string) => {
//     try {
//       const { status } = await MediaLibrary.requestPermissionsAsync()
//       if (status !== "granted") {
//         Alert.alert("Permission needed", "Please grant media library permissions to download images.")
//         return
//       }

//       const filename = `post_image_${Date.now()}.jpg`
//       const fileUri = FileSystem.documentDirectory + filename

//       const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri)

//       if (downloadResult.status === 200) {
//         const asset = await MediaLibrary.createAssetAsync(downloadResult.uri)
//         await MediaLibrary.createAlbumAsync("Downloaded", asset, false)
//         Alert.alert("Success", "Image downloaded to your gallery!")
//       } else {
//         throw new Error("Download failed")
//       }
//     } catch (error) {
//       console.error("Error downloading image:", error)
//       Alert.alert("Error", "Failed to download image")
//     }
//   }

//   const handleImagePicker = async () => {
//     try {
//       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
//       if (status !== "granted") {
//         Alert.alert("Permission needed", "Please grant camera roll permissions to send images.")
//         return
//       }

//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         allowsEditing: true,
//         aspect: [4, 3],
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
//         allowsEditing: true,
//         aspect: [4, 3],
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

//   const openImageModal = (index: number) => {
//     setCurrentImageIndex(index)
//     setIsImageModalVisible(true)
//   }

//   const renderComment = ({ item: comment }: { item: Comment }) => {
//     const isCommentLiked = user && comment.likes?.includes(user?.id || "")

//     return (
//       <View style={[styles.commentItem, { borderBottomColor: colors.border }]}>
//         <Image
//           source={{ uri: comment.user.profilePicture || "/placeholder.svg?height=40&width=40" }}
//           style={styles.commentAvatar}
//         />
//         <View style={styles.commentContent}>
//           <View style={styles.commentHeader}>
//             <Text style={[styles.commentUsername, { color: colors.text }]}>{comment.user.username}</Text>
//             <Text style={[styles.commentTime, { color: colors.secondary }]}>
//               {new Date(comment.createdAt).toLocaleDateString()}
//             </Text>
//           </View>
//           {comment.image && <Image source={{ uri: comment.image }} style={styles.commentImage} />}
//           <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>
//           <View style={styles.commentActions}>
//             <TouchableOpacity
//               onPress={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
//               style={styles.replyButton}
//             >
//               <ReplyIcon size={16} color={colors.secondary} />
//               <Text style={[styles.replyButtonText, { color: colors.secondary }]}>Reply</Text>
//             </TouchableOpacity>

//             <TouchableOpacity onPress={() => handleLikeComment(comment._id)} style={styles.commentActionButton}>
//               <Heart
//                 size={16}
//                 color={isCommentLiked ? "#e74c3c" : colors.secondary}
//                 fill={isCommentLiked ? "#e74c3c" : "none"}
//               />
//               <Text style={[styles.replyButtonText, { color: colors.secondary }]}>
//                 {comment.likes?.length || 0}
//               </Text>
//             </TouchableOpacity>
//           </View>

//           {comment.replies.length > 0 && (
//             <View style={styles.repliesContainer}>
//               {comment.replies.map((reply) => (
//                 <View key={reply._id} style={styles.replyItem}>
//                   <Image
//                     source={{ uri: reply.user.profilePicture || "/placeholder.svg?height=30&width=30" }}
//                     style={styles.replyAvatar}
//                   />
//                   <View style={styles.replyContent}>
//                     <Text style={[styles.replyUsername, { color: colors.text }]}>{reply.user.username}</Text>
//                     <Text style={[styles.replyText, { color: colors.text }]}>{reply.text}</Text>
//                   </View>
//                 </View>
//               ))}
//             </View>
//           )}

//           {replyingTo === comment._id && (
//             <View style={[styles.replyInputContainer, { backgroundColor: colors.card }]}>
//               <TextInput
//                 ref={replyInputRef}
//                 style={[styles.replyInput, { color: colors.text }]}
//                 placeholder="Write a reply..."
//                 placeholderTextColor={colors.grey}
//                 value={replyText}
//                 onChangeText={setReplyText}
//                 multiline
//               />
//               <TouchableOpacity
//                 onPress={() => handleReply(comment._id)}
//                 style={[styles.replySubmitButton, { backgroundColor: colors.primary }]}
//               >
//                 <Send size={16} color="white" />
//               </TouchableOpacity>
//             </View>
//           )}
//         </View>
//       </View>
//     )
//   }

//   if (loading) {
//     return (
//       <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color={colors.primary} />
//           <Text style={[styles.loadingText, { color: colors.text }]}>Loading post...</Text>
//         </View>
//       </SafeAreaView>
//     )
//   }

//   if (!post) {
//     return (
//       <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
//         <View style={styles.errorContainer}>
//           <Text style={[styles.errorText, { color: colors.text }]}>Post not found</Text>
//           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//             <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
//           </TouchableOpacity>
//         </View>
//       </SafeAreaView>
//     )
//   }

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
//       <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
//         {/* Header */}
//         <View style={[styles.header, { borderBottomColor: colors.border }]}>
//           <TouchableOpacity onPress={() => navigation.goBack()}>
//             <ArrowLeft size={24} color={colors.text} />
//           </TouchableOpacity>
//           <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
//           <TouchableOpacity onPress={() => setShareModalVisible(true)}>
//             <MoreHorizontal size={24} color={colors.text} />
//           </TouchableOpacity>
//         </View>

//         <ScrollView showsVerticalScrollIndicator={false}>
//           {/* Post Header */}
//           <View style={styles.postHeader}>
//             <Image
//               source={{ uri: post.user.profilePicture || "/placeholder.svg?height=50&width=50" }}
//               style={styles.userAvatar}
//             />
//             <View style={styles.userInfo}>
//               <Text style={[styles.username, { color: colors.text }]}>{post.user.username}</Text>
//               <Text style={[styles.fullName, { color: colors.secondary }]}>{post.user.fullName}</Text>
//             </View>
//             {post.user._id !== user?.id && (
//               <TouchableOpacity
//                 onPress={handleFollow}
//                 style={[
//                   styles.followButton,
//                   {
//                     backgroundColor: isFollowing ? colors.background : colors.primary,
//                     borderColor: colors.primary,
//                   },
//                 ]}
//               >
//                 {isFollowing ? <UserCheck size={16} color={colors.primary} /> : <UserPlus size={16} color="white" />}
//                 <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : "white" }]}>
//                   {isFollowing ? "Following" : "Follow"}
//                 </Text>
//               </TouchableOpacity>
//             )}
//           </View>

//           {/* Post Images */}
//           {post.images.length > 0 && (
//             <View style={styles.imageContainer}>
//               <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
//                 {post.images.map((image, index) => (
//                   <TouchableOpacity key={index} onPress={() => openImageModal(index)}>
//                     <Image source={{ uri: image }} style={styles.postImage} />
//                   </TouchableOpacity>
//                 ))}
//               </ScrollView>
//               {post.images.length > 1 && (
//                 <View style={styles.imageIndicator}>
//                   {post.images.map((_, index) => (
//                     <View
//                       key={index}
//                       style={[
//                         styles.indicatorDot,
//                         { backgroundColor: index === currentImageIndex ? colors.primary : colors.border },
//                       ]}
//                     />
//                   ))}
//                 </View>
//               )}
//             </View>
//           )}

//           {/* Post Actions */}
//           <View style={styles.postActions}>
//             <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
//               <Heart
//                 size={24}
//                 color={post.likes.includes(user?.id || "") ? "#e74c3c" : colors.text}
//                 fill={post.likes.includes(user?.id || "") ? "#e74c3c" : "none"}
//               />
//               <Text style={[styles.actionText, { color: colors.text }]}>{post.likes.length}</Text>
//             </TouchableOpacity>
//             <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.actionButton}>
//               <MessageCircle size={24} color={colors.text} />
//               <Text style={[styles.actionText, { color: colors.text }]}>{post.comments.length}</Text>
//             </TouchableOpacity>
//             <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
//               <ShareIcon size={24} color={colors.text} />
//             </TouchableOpacity>
//           </View>

//           {/* Post Caption */}
//           <View style={styles.captionContainer}>
//             <Text style={[styles.caption, { color: colors.text }]}>{post.caption}</Text>
//             <Text style={[styles.postTime, { color: colors.secondary }]}>
//               {new Date(post.createdAt).toLocaleDateString()}
//             </Text>
//           </View>

//           {/* Comments */}
//           <View style={styles.commentsContainer}>
//             <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
//             <FlatList
//               data={post.comments}
//               renderItem={renderComment}
//               keyExtractor={(item) => item._id}
//               scrollEnabled={false}
//               ListEmptyComponent={
//                 <Text style={[styles.noCommentsText, { color: colors.secondary }]}>No comments yet</Text>
//               }
//             />
//           </View>
//         </ScrollView>

//         {/* Comment Input */}
//         <View
//           style={[styles.commentInputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}
//         >
//           {selectedImage && (
//             <View style={styles.selectedImageContainer}>
//               <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />
//               <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageButton}>
//                 <CloseIcon size={16} color="white" />
//               </TouchableOpacity>
//             </View>
//           )}
//           <View style={styles.inputRow}>
//             <TouchableOpacity
//               onPress={handleImagePicker}
//               style={[styles.mediaButton, { backgroundColor: colors.card }]}
//             >
//               <ImageIcon size={20} color={colors.icon} />
//             </TouchableOpacity>
//             <TouchableOpacity
//               onPress={handleCameraPicker}
//               style={[styles.mediaButton, { backgroundColor: colors.card }]}
//             >
//               <Camera size={20} color={colors.icon} />
//             </TouchableOpacity>
//             <TextInput
//               ref={commentInputRef}
//               style={[styles.commentInput, { backgroundColor: colors.card, color: colors.text }]}
//               placeholder="Add a comment..."
//               placeholderTextColor={colors.grey}
//               value={commentText}
//               onChangeText={setCommentText}
//               multiline
//             />
//             <TouchableOpacity
//               onPress={handleComment}
//               style={[
//                 styles.commentSubmitButton,
//                 { backgroundColor: commentText.trim() || selectedImage ? colors.primary : colors.border },
//               ]}
//               disabled={!commentText.trim() && !selectedImage}
//             >
//               <Send size={20} color={commentText.trim() || selectedImage ? "white" : colors.secondary} />
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* Image Modal */}
//         <Modal visible={isImageModalVisible} transparent animationType="fade">
//           <View style={styles.imageModalContainer}>
//             <TouchableOpacity style={styles.imageModalClose} onPress={() => setIsImageModalVisible(false)}>
//               <CloseIcon size={24} color="white" />
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={styles.imageModalDownload}
//               onPress={() => handleDownloadImage(post.images[currentImageIndex])}
//             >
//               <Download size={24} color="white" />
//             </TouchableOpacity>
//             <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
//               {post.images.map((image, index) => (
//                 <Image key={index} source={{ uri: image }} style={styles.fullScreenImage} resizeMode="contain" />
//               ))}
//             </ScrollView>
//           </View>
//         </Modal>

//         {/* Share Modal */}
//         <Modal visible={shareModalVisible} transparent animationType="slide">
//           <View style={styles.shareModalContainer}>
//             <View style={[styles.shareModalContent, { backgroundColor: colors.background }]}>
//               <Text style={[styles.shareModalTitle, { color: colors.text }]}>Share Post</Text>
//               <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
//                 <ShareIcon size={24} color={colors.text} />
//                 <Text style={[styles.shareOptionText, { color: colors.text }]}>Share via...</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 onPress={() => handleDownloadImage(post.images[0])}
//                 style={styles.shareOption}
//                 disabled={post.images.length === 0}
//               >
//                 <Download size={24} color={post.images.length > 0 ? colors.text : colors.secondary} />
//                 <Text
//                   style={[
//                     styles.shareOptionText,
//                     { color: post.images.length > 0 ? colors.text : colors.secondary },
//                   ]}
//                 >
//                   Download Image
//                 </Text>
//               </TouchableOpacity>
//               <TouchableOpacity onPress={() => setShareModalVisible(false)} style={styles.shareCancel}>
//                 <Text style={[styles.shareCancelText, { color: colors.primary }]}>Cancel</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </Modal>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     marginBottom: 50,
//     paddingTop: 15
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   loadingText: {
//     marginTop: 10,
//     fontSize: 16,
//   },
//   errorContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   errorText: {
//     fontSize: 18,
//     marginBottom: 20,
//   },
//   backButton: {
//     padding: 10,
//   },
//   backButtonText: {
//     fontSize: 16,
//   },
//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     padding: 16,
//     borderBottomWidth: 1,
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//   },
//   postHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 16,
//   },
//   userAvatar: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     marginRight: 12,
//   },
//   userInfo: {
//     flex: 1,
//   },
//   username: {
//     fontSize: 16,
//     fontWeight: "600",
//   },
//   fullName: {
//     fontSize: 14,
//   },
//   followButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 20,
//     borderWidth: 1,
//   },
//   followButtonText: {
//     marginLeft: 8,
//     fontSize: 14,
//     fontWeight: "600",
//   },
//   imageContainer: {
//     position: "relative",
//   },
//   postImage: {
//     width: screenWidth,
//     height: screenWidth,
//   },
//   imageIndicator: {
//     position: "absolute",
//     bottom: 16,
//     left: 0,
//     right: 0,
//     flexDirection: "row",
//     justifyContent: "center",
//   },
//   indicatorDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     marginHorizontal: 4,
//   },
//   postActions: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 16,
//   },
//   actionButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginRight: 24,
//   },
//   actionText: {
//     marginLeft: 8,
//     fontSize: 14,
//     fontWeight: "600",
//   },
//   captionContainer: {
//     paddingHorizontal: 16,
//     paddingBottom: 16,
//   },
//   caption: {
//     fontSize: 16,
//     lineHeight: 22,
//     marginBottom: 8,
//   },
//   postTime: {
//     fontSize: 12,
//   },
//   commentsContainer: {
//     paddingHorizontal: 16,
//   },
//   commentsTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     marginBottom: 16,
//   },
//   commentItem: {
//     flexDirection: "row",
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//   },
//   commentAvatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     marginRight: 12,
//   },
//   commentContent: {
//     flex: 1,
//   },
//   commentHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   commentUsername: {
//     fontSize: 14,
//     fontWeight: "600",
//     marginRight: 8,
//   },
//   commentTime: {
//     fontSize: 12,
//   },
//   commentImage: {
//     width: 200,
//     height: 150,
//     borderRadius: 8,
//     marginVertical: 8,
//   },
//   commentText: {
//     fontSize: 14,
//     lineHeight: 20,
//     marginBottom: 8,
//   },
//   commentActions: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   replyButton: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   replyButtonText: {
//     marginLeft: 4,
//     fontSize: 12,
//   },
//   repliesContainer: {
//     marginTop: 12,
//     paddingLeft: 16,
//   },
//   replyItem: {
//     flexDirection: "row",
//     marginBottom: 8,
//   },
//   replyAvatar: {
//     width: 30,
//     height: 30,
//     borderRadius: 15,
//     marginRight: 8,
//   },
//   replyContent: {
//     flex: 1,
//   },
//   replyUsername: {
//     fontSize: 12,
//     fontWeight: "600",
//     marginBottom: 2,
//   },
//   replyText: {
//     fontSize: 12,
//     lineHeight: 16,
//   },
//   replyInputContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginTop: 8,
//     padding: 8,
//     borderRadius: 8,
//   },
//   replyInput: {
//     flex: 1,
//     fontSize: 14,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//   },
//   replySubmitButton: {
//     padding: 8,
//     borderRadius: 16,
//     marginLeft: 8,
//   },
//   noCommentsText: {
//     textAlign: "center",
//     fontSize: 14,
//     padding: 20,
//   },
//   commentInputContainer: {
//     padding: 16,
//     borderTopWidth: 1,
//   },
//   selectedImageContainer: {
//     position: "relative",
//     marginBottom: 8,
//   },
//   selectedImagePreview: {
//     width: 60,
//     height: 60,
//     borderRadius: 8,
//   },
//   removeImageButton: {
//     position: "absolute",
//     top: -8,
//     right: -8,
//     backgroundColor: "rgba(0,0,0,0.7)",
//     borderRadius: 12,
//     width: 24,
//     height: 24,
//     justifyContent: "center",
//     alignItems: "center",
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
//   commentInput: {
//     flex: 1,
//     minHeight: 40,
//     maxHeight: 100,
//     borderRadius: 20,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     textAlignVertical: "top",
//   },
//   commentSubmitButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   imageModalContainer: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.9)",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   imageModalClose: {
//     position: "absolute",
//     top: 50,
//     right: 20,
//     zIndex: 1,
//     padding: 10,
//   },
//   imageModalDownload: {
//     position: "absolute",
//     top: 50,
//     left: 20,
//     zIndex: 1,
//     padding: 10,
//   },
//   fullScreenImage: {
//     width: screenWidth,
//     height: screenHeight,
//   },
//   shareModalContainer: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.5)",
//     justifyContent: "flex-end",
//   },
//   shareModalContent: {
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//     padding: 20,
//   },
//   shareModalTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     marginBottom: 20,
//     textAlign: "center",
//   },
//   shareOption: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingVertical: 16,
//     paddingHorizontal: 12,
//     borderRadius: 8,
//     marginBottom: 8,
//   },
//   shareOptionText: {
//     marginLeft: 16,
//     fontSize: 16,
//   },
//   shareCancel: {
//     alignItems: "center",
//     paddingVertical: 16,
//     marginTop: 8,
//   },
//   shareCancelText: {
//     fontSize: 16,
//     fontWeight: "600",
//   },
//   commentActionButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginLeft: 16,
//   },
// })

// export default PostView



// // import type React from "react"
// // import { useState, useEffect, useRef } from "react"
// // import {
// //   View,
// //   Text,
// //   Image,
// //   TouchableOpacity,
// //   TextInput,
// //   Alert,
// //   ActivityIndicator,
// //   KeyboardAvoidingView,
// //   Platform,
// //   StyleSheet,
// //   Modal,
// //   ScrollView,
// //   Dimensions,
// //   Share,
// // } from "react-native"
// // import { useAuth, api } from "../../contexts/AuthContext"
// // import { useTheme } from "../../contexts/ThemeContext"
// // import { Audio } from "expo-av"
// // import {
// //   Heart,
// //   MessageCircle,
// //   ArrowLeft,
// //   UserPlus,
// //   UserCheck,
// //   Send,
// //   Reply as ReplyIcon,
// //   X as CloseIcon,
// //   Share as ShareIcon,
// //   Download,
// //   MoreHorizontal,
// //   Image as ImageIcon,
// //   Camera,
// // } from "lucide-react-native"
// // import * as ImagePicker from "expo-image-picker"
// // import * as FileSystem from "expo-file-system"
// // import * as MediaLibrary from "expo-media-library"
// // import { FlatList, SafeAreaView } from "react-native"

// // const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

// // interface Comment {
// //   _id: string
// //   user: {
// //     _id: string
// //     username: string
// //     fullName: string
// //     profilePicture?: string
// //   }
// //   text: string
// //   image?: string
// //   likes: string[]
// //   replies: {
// //     _id: string
// //     user: {
// //       _id: string
// //       username: string
// //       fullName: string
// //       profilePicture?: string
// //     }
// //     text: string
// //     image?: string
// //     likes: string[]
// //     createdAt: string
// //   }[]
// //   createdAt: string
// // }

// // interface Post {
// //   _id: string
// //   user: {
// //     _id: string
// //     username: string
// //     fullName: string
// //     profilePicture?: string
// //   }
// //   images: string[]
// //   caption: string
// //   likes: string[]
// //   comments: Comment[]
// //   views: number
// //   hashtags: string[]
// //   createdAt: string
// // }

// // interface PostViewProps {
// //   route: {
// //     params: {
// //       post?: Post
// //       postId?: string
// //       activeHashtag?: string
// //     }
// //   }
// //   navigation: any
// // }

// // const PostView: React.FC<PostViewProps> = ({ route, navigation }) => {
// //   const { post: initialPost, postId, activeHashtag } = route.params
// //   const { user, token, refreshToken } = useAuth()
// //   const { colors, theme } = useTheme()

// //   const [post, setPost] = useState<Post | null>(initialPost || null)
// //   const [loading, setLoading] = useState(!initialPost)
// //   const [commentText, setCommentText] = useState("")
// //   const [replyText, setReplyText] = useState("")
// //   const [replyingTo, setReplyingTo] = useState<string | null>(null)
// //   const [isFollowing, setIsFollowing] = useState(false)
// //   const [shareModalVisible, setShareModalVisible] = useState(false)
// //   const [error, setError] = useState<string | null>(null)
// //   const [selectedImage, setSelectedImage] = useState<string | null>(null)
// //   const [isImageModalVisible, setIsImageModalVisible] = useState(false)
// //   const [currentImageIndex, setCurrentImageIndex] = useState(0)

// //   const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
// //   const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)

// //   const commentInputRef = useRef<TextInput>(null)
// //   const replyInputRef = useRef<TextInput>(null)

// //   useEffect(() => {
// //     const loadSounds = async () => {
// //       try {
// //         const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
// //         const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
// //         setLikeSound(likeAudio)
// //         setCommentSound(commentAudio)
// //       } catch (error) {
// //         console.error("Error loading sounds:", error)
// //       }
// //     }

// //     loadSounds()

// //     return () => {
// //       likeSound?.unloadAsync()
// //       commentSound?.unloadAsync()
// //     }
// //   }, [])

// //   const playSound = async (sound: Audio.Sound | null) => {
// //     try {
// //       if (sound) {
// //         await sound.replayAsync()
// //       }
// //     } catch (error) {
// //       console.log("Error playing sound:", error)
// //     }
// //   }

// //   const fetchPostById = async (id: string) => {
// //     try {
// //       setLoading(true)
// //       setError(null)
// //       console.log("Fetching post by ID:", id)
// //       const response = await api.get(`/posts/${id}`)
// //       const fetchedPost = response.data.post

// //       if (!fetchedPost) {
// //         throw new Error("Post not found")
// //       }

// //       setPost(fetchedPost)
// //       checkFollowingStatus(fetchedPost.user._id)
// //     } catch (error) {
// //       console.error("Error fetching post by ID:", error)
// //       setError("Failed to load post. Please try again.")
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const checkFollowingStatus = async (userId?: string) => {
// //     if (!post && !userId) return
// //     const postUserId = userId || post?.user._id

// //     if (postUserId === user?.id) return

// //     try {
// //       const response = await api.post(`/users/${postUserId}/is-following`, {
// //         followerId: user?.id,
// //       })
// //       setIsFollowing(response.data.isFollowing)
// //     } catch (error) {
// //       console.error("Error checking follow status:", error)
// //     }
// //   }

// //   useEffect(() => {
// //     if (postId && !initialPost) {
// //       fetchPostById(postId)
// //     } else if (initialPost) {
// //       checkFollowingStatus()
// //     }
// //   }, [postId, initialPost])

// //   const handleLike = async () => {
// //     if (!post || !user) return

// //     try {
// //       const isLiked = post.likes.includes(user.id)
// //       const endpoint = isLiked ? "unlike" : "like"

// //       await api.post(`/posts/${post._id}/${endpoint}`, {
// //         userId: user.id,
// //       })

// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           likes: isLiked ? prev.likes.filter((id) => id !== user.id) : [...prev.likes, user.id],
// //         }
// //       })

// //       if (!isLiked) {
// //         await playSound(likeSound)
// //       }
// //     } catch (error) {
// //       console.error("Error liking post:", error)
// //       Alert.alert("Error", "Failed to like post")
// //     }
// //   }

// //   const handleReply = async (commentId: string) => {
// //     if (!replyText.trim()) return
// //     if (!post || !user) return

// //     try {
// //       // Fixed endpoint: using "comments" (plural) instead of "comment"
// //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/reply`, {
// //         text: replyText.trim(),
// //         userId: user.id,
// //       })

// //       const newReply = response.data.reply

// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           comments: prev.comments.map((comment) =>
// //             comment._id === commentId ? { ...comment, replies: [...comment.replies, newReply] } : comment,
// //           ),
// //         }
// //       })

// //       setReplyText("")
// //       setReplyingTo(null)
// //       await playSound(commentSound)
// //     } catch (error) {
// //       console.error("Error adding reply:", error)
// //       Alert.alert("Error", "Failed to add reply")
// //     }
// //   }

// //   const handleLikeComment = async (commentId: string) => {
// //     if (!user || !post) return

// //     try {
// //       await playSound(likeSound)

// //       // Fixed endpoint: using "comments" (plural) instead of "comment"
// //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/like`, {
// //         userId: user.id,
// //       })

// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           comments: prev.comments.map((comment) =>
// //             comment._id === commentId ? { ...comment, likes: response.data.likes } : comment,
// //           ),
// //         }
// //       })
// //     } catch (error) {
// //       console.error("Error liking comment:", error)
// //     }
// //   }

// //   const handleComment = async () => {
// //     if (!commentText.trim() && !selectedImage) return
// //     if (!post || !user) return

// //     try {
// //       const formData = new FormData()
// //       if (commentText.trim()) {
// //         formData.append("text", commentText.trim())
// //       }
// //       formData.append("userId", user.id)

// //       if (selectedImage) {
// //         formData.append("image", {
// //           uri: selectedImage,
// //           type: "image/jpeg",
// //           name: "comment-image.jpg",
// //         } as any)
// //       }

// //       const response = await api.post(`/posts/${post._id}/comment`, formData, {
// //         headers: {
// //           "Content-Type": "multipart/form-data",
// //         },
// //       })

// //       const newComment = response.data.comment

// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           comments: [...prev.comments, newComment],
// //         }
// //       })

// //       // Send notification to post owner if it's not the user's own post
// //       if (post.user._id !== user.id) {
// //         try {
// //           const captionPreview = post.caption
// //             ? post.caption.length > 50
// //               ? `${post.caption.substring(0, 47)}...`
// //               : post.caption
// //             : "No caption"

// //           // Create chat message with post preview
// //           const chatMessage = `New comment on your post: "${captionPreview}"\nComment: ${commentText.trim()}`

// //           // Send chat message with image if available
// //           if (post.images && post.images.length > 0) {
// //             await api.post(`/chats/${post.user._id}`, {
// //               message: chatMessage,
// //               image: post.images[0],
// //             })
// //           } else {
// //             await api.post(`/chats/${post.user._id}`, {
// //               message: chatMessage,
// //             })
// //           }

// //           console.log(`Chat notification sent to @${post.user.username}`)
// //         } catch (chatError) {
// //           console.error("Error sending chat notification:", chatError)
// //         }
// //       }

// //       setCommentText("")
// //       setSelectedImage(null)
// //       await playSound(commentSound)
// //     } catch (error) {
// //       console.error("Error adding comment:", error)
// //       Alert.alert("Error", "Failed to add comment")
// //     }
// //   }

// //   const handleFollow = async () => {
// //     if (!post || !user) return

// //     try {
// //       const endpoint = isFollowing ? "unfollow" : "follow"
// //       await api.post(`/users/${post.user._id}/${endpoint}`, {
// //         followerId: user.id,
// //       })

// //       setIsFollowing(!isFollowing)
// //       Alert.alert("Success", `${isFollowing ? "Unfollowed" : "Following"} @${post.user.username}`)
// //     } catch (error) {
// //       console.error("Error following/unfollowing user:", error)
// //       Alert.alert("Error", "Failed to update follow status")
// //     }
// //   }

// //   const handleShare = async () => {
// //     if (!post) return

// //     try {
// //       const result = await Share.share({
// //         message: `Check out this post by @${post.user.username}: ${post.caption}`,
// //         url: `https://yourapp.com/post/${post._id}`,
// //       })

// //       if (result.action === Share.sharedAction) {
// //         console.log("Post shared successfully")
// //       }
// //     } catch (error) {
// //       console.error("Error sharing post:", error)
// //       Alert.alert("Error", "Failed to share post")
// //     }
// //   }

// //   const handleDownloadImage = async (imageUrl: string) => {
// //     try {
// //       const { status } = await MediaLibrary.requestPermissionsAsync()
// //       if (status !== "granted") {
// //         Alert.alert("Permission needed", "Please grant media library permissions to download images.")
// //         return
// //       }

// //       const filename = `post_image_${Date.now()}.jpg`
// //       const fileUri = FileSystem.documentDirectory + filename

// //       const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri)

// //       if (downloadResult.status === 200) {
// //         const asset = await MediaLibrary.createAssetAsync(downloadResult.uri)
// //         await MediaLibrary.createAlbumAsync("Downloaded", asset, false)
// //         Alert.alert("Success", "Image downloaded to your gallery!")
// //       } else {
// //         throw new Error("Download failed")
// //       }
// //     } catch (error) {
// //       console.error("Error downloading image:", error)
// //       Alert.alert("Error", "Failed to download image")
// //     }
// //   }

// //   const handleImagePicker = async () => {
// //     try {
// //       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
// //       if (status !== "granted") {
// //         Alert.alert("Permission needed", "Please grant camera roll permissions to send images.")
// //         return
// //       }

// //       const result = await ImagePicker.launchImageLibraryAsync({
// //         mediaTypes: ImagePicker.MediaType.Images,
// //         allowsEditing: true,
// //         aspect: [4, 3],
// //         quality: 0.8,
// //       })

// //       if (!result.canceled && result.assets[0]) {
// //         setSelectedImage(result.assets[0].uri)
// //       }
// //     } catch (error) {
// //       console.error("Error picking image:", error)
// //       Alert.alert("Error", "Failed to pick image")
// //     }
// //   }

// //   const handleCameraPicker = async () => {
// //     try {
// //       const { status } = await ImagePicker.requestCameraPermissionsAsync()
// //       if (status !== "granted") {
// //         Alert.alert("Permission needed", "Please grant camera permissions to take photos.")
// //         return
// //       }

// //       const result = await ImagePicker.launchCameraAsync({
// //         allowsEditing: true,
// //         aspect: [4, 3],
// //         quality: 0.8,
// //       })

// //       if (!result.canceled && result.assets[0]) {
// //         setSelectedImage(result.assets[0].uri)
// //       }
// //     } catch (error) {
// //       console.error("Error taking photo:", error)
// //       Alert.alert("Error", "Failed to take photo")
// //     }
// //   }

// //   const openImageModal = (index: number) => {
// //     setCurrentImageIndex(index)
// //     setIsImageModalVisible(true)
// //   }

// //   const renderComment = ({ item: comment }: { item: Comment }) => {
// //     const isCommentLiked = user && comment.likes?.includes(user?.id || "")

// //     return (
// //       <View style={[styles.commentItem, { borderBottomColor: colors.border }]}>
// //         <Image
// //           source={{ uri: comment.user.profilePicture || "/placeholder.svg?height=40&width=40" }}
// //           style={styles.commentAvatar}
// //         />
// //         <View style={styles.commentContent}>
// //           <View style={styles.commentHeader}>
// //             <Text style={[styles.commentUsername, { color: colors.text }]}>{comment.user.username}</Text>
// //             <Text style={[styles.commentTime, { color: colors.secondary }]}>
// //               {new Date(comment.createdAt).toLocaleDateString()}
// //             </Text>
// //           </View>
// //           {comment.image && <Image source={{ uri: comment.image }} style={styles.commentImage} />}
// //           <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>
// //           <View style={styles.commentActions}>
// //             <TouchableOpacity
// //               onPress={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
// //               style={styles.replyButton}
// //             >
// //               <ReplyIcon size={16} color={colors.secondary} />
// //               <Text style={[styles.replyButtonText, { color: colors.secondary }]}>Reply</Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity onPress={() => handleLikeComment(comment._id)} style={styles.commentActionButton}>
// //               <Heart
// //                 size={16}
// //                 color={isCommentLiked ? "#e74c3c" : colors.secondary}
// //                 fill={isCommentLiked ? "#e74c3c" : "none"}
// //               />
// //               <Text style={[styles.replyButtonText, { color: colors.secondary }]}>
// //                 {comment.likes?.length || 0}
// //               </Text>
// //             </TouchableOpacity>
// //           </View>

// //           {comment.replies.length > 0 && (
// //             <View style={styles.repliesContainer}>
// //               {comment.replies.map((reply) => (
// //                 <View key={reply._id} style={styles.replyItem}>
// //                   <Image
// //                     source={{ uri: reply.user.profilePicture || "/placeholder.svg?height=30&width=30" }}
// //                     style={styles.replyAvatar}
// //                   />
// //                   <View style={styles.replyContent}>
// //                     <Text style={[styles.replyUsername, { color: colors.text }]}>{reply.user.username}</Text>
// //                     <Text style={[styles.replyText, { color: colors.text }]}>{reply.text}</Text>
// //                   </View>
// //                 </View>
// //               ))}
// //             </View>
// //           )}

// //           {replyingTo === comment._id && (
// //             <View style={[styles.replyInputContainer, { backgroundColor: colors.card }]}>
// //               <TextInput
// //                 ref={replyInputRef}
// //                 style={[styles.replyInput, { color: colors.text }]}
// //                 placeholder="Write a reply..."
// //                 placeholderTextColor={colors.secondary}
// //                 value={replyText}
// //                 onChangeText={setReplyText}
// //                 multiline
// //               />
// //               <TouchableOpacity
// //                 onPress={() => handleReply(comment._id)}
// //                 style={[styles.replySubmitButton, { backgroundColor: colors.primary }]}
// //               >
// //                 <Send size={16} color="white" />
// //               </TouchableOpacity>
// //             </View>
// //           )}
// //         </View>
// //       </View>
// //     )
// //   }

// //   if (loading) {
// //     return (
// //       <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
// //         <View style={styles.loadingContainer}>
// //           <ActivityIndicator size="large" color={colors.primary} />
// //           <Text style={[styles.loadingText, { color: colors.text }]}>Loading post...</Text>
// //         </View>
// //       </SafeAreaView>
// //     )
// //   }

// //   if (!post) {
// //     return (
// //       <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
// //         <View style={styles.errorContainer}>
// //           <Text style={[styles.errorText, { color: colors.text }]}>Post not found</Text>
// //           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
// //             <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
// //           </TouchableOpacity>
// //         </View>
// //       </SafeAreaView>
// //     )
// //   }

// //   return (
// //     <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
// //       <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
// //         {/* Header */}
// //         <View style={[styles.header, { borderBottomColor: colors.border }]}>
// //           <TouchableOpacity onPress={() => navigation.goBack()}>
// //             <ArrowLeft size={24} color={colors.text} />
// //           </TouchableOpacity>
// //           <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
// //           <TouchableOpacity onPress={() => setShareModalVisible(true)}>
// //             <MoreHorizontal size={24} color={colors.text} />
// //           </TouchableOpacity>
// //         </View>

// //         <ScrollView showsVerticalScrollIndicator={false}>
// //           {/* Post Header */}
// //           <View style={styles.postHeader}>
// //             <Image
// //               source={{ uri: post.user.profilePicture || "/placeholder.svg?height=50&width=50" }}
// //               style={styles.userAvatar}
// //             />
// //             <View style={styles.userInfo}>
// //               <Text style={[styles.username, { color: colors.text }]}>{post.user.username}</Text>
// //               <Text style={[styles.fullName, { color: colors.secondary }]}>{post.user.fullName}</Text>
// //             </View>
// //             {post.user._id !== user?.id && (
// //               <TouchableOpacity
// //                 onPress={handleFollow}
// //                 style={[
// //                   styles.followButton,
// //                   {
// //                     backgroundColor: isFollowing ? colors.background : colors.primary,
// //                     borderColor: colors.primary,
// //                   },
// //                 ]}
// //               >
// //                 {isFollowing ? <UserCheck size={16} color={colors.primary} /> : <UserPlus size={16} color="white" />}
// //                 <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : "white" }]}>
// //                   {isFollowing ? "Following" : "Follow"}
// //                 </Text>
// //               </TouchableOpacity>
// //             )}
// //           </View>

// //           {/* Post Images */}
// //           {post.images.length > 0 && (
// //             <View style={styles.imageContainer}>
// //               <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
// //                 {post.images.map((image, index) => (
// //                   <TouchableOpacity key={index} onPress={() => openImageModal(index)}>
// //                     <Image source={{ uri: image }} style={styles.postImage} />
// //                   </TouchableOpacity>
// //                 ))}
// //               </ScrollView>
// //               {post.images.length > 1 && (
// //                 <View style={styles.imageIndicator}>
// //                   {post.images.map((_, index) => (
// //                     <View
// //                       key={index}
// //                       style={[
// //                         styles.indicatorDot,
// //                         { backgroundColor: index === currentImageIndex ? colors.primary : colors.border },
// //                       ]}
// //                     />
// //                   ))}
// //                 </View>
// //               )}
// //             </View>
// //           )}

// //           {/* Post Actions */}
// //           <View style={styles.postActions}>
// //             <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
// //               <Heart
// //                 size={24}
// //                 color={post.likes.includes(user?.id || "") ? "#e74c3c" : colors.text}
// //                 fill={post.likes.includes(user?.id || "") ? "#e74c3c" : "none"}
// //               />
// //               <Text style={[styles.actionText, { color: colors.text }]}>{post.likes.length}</Text>
// //             </TouchableOpacity>
// //             <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.actionButton}>
// //               <MessageCircle size={24} color={colors.text} />
// //               <Text style={[styles.actionText, { color: colors.text }]}>{post.comments.length}</Text>
// //             </TouchableOpacity>
// //             <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
// //               <ShareIcon size={24} color={colors.text} />
// //             </TouchableOpacity>
// //           </View>

// //           {/* Post Caption */}
// //           <View style={styles.captionContainer}>
// //             <Text style={[styles.caption, { color: colors.text }]}>{post.caption}</Text>
// //             <Text style={[styles.postTime, { color: colors.secondary }]}>
// //               {new Date(post.createdAt).toLocaleDateString()}
// //             </Text>
// //           </View>

// //           {/* Comments */}
// //           <View style={styles.commentsContainer}>
// //             <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
// //             <FlatList
// //               data={post.comments}
// //               renderItem={renderComment}
// //               keyExtractor={(item) => item._id}
// //               scrollEnabled={false}
// //               ListEmptyComponent={
// //                 <Text style={[styles.noCommentsText, { color: colors.secondary }]}>No comments yet</Text>
// //               }
// //             />
// //           </View>
// //         </ScrollView>

// //         {/* Comment Input */}
// //         <View
// //           style={[styles.commentInputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}
// //         >
// //           {selectedImage && (
// //             <View style={styles.selectedImageContainer}>
// //               <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />
// //               <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageButton}>
// //                 <CloseIcon size={16} color="white" />
// //               </TouchableOpacity>
// //             </View>
// //           )}
// //           <View style={styles.inputRow}>
// //             <TouchableOpacity
// //               onPress={handleImagePicker}
// //               style={[styles.mediaButton, { backgroundColor: colors.card }]}
// //             >
// //               <ImageIcon size={20} color={colors.icon} />
// //             </TouchableOpacity>
// //             <TouchableOpacity
// //               onPress={handleCameraPicker}
// //               style={[styles.mediaButton, { backgroundColor: colors.card }]}
// //             >
// //               <Camera size={20} color={colors.icon} />
// //             </TouchableOpacity>
// //             <TextInput
// //               ref={commentInputRef}
// //               style={[styles.commentInput, { backgroundColor: colors.card, color: colors.text }]}
// //               placeholder="Add a comment..."
// //               placeholderTextColor={colors.secondary}
// //               value={commentText}
// //               onChangeText={setCommentText}
// //               multiline
// //             />
// //             <TouchableOpacity
// //               onPress={handleComment}
// //               style={[
// //                 styles.commentSubmitButton,
// //                 { backgroundColor: commentText.trim() || selectedImage ? colors.primary : colors.border },
// //               ]}
// //               disabled={!commentText.trim() && !selectedImage}
// //             >
// //               <Send size={20} color={commentText.trim() || selectedImage ? "white" : colors.secondary} />
// //             </TouchableOpacity>
// //           </View>
// //         </View>

// //         {/* Image Modal */}
// //         <Modal visible={isImageModalVisible} transparent animationType="fade">
// //           <View style={styles.imageModalContainer}>
// //             <TouchableOpacity style={styles.imageModalClose} onPress={() => setIsImageModalVisible(false)}>
// //               <CloseIcon size={24} color="white" />
// //             </TouchableOpacity>
// //             <TouchableOpacity
// //               style={styles.imageModalDownload}
// //               onPress={() => handleDownloadImage(post.images[currentImageIndex])}
// //             >
// //               <Download size={24} color="white" />
// //             </TouchableOpacity>
// //             <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
// //               {post.images.map((image, index) => (
// //                 <Image key={index} source={{ uri: image }} style={styles.fullScreenImage} resizeMode="contain" />
// //               ))}
// //             </ScrollView>
// //           </View>
// //         </Modal>

// //         {/* Share Modal */}
// //         <Modal visible={shareModalVisible} transparent animationType="slide">
// //           <View style={styles.shareModalContainer}>
// //             <View style={[styles.shareModalContent, { backgroundColor: colors.background }]}>
// //               <Text style={[styles.shareModalTitle, { color: colors.text }]}>Share Post</Text>
// //               <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
// //                 <ShareIcon size={24} color={colors.text} />
// //                 <Text style={[styles.shareOptionText, { color: colors.text }]}>Share via...</Text>
// //               </TouchableOpacity>
// //               <TouchableOpacity
// //                 onPress={() => handleDownloadImage(post.images[0])}
// //                 style={styles.shareOption}
// //                 disabled={post.images.length === 0}
// //               >
// //                 <Download size={24} color={post.images.length > 0 ? colors.text : colors.secondary} />
// //                 <Text
// //                   style={[
// //                     styles.shareOptionText,
// //                     { color: post.images.length > 0 ? colors.text : colors.secondary },
// //                   ]}
// //                 >
// //                   Download Image
// //                 </Text>
// //               </TouchableOpacity>
// //               <TouchableOpacity onPress={() => setShareModalVisible(false)} style={styles.shareCancel}>
// //                 <Text style={[styles.shareCancelText, { color: colors.primary }]}>Cancel</Text>
// //               </TouchableOpacity>
// //             </View>
// //           </View>
// //         </Modal>
// //       </KeyboardAvoidingView>
// //     </SafeAreaView>
// //   )
// // }

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //     marginBottom: 50
// //   },
// //   loadingContainer: {
// //     flex: 1,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   loadingText: {
// //     marginTop: 10,
// //     fontSize: 16,
// //   },
// //   errorContainer: {
// //     flex: 1,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   errorText: {
// //     fontSize: 18,
// //     marginBottom: 20,
// //   },
// //   backButton: {
// //     padding: 10,
// //   },
// //   backButtonText: {
// //     fontSize: 16,
// //   },
// //   header: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //     padding: 16,
// //     borderBottomWidth: 1,
// //   },
// //   headerTitle: {
// //     fontSize: 18,
// //     fontWeight: "600",
// //   },
// //   postHeader: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     padding: 16,
// //   },
// //   userAvatar: {
// //     width: 50,
// //     height: 50,
// //     borderRadius: 25,
// //     marginRight: 12,
// //   },
// //   userInfo: {
// //     flex: 1,
// //   },
// //   username: {
// //     fontSize: 16,
// //     fontWeight: "600",
// //   },
// //   fullName: {
// //     fontSize: 14,
// //   },
// //   followButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingHorizontal: 16,
// //     paddingVertical: 8,
// //     borderRadius: 20,
// //     borderWidth: 1,
// //   },
// //   followButtonText: {
// //     marginLeft: 8,
// //     fontSize: 14,
// //     fontWeight: "600",
// //   },
// //   imageContainer: {
// //     position: "relative",
// //   },
// //   postImage: {
// //     width: screenWidth,
// //     height: screenWidth,
// //   },
// //   imageIndicator: {
// //     position: "absolute",
// //     bottom: 16,
// //     left: 0,
// //     right: 0,
// //     flexDirection: "row",
// //     justifyContent: "center",
// //   },
// //   indicatorDot: {
// //     width: 8,
// //     height: 8,
// //     borderRadius: 4,
// //     marginHorizontal: 4,
// //   },
// //   postActions: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     padding: 16,
// //   },
// //   actionButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     marginRight: 24,
// //   },
// //   actionText: {
// //     marginLeft: 8,
// //     fontSize: 14,
// //     fontWeight: "600",
// //   },
// //   captionContainer: {
// //     paddingHorizontal: 16,
// //     paddingBottom: 16,
// //   },
// //   caption: {
// //     fontSize: 16,
// //     lineHeight: 22,
// //     marginBottom: 8,
// //   },
// //   postTime: {
// //     fontSize: 12,
// //   },
// //   commentsContainer: {
// //     paddingHorizontal: 20,
  
// //   },
// //   commentsTitle: {
// //     fontSize: 18,
// //     fontWeight: "600",
// //     marginBottom: 16,
// //   },
// //   commentItem: {
// //     flexDirection: "row",
// //     paddingVertical: 12,
// //     borderBottomWidth: 1,
// //   },
// //   commentAvatar: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     marginRight: 12,
// //   },
// //   commentContent: {
// //     flex: 1,
// //   },
// //   commentHeader: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     marginBottom: 4,
// //   },
// //   commentUsername: {
// //     fontSize: 14,
// //     fontWeight: "600",
// //     marginRight: 8,
// //   },
// //   commentTime: {
// //     fontSize: 12,
// //   },
// //   commentImage: {
// //     width: 200,
// //     height: 150,
// //     borderRadius: 8,
// //     marginVertical: 8,
// //   },
// //   commentText: {
// //     fontSize: 14,
// //     lineHeight: 20,
// //     marginBottom: 8,
// //   },
// //   commentActions: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //   },
// //   replyButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //   },
// //   replyButtonText: {
// //     marginLeft: 4,
// //     fontSize: 12,
// //   },
// //   repliesContainer: {
// //     marginTop: 12,
// //     paddingLeft: 16,
// //   },
// //   replyItem: {
// //     flexDirection: "row",
// //     marginBottom: 8,
// //   },
// //   replyAvatar: {
// //     width: 30,
// //     height: 30,
// //     borderRadius: 15,
// //     marginRight: 8,
// //   },
// //   replyContent: {
// //     flex: 1,
// //   },
// //   replyUsername: {
// //     fontSize: 12,
// //     fontWeight: "600",
// //     marginBottom: 2,
// //   },
// //   replyText: {
// //     fontSize: 12,
// //     lineHeight: 16,
// //   },
// //   replyInputContainer: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     marginTop: 8,
// //     padding: 8,
// //     borderRadius: 8,
// //   },
// //   replyInput: {
// //     flex: 1,
// //     fontSize: 14,
// //     paddingVertical: 8,
// //     paddingHorizontal: 12,
// //   },
// //   replySubmitButton: {
// //     padding: 8,
// //     borderRadius: 16,
// //     marginLeft: 8,
// //   },
// //   noCommentsText: {
// //     textAlign: "center",
// //     fontSize: 14,
// //     padding: 20,
// //   },
// //   commentInputContainer: {
// //     padding: 16,
// //     borderTopWidth: 1,
// //     marginBottom: 0
// //   },
// //   selectedImageContainer: {
// //     position: "relative",
// //     marginBottom: 8,
// //   },
// //   selectedImagePreview: {
// //     width: 60,
// //     height: 60,
// //     borderRadius: 8,
// //   },
// //   removeImageButton: {
// //     position: "absolute",
// //     top: -8,
// //     right: -8,
// //     backgroundColor: "rgba(0,0,0,0.7)",
// //     borderRadius: 12,
// //     width: 24,
// //     height: 24,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   inputRow: {
// //     flexDirection: "row",
// //     alignItems: "flex-end",
// //     gap: 8,
// //   },
// //   mediaButton: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     alignItems: "center",
// //     justifyContent: "center",
// //   },
// //   commentInput: {
// //     flex: 1,
// //     minHeight: 40,
// //     maxHeight: 100,
// //     borderRadius: 20,
// //     paddingHorizontal: 16,
// //     paddingVertical: 10,
// //     textAlignVertical: "top",
// //   },
// //   commentSubmitButton: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     alignItems: "center",
// //     justifyContent: "center",
// //   },
// //   imageModalContainer: {
// //     flex: 1,
// //     backgroundColor: "rgba(0,0,0,0.9)",
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   imageModalClose: {
// //     position: "absolute",
// //     top: 50,
// //     right: 20,
// //     zIndex: 1,
// //     padding: 10,
// //   },
// //   imageModalDownload: {
// //     position: "absolute",
// //     top: 50,
// //     left: 20,
// //     zIndex: 1,
// //     padding: 10,
// //   },
// //   fullScreenImage: {
// //     width: screenWidth,
// //     height: screenHeight,
// //   },
// //   shareModalContainer: {
// //     flex: 1,
// //     backgroundColor: "rgba(0,0,0,0.5)",
// //     justifyContent: "flex-end",
// //   },
// //   shareModalContent: {
// //     borderTopLeftRadius: 20,
// //     borderTopRightRadius: 20,
// //     padding: 20,
// //   },
// //   shareModalTitle: {
// //     fontSize: 18,
// //     fontWeight: "600",
// //     marginBottom: 20,
// //     textAlign: "center",
// //   },
// //   shareOption: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingVertical: 16,
// //     paddingHorizontal: 12,
// //     borderRadius: 8,
// //     marginBottom: 8,
// //   },
// //   shareOptionText: {
// //     marginLeft: 16,
// //     fontSize: 16,
// //   },
// //   shareCancel: {
// //     alignItems: "center",
// //     paddingVertical: 16,
// //     marginTop: 8,
// //   },
// //   shareCancelText: {
// //     fontSize: 16,
// //     fontWeight: "600",
// //   },
// //   commentActionButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     marginLeft: 16,
// //   },
// // })

// // export default PostView







// // "use client"

// // import type React from "react"
// // import { useState, useEffect, useRef } from "react"
// // import {
// //   View,
// //   ScrollView,
// //   Text,
// //   StyleSheet,
// //   Image,
// //   TouchableOpacity,
// //   TextInput,
// //   Alert,
// //   Share,
// //   ActivityIndicator,
// //   Modal,
// //   StatusBar,
// //   KeyboardAvoidingView,
// //   Platform,
// // } from "react-native"
// // import { useAuth, api } from "../../contexts/AuthContext"
// // import { useTheme } from "../../contexts/ThemeContext"
// // import { Audio } from "expo-av"
// // import {
// //   Heart,
// //   MessageCircle,
// //   Share as ShareIcon,
// //   MoreHorizontal,
// //   Eye,
// //   ArrowLeft,
// //   UserPlus,
// //   UserCheck,
// //   Send,
// //   Reply as ReplyIcon,
// //   ThumbsUp,
// //   Hash,
// // } from "lucide-react-native"

// // interface Comment {
// //   _id: string
// //   user: {
// //     _id: string
// //     username: string
// //     fullName: string
// //     profilePicture?: string
// //   }
// //   text: string
// //   image?: string
// //   likes: string[]
// //   replies: {
// //     _id: string
// //     user: {
// //       _id: string
// //       username: string
// //       fullName: string
// //       profilePicture?: string
// //     }
// //     text: string
// //     image?: string
// //     likes: string[]
// //     createdAt: string
// //   }[]
// //   createdAt: string
// // }

// // interface Post {
// //   _id: string
// //   user: {
// //     _id: string
// //     username: string
// //     fullName: string
// //     profilePicture?: string
// //   }
// //   images: string[]
// //   caption: string
// //   likes: string[]
// //   comments: Comment[]
// //   views: number
// //   hashtags: string[]
// //   createdAt: string
// // }

// // interface PostViewProps {
// //   route: {
// //     params: {
// //       post?: Post
// //       postId?: string
// //       activeHashtag?: string
// //     }
// //   }
// //   navigation: any
// // }

// // const PostView: React.FC<PostViewProps> = ({ route, navigation }) => {
// //   const { post: initialPost, postId, activeHashtag } = route.params
// //   const { user, token } = useAuth()
// //   const { colors, theme } = useTheme()

// //   const [post, setPost] = useState<Post | null>(initialPost || null)
// //   const [loading, setLoading] = useState(!initialPost)
// //   const [commentText, setCommentText] = useState("")
// //   const [replyText, setReplyText] = useState("")
// //   const [replyingTo, setReplyingTo] = useState<string | null>(null)
// //   const [isFollowing, setIsFollowing] = useState(false)
// //   const [shareModalVisible, setShareModalVisible] = useState(false)
// //   const [error, setError] = useState<string | null>(null)

// //   const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
// //   const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)
// //   const [sendSound, setSendSound] = useState<Audio.Sound | null>(null)

// //   const commentInputRef = useRef<TextInput>(null)
// //   const replyInputRef = useRef<TextInput>(null)

// //   useEffect(() => {
// //     const loadSounds = async () => {
// //       try {
// //         const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
// //         const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
// //         const { sound: sendAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/send.mp3"))
// //         setLikeSound(likeAudio)
// //         setCommentSound(commentAudio)
// //         setSendSound(sendAudio)
// //       } catch (error) {
// //         console.error("Error loading sounds:", error)
// //       }
// //     }

// //     loadSounds()

// //     return () => {
// //       likeSound?.unloadAsync()
// //       commentSound?.unloadAsync()
// //       sendSound?.unloadAsync()
// //     }
// //   }, [])

// //   useEffect(() => {
// //     if (postId && !initialPost) {
// //       fetchPostById(postId)
// //     } else if (initialPost) {
// //       fetchPostDetails()
// //       checkFollowingStatus()
// //     }
// //   }, [postId, initialPost])

// //   const playSound = async (sound: Audio.Sound | null) => {
// //     try {
// //       if (sound) {
// //         await sound.replayAsync()
// //       }
// //     } catch (error) {
// //       console.error("Error playing sound:", error)
// //     }
// //   }

// //   const fetchPostById = async (id: string) => {
// //     try {
// //       setLoading(true)
// //       setError(null)
// //       console.log("Fetching post by ID:", id)
// //       const response = await api.get(`/posts/${id}`)
// //       const fetchedPost = response.data.post

// //       if (!fetchedPost) {
// //         throw new Error("Post not found")
// //       }

// //       setPost(fetchedPost)
// //       checkFollowingStatus(fetchedPost.user._id)
// //     } catch (error) {
// //       console.error("Error fetching post by ID:", error)
// //       setError("Failed to load post. Please try again.")
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const fetchPostDetails = async () => {
// //     if (!post) return

// //     try {
// //       setLoading(true)
// //       setError(null)
// //       const response = await api.get(`/posts/${post._id}`)
// //       setPost(response.data.post)
// //     } catch (error) {
// //       console.error("Error fetching post details:", error)
// //       setError("Failed to refresh post details")
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const checkFollowingStatus = async (userId?: string) => {
// //     if (!post && !userId) return
// //     const postUserId = userId || post?.user._id

// //     if (postUserId === user?.id) return

// //     try {
// //       const response = await api.post(`/users/${postUserId}/is-following`, {
// //         followerId: user?.id,
// //       })
// //       setIsFollowing(response.data.isFollowing)
// //     } catch (error) {
// //       console.error("Error checking follow status:", error)
// //     }
// //   }

// //   const handleLike = async () => {
// //     if (!user || !token || !post) return

// //     try {
// //       await playSound(likeSound)

// //       const isLiked = post.likes.includes(user.id)
// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           likes: isLiked ? prev.likes.filter((id) => id !== user.id) : [...prev.likes, user.id],
// //         }
// //       })

// //       await api.post(`/posts/${post._id}/like`, { userId: user.id })
// //     } catch (error) {
// //       console.error("Error liking post:", error)
// //       fetchPostDetails()
// //     }
// //   }

// //   const handleFollow = async () => {
// //     if (!user || !token || !post || post.user._id === user.id) return

// //     try {
// //       if (isFollowing) {
// //         await api.post(`/users/${post.user._id}/unfollow`, { followerId: user.id })
// //         setIsFollowing(false)
// //       } else {
// //         await api.post(`/users/${post.user._id}/follow`, { followerId: user.id })
// //         setIsFollowing(true)
// //       }
// //     } catch (error) {
// //       console.error("Error following/unfollowing user:", error)
// //       Alert.alert("Error", "Failed to update follow status")
// //     }
// //   }

// //   const handleComment = async () => {
// //     if (!commentText.trim() || !user || !post) return

// //     try {
// //       await playSound(commentSound)
// //       await playSound(sendSound)

// //       const response = await api.post(`/posts/${post._id}/comment`, {
// //         text: commentText.trim(),
// //       })

// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           comments: [...prev.comments, response.data.comment],
// //         }
// //       })

// //       if (post.user._id !== user.id) {
// //         try {
// //           const captionPreview = post.caption
// //             ? post.caption.length > 50
// //               ? `${post.caption.substring(0, 47)}...`
// //               : post.caption
// //             : "No caption"
// //           const chatMessage = `New comment on your post:\n[img]${post.images[0] || ''}[/img]\n[faint]${captionPreview} (${post.caption || ''})[/faint]\nComment: ${commentText.trim()}`
// //           await api.post(`/chats/${post.user._id}`, { message: chatMessage })
// //           console.log(`Chat message sent to @${post.user.username}: ${chatMessage}`)
// //         } catch (chatError) {
// //           console.error("Error sending chat message:", chatError)
// //           Alert.alert("Warning", "Comment posted, but failed to send chat notification to post creator")
// //         }
// //       }

// //       setCommentText("")
// //       commentInputRef.current?.blur()
// //     } catch (error) {
// //       console.error("Error adding comment:", error)
// //       Alert.alert("Error", "Failed to add comment")
// //     }
// //   }

// //   const handleReply = async (commentId: string) => {
// //     if (!replyText.trim() || !user || !post) return

// //     try {
// //       await playSound(commentSound)
// //       await playSound(sendSound)

// //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/reply`, {
// //         text: replyText.trim(),
// //       })

// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           comments: prev.comments.map((comment) =>
// //             comment._id === commentId ? { ...comment, replies: [...comment.replies, response.data.reply] } : comment,
// //           ),
// //         }
// //       })

// //       setReplyText("")
// //       setReplyingTo(null)
// //       replyInputRef.current?.blur()
// //     } catch (error) {
// //       console.error("Error adding reply:", error)
// //       Alert.alert("Error", "Failed to add reply")
// //     }
// //   }

// //   const handleLikeComment = async (commentId: string) => {
// //     if (!user || !post) return

// //     try {
// //       await playSound(likeSound)

// //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/like`)

// //       setPost((prev) => {
// //         if (!prev) return prev
// //         return {
// //           ...prev,
// //           comments: prev.comments.map((comment) =>
// //             comment._id === commentId ? { ...comment, likes: response.data.likes } : comment,
// //           ),
// //         }
// //       })
// //     } catch (error) {
// //       console.error("Error liking comment:", error)
// //     }
// //   }

// //   const handleHashtagPress = (hashtag: string) => {
// //     navigation.navigate("Search", {
// //       initialQuery: `#${hashtag}`,
// //       initialType: "hashtags",
// //       activeHashtag: hashtag,
// //     })
// //   }

// //   const handleChatWithUser = async () => {
// //     if (!user || !post || post.user._id === user.id) return

// //     try {
// //       await api.post(`/chats/${post.user._id}`, {
// //         message: `Hi! I'd like to connect with you.`,
// //       })

// //       Alert.alert("Success", `Message sent to @${post.user.username}!`, [
// //         {
// //           text: "Go to Chat",
// //           onPress: () => navigation.navigate("Chat"),
// //         },
// //         { text: "OK" },
// //       ])
// //     } catch (error) {
// //       console.error("Error creating chat:", error)
// //       Alert.alert("Error", "Failed to send message")
// //     }
// //   }

// //   const handleShare = async () => {
// //     if (!post) return

// //     try {
// //       const shareContent = {
// //         message: `${post.caption || "Check out this post!"} by @${post.user.username}`,
// //         url: post.images?.[0] || "",
// //       }
// //       await Share.share(shareContent)
// //       setShareModalVisible(false)
// //     } catch (error) {
// //       console.error("Error sharing post:", error)
// //     }
// //   }

// //   const handleShareComment = async (comment: Comment) => {
// //     if (!post) return

// //     try {
// //       const shareContent = {
// //         message: `"${comment.text}" - Comment by @${comment.user.username} on @${post.user.username}'s post`,
// //       }
// //       await Share.share(shareContent)
// //     } catch (error) {
// //       console.error("Error sharing comment:", error)
// //     }
// //   }

// //   const formatTimeAgo = (dateString: string) => {
// //     const now = new Date()
// //     const postDate = new Date(dateString)
// //     const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000)

// //     if (diffInSeconds < 60) return "now"
// //     if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
// //     if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
// //     if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`

// //     return postDate.toLocaleDateString()
// //   }

// //   const renderComment = ({ item: comment }: { item: Comment }) => {
// //     const isCommentLiked = user && comment.likes?.includes(user.id)

// //     return (
// //       <View style={styles.commentContainer}>
// //         <View style={styles.commentHeader}>
// //           <Image
// //             source={{
// //               uri: comment.user.profilePicture || "https://via.placeholder.com/32",
// //             }}
// //             style={styles.commentProfileImage}
// //           />
// //           <View style={styles.commentContent}>
// //             <View style={styles.commentUserInfo}>
// //               <Text style={[styles.commentUserName, { color: colors.text }]}>{comment.user.fullName}</Text>
// //               <Text style={[styles.commentUsername, { color: colors.placeholder }]}>@{comment.user.username}</Text>
// //               <Text style={[styles.commentTime, { color: colors.placeholder }]}>
// //                 · {formatTimeAgo(comment.createdAt)}
// //               </Text>
// //             </View>
// //             <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>

// //             {comment.image && <Image source={{ uri: comment.image }} style={styles.commentImage} />}

// //             <View style={styles.commentActions}>
// //               <TouchableOpacity
// //                 onPress={() => {
// //                   setReplyingTo(comment._id)
// //                   replyInputRef.current?.focus()
// //                 }}
// //                 style={styles.commentActionButton}
// //               >
// //                 <ReplyIcon size={16} color={colors.icon} />
// //                 <Text style={[styles.commentActionText, { color: colors.placeholder }]}>
// //                   {comment.replies?.length || 0}
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity onPress={() => handleLikeComment(comment._id)} style={styles.commentActionButton}>
// //                 <ThumbsUp
// //                   size={16}
// //                   color={isCommentLiked ? "#E91E63" : colors.icon}
// //                   fill={isCommentLiked ? "#E91E63" : "none"}
// //                 />
// //                 <Text style={[styles.commentActionText, { color: colors.placeholder }]}>
// //                   {comment.likes?.length || 0}
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity onPress={() => handleShareComment(comment)} style={styles.commentActionButton}>
// //                 <ShareIcon size={16} color={colors.icon} />
// //               </TouchableOpacity>
// //             </View>

// //             {comment.replies?.map((reply) => (
// //               <View key={reply._id} style={styles.replyContainer}>
// //                 <Image
// //                   source={{
// //                     uri: reply.user.profilePicture || "https://via.placeholder.com/24",
// //                   }}
// //                   style={styles.replyProfileImage}
// //                 />
// //                 <View style={styles.replyContent}>
// //                   <View style={styles.replyUserInfo}>
// //                     <Text style={[styles.replyUserName, { color: colors.text }]}>{reply.user.fullName}</Text>
// //                     <Text style={[styles.replyUsername, { color: colors.text }]}>@{reply.user.username}</Text>
// //                     <Text style={[styles.replyTime, { color: colors.text }]}>
// //                       · {formatTimeAgo(reply.createdAt)}
// //                     </Text>
// //                   </View>
// //                   <Text style={[styles.replyText, { color: colors.text }]}>{reply.text}</Text>
// //                 </View>
// //               </View>
// //             ))}
// //           </View>
// //         </View>
// //       </View>
// //     )
// //   }

// //   if ((loading && !post) || error) {
// //     return (
// //       <View
// //         style={[
// //           styles.container,
// //           { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
// //         ]}
// //       >
// //         <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

// //         <View
// //           style={[
// //             styles.header,
// //             {
// //               backgroundColor: colors.background,
// //               borderBottomColor: colors.border,
// //               position: "absolute",
// //               top: 0,
// //               left: 0,
// //               right: 0,
// //             },
// //           ]}
// //         >
// //           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
// //             <ArrowLeft size={24} color={colors.text} />
// //           </TouchableOpacity>
// //           <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
// //           <View style={styles.headerRight} />
// //         </View>

// //         {loading ? (
// //           <ActivityIndicator size="large" color={colors.primary} />
// //         ) : (
// //           <View style={styles.errorContainer}>
// //             <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
// //             <TouchableOpacity
// //               style={[styles.retryButton, { backgroundColor: colors.primary }]}
// //               onPress={() => (postId ? fetchPostById(postId) : navigation.goBack())}
// //             >
// //               <Text style={styles.retryButtonText}>Retry</Text>
// //             </TouchableOpacity>
// //           </View>
// //         )}
// //       </View>
// //     )
// //   }

// //   if (!post) {
// //     return null
// //   }

// //   const isLiked = user && post.likes?.includes(user.id)
// //   const isOwnPost = user?.id === post.user._id

// //   return (
// //     <KeyboardAvoidingView
// //       style={[styles.container, { backgroundColor: colors.background }]}
// //       behavior={Platform.OS === "ios" ? "padding" : "height"}
// //       keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
// //     >
// //       <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

// //       <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
// //         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
// //           <ArrowLeft size={24} color={colors.text} />
// //         </TouchableOpacity>
// //         <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
// //         <View style={styles.headerRight} />
// //       </View>

// //       <ScrollView
// //         style={styles.content}
// //         showsVerticalScrollIndicator={false}
// //         contentContainerStyle={styles.scrollContent}
// //         keyboardShouldPersistTaps="handled"
// //       >
// //         <View style={styles.postHeader}>
// //           <TouchableOpacity
// //             onPress={() => navigation.navigate("UserProfile", { userId: post.user._id })}
// //             style={styles.userInfoContainer}
// //           >
// //             <Image
// //               source={{
// //                 uri: post.user.profilePicture || "https://via.placeholder.com/48",
// //               }}
// //               style={styles.profileImage}
// //             />
// //             <View style={styles.userInfo}>
// //               <Text style={[styles.fullName, { color: colors.text }]}>{post.user.fullName}</Text>
// //               <Text style={[styles.username, { color: colors.text }]}>@{post.user.username}</Text>
// //             </View>
// //           </TouchableOpacity>

// //           <View style={styles.headerActions}>
// //             {!isOwnPost && (
// //               <>
// //                 <TouchableOpacity
// //                   onPress={handleFollow}
// //                   style={[
// //                     styles.followButton,
// //                     {
// //                       backgroundColor: isFollowing ? colors.border : colors.primary,
// //                       borderColor: colors.primary,
// //                     },
// //                   ]}
// //                 >
// //                   {isFollowing ? <UserCheck size={16} color={colors.text} /> : <UserPlus size={16} color="white" />}
// //                   <Text style={[styles.followButtonText, { color: isFollowing ? colors.text : "white" }]}>
// //                     {isFollowing ? "Following" : "Follow"}
// //                   </Text>
// //                 </TouchableOpacity>

// //                 {/* <TouchableOpacity 
// //                    onPress={handleChatWithUser}
// //                    style={[styles.chatButton, { borderColor: colors.primary }]}
// //                 >
// //                    <MessageCircle size={16} color={colors.primary} /> 
// //                    <Text style={[styles.chatButtonText, { color: colors.primary }]}>Chat</Text> 
// //                  </TouchableOpacity> */}
// //               </>
// //             )}

// //             <TouchableOpacity style={styles.moreButton}>
// //               <MoreHorizontal size={20} color={colors.icon} />
// //             </TouchableOpacity>
// //           </View>
// //         </View>

// //         {post.caption ? (
// //           <View style={styles.captionContainer}>
// //             <Text style={[styles.caption, { color: colors.text }]}>
// //               {post.caption.split(/(\s+)/).map((word, index) => {
// //                 if (word.startsWith("#")) {
// //                   const hashtag = word.substring(1)
// //                   const isActive = activeHashtag === hashtag
// //                   return (
// //                     <Text
// //                       key={index}
// //                       style={[
// //                         styles.hashtag,
// //                         {
// //                           color: isActive ? colors.primary : colors.hashtag,
// //                           backgroundColor: isActive ? colors.primary + "20" : "transparent",
// //                           paddingHorizontal: isActive ? 4 : 0,
// //                           borderRadius: isActive ? 4 : 0,
// //                         },
// //                       ]}
// //                       onPress={() => handleHashtagPress(hashtag)}
// //                     >
// //                       {word}
// //                     </Text>
// //                   )
// //                 }
// //                 return word
// //               })}
// //             </Text>
// //           </View>
// //         ) : null}

// //         {post.hashtags && post.hashtags.length > 0 && (
// //           <View style={styles.hashtagsContainer}>
// //             {post.hashtags.map((hashtag, index) => {
// //               const isActive = activeHashtag === hashtag
// //               return (
// //                 <TouchableOpacity
// //                   key={index}
// //                   onPress={() => handleHashtagPress(hashtag)}
// //                   style={[
// //                     styles.hashtagButton,
// //                     {
// //                       backgroundColor: isActive ? colors.primary : colors.primary + "20",
// //                       borderWidth: isActive ? 2 : 0,
// //                       borderColor: isActive ? colors.primary : "transparent",
// //                     },
// //                   ]}
// //                 >
// //                   <Hash size={12} color={isActive ? "white" : colors.primary} />
// //                   <Text style={[styles.hashtagText, { color: isActive ? "white" : colors.primary }]}>{hashtag}</Text>
// //                 </TouchableOpacity>
// //               )
// //             })}
// //           </View>
// //         )}

// //         {post.images?.[0] && <Image source={{ uri: post.images[0] }} style={styles.postImage} />}

// //         <Text style={[styles.timestamp, { color: colors.placeholder }]}>{formatTimeAgo(post.createdAt)}</Text>

// //         <View style={styles.actionsContainer}>
// //           <View style={styles.actionButtons}>
// //             <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
// //               <Heart size={24} color={isLiked ? "#E91E63" : colors.icon} fill={isLiked ? "#E91E63" : "none"} />
// //               <Text style={[styles.actionCount, { color: colors.text }]}>{post.likes?.length || 0}</Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.actionButton}>
// //               <MessageCircle size={24} color={colors.icon} />
// //               <Text style={[styles.actionCount, { color: colors.text }]}>{post.comments?.length || 0}</Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity onPress={() => setShareModalVisible(true)} style={styles.actionButton}>
// //               <ShareIcon size={24} color={colors.icon} />
// //             </TouchableOpacity>
// //           </View>

// //           <View style={styles.viewsContainer}>
// //             <Eye size={18} color={colors.placeholder} />
// //             <Text style={[styles.viewsText, { color: colors.placeholder }]}>{post.views || 0} views</Text>
// //           </View>
// //         </View>

// //         <View style={styles.commentsSection}>
// //           <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments ({post.comments?.length || 0})</Text>

// //           {post.comments?.map((comment) => (
// //             <View key={comment._id}>{renderComment({ item: comment })}</View>
// //           ))}
// //         </View>

// //         <View style={styles.bottomPadding} />
// //       </ScrollView>

// //       <View
// //         style={[
// //           styles.commentInputContainer,
// //           {
// //             backgroundColor: colors.card,
// //             borderTopColor: colors.border,
// //             paddingBottom: Platform.OS === "ios" ? 34 : 16,
// //           },
// //         ]}
// //       >
// //         {replyingTo && (
// //           <View style={[styles.replyingToContainer, { backgroundColor: colors.background }]}>
// //             <Text style={[styles.replyingToText, { color: colors.placeholder }]}>Replying to comment</Text>
// //             <TouchableOpacity onPress={() => setReplyingTo(null)}>
// //               <Text style={[styles.cancelReply, { color: colors.primary }]}>Cancel</Text>
// //             </TouchableOpacity>
// //           </View>
// //         )}

// //         <View style={styles.inputRow}>
// //           <Image
// //             source={{
// //               uri: user?.profilePicture || "https://via.placeholder.com/32",
// //             }}
// //             style={styles.inputProfileImage}
// //           />
// //           <TextInput
// //             ref={replyingTo ? replyInputRef : commentInputRef}
// //             style={[
// //               styles.textInput,
// //               {
// //                 color: colors.text,
// //                 borderColor: colors.border,
// //                 backgroundColor: colors.background,
// //               },
// //             ]}
// //             placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
// //             placeholderTextColor={colors.text}
// //             value={replyingTo ? replyText : commentText}
// //             onChangeText={replyingTo ? setReplyText : setCommentText}
// //             multiline
// //             maxLength={500}
// //             returnKeyType="default"
// //             blurOnSubmit={false}
// //           />
// //           <TouchableOpacity
// //             onPress={replyingTo ? () => handleReply(replyingTo) : handleComment}
// //             style={[
// //               styles.sendButton,
// //               {
// //                 backgroundColor: (replyingTo ? replyText : commentText).trim() ? colors.primary : colors.border,
// //               },
// //             ]}
// //             disabled={!(replyingTo ? replyText : commentText).trim()}
// //           >
// //             <Send size={18} color="white" />
// //           </TouchableOpacity>
// //         </View>
// //       </View>

// //       <Modal
// //         visible={shareModalVisible}
// //         transparent
// //         animationType="slide"
// //         onRequestClose={() => setShareModalVisible(false)}
// //       >
// //         <View style={styles.modalOverlay}>
// //           <View style={[styles.shareModal, { backgroundColor: colors.card }]}>
// //             <Text style={[styles.shareTitle, { color: colors.text }]}>Share Post</Text>

// //             <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
// //               <ShareIcon size={24} color={colors.text} />
// //               <Text style={[styles.shareOptionText, { color: colors.text }]}>Share via...</Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               onPress={() => setShareModalVisible(false)}
// //               style={[styles.cancelButton, { borderColor: colors.border }]}
// //             >
// //               <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
// //             </TouchableOpacity>
// //           </View>
// //         </View>
// //       </Modal>

// //       {loading && (
// //         <View style={styles.loadingOverlay}>
// //           <ActivityIndicator size="large" color={colors.primary} />
// //         </View>
// //       )}
// //     </KeyboardAvoidingView>
// //   )
// // }

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //     marginBottom: 116,
// //     paddingTop: 5
// //   },
// //   header: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //     paddingTop: StatusBar.currentHeight || 44,
// //     paddingHorizontal: 16,
// //     paddingBottom: 12,
// //     borderBottomWidth: 0.5,
// //   },
// //   backButton: {
// //     padding: 8,
// //     marginLeft: -8,
// //   },
// //   headerTitle: {
// //     fontSize: 18,
// //     fontWeight: "600",
// //   },
// //   headerRight: {
// //     width: 40,
// //   },
// //   content: {
// //     flex: 1,
// //   },
// //   scrollContent: {
// //     flexGrow: 1,
// //   },
// //   postHeader: {
// //     flexDirection: "row",
// //     alignItems: "flex-start",
// //     justifyContent: "space-between",
// //     padding: 16,
// //   },
// //   userInfoContainer: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     flex: 1,
// //   },
// //   profileImage: {
// //     width: 48,
// //     height: 48,
// //     borderRadius: 24,
// //     marginRight: 12,
// //   },
// //   userInfo: {
// //     flex: 1,
// //   },
// //   fullName: {
// //     fontSize: 16,
// //     fontWeight: "bold",
// //   },
// //   username: {
// //     fontSize: 14,
// //     marginTop: 2,
// //   },
// //   headerActions: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 8,
// //   },
// //   followButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingHorizontal: 16,
// //     paddingVertical: 8,
// //     borderRadius: 20,
// //     borderWidth: 1,
// //     gap: 4,
// //   },
// //   followButtonText: {
// //     fontSize: 14,
// //     fontWeight: "600",
// //   },
// //   chatButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingHorizontal: 16,
// //     paddingVertical: 8,
// //     borderRadius: 20,
// //     borderWidth: 1,
// //     gap: 4,
// //   },
// //   chatButtonText: {
// //     fontSize: 14,
// //     fontWeight: "600",
// //   },
// //   moreButton: {
// //     padding: 8,
// //   },
// //   captionContainer: {
// //     paddingHorizontal: 16,
// //     marginBottom: 16,
// //   },
// //   caption: {
// //     fontSize: 16,
// //     lineHeight: 22,
// //   },
// //   hashtag: {
// //     fontWeight: "bold",
// //   },
// //   hashtagsContainer: {
// //     flexDirection: "row",
// //     flexWrap: "wrap",
// //     paddingHorizontal: 16,
// //     marginBottom: 16,
// //   },
// //   hashtagButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingHorizontal: 10,
// //     paddingVertical: 5,
// //     borderRadius: 15,
// //     marginRight: 10,
// //     marginBottom: 10,
// //   },
// //   hashtagText: {
// //     fontSize: 12,
// //     marginLeft: 4,
// //   },
// //   postImage: {
// //     width: "100%",
// //     height: 400,
// //     marginBottom: 16,
// //   },
// //   timestamp: {
// //     fontSize: 14,
// //     paddingHorizontal: 16,
// //     marginBottom: 16,
// //   },
// //   actionsContainer: {
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderTopWidth: 0.5,
// //     borderBottomWidth: 0.5,
// //     borderColor: "#E1E8ED",
// //   },
// //   actionButtons: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 32,
// //   },
// //   actionButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 8,
// //   },
// //   actionCount: {
// //     fontSize: 14,
// //     fontWeight: "600",
// //   },
// //   viewsContainer: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 4,
// //   },
// //   viewsText: {
// //     fontSize: 14,
// //   },
// //   commentsSection: {
// //     padding: 16,
// //   },
// //   commentsTitle: {
// //     fontSize: 18,
// //     fontWeight: "bold",
// //     marginBottom: 16,
// //   },
// //   commentContainer: {
// //     marginBottom: 16,
// //   },
// //   commentHeader: {
// //     flexDirection: "row",
// //     alignItems: "flex-start",
// //   },
// //   commentProfileImage: {
// //     width: 32,
// //     height: 32,
// //     borderRadius: 16,
// //     marginRight: 12,
// //   },
// //   commentContent: {
// //     flex: 1,
// //   },
// //   commentUserInfo: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     marginBottom: 4,
// //   },
// //   commentUserName: {
// //     fontSize: 14,
// //     fontWeight: "600",
// //     marginRight: 4,
// //   },
// //   commentUsername: {
// //     fontSize: 14,
// //     marginRight: 4,
// //   },
// //   commentTime: {
// //     fontSize: 14,
// //   },
// //   commentText: {
// //     fontSize: 14,
// //     lineHeight: 18,
// //     marginBottom: 8,
// //   },
// //   commentImage: {
// //     width: "100%",
// //     height: 200,
// //     borderRadius: 8,
// //     marginBottom: 8,
// //   },
// //   commentActions: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 16,
// //   },
// //   commentActionButton: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 4,
// //   },
// //   commentActionText: {
// //     fontSize: 12,
// //   },
// //   replyContainer: {
// //     flexDirection: "row",
// //     alignItems: "flex-start",
// //     marginTop: 12,
// //     marginLeft: 16,
// //   },
// //   replyProfileImage: {
// //     width: 24,
// //     height: 24,
// //     borderRadius: 12,
// //     marginRight: 8,
// //   },
// //   replyContent: {
// //     flex: 1,
// //   },
// //   replyUserInfo: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     marginBottom: 2,
// //   },
// //   replyUserName: {
// //     fontSize: 12,
// //     fontWeight: "600",
// //     marginRight: 4,
// //   },
// //   replyUsername: {
// //     fontSize: 12,
// //     marginRight: 4,
// //   },
// //   replyTime: {
// //     fontSize: 12,
// //   },
// //   replyText: {
// //     fontSize: 12,
// //     lineHeight: 16,
// //   },
// //   bottomPadding: {
// //     height: 100,
// //   },
// //   commentInputContainer: {
// //     borderTopWidth: 0.5,
// //     paddingHorizontal: 16,
// //     paddingTop: 16,
// //     position: "absolute",
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     zIndex: 1000,
// //   },
// //   replyingToContainer: {
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //     paddingVertical: 8,
// //     paddingHorizontal: 12,
// //     borderRadius: 8,
// //     marginBottom: 8,
// //   },
// //   replyingToText: {
// //     fontSize: 12,
// //   },
// //   cancelReply: {
// //     fontSize: 12,
// //     fontWeight: "600",
// //   },
// //   inputRow: {
// //     flexDirection: "row",
// //     alignItems: "flex-end",
// //     gap: 12,
// //   },
// //   inputProfileImage: {
// //     width: 32,
// //     height: 32,
// //     borderRadius: 16,
// //   },
// //   textInput: {
// //     flex: 1,
// //     borderWidth: 1,
// //     borderRadius: 20,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     maxHeight: 100,
// //     fontSize: 14,
// //     minHeight: 40,
// //   },
// //   sendButton: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   modalOverlay: {
// //     flex: 1,
// //     backgroundColor: "rgba(0, 0, 0, 0.5)",
// //     justifyContent: "flex-end",
// //   },
// //   shareModal: {
// //     borderTopLeftRadius: 20,
// //     borderTopRightRadius: 20,
// //     padding: 24,
// //   },
// //   shareTitle: {
// //     fontSize: 18,
// //     fontWeight: "600",
// //     marginBottom: 20,
// //     textAlign: "center",
// //   },
// //   shareOption: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingVertical: 16,
// //     gap: 16
// //   },
// //   shareOptionText: {
// //     fontSize: 16,
// //   },
// //   cancelButton: {
// //     borderWidth: 1,
// //     borderRadius: 12,
// //     paddingVertical: 12,
// //     marginTop: 16,
// //   },
// //   cancelButtonText: {
// //     fontSize: 16,
// //     textAlign: "center",
// //   },
// //   loadingOverlay: {
// //     position: "absolute",
// //     top: 0,
// //     left: 0,
// //     right: 0,
// //     bottom: 0,
// //     backgroundColor: "rgba(0, 0,0,0.3)",
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },
// //   errorContainer: {
// //     padding: 20,
// //     alignItems: "center",
// //   },
// //   errorText: {
// //     fontSize: 16,
// //     textAlign: "center",
// //     marginBottom: 20,
// //   },
// //   retryButton: {
// //     paddingVertical: 10,
// //     paddingHorizontal: 20,
// //     borderRadius: 8,
// //   },
// //   retryButtonText: {
// //     color: "white",
// //     fontWeight: "600",
// //   },
// // })

// // export default PostView

// // // "use client"

// // // import type React from "react"
// // // import { useState, useEffect, useRef } from "react"
// // // import {
// // //   View,
// // //   ScrollView,
// // //   Text,
// // //   StyleSheet,
// // //   Image,
// // //   TouchableOpacity,
// // //   TextInput,
// // //   Alert,
// // //   Share,
// // //   ActivityIndicator,
// // //   Modal,
// // //   StatusBar,
// // //   KeyboardAvoidingView,
// // //   Platform,
// // // } from "react-native"
// // // import { useAuth, api } from "../../contexts/AuthContext"
// // // import { useTheme } from "../../contexts/ThemeContext"
// // // import { Audio } from "expo-av"
// // // import {
// // //   Heart,
// // //   MessageCircle,
// // //   Share as ShareIcon,
// // //   MoreHorizontal,
// // //   Eye,
// // //   ArrowLeft,
// // //   UserPlus,
// // //   UserCheck,
// // //   Send,
// // //   Reply as ReplyIcon,
// // //   ThumbsUp,
// // //   Hash,
// // // } from "lucide-react-native"

// // // interface Comment {
// // //   _id: string
// // //   user: {
// // //     _id: string
// // //     username: string
// // //     fullName: string
// // //     profilePicture?: string
// // //   }
// // //   text: string
// // //   image?: string
// // //   likes: string[]
// // //   replies: {
// // //     _id: string
// // //     user: {
// // //       _id: string
// // //       username: string
// // //       fullName: string
// // //       profilePicture?: string
// // //     }
// // //     text: string
// // //     image?: string
// // //     likes: string[]
// // //     createdAt: string
// // //   }[]
// // //   createdAt: string
// // // }

// // // interface Post {
// // //   _id: string
// // //   user: {
// // //     _id: string
// // //     username: string
// // //     fullName: string
// // //     profilePicture?: string
// // //   }
// // //   images: string[]
// // //   caption: string
// // //   likes: string[]
// // //   comments: Comment[]
// // //   views: number
// // //   hashtags: string[]
// // //   createdAt: string
// // // }

// // // interface PostViewProps {
// // //   route: {
// // //     params: {
// // //       post?: Post
// // //       postId?: string
// // //       activeHashtag?: string
// // //     }
// // //   }
// // //   navigation: any
// // // }

// // // const PostView: React.FC<PostViewProps> = ({ route, navigation }) => {
// // //   const { post: initialPost, postId, activeHashtag } = route.params
// // //   const { user, token } = useAuth()
// // //   const { colors, theme } = useTheme()

// // //   const [post, setPost] = useState<Post | null>(initialPost || null)
// // //   const [loading, setLoading] = useState(!initialPost)
// // //   const [commentText, setCommentText] = useState("")
// // //   const [replyText, setReplyText] = useState("")
// // //   const [replyingTo, setReplyingTo] = useState<string | null>(null)
// // //   const [isFollowing, setIsFollowing] = useState(false)
// // //   const [shareModalVisible, setShareModalVisible] = useState(false)
// // //   const [error, setError] = useState<string | null>(null)

// // //   const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
// // //   const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)
// // //   const [sendSound, setSendSound] = useState<Audio.Sound | null>(null)

// // //   const commentInputRef = useRef<TextInput>(null)
// // //   const replyInputRef = useRef<TextInput>(null)

// // //   useEffect(() => {
// // //     const loadSounds = async () => {
// // //       try {
// // //         const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
// // //         const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
// // //         const { sound: sendAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/send.mp3"))
// // //         setLikeSound(likeAudio)
// // //         setCommentSound(commentAudio)
// // //         setSendSound(sendAudio)
// // //       } catch (error) {
// // //         console.error("Error loading sounds:", error)
// // //       }
// // //     }

// // //     loadSounds()

// // //     return () => {
// // //       likeSound?.unloadAsync()
// // //       commentSound?.unloadAsync()
// // //       sendSound?.unloadAsync()
// // //     }
// // //   }, [])

// // //   useEffect(() => {
// // //     if (postId && !initialPost) {
// // //       fetchPostById(postId)
// // //     } else if (initialPost) {
// // //       fetchPostDetails()
// // //       checkFollowingStatus()
// // //     }
// // //   }, [postId, initialPost])

// // //   const playSound = async (sound: Audio.Sound | null) => {
// // //     try {
// // //       if (sound) {
// // //         await sound.replayAsync()
// // //       }
// // //     } catch (error) {
// // //       console.error("Error playing sound:", error)
// // //     }
// // //   }

// // //   const fetchPostById = async (id: string) => {
// // //     try {
// // //       setLoading(true)
// // //       setError(null)
// // //       console.log("Fetching post by ID:", id)
// // //       const response = await api.get(`/posts/${id}`)
// // //       const fetchedPost = response.data.post

// // //       if (!fetchedPost) {
// // //         throw new Error("Post not found")
// // //       }

// // //       setPost(fetchedPost)
// // //       checkFollowingStatus(fetchedPost.user._id)
// // //     } catch (error) {
// // //       console.error("Error fetching post by ID:", error)
// // //       setError("Failed to load post. Please try again.")
// // //     } finally {
// // //       setLoading(false)
// // //     }
// // //   }

// // //   const fetchPostDetails = async () => {
// // //     if (!post) return

// // //     try {
// // //       setLoading(true)
// // //       setError(null)
// // //       const response = await api.get(`/posts/${post._id}`)
// // //       setPost(response.data.post)
// // //     } catch (error) {
// // //       console.error("Error fetching post details:", error)
// // //       setError("Failed to refresh post details")
// // //     } finally {
// // //       setLoading(false)
// // //     }
// // //   }

// // //   const checkFollowingStatus = async (userId?: string) => {
// // //     if (!post && !userId) return
// // //     const postUserId = userId || post?.user._id

// // //     if (postUserId === user?.id) return

// // //     try {
// // //       const response = await api.post(`/users/${postUserId}/is-following`, {
// // //         followerId: user?.id,
// // //       })
// // //       setIsFollowing(response.data.isFollowing)
// // //     } catch (error) {
// // //       console.error("Error checking follow status:", error)
// // //     }
// // //   }

// // //   const handleLike = async () => {
// // //     if (!user || !token || !post) return

// // //     try {
// // //       await playSound(likeSound)

// // //       const isLiked = post.likes.includes(user.id)
// // //       setPost((prev) => {
// // //         if (!prev) return prev
// // //         return {
// // //           ...prev,
// // //           likes: isLiked ? prev.likes.filter((id) => id !== user.id) : [...prev.likes, user.id],
// // //         }
// // //       })

// // //       await api.post(`/posts/${post._id}/like`, { userId: user.id })
// // //     } catch (error) {
// // //       console.error("Error liking post:", error)
// // //       fetchPostDetails()
// // //     }
// // //   }

// // //   const handleFollow = async () => {
// // //     if (!user || !token || !post || post.user._id === user.id) return

// // //     try {
// // //       if (isFollowing) {
// // //         await api.post(`/users/${post.user._id}/unfollow`, { followerId: user.id })
// // //         setIsFollowing(false)
// // //       } else {
// // //         await api.post(`/users/${post.user._id}/follow`, { followerId: user.id })
// // //         setIsFollowing(true)
// // //       }
// // //     } catch (error) {
// // //       console.error("Error following/unfollowing user:", error)
// // //       Alert.alert("Error", "Failed to update follow status")
// // //     }
// // //   }

// // //   const handleComment = async () => {
// // //     if (!commentText.trim() || !user || !post) return

// // //     try {
// // //       await playSound(commentSound)
// // //       await playSound(sendSound)

// // //       const response = await api.post(`/posts/${post._id}/comment`, {
// // //         text: commentText.trim(),
// // //       })

// // //       setPost((prev) => {
// // //         if (!prev) return prev
// // //         return {
// // //           ...prev,
// // //           comments: [...prev.comments, response.data.comment],
// // //         }
// // //       })

// // //       if (post.user._id !== user.id) {
// // //         try {
// // //           const captionPreview = post.caption
// // //             ? post.caption.length > 50
// // //               ? `${post.caption.substring(0, 47)}...`
// // //               : post.caption
// // //             : "No caption"
// // //           const chatMessage = `New comment on your post:\n${captionPreview} [faint]${post.caption || ''}[/faint]\nComment: ${commentText.trim()}`
// // //           await api.post(`/chats/${post.user._id}`, {
// // //             message: chatMessage,
// // //             image: post.images[0] || undefined,
// // //           })
// // //           console.log(`Chat message sent to @${post.user.username}: ${chatMessage}${post.images[0] ? ` with image ${post.images[0]}` : ''}`)
// // //         } catch (chatError) {
// // //           console.error("Error sending chat message:", chatError)
// // //           Alert.alert("Warning", "Comment posted, but failed to send chat notification to post creator")
// // //         }
// // //       }

// // //       setCommentText("")
// // //       commentInputRef.current?.blur()
// // //     } catch (error) {
// // //       console.error("Error adding comment:", error)
// // //       Alert.alert("Error", "Failed to add comment")
// // //     }
// // //   }

// // //   const handleReply = async (commentId: string) => {
// // //     if (!replyText.trim() || !user || !post) return

// // //     try {
// // //       await playSound(commentSound)
// // //       await playSound(sendSound)

// // //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/reply`, {
// // //         text: replyText.trim(),
// // //       })

// // //       setPost((prev) => {
// // //         if (!prev) return prev
// // //         return {
// // //           ...prev,
// // //           comments: prev.comments.map((comment) =>
// // //             comment._id === commentId ? { ...comment, replies: [...comment.replies, response.data.reply] } : comment,
// // //           ),
// // //         }
// // //       })

// // //       setReplyText("")
// // //       setReplyingTo(null)
// // //       replyInputRef.current?.blur()
// // //     } catch (error) {
// // //       console.error("Error adding reply:", error)
// // //       Alert.alert("Error", "Failed to add reply")
// // //     }
// // //   }

// // //   const handleLikeComment = async (commentId: string) => {
// // //     if (!user || !post) return

// // //     try {
// // //       await playSound(likeSound)

// // //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/like`)

// // //       setPost((prev) => {
// // //         if (!prev) return prev
// // //         return {
// // //           ...prev,
// // //           comments: prev.comments.map((comment) =>
// // //             comment._id === commentId ? { ...comment, likes: response.data.likes } : comment,
// // //           ),
// // //         }
// // //       })
// // //     } catch (error) {
// // //       console.error("Error liking comment:", error)
// // //     }
// // //   }

// // //   const handleHashtagPress = (hashtag: string) => {
// // //     navigation.navigate("Search", {
// // //       initialQuery: `#${hashtag}`,
// // //       initialType: "hashtags",
// // //       activeHashtag: hashtag,
// // //     })
// // //   }

// // //   const handleChatWithUser = async () => {
// // //     if (!user || !post || post.user._id === user.id) return

// // //     try {
// // //       await api.post(`/chats/${post.user._id}`, {
// // //         message: `Hi! I'd like to connect with you.`,
// // //       })

// // //       Alert.alert("Success", `Message sent to @${post.user.username}!`, [
// // //         {
// // //           text: "Go to Chat",
// // //           onPress: () => navigation.navigate("Chat"),
// // //         },
// // //         { text: "OK" },
// // //       ])
// // //     } catch (error) {
// // //       console.error("Error creating chat:", error)
// // //       Alert.alert("Error", "Failed to send message")
// // //     }
// // //   }

// // //   const handleShare = async () => {
// // //     if (!post) return

// // //     try {
// // //       const shareContent = {
// // //         message: `${post.caption || "Check out this post!"} by @${post.user.username}`,
// // //         url: post.images?.[0] || "",
// // //       }
// // //       await Share.share(shareContent)
// // //       setShareModalVisible(false)
// // //     } catch (error) {
// // //       console.error("Error sharing post:", error)
// // //     }
// // //   }

// // //   const handleShareComment = async (comment: Comment) => {
// // //     if (!post) return

// // //     try {
// // //       const shareContent = {
// // //         message: `"${comment.text}" - Comment by @${comment.user.username} on @${post.user.username}'s post`,
// // //       }
// // //       await Share.share(shareContent)
// // //     } catch (error) {
// // //       console.error("Error sharing comment:", error)
// // //     }
// // //   }

// // //   const formatTimeAgo = (dateString: string) => {
// // //     const now = new Date()
// // //     const postDate = new Date(dateString)
// // //     const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000)

// // //     if (diffInSeconds < 60) return "now"
// // //     if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
// // //     if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
// // //     if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`

// // //     return postDate.toLocaleDateString()
// // //   }

// // //   const renderComment = ({ item: comment }: { item: Comment }) => {
// // //     const isCommentLiked = user && comment.likes?.includes(user.id)

// // //     return (
// // //       <View style={styles.commentContainer}>
// // //         <View style={styles.commentHeader}>
// // //           <Image
// // //             source={{
// // //               uri: comment.user.profilePicture || "https://via.placeholder.com/32",
// // //             }}
// // //             style={styles.commentProfileImage}
// // //           />
// // //           <View style={styles.commentContent}>
// // //             <View style={styles.commentUserInfo}>
// // //               <Text style={[styles.commentUserName, { color: colors.text }]}>{comment.user.fullName}</Text>
// // //               <Text style={[styles.commentUsername, { color: colors.placeholder }]}>@{comment.user.username}</Text>
// // //               <Text style={[styles.commentTime, { color: colors.placeholder }]}>
// // //                 · {formatTimeAgo(comment.createdAt)}
// // //               </Text>
// // //             </View>
// // //             <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>

// // //             {comment.image && <Image source={{ uri: comment.image }} style={styles.commentImage} />}

// // //             <View style={styles.commentActions}>
// // //               <TouchableOpacity
// // //                 onPress={() => {
// // //                   setReplyingTo(comment._id)
// // //                   replyInputRef.current?.focus()
// // //                 }}
// // //                 style={styles.commentActionButton}
// // //               >
// // //                 <ReplyIcon size={16} color={colors.icon} />
// // //                 <Text style={[styles.commentActionText, { color: colors.placeholder }]}>
// // //                   {comment.replies?.length || 0}
// // //                 </Text>
// // //               </TouchableOpacity>

// // //               <TouchableOpacity onPress={() => handleLikeComment(comment._id)} style={styles.commentActionButton}>
// // //                 <ThumbsUp
// // //                   size={16}
// // //                   color={isCommentLiked ? "#E91E63" : colors.icon}
// // //                   fill={isCommentLiked ? "#E91E63" : "none"}
// // //                 />
// // //                 <Text style={[styles.commentActionText, { color: colors.placeholder }]}>
// // //                   {comment.likes?.length || 0}
// // //                 </Text>
// // //               </TouchableOpacity>

// // //               <TouchableOpacity onPress={() => handleShareComment(comment)} style={styles.commentActionButton}>
// // //                 <ShareIcon size={16} color={colors.icon} />
// // //               </TouchableOpacity>
// // //             </View>

// // //             {comment.replies?.map((reply) => (
// // //               <View key={reply._id} style={styles.replyContainer}>
// // //                 <Image
// // //                   source={{
// // //                     uri: reply.user.profilePicture || "https://via.placeholder.com/24",
// // //                   }}
// // //                   style={styles.replyProfileImage}
// // //                 />
// // //                 <View style={styles.replyContent}>
// // //                   <View style={styles.replyUserInfo}>
// // //                     <Text style={[styles.replyUserName, { color: colors.text }]}>{reply.user.fullName}</Text>
// // //                     <Text style={[styles.replyUsername, { color: colors.text }]}>@{reply.user.username}</Text>
// // //                     <Text style={[styles.replyTime, { color: colors.text }]}>
// // //                       · {formatTimeAgo(reply.createdAt)}
// // //                     </Text>
// // //                   </View>
// // //                   <Text style={[styles.replyText, { color: colors.text }]}>{reply.text}</Text>
// // //                 </View>
// // //               </View>
// // //             ))}
// // //           </View>
// // //         </View>
// // //       </View>
// // //     )
// // //   }

// // //   if ((loading && !post) || error) {
// // //     return (
// // //       <View
// // //         style={[
// // //           styles.container,
// // //           { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
// // //         ]}
// // //       >
// // //         <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

// // //         <View
// // //           style={[
// // //             styles.header,
// // //             {
// // //               backgroundColor: colors.background,
// // //               borderBottomColor: colors.border,
// // //               position: "absolute",
// // //               top: 0,
// // //               left: 0,
// // //               right: 0,
// // //             },
// // //           ]}
// // //         >
// // //           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
// // //             <ArrowLeft size={24} color={colors.text} />
// // //           </TouchableOpacity>
// // //           <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
// // //           <View style={styles.headerRight} />
// // //         </View>

// // //         {loading ? (
// // //           <ActivityIndicator size="large" color={colors.primary} />
// // //         ) : (
// // //           <View style={styles.errorContainer}>
// // //             <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
// // //             <TouchableOpacity
// // //               style={[styles.retryButton, { backgroundColor: colors.primary }]}
// // //               onPress={() => (postId ? fetchPostById(postId) : navigation.goBack())}
// // //             >
// // //               <Text style={styles.retryButtonText}>Retry</Text>
// // //             </TouchableOpacity>
// // //           </View>
// // //         )}
// // //       </View>
// // //     )
// // //   }

// // //   if (!post) {
// // //     return null
// // //   }

// // //   const isLiked = user && post.likes?.includes(user.id)
// // //   const isOwnPost = user?.id === post.user._id

// // //   return (
// // //     <KeyboardAvoidingView
// // //       style={[styles.container, { backgroundColor: colors.background }]}
// // //       behavior={Platform.OS === "ios" ? "padding" : "height"}
// // //       keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
// // //     >
// // //       <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

// // //       <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
// // //         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
// // //           <ArrowLeft size={24} color={colors.text} />
// // //         </TouchableOpacity>
// // //         <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
// // //         <View style={styles.headerRight} />
// // //       </View>

// // //       <ScrollView
// // //         style={styles.content}
// // //         showsVerticalScrollIndicator={false}
// // //         contentContainerStyle={styles.scrollContent}
// // //         keyboardShouldPersistTaps="handled"
// // //       >
// // //         <View style={styles.postHeader}>
// // //           <TouchableOpacity
// // //             onPress={() => navigation.navigate("UserProfile", { userId: post.user._id })}
// // //             style={styles.userInfoContainer}
// // //           >
// // //             <Image
// // //               source={{
// // //                 uri: post.user.profilePicture || "https://via.placeholder.com/48",
// // //               }}
// // //               style={styles.profileImage}
// // //             />
// // //             <View style={styles.userInfo}>
// // //               <Text style={[styles.fullName, { color: colors.text }]}>{post.user.fullName}</Text>
// // //               <Text style={[styles.username, { color: colors.text }]}>@{post.user.username}</Text>
// // //             </View>
// // //           </TouchableOpacity>

// // //           <View style={styles.headerActions}>
// // //             {!isOwnPost && (
// // //               <>
// // //                 <TouchableOpacity
// // //                   onPress={handleFollow}
// // //                   style={[
// // //                     styles.followButton,
// // //                     {
// // //                       backgroundColor: isFollowing ? colors.border : colors.primary,
// // //                       borderColor: colors.primary,
// // //                     },
// // //                   ]}
// // //                 >
// // //                   {isFollowing ? <UserCheck size={16} color={colors.text} /> : <UserPlus size={16} color="white" />}
// // //                   <Text style={[styles.followButtonText, { color: isFollowing ? colors.text : "white" }]}>
// // //                     {isFollowing ? "Following" : "Follow"}
// // //                   </Text>
// // //                 </TouchableOpacity>

// // //                 {/* <TouchableOpacity 
// // //                    onPress={handleChatWithUser}
// // //                    style={[styles.chatButton, { borderColor: colors.primary }]}
// // //                 >
// // //                    <MessageCircle size={16} color={colors.primary} /> 
// // //                    <Text style={[styles.chatButtonText, { color: colors.primary }]}>Chat</Text> 
// // //                  </TouchableOpacity> */}
// // //               </>
// // //             )}

// // //             <TouchableOpacity style={styles.moreButton}>
// // //               <MoreHorizontal size={20} color={colors.icon} />
// // //             </TouchableOpacity>
// // //           </View>
// // //         </View>

// // //         {post.caption ? (
// // //           <View style={styles.captionContainer}>
// // //             <Text style={[styles.caption, { color: colors.text }]}>
// // //               {post.caption.split(/(\s+)/).map((word, index) => {
// // //                 if (word.startsWith("#")) {
// // //                   const hashtag = word.substring(1)
// // //                   const isActive = activeHashtag === hashtag
// // //                   return (
// // //                     <Text
// // //                       key={index}
// // //                       style={[
// // //                         styles.hashtag,
// // //                         {
// // //                           color: isActive ? colors.primary : colors.hashtag,
// // //                           backgroundColor: isActive ? colors.primary + "20" : "transparent",
// // //                           paddingHorizontal: isActive ? 4 : 0,
// // //                           borderRadius: isActive ? 4 : 0,
// // //                         },
// // //                       ]}
// // //                       onPress={() => handleHashtagPress(hashtag)}
// // //                     >
// // //                       {word}
// // //                     </Text>
// // //                   )
// // //                 }
// // //                 return word
// // //               })}
// // //             </Text>
// // //           </View>
// // //         ) : null}

// // //         {post.hashtags && post.hashtags.length > 0 && (
// // //           <View style={styles.hashtagsContainer}>
// // //             {post.hashtags.map((hashtag, index) => {
// // //               const isActive = activeHashtag === hashtag
// // //               return (
// // //                 <TouchableOpacity
// // //                   key={index}
// // //                   onPress={() => handleHashtagPress(hashtag)}
// // //                   style={[
// // //                     styles.hashtagButton,
// // //                     {
// // //                       backgroundColor: isActive ? colors.primary : colors.primary + "20",
// // //                       borderWidth: isActive ? 2 : 0,
// // //                       borderColor: isActive ? colors.primary : "transparent",
// // //                     },
// // //                   ]}
// // //                 >
// // //                   <Hash size={12} color={isActive ? "white" : colors.primary} />
// // //                   <Text style={[styles.hashtagText, { color: isActive ? "white" : colors.primary }]}>{hashtag}</Text>
// // //                 </TouchableOpacity>
// // //               )
// // //             })}
// // //           </View>
// // //         )}

// // //         {post.images?.[0] && <Image source={{ uri: post.images[0] }} style={styles.postImage} />}

// // //         <Text style={[styles.timestamp, { color: colors.placeholder }]}>{formatTimeAgo(post.createdAt)}</Text>

// // //         <View style={styles.actionsContainer}>
// // //           <View style={styles.actionButtons}>
// // //             <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
// // //               <Heart size={24} color={isLiked ? "#E91E63" : colors.icon} fill={isLiked ? "#E91E63" : "none"} />
// // //               <Text style={[styles.actionCount, { color: colors.text }]}>{post.likes?.length || 0}</Text>
// // //             </TouchableOpacity>

// // //             <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.actionButton}>
// // //               <MessageCircle size={24} color={colors.icon} />
// // //               <Text style={[styles.actionCount, { color: colors.text }]}>{post.comments?.length || 0}</Text>
// // //             </TouchableOpacity>

// // //             <TouchableOpacity onPress={() => setShareModalVisible(true)} style={styles.actionButton}>
// // //               <ShareIcon size={24} color={colors.icon} />
// // //             </TouchableOpacity>
// // //           </View>

// // //           <View style={styles.viewsContainer}>
// // //             <Eye size={18} color={colors.placeholder} />
// // //             <Text style={[styles.viewsText, { color: colors.placeholder }]}>{post.views || 0} views</Text>
// // //           </View>
// // //         </View>

// // //         <View style={styles.commentsSection}>
// // //           <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments ({post.comments?.length || 0})</Text>

// // //           {post.comments?.map((comment) => (
// // //             <View key={comment._id}>{renderComment({ item: comment })}</View>
// // //           ))}
// // //         </View>

// // //         <View style={styles.bottomPadding} />
// // //       </ScrollView>

// // //       <View
// // //         style={[
// // //           styles.commentInputContainer,
// // //           {
// // //             backgroundColor: colors.card,
// // //             borderTopColor: colors.border,
// // //             paddingBottom: Platform.OS === "ios" ? 34 : 16,
// // //           },
// // //         ]}
// // //       >
// // //         {replyingTo && (
// // //           <View style={[styles.replyingToContainer, { backgroundColor: colors.background }]}>
// // //             <Text style={[styles.replyingToText, { color: colors.placeholder }]}>Replying to comment</Text>
// // //             <TouchableOpacity onPress={() => setReplyingTo(null)}>
// // //               <Text style={[styles.cancelReply, { color: colors.primary }]}>Cancel</Text>
// // //             </TouchableOpacity>
// // //           </View>
// // //         )}

// // //         <View style={styles.inputRow}>
// // //           <Image
// // //             source={{
// // //               uri: user?.profilePicture || "https://via.placeholder.com/32",
// // //             }}
// // //             style={styles.inputProfileImage}
// // //           />
// // //           <TextInput
// // //             ref={replyingTo ? replyInputRef : commentInputRef}
// // //             style={[
// // //               styles.textInput,
// // //               {
// // //                 color: colors.text,
// // //                 borderColor: colors.border,
// // //                 backgroundColor: colors.background,
// // //               },
// // //             ]}
// // //             placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
// // //             placeholderTextColor={colors.text}
// // //             value={replyingTo ? replyText : commentText}
// // //             onChangeText={replyingTo ? setReplyText : setCommentText}
// // //             multiline
// // //             maxLength={500}
// // //             returnKeyType="default"
// // //             blurOnSubmit={false}
// // //           />
// // //           <TouchableOpacity
// // //             onPress={replyingTo ? () => handleReply(replyingTo) : handleComment}
// // //             style={[
// // //               styles.sendButton,
// // //               {
// // //                 backgroundColor: (replyingTo ? replyText : commentText).trim() ? colors.primary : colors.border,
// // //               },
// // //             ]}
// // //             disabled={!(replyingTo ? replyText : commentText).trim()}
// // //           >
// // //             <Send size={18} color="white" />
// // //           </TouchableOpacity>
// // //         </View>
// // //       </View>

// // //       <Modal
// // //         visible={shareModalVisible}
// // //         transparent
// // //         animationType="slide"
// // //         onRequestClose={() => setShareModalVisible(false)}
// // //       >
// // //         <View style={styles.modalOverlay}>
// // //           <View style={[styles.shareModal, { backgroundColor: colors.card }]}>
// // //             <Text style={[styles.shareTitle, { color: colors.text }]}>Share Post</Text>

// // //             <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
// // //               <ShareIcon size={24} color={colors.text} />
// // //               <Text style={[styles.shareOptionText, { color: colors.text }]}>Share via...</Text>
// // //             </TouchableOpacity>

// // //             <TouchableOpacity
// // //               onPress={() => setShareModalVisible(false)}
// // //               style={[styles.cancelButton, { borderColor: colors.border }]}
// // //             >
// // //               <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
// // //             </TouchableOpacity>
// // //           </View>
// // //         </View>
// // //       </Modal>

// // //       {loading && (
// // //         <View style={styles.loadingOverlay}>
// // //           <ActivityIndicator size="large" color={colors.primary} />
// // //         </View>
// // //       )}
// // //     </KeyboardAvoidingView>
// // //   )
// // // }

// // // const styles = StyleSheet.create({
// // //   container: {
// // //     flex: 1,
// // //     marginBottom: 116,
// // //     paddingTop: 5
// // //   },
// // //   header: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     justifyContent: "space-between",
// // //     paddingTop: StatusBar.currentHeight || 44,
// // //     paddingHorizontal: 16,
// // //     paddingBottom: 12,
// // //     borderBottomWidth: 0.5,
// // //   },
// // //   backButton: {
// // //     padding: 8,
// // //     marginLeft: -8,
// // //   },
// // //   headerTitle: {
// // //     fontSize: 18,
// // //     fontWeight: "600",
// // //   },
// // //   headerRight: {
// // //     width: 40,
// // //   },
// // //   content: {
// // //     flex: 1,
// // //   },
// // //   scrollContent: {
// // //     flexGrow: 1,
// // //   },
// // //   postHeader: {
// // //     flexDirection: "row",
// // //     alignItems: "flex-start",
// // //     justifyContent: "space-between",
// // //     padding: 16,
// // //   },
// // //   userInfoContainer: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     flex: 1,
// // //   },
// // //   profileImage: {
// // //     width: 48,
// // //     height: 48,
// // //     borderRadius: 24,
// // //     marginRight: 12,
// // //   },
// // //   userInfo: {
// // //     flex: 1,
// // //   },
// // //   fullName: {
// // //     fontSize: 16,
// // //     fontWeight: "bold",
// // //   },
// // //   username: {
// // //     fontSize: 14,
// // //     marginTop: 2,
// // //   },
// // //   headerActions: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     gap: 8,
// // //   },
// // //   followButton: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 8,
// // //     borderRadius: 20,
// // //     borderWidth: 1,
// // //     gap: 4,
// // //   },
// // //   followButtonText: {
// // //     fontSize: 14,
// // //     fontWeight: "600",
// // //   },
// // //   chatButton: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 8,
// // //     borderRadius: 20,
// // //     borderWidth: 1,
// // //     gap: 4,
// // //   },
// // //   chatButtonText: {
// // //     fontSize: 14,
// // //     fontWeight: "600",
// // //   },
// // //   moreButton: {
// // //     padding: 8,
// // //   },
// // //   captionContainer: {
// // //     paddingHorizontal: 16,
// // //     marginBottom: 16,
// // //   },
// // //   caption: {
// // //     fontSize: 16,
// // //     lineHeight: 22,
// // //   },
// // //   hashtag: {
// // //     fontWeight: "bold",
// // //   },
// // //   hashtagsContainer: {
// // //     flexDirection: "row",
// // //     flexWrap: "wrap",
// // //     paddingHorizontal: 16,
// // //     marginBottom: 16,
// // //   },
// // //   hashtagButton: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     paddingHorizontal: 10,
// // //     paddingVertical: 5,
// // //     borderRadius: 15,
// // //     marginRight: 10,
// // //     marginBottom: 10,
// // //   },
// // //   hashtagText: {
// // //     fontSize: 12,
// // //     marginLeft: 4,
// // //   },
// // //   postImage: {
// // //     width: "100%",
// // //     height: 400,
// // //     marginBottom: 16,
// // //   },
// // //   timestamp: {
// // //     fontSize: 14,
// // //     paddingHorizontal: 16,
// // //     marginBottom: 16,
// // //   },
// // //   actionsContainer: {
// // //     flexDirection: "row",
// // //     justifyContent: "space-between",
// // //     alignItems: "center",
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 12,
// // //     borderTopWidth: 0.5,
// // //     borderBottomWidth: 0.5,
// // //     borderColor: "#E1E8ED",
// // //   },
// // //   actionButtons: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     gap: 32,
// // //   },
// // //   actionButton: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     gap: 8,
// // //   },
// // //   actionCount: {
// // //     fontSize: 14,
// // //     fontWeight: "600",
// // //   },
// // //   viewsContainer: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     gap: 4,
// // //   },
// // //   viewsText: {
// // //     fontSize: 14,
// // //   },
// // //   commentsSection: {
// // //     padding: 16,
// // //   },
// // //   commentsTitle: {
// // //     fontSize: 18,
// // //     fontWeight: "bold",
// // //     marginBottom: 16,
// // //   },
// // //   commentContainer: {
// // //     marginBottom: 16,
// // //   },
// // //   commentHeader: {
// // //     flexDirection: "row",
// // //     alignItems: "flex-start",
// // //   },
// // //   commentProfileImage: {
// // //     width: 32,
// // //     height: 32,
// // //     borderRadius: 16,
// // //     marginRight: 12,
// // //   },
// // //   commentContent: {
// // //     flex: 1,
// // //   },
// // //   commentUserInfo: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     marginBottom: 4,
// // //   },
// // //   commentUserName: {
// // //     fontSize: 14,
// // //     fontWeight: "600",
// // //     marginRight: 4,
// // //   },
// // //   commentUsername: {
// // //     fontSize: 14,
// // //     marginRight: 4,
// // //   },
// // //   commentTime: {
// // //     fontSize: 14,
// // //   },
// // //   commentText: {
// // //     fontSize: 14,
// // //     lineHeight: 18,
// // //     marginBottom: 8,
// // //   },
// // //   commentImage: {
// // //     width: "100%",
// // //     height: 200,
// // //     borderRadius: 8,
// // //     marginBottom: 8,
// // //   },
// // //   commentActions: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     gap: 16,
// // //   },
// // //   commentActionButton: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     gap: 4,
// // //   },
// // //   commentActionText: {
// // //     fontSize: 12,
// // //   },
// // //   replyContainer: {
// // //     flexDirection: "row",
// // //     alignItems: "flex-start",
// // //     marginTop: 12,
// // //     marginLeft: 16,
// // //   },
// // //   replyProfileImage: {
// // //     width: 24,
// // //     height: 24,
// // //     borderRadius: 12,
// // //     marginRight: 8,
// // //   },
// // //   replyContent: {
// // //     flex: 1,
// // //   },
// // //   replyUserInfo: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     marginBottom: 2,
// // //   },
// // //   replyUserName: {
// // //     fontSize: 12,
// // //     fontWeight: "600",
// // //     marginRight: 4,
// // //   },
// // //   replyUsername: {
// // //     fontSize: 12,
// // //     marginRight: 4,
// // //   },
// // //   replyTime: {
// // //     fontSize: 12,
// // //   },
// // //   replyText: {
// // //     fontSize: 12,
// // //     lineHeight: 16,
// // //   },
// // //   bottomPadding: {
// // //     height: 100,
// // //   },
// // //   commentInputContainer: {
// // //     borderTopWidth: 0.5,
// // //     paddingHorizontal: 16,
// // //     paddingTop: 16,
// // //     position: "absolute",
// // //     bottom: 0,
// // //     left: 0,
// // //     right: 0,
// // //     zIndex: 1000,
// // //   },
// // //   replyingToContainer: {
// // //     flexDirection: "row",
// // //     justifyContent: "space-between",
// // //     alignItems: "center",
// // //     paddingVertical: 8,
// // //     paddingHorizontal: 12,
// // //     borderRadius: 8,
// // //     marginBottom: 8,
// // //   },
// // //   replyingToText: {
// // //     fontSize: 12,
// // //   },
// // //   cancelReply: {
// // //     fontSize: 12,
// // //     fontWeight: "600",
// // //   },
// // //   inputRow: {
// // //     flexDirection: "row",
// // //     alignItems: "flex-end",
// // //     gap: 12,
// // //   },
// // //   inputProfileImage: {
// // //     width: 32,
// // //     height: 32,
// // //     borderRadius: 16,
// // //   },
// // //   textInput: {
// // //     flex: 1,
// // //     borderWidth: 1,
// // //     borderRadius: 20,
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 12,
// // //     maxHeight: 100,
// // //     fontSize: 14,
// // //     minHeight: 40,
// // //   },
// // //   sendButton: {
// // //     width: 40,
// // //     height: 40,
// // //     borderRadius: 20,
// // //     justifyContent: "center",
// // //     alignItems: "center",
// // //   },
// // //   modalOverlay: {
// // //     flex: 1,
// // //     backgroundColor: "rgba(0, 0, 0, 0.5)",
// // //     justifyContent: "flex-end",
// // //   },
// // //   shareModal: {
// // //     borderTopLeftRadius: 20,
// // //     borderTopRightRadius: 20,
// // //     padding: 24,
// // //   },
// // //   shareTitle: {
// // //     fontSize: 18,
// // //     fontWeight: "600",
// // //     marginBottom: 20,
// // //     textAlign: "center",
// // //   },
// // //   shareOption: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     paddingVertical: 16,
// // //     gap: 16
// // //   },
// // //   shareOptionText: {
// // //     fontSize: 16,
// // //   },
// // //   cancelButton: {
// // //     borderWidth: 1,
// // //     borderRadius: 12,
// // //     paddingVertical: 12,
// // //     marginTop: 16,
// // //   },
// // //   cancelButtonText: {
// // //     fontSize: 16,
// // //     textAlign: "center",
// // //   },
// // //   loadingOverlay: {
// // //     position: "absolute",
// // //     top: 0,
// // //     left: 0,
// // //     right: 0,
// // //     bottom: 0,
// // //     backgroundColor: "rgba(0, 0,0,0.3)",
// // //     justifyContent: "center",
// // //     alignItems: "center",
// // //   },
// // //   errorContainer: {
// // //     padding: 20,
// // //     alignItems: "center",
// // //   },
// // //   errorText: {
// // //     fontSize: 16,
// // //     textAlign: "center",
// // //     marginBottom: 20,
// // //   },
// // //   retryButton: {
// // //     paddingVertical: 10,
// // //     paddingHorizontal: 20,
// // //     borderRadius: 8,
// // //   },
// // //   retryButtonText: {
// // //     color: "white",
// // //     fontWeight: "600",
// // //   },
// // // })

// // // export default PostView


// // // // "use client"

// // // // import type React from "react"
// // // // import { useState, useEffect, useRef } from "react"
// // // // import {
// // // //   View,
// // // //   ScrollView,
// // // //   Text,
// // // //   StyleSheet,
// // // //   Image,
// // // //   TouchableOpacity,
// // // //   TextInput,
// // // //   Alert,
// // // //   Share,
// // // //   ActivityIndicator,
// // // //   Modal,
// // // //   StatusBar,
// // // //   KeyboardAvoidingView,
// // // //   Platform,
// // // // } from "react-native"
// // // // import { useAuth, api } from "../../contexts/AuthContext"
// // // // import { useTheme } from "../../contexts/ThemeContext"
// // // // import { Audio } from "expo-av"
// // // // import {
// // // //   Heart,
// // // //   MessageCircle,
// // // //   Share as ShareIcon,
// // // //   MoreHorizontal,
// // // //   Eye,
// // // //   ArrowLeft,
// // // //   UserPlus,
// // // //   UserCheck,
// // // //   Send,
// // // //   Reply as ReplyIcon,
// // // //   ThumbsUp,
// // // //   Hash,
// // // // } from "lucide-react-native"

// // // // interface Comment {
// // // //   _id: string
// // // //   user: {
// // // //     _id: string
// // // //     username: string
// // // //     fullName: string
// // // //     profilePicture?: string
// // // //   }
// // // //   text: string
// // // //   image?: string
// // // //   likes: string[]
// // // //   replies: {
// // // //     _id: string
// // // //     user: {
// // // //       _id: string
// // // //       username: string
// // // //       fullName: string
// // // //       profilePicture?: string
// // // //     }
// // // //     text: string
// // // //     image?: string
// // // //     likes: string[]
// // // //     createdAt: string
// // // //   }[]
// // // //   createdAt: string
// // // // }

// // // // interface Post {
// // // //   _id: string
// // // //   user: {
// // // //     _id: string
// // // //     username: string
// // // //     fullName: string
// // // //     profilePicture?: string
// // // //   }
// // // //   images: string[]
// // // //   caption: string
// // // //   likes: string[]
// // // //   comments: Comment[]
// // // //   views: number
// // // //   hashtags: string[]
// // // //   createdAt: string
// // // // }

// // // // interface PostViewProps {
// // // //   route: {
// // // //     params: {
// // // //       post?: Post
// // // //       postId?: string
// // // //       activeHashtag?: string
// // // //     }
// // // //   }
// // // //   navigation: any
// // // // }

// // // // const PostView: React.FC<PostViewProps> = ({ route, navigation }) => {
// // // //   const { post: initialPost, postId, activeHashtag } = route.params
// // // //   const { user, token } = useAuth()
// // // //   const { colors, theme } = useTheme()

// // // //   const [post, setPost] = useState<Post | null>(initialPost || null)
// // // //   const [loading, setLoading] = useState(!initialPost)
// // // //   const [commentText, setCommentText] = useState("")
// // // //   const [replyText, setReplyText] = useState("")
// // // //   const [replyingTo, setReplyingTo] = useState<string | null>(null)
// // // //   const [isFollowing, setIsFollowing] = useState(false)
// // // //   const [shareModalVisible, setShareModalVisible] = useState(false)
// // // //   const [error, setError] = useState<string | null>(null)

// // // //   const [likeSound, setLikeSound] = useState<Audio.Sound | null>(null)
// // // //   const [commentSound, setCommentSound] = useState<Audio.Sound | null>(null)
// // // //   const [sendSound, setSendSound] = useState<Audio.Sound | null>(null)

// // // //   const commentInputRef = useRef<TextInput>(null)
// // // //   const replyInputRef = useRef<TextInput>(null)

// // // //   useEffect(() => {
// // // //     const loadSounds = async () => {
// // // //       try {
// // // //         const { sound: likeAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/like.mp3"))
// // // //         const { sound: commentAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/comment.mp3"))
// // // //         const { sound: sendAudio } = await Audio.Sound.createAsync(require("../../assets/sounds/send.mp3"))
// // // //         setLikeSound(likeAudio)
// // // //         setCommentSound(commentAudio)
// // // //         setSendSound(sendAudio)
// // // //       } catch (error) {
// // // //         console.error("Error loading sounds:", error)
// // // //       }
// // // //     }

// // // //     loadSounds()

// // // //     return () => {
// // // //       likeSound?.unloadAsync()
// // // //       commentSound?.unloadAsync()
// // // //       sendSound?.unloadAsync()
// // // //     }
// // // //   }, [])

// // // //   useEffect(() => {
// // // //     // If we have a postId but no post, fetch the post details
// // // //     if (postId && !initialPost) {
// // // //       fetchPostById(postId)
// // // //     } else if (initialPost) {
// // // //       // If we have a post, fetch the latest details
// // // //       fetchPostDetails()
// // // //       checkFollowingStatus()
// // // //     }
// // // //   }, [postId, initialPost])

// // // //   const playSound = async (sound: Audio.Sound | null) => {
// // // //     try {
// // // //       if (sound) {
// // // //         await sound.replayAsync()
// // // //       }
// // // //     } catch (error) {
// // // //       console.error("Error playing sound:", error)
// // // //     }
// // // //   }

// // // //   const fetchPostById = async (id: string) => {
// // // //     try {
// // // //       setLoading(true)
// // // //       setError(null)
// // // //       console.log("Fetching post by ID:", id)
// // // //       const response = await api.get(`/posts/${id}`)
// // // //       const fetchedPost = response.data.post

// // // //       if (!fetchedPost) {
// // // //         throw new Error("Post not found")
// // // //       }

// // // //       setPost(fetchedPost)
// // // //       checkFollowingStatus(fetchedPost.user._id)
// // // //     } catch (error) {
// // // //       console.error("Error fetching post by ID:", error)
// // // //       setError("Failed to load post. Please try again.")
// // // //     } finally {
// // // //       setLoading(false)
// // // //     }
// // // //   }

// // // //   const fetchPostDetails = async () => {
// // // //     if (!post) return

// // // //     try {
// // // //       setLoading(true)
// // // //       setError(null)
// // // //       const response = await api.get(`/posts/${post._id}`)
// // // //       setPost(response.data.post)
// // // //     } catch (error) {
// // // //       console.error("Error fetching post details:", error)
// // // //       setError("Failed to refresh post details")
// // // //     } finally {
// // // //       setLoading(false)
// // // //     }
// // // //   }

// // // //   const checkFollowingStatus = async (userId?: string) => {
// // // //     if (!post && !userId) return
// // // //     const postUserId = userId || post?.user._id

// // // //     if (postUserId === user?.id) return

// // // //     try {
// // // //       const response = await api.post(`/users/${postUserId}/is-following`, {
// // // //         followerId: user?.id,
// // // //       })
// // // //       setIsFollowing(response.data.isFollowing)
// // // //     } catch (error) {
// // // //       console.error("Error checking follow status:", error)
// // // //     }
// // // //   }

// // // //   const handleLike = async () => {
// // // //     if (!user || !token || !post) return

// // // //     try {
// // // //       await playSound(likeSound)

// // // //       const isLiked = post.likes.includes(user.id)
// // // //       setPost((prev) => {
// // // //         if (!prev) return prev
// // // //         return {
// // // //           ...prev,
// // // //           likes: isLiked ? prev.likes.filter((id) => id !== user.id) : [...prev.likes, user.id],
// // // //         }
// // // //       })

// // // //       await api.post(`/posts/${post._id}/like`, { userId: user.id })
// // // //     } catch (error) {
// // // //       console.error("Error liking post:", error)
// // // //       fetchPostDetails()
// // // //     }
// // // //   }

// // // //   const handleFollow = async () => {
// // // //     if (!user || !token || !post || post.user._id === user.id) return

// // // //     try {
// // // //       if (isFollowing) {
// // // //         await api.post(`/users/${post.user._id}/unfollow`, { followerId: user.id })
// // // //         setIsFollowing(false)
// // // //       } else {
// // // //         await api.post(`/users/${post.user._id}/follow`, { followerId: user.id })
// // // //         setIsFollowing(true)
// // // //       }
// // // //     } catch (error) {
// // // //       console.error("Error following/unfollowing user:", error)
// // // //       Alert.alert("Error", "Failed to update follow status")
// // // //     }
// // // //   }

// // // //   const handleComment = async () => {
// // // //     if (!commentText.trim() || !user || !post) return

// // // //     try {
// // // //       await playSound(commentSound)
// // // //       await playSound(sendSound)

// // // //       const response = await api.post(`/posts/${post._id}/comment`, {
// // // //         text: commentText.trim(),
// // // //       })

// // // //       setPost((prev) => {
// // // //         if (!prev) return prev
// // // //         return {
// // // //           ...prev,
// // // //           comments: [...prev.comments, response.data.comment],
// // // //         }
// // // //       })

// // // //       setCommentText("")
// // // //       commentInputRef.current?.blur()
// // // //     } catch (error) {
// // // //       console.error("Error adding comment:", error)
// // // //       Alert.alert("Error", "Failed to add comment")
// // // //     }
// // // //   }

// // // //   const handleReply = async (commentId: string) => {
// // // //     if (!replyText.trim() || !user || !post) return

// // // //     try {
// // // //       await playSound(commentSound)
// // // //       await playSound(sendSound)

// // // //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/reply`, {
// // // //         text: replyText.trim(),
// // // //       })

// // // //       setPost((prev) => {
// // // //         if (!prev) return prev
// // // //         return {
// // // //           ...prev,
// // // //           comments: prev.comments.map((comment) =>
// // // //             comment._id === commentId ? { ...comment, replies: [...comment.replies, response.data.reply] } : comment,
// // // //           ),
// // // //         }
// // // //       })

// // // //       setReplyText("")
// // // //       setReplyingTo(null)
// // // //       replyInputRef.current?.blur()
// // // //     } catch (error) {
// // // //       console.error("Error adding reply:", error)
// // // //       Alert.alert("Error", "Failed to add reply")
// // // //     }
// // // //   }

// // // //   const handleLikeComment = async (commentId: string) => {
// // // //     if (!user || !post) return

// // // //     try {
// // // //       await playSound(likeSound)

// // // //       const response = await api.post(`/posts/${post._id}/comments/${commentId}/like`)

// // // //       setPost((prev) => {
// // // //         if (!prev) return prev
// // // //         return {
// // // //           ...prev,
// // // //           comments: prev.comments.map((comment) =>
// // // //             comment._id === commentId ? { ...comment, likes: response.data.likes } : comment,
// // // //           ),
// // // //         }
// // // //       })
// // // //     } catch (error) {
// // // //       console.error("Error liking comment:", error)
// // // //     }
// // // //   }

// // // //   const handleHashtagPress = (hashtag: string) => {
// // // //     navigation.navigate("Search", {
// // // //       initialQuery: `#${hashtag}`,
// // // //       initialType: "hashtags",
// // // //       activeHashtag: hashtag,
// // // //     })
// // // //   }

// // // //   const handleChatWithUser = async () => {
// // // //     if (!user || !post || post.user._id === user.id) return

// // // //     try {
// // // //       await api.post(`/chats/${post.user._id}`, {
// // // //         message: `Hi! I'd like to connect with you.`,
// // // //       })

// // // //       Alert.alert("Success", `Message sent to @${post.user.username}!`, [
// // // //         {
// // // //           text: "Go to Chat",
// // // //           onPress: () => navigation.navigate("Chat"),
// // // //         },
// // // //         { text: "OK" },
// // // //       ])
// // // //     } catch (error) {
// // // //       console.error("Error creating chat:", error)
// // // //       Alert.alert("Error", "Failed to send message")
// // // //     }
// // // //   }

// // // //   const handleShare = async () => {
// // // //     if (!post) return

// // // //     try {
// // // //       const shareContent = {
// // // //         message: `${post.caption || "Check out this post!"} by @${post.user.username}`,
// // // //         url: post.images?.[0] || "",
// // // //       }
// // // //       await Share.share(shareContent)
// // // //       setShareModalVisible(false)
// // // //     } catch (error) {
// // // //       console.error("Error sharing post:", error)
// // // //     }
// // // //   }

// // // //   const handleShareComment = async (comment: Comment) => {
// // // //     if (!post) return

// // // //     try {
// // // //       const shareContent = {
// // // //         message: `"${comment.text}" - Comment by @${comment.user.username} on @${post.user.username}'s post`,
// // // //       }
// // // //       await Share.share(shareContent)
// // // //     } catch (error) {
// // // //       console.error("Error sharing comment:", error)
// // // //     }
// // // //   }

// // // //   const formatTimeAgo = (dateString: string) => {
// // // //     const now = new Date()
// // // //     const postDate = new Date(dateString)
// // // //     const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000)

// // // //     if (diffInSeconds < 60) return "now"
// // // //     if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
// // // //     if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
// // // //     if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`

// // // //     return postDate.toLocaleDateString()
// // // //   }

// // // //   const renderComment = ({ item: comment }: { item: Comment }) => {
// // // //     const isCommentLiked = user && comment.likes?.includes(user.id)

// // // //     return (
// // // //       <View style={styles.commentContainer}>
// // // //         <View style={styles.commentHeader}>
// // // //           <Image
// // // //             source={{
// // // //               uri: comment.user.profilePicture || "https://via.placeholder.com/32",
// // // //             }}
// // // //             style={styles.commentProfileImage}
// // // //           />
// // // //           <View style={styles.commentContent}>
// // // //             <View style={styles.commentUserInfo}>
// // // //               <Text style={[styles.commentUserName, { color: colors.text }]}>{comment.user.fullName}</Text>
// // // //               <Text style={[styles.commentUsername, { color: colors.placeholder }]}>@{comment.user.username}</Text>
// // // //               <Text style={[styles.commentTime, { color: colors.placeholder }]}>
// // // //                 · {formatTimeAgo(comment.createdAt)}
// // // //               </Text>
// // // //             </View>
// // // //             <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>

// // // //             {comment.image && <Image source={{ uri: comment.image }} style={styles.commentImage} />}

// // // //             <View style={styles.commentActions}>
// // // //               <TouchableOpacity
// // // //                 onPress={() => {
// // // //                   setReplyingTo(comment._id)
// // // //                   replyInputRef.current?.focus()
// // // //                 }}
// // // //                 style={styles.commentActionButton}
// // // //               >
// // // //                 <ReplyIcon size={16} color={colors.icon} />
// // // //                 <Text style={[styles.commentActionText, { color: colors.placeholder }]}>
// // // //                   {comment.replies?.length || 0}
// // // //                 </Text>
// // // //               </TouchableOpacity>

// // // //               <TouchableOpacity onPress={() => handleLikeComment(comment._id)} style={styles.commentActionButton}>
// // // //                 <ThumbsUp
// // // //                   size={16}
// // // //                   color={isCommentLiked ? "#E91E63" : colors.icon}
// // // //                   fill={isCommentLiked ? "#E91E63" : "none"}
// // // //                 />
// // // //                 <Text style={[styles.commentActionText, { color: colors.placeholder }]}>
// // // //                   {comment.likes?.length || 0}
// // // //                 </Text>
// // // //               </TouchableOpacity>

// // // //               <TouchableOpacity onPress={() => handleShareComment(comment)} style={styles.commentActionButton}>
// // // //                 <ShareIcon size={16} color={colors.icon} />
// // // //               </TouchableOpacity>
// // // //             </View>

// // // //             {comment.replies?.map((reply) => (
// // // //               <View key={reply._id} style={styles.replyContainer}>
// // // //                 <Image
// // // //                   source={{
// // // //                     uri: reply.user.profilePicture || "https://via.placeholder.com/24",
// // // //                   }}
// // // //                   style={styles.replyProfileImage}
// // // //                 />
// // // //                 <View style={styles.replyContent}>
// // // //                   <View style={styles.replyUserInfo}>
// // // //                     <Text style={[styles.replyUserName, { color: colors.text }]}>{reply.user.fullName}</Text>
// // // //                     <Text style={[styles.replyUsername, { color: colors.text }]}>@{reply.user.username}</Text>
// // // //                     <Text style={[styles.replyTime, { color: colors.text }]}>
// // // //                       · {formatTimeAgo(reply.createdAt)}
// // // //                     </Text>
// // // //                   </View>
// // // //                   <Text style={[styles.replyText, { color: colors.text }]}>{reply.text}</Text>
// // // //                 </View>
// // // //               </View>
// // // //             ))}
// // // //           </View>
// // // //         </View>
// // // //       </View>
// // // //     )
// // // //   }

// // // //   // If there's an error or we're still loading and don't have a post yet
// // // //   if ((loading && !post) || error) {
// // // //     return (
// // // //       <View
// // // //         style={[
// // // //           styles.container,
// // // //           { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
// // // //         ]}
// // // //       >
// // // //         <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

// // // //         <View
// // // //           style={[
// // // //             styles.header,
// // // //             {
// // // //               backgroundColor: colors.background,
// // // //               borderBottomColor: colors.border,
// // // //               position: "absolute",
// // // //               top: 0,
// // // //               left: 0,
// // // //               right: 0,
// // // //             },
// // // //           ]}
// // // //         >
// // // //           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
// // // //             <ArrowLeft size={24} color={colors.text} />
// // // //           </TouchableOpacity>
// // // //           <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
// // // //           <View style={styles.headerRight} />
// // // //         </View>

// // // //         {loading ? (
// // // //           <ActivityIndicator size="large" color={colors.primary} />
// // // //         ) : (
// // // //           <View style={styles.errorContainer}>
// // // //             <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
// // // //             <TouchableOpacity
// // // //               style={[styles.retryButton, { backgroundColor: colors.primary }]}
// // // //               onPress={() => (postId ? fetchPostById(postId) : navigation.goBack())}
// // // //             >
// // // //               <Text style={styles.retryButtonText}>Retry</Text>
// // // //             </TouchableOpacity>
// // // //           </View>
// // // //         )}
// // // //       </View>
// // // //     )
// // // //   }

// // // //   if (!post) {
// // // //     return null // This should never happen with our loading state, but TypeScript needs it
// // // //   }

// // // //   const isLiked = user && post.likes?.includes(user.id)
// // // //   const isOwnPost = user?.id === post.user._id

// // // //   return (
// // // //     <KeyboardAvoidingView
// // // //       style={[styles.container, { backgroundColor: colors.background }]}
// // // //       behavior={Platform.OS === "ios" ? "padding" : "height"}
// // // //       keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
// // // //     >
// // // //       <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

// // // //       <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
// // // //         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
// // // //           <ArrowLeft size={24} color={colors.text} />
// // // //         </TouchableOpacity>
// // // //         <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
// // // //         <View style={styles.headerRight} />
// // // //       </View>

// // // //       <ScrollView
// // // //         style={styles.content}
// // // //         showsVerticalScrollIndicator={false}
// // // //         contentContainerStyle={styles.scrollContent}
// // // //         keyboardShouldPersistTaps="handled"
// // // //       >
// // // //         <View style={styles.postHeader}>
// // // //           <TouchableOpacity
// // // //             onPress={() => navigation.navigate("UserProfile", { userId: post.user._id })}
// // // //             style={styles.userInfoContainer}
// // // //           >
// // // //             <Image
// // // //               source={{
// // // //                 uri: post.user.profilePicture || "https://via.placeholder.com/48",
// // // //               }}
// // // //               style={styles.profileImage}
// // // //             />
// // // //             <View style={styles.userInfo}>
// // // //               <Text style={[styles.fullName, { color: colors.text }]}>{post.user.fullName}</Text>
// // // //               <Text style={[styles.username, { color: colors.text }]}>@{post.user.username}</Text>
// // // //             </View>
// // // //           </TouchableOpacity>

// // // //           <View style={styles.headerActions}>
// // // //             {!isOwnPost && (
// // // //               <>
// // // //                 <TouchableOpacity
// // // //                   onPress={handleFollow}
// // // //                   style={[
// // // //                     styles.followButton,
// // // //                     {
// // // //                       backgroundColor: isFollowing ? colors.border : colors.primary,
// // // //                       borderColor: colors.primary,
// // // //                     },
// // // //                   ]}
// // // //                 >
// // // //                   {isFollowing ? <UserCheck size={12} color={colors.text} /> : <UserPlus size={12} color="white" />}
// // // //                   <Text style={[styles.followButtonText, { color: isFollowing ? colors.text : "white" }]}>
// // // //                     {isFollowing ? "Following" : "Follow"}
// // // //                   </Text>
// // // //                 </TouchableOpacity>

// // // //                  <TouchableOpacity 
// // // //                    onPress={handleChatWithUser}
// // // //                    style={[styles.chatButton, { borderColor: colors.primary }]}
// // // //                >
// // // //                    <MessageCircle size={12} color={colors.primary} /> 
// // // //                    <Text style={[styles.chatButtonText, { color: colors.primary }]}>Chat</Text> 
// // // //                  </TouchableOpacity> 
// // // //               </>
// // // //             )}

// // // //             <TouchableOpacity style={styles.moreButton}>
// // // //               <MoreHorizontal size={20} color={colors.icon} />
// // // //             </TouchableOpacity>
// // // //           </View>
// // // //         </View>

// // // //         {post.caption ? (
// // // //           <View style={styles.captionContainer}>
// // // //             <Text style={[styles.caption, { color: colors.text }]}>
// // // //               {post.caption.split(/(\s+)/).map((word, index) => {
// // // //                 if (word.startsWith("#")) {
// // // //                   const hashtag = word.substring(1)
// // // //                   const isActive = activeHashtag === hashtag
// // // //                   return (
// // // //                     <Text
// // // //                       key={index}
// // // //                       style={[
// // // //                         styles.hashtag,
// // // //                         {
// // // //                           color: isActive ? colors.primary : colors.hashtag,
// // // //                           backgroundColor: isActive ? colors.primary + "20" : "transparent",
// // // //                           paddingHorizontal: isActive ? 4 : 0,
// // // //                           borderRadius: isActive ? 4 : 0,
// // // //                         },
// // // //                       ]}
// // // //                       onPress={() => handleHashtagPress(hashtag)}
// // // //                     >
// // // //                       {word}
// // // //                     </Text>
// // // //                   )
// // // //                 }
// // // //                 return word
// // // //               })}
// // // //             </Text>
// // // //           </View>
// // // //         ) : null}

// // // //         {post.hashtags && post.hashtags.length > 0 && (
// // // //           <View style={styles.hashtagsContainer}>
// // // //             {post.hashtags.map((hashtag, index) => {
// // // //               const isActive = activeHashtag === hashtag
// // // //               return (
// // // //                 <TouchableOpacity
// // // //                   key={index}
// // // //                   onPress={() => handleHashtagPress(hashtag)}
// // // //                   style={[
// // // //                     styles.hashtagButton,
// // // //                     {
// // // //                       backgroundColor: isActive ? colors.primary : colors.primary + "20",
// // // //                       borderWidth: isActive ? 2 : 0,
// // // //                       borderColor: isActive ? colors.primary : "transparent",
// // // //                     },
// // // //                   ]}
// // // //                 >
// // // //                   <Hash size={12} color={isActive ? "white" : colors.primary} />
// // // //                   <Text style={[styles.hashtagText, { color: isActive ? "white" : colors.primary }]}>{hashtag}</Text>
// // // //                 </TouchableOpacity>
// // // //               )
// // // //             })}
// // // //           </View>
// // // //         )}

// // // //         {post.images?.[0] && <Image source={{ uri: post.images[0] }} style={styles.postImage} />}

// // // //         <Text style={[styles.timestamp, { color: colors.placeholder }]}>{formatTimeAgo(post.createdAt)}</Text>

// // // //         <View style={styles.actionsContainer}>
// // // //           <View style={styles.actionButtons}>
// // // //             <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
// // // //               <Heart size={24} color={isLiked ? "#E91E63" : colors.icon} fill={isLiked ? "#E91E63" : "none"} />
// // // //               <Text style={[styles.actionCount, { color: colors.text }]}>{post.likes?.length || 0}</Text>
// // // //             </TouchableOpacity>

// // // //             <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.actionButton}>
// // // //               <MessageCircle size={24} color={colors.icon} />
// // // //               <Text style={[styles.actionCount, { color: colors.text }]}>{post.comments?.length || 0}</Text>
// // // //             </TouchableOpacity>

// // // //             <TouchableOpacity onPress={() => setShareModalVisible(true)} style={styles.actionButton}>
// // // //               <ShareIcon size={24} color={colors.icon} />
// // // //             </TouchableOpacity>
// // // //           </View>

// // // //           <View style={styles.viewsContainer}>
// // // //             <Eye size={18} color={colors.placeholder} />
// // // //             <Text style={[styles.viewsText, { color: colors.placeholder }]}>{post.views || 0} views</Text>
// // // //           </View>
// // // //         </View>

// // // //         <View style={styles.commentsSection}>
// // // //           <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments ({post.comments?.length || 0})</Text>

// // // //           {post.comments?.map((comment) => (
// // // //             <View key={comment._id}>{renderComment({ item: comment })}</View>
// // // //           ))}
// // // //         </View>

// // // //         <View style={styles.bottomPadding} />
// // // //       </ScrollView>

// // // //       <View
// // // //         style={[
// // // //           styles.commentInputContainer,
// // // //           {
// // // //             backgroundColor: colors.card,
// // // //             borderTopColor: colors.border,
// // // //             paddingBottom: Platform.OS === "ios" ? 34 : 16,
// // // //           },
// // // //         ]}
// // // //       >
// // // //         {replyingTo && (
// // // //           <View style={[styles.replyingToContainer, { backgroundColor: colors.background }]}>
// // // //             <Text style={[styles.replyingToText, { color: colors.placeholder }]}>Replying to comment</Text>
// // // //             <TouchableOpacity onPress={() => setReplyingTo(null)}>
// // // //               <Text style={[styles.cancelReply, { color: colors.primary }]}>Cancel</Text>
// // // //             </TouchableOpacity>
// // // //           </View>
// // // //         )}

// // // //         <View style={styles.inputRow}>
// // // //           <Image
// // // //             source={{
// // // //               uri: user?.profilePicture || "https://via.placeholder.com/32",
// // // //             }}
// // // //             style={styles.inputProfileImage}
// // // //           />
// // // //           <TextInput
// // // //             ref={replyingTo ? replyInputRef : commentInputRef}
// // // //             style={[
// // // //               styles.textInput,
// // // //               {
// // // //                 color: colors.text,
// // // //                 borderColor: colors.border,
// // // //                 backgroundColor: colors.background,
// // // //               },
// // // //             ]}
// // // //             placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
// // // //             placeholderTextColor={colors.text}
// // // //             value={replyingTo ? replyText : commentText}
// // // //             onChangeText={replyingTo ? setReplyText : setCommentText}
// // // //             multiline
// // // //             maxLength={500}
// // // //             returnKeyType="default"
// // // //             blurOnSubmit={false}
// // // //           />
// // // //           <TouchableOpacity
// // // //             onPress={replyingTo ? () => handleReply(replyingTo) : handleComment}
// // // //             style={[
// // // //               styles.sendButton,
// // // //               {
// // // //                 backgroundColor: (replyingTo ? replyText : commentText).trim() ? colors.primary : colors.border,
// // // //               },
// // // //             ]}
// // // //             disabled={!(replyingTo ? replyText : commentText).trim()}
// // // //           >
// // // //             <Send size={18} color="white" />
// // // //           </TouchableOpacity>
// // // //         </View>
// // // //       </View>

// // // //       <Modal
// // // //         visible={shareModalVisible}
// // // //         transparent
// // // //         animationType="slide"
// // // //         onRequestClose={() => setShareModalVisible(false)}
// // // //       >
// // // //         <View style={styles.modalOverlay}>
// // // //           <View style={[styles.shareModal, { backgroundColor: colors.card }]}>
// // // //             <Text style={[styles.shareTitle, { color: colors.text }]}>Share Post</Text>

// // // //             <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
// // // //               <ShareIcon size={24} color={colors.text} />
// // // //               <Text style={[styles.shareOptionText, { color: colors.text }]}>Share via...</Text>
// // // //             </TouchableOpacity>

// // // //             <TouchableOpacity
// // // //               onPress={() => setShareModalVisible(false)}
// // // //               style={[styles.cancelButton, { borderColor: colors.border }]}
// // // //             >
// // // //               <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
// // // //             </TouchableOpacity>
// // // //           </View>
// // // //         </View>
// // // //       </Modal>

// // // //       {loading && (
// // // //         <View style={styles.loadingOverlay}>
// // // //           <ActivityIndicator size="large" color={colors.primary} />
// // // //         </View>
// // // //       )}
// // // //     </KeyboardAvoidingView>
// // // //   )
// // // // }

// // // // const styles = StyleSheet.create({
// // // //   container: {
// // // //     flex: 1,
// // // //     marginBottom: 116,
// // // //     paddingTop: 5
// // // //   },
// // // //   header: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     justifyContent: "space-between",
// // // //     paddingTop: StatusBar.currentHeight || 44,
// // // //     paddingHorizontal: 16,
// // // //     paddingBottom: 12,
// // // //     borderBottomWidth: 0.5,
// // // //   },
// // // //   backButton: {
// // // //     padding: 8,
// // // //     marginLeft: -8,
// // // //   },
// // // //   headerTitle: {
// // // //     fontSize: 18,
// // // //     fontWeight: "600",
// // // //   },
// // // //   headerRight: {
// // // //     width: 40,
// // // //   },
// // // //   content: {
// // // //     flex: 1,
// // // //   },
// // // //   scrollContent: {
// // // //     flexGrow: 1,
// // // //   },
// // // //   postHeader: {
// // // //     flexDirection: "row",
// // // //     alignItems: "flex-start",
// // // //     justifyContent: "space-between",
// // // //     padding: 12,
// // // //   },
// // // //   userInfoContainer: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     flex: 1,
// // // //   },
// // // //   profileImage: {
// // // //     width: 48,
// // // //     height: 48,
// // // //     borderRadius: 24,
// // // //     marginRight: 10,
// // // //   },
// // // //   userInfo: {
// // // //     flex: 1,
// // // //   },
// // // //   fullName: {
// // // //     fontSize: 14,
// // // //     fontWeight: "bold",
// // // //   },
// // // //   username: {
// // // //     fontSize: 12,
// // // //     marginTop: 1,
// // // //   },
// // // //   headerActions: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     gap: 8,
// // // //   },
// // // //   followButton: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     paddingHorizontal: 4,
// // // //     paddingVertical: 4,
// // // //     borderRadius: 20,
// // // //     borderWidth: 1,
// // // //     gap: 2,
// // // //   },
// // // //   followButtonText: {
// // // //     fontSize: 12,
// // // //     fontWeight: "600",
// // // //   },
// // // //   chatButton: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     paddingHorizontal: 6,
// // // //     paddingVertical: 4,
// // // //     borderRadius: 20,
// // // //     borderWidth: 0.5,
// // // //     gap: 1,
// // // //   },
// // // //   chatButtonText: {
// // // //     fontSize: 12,
// // // //     fontWeight: "600",
// // // //   },
// // // //   moreButton: {
// // // //     padding: 8,
// // // //   },
// // // //   captionContainer: {
// // // //     paddingHorizontal: 16,
// // // //     marginBottom: 16,
// // // //   },
// // // //   caption: {
// // // //     fontSize: 16,
// // // //     lineHeight: 22,
// // // //   },
// // // //   hashtag: {
// // // //     fontWeight: "bold",
// // // //   },
// // // //   hashtagsContainer: {
// // // //     flexDirection: "row",
// // // //     flexWrap: "wrap",
// // // //     paddingHorizontal: 16,
// // // //     marginBottom: 16,
// // // //   },
// // // //   hashtagButton: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     paddingHorizontal: 10,
// // // //     paddingVertical: 5,
// // // //     borderRadius: 15,
// // // //     marginRight: 10,
// // // //     marginBottom: 10,
// // // //   },
// // // //   hashtagText: {
// // // //     fontSize: 12,
// // // //     marginLeft: 4,
// // // //   },
// // // //   postImage: {
// // // //     width: "100%",
// // // //     height: 400,
// // // //     marginBottom: 16,
// // // //   },
// // // //   timestamp: {
// // // //     fontSize: 14,
// // // //     paddingHorizontal: 16,
// // // //     marginBottom: 16,
// // // //   },
// // // //   actionsContainer: {
// // // //     flexDirection: "row",
// // // //     justifyContent: "space-between",
// // // //     alignItems: "center",
// // // //     paddingHorizontal: 16,
// // // //     paddingVertical: 12,
// // // //     borderTopWidth: 0.5,
// // // //     borderBottomWidth: 0.5,
// // // //     borderColor: "#E1E8ED",
// // // //   },
// // // //   actionButtons: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     gap: 32,
// // // //   },
// // // //   actionButton: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     gap: 8,
// // // //   },
// // // //   actionCount: {
// // // //     fontSize: 14,
// // // //     fontWeight: "600",
// // // //   },
// // // //   viewsContainer: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     gap: 4,
// // // //   },
// // // //   viewsText: {
// // // //     fontSize: 14,
// // // //   },
// // // //   commentsSection: {
// // // //     padding: 16,
// // // //   },
// // // //   commentsTitle: {
// // // //     fontSize: 18,
// // // //     fontWeight: "bold",
// // // //     marginBottom: 16,
// // // //   },
// // // //   commentContainer: {
// // // //     marginBottom: 16,
// // // //   },
// // // //   commentHeader: {
// // // //     flexDirection: "row",
// // // //     alignItems: "flex-start",
// // // //   },
// // // //   commentProfileImage: {
// // // //     width: 32,
// // // //     height: 32,
// // // //     borderRadius: 16,
// // // //     marginRight: 12,
// // // //   },
// // // //   commentContent: {
// // // //     flex: 1,
// // // //   },
// // // //   commentUserInfo: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     marginBottom: 4,
// // // //   },
// // // //   commentUserName: {
// // // //     fontSize: 14,
// // // //     fontWeight: "600",
// // // //     marginRight: 4,
// // // //   },
// // // //   commentUsername: {
// // // //     fontSize: 14,
// // // //     marginRight: 4,
// // // //   },
// // // //   commentTime: {
// // // //     fontSize: 14,
// // // //   },
// // // //   commentText: {
// // // //     fontSize: 14,
// // // //     lineHeight: 18,
// // // //     marginBottom: 8,
// // // //   },
// // // //   commentImage: {
// // // //     width: "100%",
// // // //     height: 200,
// // // //     borderRadius: 8,
// // // //     marginBottom: 8,
// // // //   },
// // // //   commentActions: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     gap: 16,
// // // //   },
// // // //   commentActionButton: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     gap: 4,
// // // //   },
// // // //   commentActionText: {
// // // //     fontSize: 12,
// // // //   },
// // // //   replyContainer: {
// // // //     flexDirection: "row",
// // // //     alignItems: "flex-start",
// // // //     marginTop: 12,
// // // //     marginLeft: 16,
// // // //   },
// // // //   replyProfileImage: {
// // // //     width: 24,
// // // //     height: 24,
// // // //     borderRadius: 12,
// // // //     marginRight: 8,
// // // //   },
// // // //   replyContent: {
// // // //     flex: 1,
// // // //   },
// // // //   replyUserInfo: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     marginBottom: 2,
// // // //   },
// // // //   replyUserName: {
// // // //     fontSize: 12,
// // // //     fontWeight: "600",
// // // //     marginRight: 4,
// // // //   },
// // // //   replyUsername: {
// // // //     fontSize: 12,
// // // //     marginRight: 4,
// // // //   },
// // // //   replyTime: {
// // // //     fontSize: 12,
// // // //   },
// // // //   replyText: {
// // // //     fontSize: 12,
// // // //     lineHeight: 16,
// // // //   },
// // // //   bottomPadding: {
// // // //     height: 100,
// // // //   },
// // // //   commentInputContainer: {
// // // //     borderTopWidth: 0.5,
// // // //     paddingHorizontal: 16,
// // // //     paddingTop: 16,
// // // //     position: "absolute",
// // // //     bottom: 0,
// // // //     left: 0,
// // // //     right: 0,
// // // //     zIndex: 1000,
// // // //   },
// // // //   replyingToContainer: {
// // // //     flexDirection: "row",
// // // //     justifyContent: "space-between",
// // // //     alignItems: "center",
// // // //     paddingVertical: 8,
// // // //     paddingHorizontal: 12,
// // // //     borderRadius: 8,
// // // //     marginBottom: 8,
// // // //   },
// // // //   replyingToText: {
// // // //     fontSize: 12,
// // // //   },
// // // //   cancelReply: {
// // // //     fontSize: 12,
// // // //     fontWeight: "600",
// // // //   },
// // // //   inputRow: {
// // // //     flexDirection: "row",
// // // //     alignItems: "flex-end",
// // // //     gap: 12,
// // // //   },
// // // //   inputProfileImage: {
// // // //     width: 32,
// // // //     height: 32,
// // // //     borderRadius: 16,
// // // //   },
// // // //   textInput: {
// // // //     flex: 1,
// // // //     borderWidth: 1,
// // // //     borderRadius: 20,
// // // //     paddingHorizontal: 16,
// // // //     paddingVertical: 12,
// // // //     maxHeight: 100,
// // // //     fontSize: 14,
// // // //     minHeight: 40,
// // // //   },
// // // //   sendButton: {
// // // //     width: 40,
// // // //     height: 40,
// // // //     borderRadius: 20,
// // // //     justifyContent: "center",
// // // //     alignItems: "center",
// // // //   },
// // // //   modalOverlay: {
// // // //     flex: 1,
// // // //     backgroundColor: "rgba(0, 0, 0, 0.5)",
// // // //     justifyContent: "flex-end",
// // // //   },
// // // //   shareModal: {
// // // //     borderTopLeftRadius: 20,
// // // //     borderTopRightRadius: 20,
// // // //     padding: 24,
// // // //   },
// // // //   shareTitle: {
// // // //     fontSize: 18,
// // // //     fontWeight: "bold",
// // // //     marginBottom: 20,
// // // //     textAlign: "center",
// // // //   },
// // // //   shareOption: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     paddingVertical: 16,
// // // //     gap: 16,
// // // //   },
// // // //   shareOptionText: {
// // // //     fontSize: 16,
// // // //   },
// // // //   cancelButton: {
// // // //     borderWidth: 1,
// // // //     borderRadius: 12,
// // // //     paddingVertical: 12,
// // // //     marginTop: 16,
// // // //   },
// // // //   cancelButtonText: {
// // // //     fontSize: 16,
// // // //     textAlign: "center",
// // // //   },
// // // //   loadingOverlay: {
// // // //     position: "absolute",
// // // //     top: 0,
// // // //     left: 0,
// // // //     right: 0,
// // // //     bottom: 0,
// // // //     backgroundColor: "rgba(0, 0, 0, 0.3)",
// // // //     justifyContent: "center",
// // // //     alignItems: "center",
// // // //   },
// // // //   errorContainer: {
// // // //     padding: 20,
// // // //     alignItems: "center",
// // // //   },
// // // //   errorText: {
// // // //     fontSize: 16,
// // // //     textAlign: "center",
// // // //     marginBottom: 20,
// // // //   },
// // // //   retryButton: {
// // // //     paddingVertical: 10,
// // // //     paddingHorizontal: 20,
// // // //     borderRadius: 8,
// // // //   },
// // // //   retryButtonText: {
// // // //     color: "white",
// // // //     fontWeight: "600",
// // // //   },
// // // // })

// // // // export default PostView

