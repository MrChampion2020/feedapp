
import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
  StatusBar,
  Share,
  Pressable,
  Animated,
  FlatList,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import VerifiedBadge from "../../components/VerifiedBadge"
import { getUserVerificationStatus } from "../../utils/userUtils"
import { Ionicons } from "@expo/vector-icons"
import ImagePickerModal from "../../components/ImagePickerModal"
import type { NativeStackNavigationProp, RouteProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../types/navigation"

type UserProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "UserProfile">
type UserProfileScreenRouteProp = RouteProp<RootStackParamList, "UserProfile">

interface UserProfile {
  _id: string
  username: string
  fullName: string
  email: string
  profilePicture?: string
  bio: string
  followers: any[]
  following: any[]
  posts: any[]
  isVerified: boolean
  createdAt: string
}

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
  createdAt: string
}

const UserProfileScreen: React.FC = () => {
  const navigation = useNavigation<UserProfileScreenNavigationProp>()
  const route = useRoute<UserProfileScreenRouteProp>()
  const { userId } = route.params
  const { user: currentUser, token } = useAuth()
  const { colors } = useTheme()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userPosts, setUserPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({})
  const [isFollowing, setIsFollowing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<"posts" | "followers" | "following">("posts")
  const [showImagePicker, setShowImagePicker] = useState(false)

  const isOwnProfile = currentUser?.id === userId

  useEffect(() => {
    fetchProfile()
    fetchUserPosts()
    if (!isOwnProfile) {
      checkFollowStatus()
    }
  }, [userId, token])

  const fetchProfile = async () => {
    try {
      const response = await api.get(`/users/${userId}`)
      if (response.status === 200) {
        setProfile(response.data.user)
        setEditedProfile(response.data.user)
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const fetchUserPosts = async () => {
    try {
      const response = await api.get(`/posts?userId=${userId}`)
      if (response.status === 200) {
        setUserPosts(response.data.posts || [])
      }
    } catch (error) {
    }
  }

  const checkFollowStatus = async () => {
    try {
      const response = await api.post(`/users/${userId}/is-following`, {
        followerId: currentUser?.id,
      })
      setIsFollowing(response.data.isFollowing)
    } catch (error) {
    }
  }

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.post(`/users/${userId}/unfollow`, { followerId: currentUser?.id })
        setIsFollowing(false)
      } else {
        await api.post(`/users/${userId}/follow`, { followerId: currentUser?.id })
        setIsFollowing(true)
      }
      fetchProfile() // Refresh to update follower count
    } catch (error) {
      Alert.alert("Error", "Failed to update follow status")
    }
  }

  const handleImageSelected = (imageUri: string) => {
    uploadProfileImage(imageUri)
  }

  const uploadProfileImage = async (imageUri: string) => {
    try {
      setUploading(true)

      const formData = new FormData()
      formData.append("profileImage", {
        uri: imageUri,
        type: "image/jpeg",
        name: "profile.jpg",
      } as any)

      const response = await api.put("/users/update-profile-image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      if (response.status === 200) {
        setProfile((prev) => (prev ? { ...prev, profilePicture: response.data.profilePicture } : null))
        Alert.alert("Success", "Profile image updated successfully!")
      }
    } catch (error) {
      Alert.alert("Error", "Failed to upload profile image")
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      const response = await api.put("/users/update", {
        userId: userId,
        fullName: editedProfile.fullName,
        bio: editedProfile.bio,
      })

      if (response.status === 200) {
        setProfile((prev) => (prev ? { ...prev, ...editedProfile } : null))
        setIsEditing(false)
        Alert.alert("Success", "Profile updated successfully!")
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update profile")
    }
  }

  const handlePostPress = (post: Post) => {
    navigation.navigate("HomeTab", {
      screen: "PostView",
      params: { post },
    })
  }

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity style={styles.postItem} onPress={() => handlePostPress(item)}>
      <Image source={{ uri: item.images[0] || "/placeholder.svg?height=150&width=150" }} style={styles.postImage} />
      <View style={styles.postOverlay}>
        <View style={styles.postStats}>
          <Ionicons name="heart" size={16} color="white" />
          <Text style={styles.postStatText}>{item.likes.length}</Text>
          <Ionicons name="chatbubble" size={16} color="white" style={{ marginLeft: 10 }} />
          <Text style={styles.postStatText}>{item.comments.length}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderFollowItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.followItem} onPress={() => navigation.navigate("Profile", { userId: item._id })}>
      <Image
        source={{ uri: item.profilePicture || "/placeholder.svg?height=50&width=50" }}
        style={styles.followAvatar}
      />
      <View style={styles.followInfo}>
        <Text style={[styles.followUsername, { color: colors.text }]}>{item.username}</Text>
        <Text style={[styles.followFullName, { color: colors.text }]}>{item.fullName}</Text>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
        </View>
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Profile not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{profile.username}</Text>
          {isOwnProfile && (
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Ionicons name={isEditing ? "close" : "create-outline"} size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{ uri: profile.profilePicture || "/placeholder.svg?height=120&width=120" }}
              style={styles.profileImage}
            />
            {isOwnProfile && (
              <TouchableOpacity
                style={[styles.editImageButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowImagePicker(true)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={16} color="white" />
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.profileInfo}>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={[styles.editInput, { color: colors.text, borderColor: colors.border }]}
                  value={editedProfile.fullName || ""}
                  onChangeText={(text) => setEditedProfile((prev) => ({ ...prev, fullName: text }))}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[styles.editInput, styles.bioInput, { color: colors.text, borderColor: colors.border }]}
                  value={editedProfile.bio || ""}
                  onChangeText={(text) => setEditedProfile((prev) => ({ ...prev, bio: text }))}
                  placeholder="Bio"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSaveProfile}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => {
                      setIsEditing(false)
                      setEditedProfile(profile)
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.profileNameRow}>
                  <Text style={[styles.fullName, { color: colors.text }]}>{profile.fullName}</Text>
                  {(() => {
                    const { isVerified, isPremiumVerified } = getUserVerificationStatus(profile._id)
                                            return <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={10} />
                  })()}
                </View>
                <Text style={[styles.username, { color: colors.text }]}>@{profile.username}</Text>
                {profile.bio && <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text>}
                <Text style={[styles.joinDate, { color: colors.text }]}>
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem} onPress={() => setActiveTab("posts")}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{profile.posts.length}</Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={() => setActiveTab("followers")}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{profile.followers.length}</Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={() => setActiveTab("following")}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{profile.following.length}</Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Follow Button */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing ? colors.background : colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={handleFollow}
          >
            <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : "white" }]}>
              {isFollowing ? "Unfollow" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Content Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "posts" && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab("posts")}
          >
            <Text style={[styles.tabText, { color: activeTab === "posts" ? colors.primary : colors.text }]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "followers" && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab("followers")}
          >
            <Text style={[styles.tabText, { color: activeTab === "followers" ? colors.primary : colors.text }]}>
              Followers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "following" && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab("following")}
          >
            <Text style={[styles.tabText, { color: activeTab === "following" ? colors.primary : colors.text }]}>
              Following
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {activeTab === "posts" && (
            <FlatList
              data={userPosts}
              renderItem={renderPost}
              keyExtractor={(item) => item._id}
              numColumns={3}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
                </View>
              }
            />
          )}
          {activeTab === "followers" && (
            <FlatList
              data={profile.followers}
              renderItem={renderFollowItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No followers yet</Text>
                </View>
              }
            />
          )}
          {activeTab === "following" && (
            <FlatList
              data={profile.following}
              renderItem={renderFollowItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Not following anyone yet</Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onImageSelected={handleImageSelected}
        title="Update Profile Picture"
        allowsEditing={true}
        aspect={[1, 1]}
        quality={0.8}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
    marginBottom: 80,
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
    padding: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  profileSection: {
    flexDirection: "row",
    padding: 20,
    alignItems: "flex-start",
  },
  profileImageContainer: {
    position: "relative",
    marginRight: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  fullName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  joinDate: {
    fontSize: 14,
  },
  editContainer: {
    width: "100%",
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  bioInput: {
    height: 80,
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    gap: 10,
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelButtonText: {
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  followButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  followButtonText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
  },
  contentContainer: {
    padding: 10,
  },
  postItem: {
    flex: 1,
    margin: 2,
    aspectRatio: 1,
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  postOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0,
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  postStatText: {
    color: "white",
    marginLeft: 4,
    fontWeight: "bold",
  },
  followItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  followAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  followInfo: {
    flex: 1,
  },
  followUsername: {
    fontSize: 16,
    fontWeight: "bold",
  },
  followFullName: {
    fontSize: 14,
    opacity: 0.7,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
})

export default UserProfileScreen


