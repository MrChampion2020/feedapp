import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RootStackParamList } from "../../types/navigation";
import { ArrowLeft } from "lucide-react-native";
import VerifiedBadge from "../../components/VerifiedBadge";
import { getUserVerificationStatus } from "../../utils/userUtils";
import ChatRoom from "../../components/chat/ChatRoom";
import { ChatItem } from "../../types/ChatItem";

type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">;

const getEmojiFromName = (name: string) => {
  const firstLetter = name.charAt(0).toUpperCase();
  const emojiMap: { [key: string]: string } = {
    A: "😀", B: "😂", C: "😊", D: "👍", E: "❤️", F: "😎", G: "🎉", H: "🌟", I: "🌈",
    J: "💡", K: "🔥", L: "🌹", M: "🎶", N: "🌍", O: "🚀", P: "💕", Q: "🌺", R: "🎵",
    S: "🌞", T: "🍎", U: "🌴", V: "🐱", W: "🐶", X: "🐼", Y: "🐰", Z: "🐸",
  };
  return emojiMap[firstLetter] || "👤";
};

const ChatScreen = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { user, token, api } = useAuth();
  const { colors } = useTheme();
  
  // State management
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch chats with error handling
  const fetchChats = async () => {
    if (!token) {
      console.log("No token available for fetching chats");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("📱 Fetching chats...");
      
      const response = await api.get("/chats");
      
      console.log("📱 Chats response:", response.status);
      
      const { chats: chatData } = response.data;
      
      // Validate response data
      if (!response.data || !Array.isArray(chatData)) {
        console.error("Invalid chat data format:", response.data);
        setChats([]);
        setError("Invalid response format");
        return;
      }
      
      // Handle case where user has no chats yet
      if (chatData.length === 0) {
        console.log("📱 User has no chats yet");
        setChats([]);
        return;
      }
      
      // Safely process chat data
      const sortedChats = chatData
        .filter((chat: any) => chat && typeof chat === 'object')
        .map((chat: any): ChatItem | null => {
          try {
            return {
              id: chat.id || chat._id || '',
              name: chat.name || chat.username || 'Unknown User',
              fullName: chat.fullName || chat.name || 'Unknown User',
              lastMessage: chat.lastMessage || "No messages yet",
              lastMessageTime: chat.lastMessageTime || new Date().toISOString(),
              unreadCount: chat.unreadCount || 0,
              avatar: chat.avatar || getEmojiFromName(chat.name || 'Unknown User'),
            };
          } catch (error) {
            console.error("Error processing chat item:", error, chat);
            return null;
          }
        })
        .filter((chat): chat is ChatItem => chat !== null)
        .sort((a: any, b: any) => {
          try {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          } catch (error) {
            console.error("Error sorting chats:", error);
            return 0;
          }
        });
      
      console.log("📱 Processed chats:", sortedChats.length);
      setChats(sortedChats);
    } catch (error: any) {
      console.error("📱 Fetch chats error:", error);
      setError(error.response?.data?.message || error.message || "Failed to load chats");
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    if (token) {
      fetchChats();
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      const timer = setTimeout(() => {
        fetchChats();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, token]);

  // Handler for going back to chat list
  const handleBack = () => {
    setActiveChat(null);
  };

  // Handler for chat change
  const handleChatChange = (chat: ChatItem | null) => {
    setActiveChat(chat);
  };

  // Render chat item
  const renderChatItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: colors.background }]}
      onPress={() => setActiveChat(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.avatar, { backgroundColor: item.avatar.startsWith("http") ? "transparent" : colors.icon }]}>
        {item.avatar.startsWith("http") ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        ) : (
          <Text style={[styles.emojiText, { color: colors.text }]}>{getEmojiFromName(item.name)}</Text>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatNameRow}>
          <Text style={[styles.chatName, { color: colors.text }]}>{item.fullName || item.name}</Text>
          <VerifiedBadge size={20} />
        </View>
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
  );

  // Error display component
  const ErrorDisplay = () => {
    if (!error) return null;
    
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.error || '#ff6b6b' }]}>
        <Text style={[styles.errorText, { color: '#fff' }]} numberOfLines={2}>
          {error}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            if (token) fetchChats();
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Loading overlay
  const LoadingOverlay = () => {
    if (!loading) return null;
    
    return (
      <View style={[styles.loadingOverlay, { backgroundColor: "rgba(0,0,0,0.1)" }]}>
        <ActivityIndicator size="large" color={colors.chatroom.text} />
      </View>
    );
  };

  if (!user || !token) {
    return (
      <View style={styles.authRequiredContainer}>
        <Text style={[styles.authRequiredText, { color: colors.text }]}>
          Please log in to access the chat.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.chatroom.background, paddingTop: Platform.OS === 'ios' ? 32 : 0 }]}>
      <ErrorDisplay />
      <LoadingOverlay />
      
      {!activeChat ? (
        <>
          <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backButton, { backgroundColor: colors.iconBackBg }]}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft color={colors.iconBack} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
            <View style={styles.headerRight} />
          </View>
          
          <FlatList
            data={chats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
            refreshing={loading}
            onRefresh={fetchChats}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No conversations yet. Start chatting with someone!
                </Text>
                {!loading && chats.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.grey, fontSize: 14, marginTop: 10 }]}>
                    Start a conversation by following someone or commenting on their posts!
                  </Text>
                )}
              </View>
            }
            showsVerticalScrollIndicator={true}
          />
        </>
      ) : (
        <ChatRoom
          activeChat={activeChat}
          onBack={handleBack}
          onChatChange={handleChatChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  chatNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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
  errorContainer: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  authRequiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authRequiredText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ChatScreen;



