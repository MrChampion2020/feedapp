import type React from "react"
import { useState, useCallback } from "react"
import {
  View,
  FlatList,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  StyleSheet,
} from "react-native"
import { useAuth, api } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import VerifiedBadge from "../../components/VerifiedBadge"
import { getUserVerificationStatus } from "../../utils/userUtils"
import { useFocusEffect } from "@react-navigation/native"
import { ArrowLeft, Heart, MessageCircle, UserPlus, Mail, LogIn, Gift } from "lucide-react-native"

interface Notification {
  _id: string
  sender: {
    _id: string
    username: string
    fullName: string
    profilePicture?: string
  }
  type: "like" | "comment" | "follow" | "message" | "welcome" | "login"
  message: string
  postId?: {
    _id: string
    images: string[]
    caption: string
  }
  isRead: boolean
  createdAt: string
}

interface NotificationScreenProps {
  navigation: any
}

const NotificationScreen: React.FC<NotificationScreenProps> = ({ navigation }) => {
  const { user, token } = useAuth()
  const { colors, theme } = useTheme()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchNotifications = async (pageNum = 1, isRefresh = false) => {
    try {
      if (pageNum === 1) {
        isRefresh ? setRefreshing(true) : setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const response = await api.get(`/notifications?page=${pageNum}&limit=20`)
      const { notifications: newNotifications, pagination } = response.data

      if (pageNum === 1) {
        setNotifications(newNotifications)
      } else {
        setNotifications((prev) => [...prev, ...newNotifications])
      }

      setHasMore(pagination?.hasNext || false)
      setPage(pageNum)
    } catch (error) {
      // console.error("Error fetching notifications:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchNotifications(1)
      }
    }, [token]),
  )

  const handleRefresh = () => {
    fetchNotifications(1, true)
  }

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(page + 1)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`)
      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === notificationId ? { ...notification, isRead: true } : notification,
        ),
      )
    } catch (error) {
      // console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put("/notifications/read-all")
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })))
    } catch (error) {
      // console.error("Error marking all notifications as read:", error)
    }
  }

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id)
    }

    switch (notification.type) {
      case "like":
      case "comment":
        if (notification.postId) {
          // Pass postId instead of post object - the PostView will fetch the full post
          navigation.navigate("PostView", { postId: notification.postId._id })
        }
        break
      case "follow":
        navigation.navigate("UserProfile", { userId: notification.sender._id })
        break
      case "message":
        navigation.navigate("Chat", { userId: notification.sender._id })
        break
      default:
        break
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart size={20} color="#E91E63" fill="#E91E63" />
      case "comment":
        return <MessageCircle size={20} color="#1DA1F2" />
      case "follow":
        return <UserPlus size={20} color="#10B981" />
      case "message":
        return <Mail size={20} color="blue" />
      case "login":
        return <LogIn size={20} color="#F59E0B" />
      case "welcome":
        return <Gift size={20} color="#EF4444" />
      default:
        return <MessageCircle size={20} color={colors.icon} />
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

  const renderNotification = ({ item }: { item: Notification }) => {
    return (
      <TouchableOpacity
        style={[
          styles.notificationContainer,
          {
            backgroundColor: item.isRead ? colors.card : colors.background,
            borderLeftColor: item.isRead ? "transparent" : colors.primary,
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationIcon}>{getNotificationIcon(item.type)}</View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            {item.sender && (
              <Image
                source={{
                  uri: item.sender.profilePicture || "https://via.placeholder.com/32",
                }}
                style={styles.senderImage}
              />
            )}
            <View style={styles.notificationText}>
              <View style={styles.notificationSenderRow}>
                <Text style={[styles.senderName, { color: colors.text }]}>{item.sender?.fullName || item.sender?.username}</Text>
                {(() => {
                  const { isVerified, isPremiumVerified } = getUserVerificationStatus(item.sender?._id || "")
                                          return <VerifiedBadge isVerified={isVerified} isPremiumVerified={isPremiumVerified} size={10} />
                })()}
              </View>
              <Text style={[styles.notificationMessage, { color: colors.text }]}>{item.message}</Text>
              <Text style={[styles.notificationTime, { color: colors.text }]}>
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>
          </View>

          {item.postId && item.postId.images?.[0] && (
            <Image source={{ uri: item.postId.images[0] }} style={styles.postThumbnail} />
          )}
        </View>

        {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
      </TouchableOpacity>
    )
  }

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
          <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
        </TouchableOpacity>
      </View>
    </View>
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
      <Text style={[styles.emptyText, { color: colors.text }]}>No notifications yet</Text>
      <Text style={[styles.emptySubtext, { color: colors.text }]}>
        When someone likes, comments, or follows you, you'll see it here
      </Text>
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading notifications...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
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
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 115.5
  },
  header: {
    paddingTop: StatusBar.currentHeight || 2,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.3,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  list: {
    flexGrow: 1,
  },
  notificationContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderLeftWidth: 3,
    borderBottomWidth: 0.3,
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 4,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  senderImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationSenderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 2,
  },
  senderName: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  postThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginTop: 8,
    marginLeft: 44,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
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
  loadingMore: {
    padding: 20,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
})

export default NotificationScreen

