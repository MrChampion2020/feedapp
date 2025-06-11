
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
} from "lucide-react-native"
import { useNavigation } from "@react-navigation/native"
import { Audio } from "expo-av"
const { width: screenWidth } = Dimensions.get("window")

interface SearchResult {
  users: any[]
  posts: any[]
  hashtags: any[]
  total: number
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

const SearchScreen: React.FC<SearchScreenProps> = ({ route }) => {
  const navigation = useNavigation()
  const { user } = useAuth()
  const { colors, theme } = useTheme()

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

  const searchInputRef = useRef<TextInput>(null)
  const searchTimeout = useRef<NodeJS.Timeout>()

  useEffect(() => {
    fetchTrendingHashtags()
    fetchSearchHistory()

    if (route?.params?.initialQuery) {
      performSearch(route.params.initialQuery, route?.params?.initialType || "all")
      if (route?.params?.activeHashtag) {
        setActiveHashtag(route.params.activeHashtag)
      }
    }
  }, [])

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
      setResults(response.data.results)
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
    navigation.navigate("UserProfile", { userId })
  }

  const handlePostPress = (post: any) => {
    navigation.navigate("PostView", { post, activeHashtag })
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

    return date.toLocaleDateString()
  }

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

  const fetchHashtagPosts = async (hashtag) => {
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
        keyExtractor={(item, index) => `trending-${index}`}
        renderItem={({ item, index }) => {
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
          data={searchHistory.slice(0, 10)}
          keyExtractor={(item, index) => `${item.query}-${item.type}-${index}`}
          renderItem={({ item }) => (
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
          {item.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
        </View>
        <Text style={[styles.userUsername, { color: colors.text }]}>@{item.username}</Text>
        <Text style={[styles.userStats, { color: colors.text }]}>
          {item.followersCount} followers • {item.followingCount} following
        </Text>
      </View>
    </TouchableOpacity>
  )

  const renderPostResult = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.postContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={() => handlePostPress(item)}
      activeOpacity={0.95}
    >
      <View style={styles.postHeader}>
        <TouchableOpacity
          onPress={() => navigation.navigate("UserProfile", { userId: item.user._id })}
          style={styles.userInfoContainer}
        >
          <Image
            source={{ uri: item.user.profilePicture || "https://via.placeholder.com/40" }}
            style={styles.profileImage}
          />
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={[styles.fullName, { color: colors.text, paddingLeft: 8}]}>{item.user.fullName}</Text>
              <Text style={[styles.username, { color: colors.text }]}>@{item.user.username}</Text>
              <Text style={[styles.timestamp, { color: colors.text }]}>·</Text>
              <Text style={[styles.timestamp, { color: colors.text }]}>{formatTimeAgo(item.createdAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {item.caption && (
        <View style={styles.captionContainer}>
          <Text style={[styles.caption, { color: colors.text }]}>
            {item.caption.split(/(\s+)/).map((word, index) => {
              if (word.startsWith("#")) {
                return (
                  <Text
                    key={index}
                    style={[styles.hashtag, { color: colors.primary }]}
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
      )}

      {item.images && item.images.length > 0 && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.images[0] }} style={styles.postImage} />
        </View>
      )}

      <View style={styles.actionsContainer}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              handlePostPress(item)
            }}
            style={styles.actionButton}
          >
            <MessageCircle size={20} color={colors.icon} />
            <Text style={[styles.actionCount, { color: colors.text }]}>{item.comments?.length || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              // Handle like functionality here
            }}
            style={styles.actionButton}
          >
            <Heart size={20} color={colors.icon} />
            <Text style={[styles.actionCount, { color: colors.text }]}>{item.likes?.length || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              // Handle share functionality here
            }}
            style={styles.actionButton}
          >
            <ShareIcon size={20} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <View style={styles.viewsContainer}>
          <Eye size={16} color={colors.text} />
          <Text style={[styles.viewsText, { color: colors.text }]}>{item.views || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

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
      ...results.users.map((user) => ({ ...user, type: "user" })),
      ...results.posts.map((post) => ({ ...post, type: "post" })),
      ...results.hashtags.map((hashtag) => ({ ...hashtag, type: "hashtag" })),
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
      />
    )
  }

  const renderTrendingContent = () => {
    // If we have an active hashtag and posts, show the posts feed
    if (activeHashtag && trendingPosts.length > 0) {
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
              {trendingPosts.length} posts
            </Text>
          </View>

          {loadingTrending ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>Loading posts...</Text>
            </View>
          ) : (
            <FlatList
              data={trendingPosts}
              keyExtractor={(item) => item._id}
              renderItem={renderPostResult}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.hashtagFeedList}
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
          data={trendingHashtags}
          keyExtractor={(item, index) => `trending-${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.trendingItem, { borderBottomColor: colors.border }]}
              onPress={() => fetchHashtagPosts(item.hashtag)}
            >
              <View style={styles.trendingRank}>
                <Text style={[styles.rankNumber, { color: colors.primary }]}>{index + 1}</Text>
              </View>

              <View style={styles.trendingInfo}>
                <Text style={[styles.trendingHashtagText, { color: colors.text }]}>#{item.hashtag}</Text>
                <Text style={[styles.trendingStats, { color: colors.text }]}>{item.count} posts</Text>
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
    paddingTop: 20,
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
    fontSize: 16,
    fontWeight: "bold",
  },
  verifiedBadge: {
    fontSize: 12,
    color: "#1DA1F2",
    marginLeft: 5,
  },
  userUsername: {
    fontSize: 14,
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
})

export default SearchScreen

