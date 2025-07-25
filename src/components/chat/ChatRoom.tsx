import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ImageBackground,
  Alert,
  Image,
  Clipboard,
  ToastAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ArrowLeft, UserPlus, UserCheck, Reply, Share2, Trash2 } from 'lucide-react-native';
import VerifiedBadge from '../VerifiedBadge';
import { getUserVerificationStatus } from '../../utils/userUtils';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import ChatHeader from './ChatHeader';
import ChatAttachmentModal from './ChatAttachmentModal';
import ChatForwardModal from './ChatForwardModal';
import ChatDeleteModal from './ChatDeleteModal';
import ChatInfoModal from './ChatInfoModal';
import ChatErrorBoundary from './ChatErrorBoundary';
import { Message, ChatItem } from '../../types/ChatItem';
import ChatActionsBar from './ChatActionsBar';
import { socket } from '../../contexts/AuthContext';

interface ChatRoomProps {
  activeChat: ChatItem | null;
  onBack: () => void;
  onChatChange: (chat: ChatItem | null) => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ activeChat, onBack, onChatChange }) => {
  const navigation = useNavigation();
  const { user, token, api } = useAuth();
  const { colors } = useTheme();
  
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [drafts, setDrafts] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messageStatus, setMessageStatus] = useState<{[key: string]: string}>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Action modals state
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [forwardSelected, setForwardSelected] = useState<string[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [messageInfo, setMessageInfo] = useState<any>(null);
  const [actionsMessage, setActionsMessage] = useState<Message | null>(null);
  const [showActionsBar, setShowActionsBar] = useState(false);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Edit message state
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Refs
  const flatListRef = useRef<FlatList<any>>(null);
  const isAtBottom = useRef(true);

  // Effects
  useEffect(() => {
    if (activeChat && user) {
      // Connect and join chat room
      if (!socket.connected) socket.connect();
      socket.emit('join-chat', activeChat.id);

      // Listen for new messages
      const handleNewMessage = (msg: any) => {
        if (msg.chatId === activeChat.id) {
          setMessages(prev => {
            // Remove any message with the same id, then add the new one
            const filtered = prev.filter(m => m.id !== msg.id);
            return [...filtered, {
              id: msg.id,
              text: msg.text,
              image: msg.image,
              audio: msg.audio,
              video: msg.video,
              messageType: msg.messageType || 'text',
              sender: msg.sender,
              timestamp: msg.timestamp,
              isRead: msg.isRead || false,
              createdAt: msg.createdAt,
            }];
          });
        }
      };
      socket.on('new-message', handleNewMessage);

      return () => {
        socket.off('new-message', handleNewMessage);
        socket.emit('join-chat', null); // Optionally leave room
        // Optionally disconnect socket if not needed elsewhere
        // socket.disconnect();
      };
    }
  }, [activeChat, user]);

  // Error handling wrapper
  const handleError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    const errorMessage = error?.response?.data?.message || error?.message || `Something went wrong in ${context}`;
    setError(errorMessage);
    
    // Auto-clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  // Safe API call wrapper
  const safeApiCall = async (apiCall: () => Promise<any>, context: string) => {
    try {
      setError(null);
      return await apiCall();
    } catch (error) {
      handleError(error, context);
      return null;
    }
  };

  // Fetch messages with error handling
  const fetchMessages = async (chatId: string) => {
    if (!token || !chatId) return;
    
    setLoading(true);
    setHasMoreMessages(true); // Reset for new chat
    try {
      const result = await safeApiCall(
        () => api.get(`/chats/${chatId}`),
        'fetching messages'
      );
      
      if (result?.data?.messages) {
        try {
          const formattedMessages = result.data.messages.map((msg: any) => ({
            id: msg._id,
            text: msg.message,
            image: msg.image,
            audio: msg.audio,
            video: msg.video,
            messageType: msg.messageType || "text",
            sender: msg.sender,
            timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isRead: msg.isRead || false,
            createdAt: msg.createdAt,
          }));
          
          setMessages(formattedMessages);
          
          // Mark as read
          await safeApiCall(
            () => api.post(`/chats/${chatId}/mark-as-read`),
            'marking messages as read'
          );
          
        } catch (error) {
          handleError(error, 'processing messages');
        }
      }
    } catch (error: any) {
      console.error("📱 Fetch messages error:", error);
      
      if (error.response?.status !== 404) {
        setError(error.response?.data?.message || error.message || "Failed to load messages");
      }
      
      if (error.response?.status === 404) {
        console.log("📱 No messages found for this chat");
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (loading || isLoadingMore || !activeChat || !token || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    
    try {
      console.log("📱 Loading more messages...");
      
      // Try with pagination parameters first
      let response;
      try {
        response = await api.get(`/chats/${activeChat.id}`, {
          params: {
            page: Math.ceil(messages.length / 20) + 1,
            limit: 20,
          },
        });
      } catch (paginationError) {
        console.log("📱 Pagination not supported, trying without parameters");
        // If pagination fails, try without parameters (backend might not support pagination)
        response = await api.get(`/chats/${activeChat.id}`);
      }
      
      if (response.data && response.data.messages && Array.isArray(response.data.messages)) {
        const newMessages = response.data.messages
          .map((msg: any) => ({
            id: msg._id,
            text: msg.message,
            image: msg.image,
            audio: msg.audio,
            video: msg.video,
            messageType: msg.messageType || "text",
            sender: msg.sender,
            timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isRead: msg.isRead || false,
            createdAt: msg.createdAt,
          }))
          .filter((msg: Message) => !messages.some(existing => existing.id === msg.id));
        
        if (newMessages.length > 0) {
          setMessages(prev => [...newMessages, ...prev]);
          console.log(`📱 Loaded ${newMessages.length} more messages`);
        } else {
          console.log("📱 No more messages to load");
          setHasMoreMessages(false);
        }
      } else {
        console.log("📱 No messages data in response");
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("📱 Error loading more messages:", error);
      // Don't show error for pagination failures, just log them
      if (error.response?.status !== 404) {
        console.log("📱 Non-404 error, might be a real issue");
      }
      // If we get a 404, assume no more messages
      if (error.response?.status === 404) {
        setHasMoreMessages(false);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Check follow status
  const checkFollowStatus = async (userId: string) => {
    if (!user || !token) return;
    
    const result = await safeApiCall(
      () => api.post(`/users/${userId}/is-following`, { followerId: user.id }),
      'checking follow status'
    );
    
    if (result?.data?.isFollowing !== undefined) {
      setIsFollowing(result.data.isFollowing);
    }
  };

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!activeChat || !user) return;
    
    const endpoint = isFollowing ? "unfollow" : "follow";
    const result = await safeApiCall(
      () => api.post(`/users/${activeChat.id}/${endpoint}`, { followerId: user.id }),
      `${isFollowing ? 'unfollowing' : 'following'} user`
    );
    
    if (result) {
      setIsFollowing(!isFollowing);
      setSuccessMessage(`${isFollowing ? "Unfollowed" : "Following"} @${activeChat.name}`);
      setShowSuccessNotification(true);
    }
  };

  // Send message with error handling
  const handleSendMessage = async (text: string, mediaDrafts: Message[] = []) => {
    if (!activeChat || !user || sending) return;
    
    setSending(true);
    
    try {
      if (mediaDrafts.length > 0) {
        // Handle media messages
        const formData = new FormData();
        
        if (text.trim()) {
          formData.append("message", text.trim());
        }
        
        const mediaFiles = mediaDrafts.map((draft, index) => {
          const mediaUri = draft.image || draft.video || draft.audio;
          let type = "image/jpeg";
          let name = `chat-media-${index}.jpg`;
          
          if (draft.messageType.includes("audio")) {
            type = "audio/m4a";
            name = `chat-audio-${index}.m4a`;
          } else if (draft.messageType.includes("video")) {
            type = "video/mp4";
            name = `chat-video-${index}.mp4`;
          }
          
          return { uri: mediaUri, type, name, messageType: draft.messageType };
        });
        
        mediaFiles.forEach((media) => {
          if (media.uri) {
            formData.append(`media`, {
              uri: media.uri,
              type: media.type,
              name: media.name,
            } as any);
          }
        });
        
        const primaryMessageType = mediaFiles[0]?.messageType || "image";
        formData.append("messageType", primaryMessageType);
        
        const result = await safeApiCall(
          () => api.post(`/chats/${activeChat.id}`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          }),
          'sending media message'
        );
        
        if (result?.data?.chat) {
          // Do NOT update setMessages here. Wait for socket event.
          setSuccessMessage("Message sent");
          setShowSuccessNotification(true);
        }
        
      } else if (text.trim()) {
        // Handle text-only messages
        const result = await safeApiCall(
          () => api.post(`/chats/${activeChat.id}`, {
            message: text.trim(),
            messageType: "text",
          }, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
          'sending text message'
        );
        if (result?.data?.chat) {
          // Do NOT update setMessages here. Wait for socket event.
        }
      }
      
      // Clear states after successful send
      setDrafts([]);
      setReplyingTo(null);
      
    } catch (error) {
      handleError(error, 'sending message');
    } finally {
      setSending(false);
    }
  };

  // Enhanced message actions with full server integration
  const handleMessageAction = async (action: string, message: Message) => {
    if (!user || !token || !activeChat) return;

    try {
      switch (action) {
        case 'showActions':
          setActionsMessage(message);
          setShowActionsBar(true);
          break;

        case 'copy':
          if (message.text) {
            Clipboard.setString(message.text);
            ToastAndroid.show('Copied!', ToastAndroid.SHORT);
          }
          break;

        case 'forward':
          await fetchFollowers();
          setActionsMessage(message);
          setShowForwardModal(true);
          break;

        case 'delete':
          setActionsMessage(message);
          setShowDeleteModal(true);
          break;

        case 'edit':
          if (message.sender._id === user.id) {
            setEditText(message.text || '');
            setIsEditing(true);
            setActionsMessage(message);
            // Focus the input after a short delay
            setTimeout(() => {
              // This would need to be passed down to ChatInput component
              console.log("Edit mode activated for message:", message.id);
            }, 100);
          } else {
            ToastAndroid.show('You can only edit your own messages', ToastAndroid.SHORT);
          }
          break;

        case 'info':
          try {
            const response = await api.get(`/chats/${message.id}/info`);
            setMessageInfo(response.data);
            setShowInfoModal(true);
          } catch (error) {
            ToastAndroid.show('Failed to get message info', ToastAndroid.SHORT);
          }
          break;

        case 'reply':
          setReplyingTo(message);
          break;

        case 'star':
          // Handle star/favorite message
          try {
            await api.post(`/chats/${activeChat.id}/messages/${message.id}/star`);
            ToastAndroid.show('Message starred', ToastAndroid.SHORT);
          } catch (error) {
            ToastAndroid.show('Failed to star message', ToastAndroid.SHORT);
          }
          break;

        default:
          if (action.startsWith('react:')) {
            // Handle emoji reactions
            const reaction = action.replace('react:', '');
            try {
              await api.post(`/chats/${activeChat.id}/messages/${message.id}/react`, { reaction });
              setMessages(prev => prev.map(msg => 
                msg.id === message.id 
                  ? { ...msg, reactions: { ...(msg.reactions || {}), [reaction]: ((msg.reactions || {})[reaction] || 0) + 1 } }
                  : msg
              ));
              ToastAndroid.show(`You reacted with ${reaction}`, ToastAndroid.SHORT);
            } catch (error) {
              ToastAndroid.show('Failed to react to message', ToastAndroid.SHORT);
            }
          } else {
            console.log("Unknown action:", action);
          }
      }
    } catch (error) {
      console.error("Error handling message action:", error);
      ToastAndroid.show('Action failed', ToastAndroid.SHORT);
    }
  };

  // Fetch followers for forward functionality
  const fetchFollowers = async () => {
    if (!user || !token) return;
    try {
      const response = await api.get(`/users/${user.id}`);
      const userData = response.data.user;
      setFollowers(userData.followers || []);
    } catch (error) {
      console.error('Failed to fetch followers:', error);
      setFollowers([]);
    }
  };

  // Handle forward to selected users
  const handleForward = async () => {
    if (!actionsMessage || !user || !token || forwardSelected.length === 0) return;
    
    try {
      for (const receiverId of forwardSelected) {
        await api.post(`/chats/${receiverId}/forward`, {
          messageId: actionsMessage.id
        });
      }
      ToastAndroid.show(`Forwarded to ${forwardSelected.length} user(s)`, ToastAndroid.SHORT);
      setShowForwardModal(false);
      setForwardSelected([]);
      setActionsMessage(null);
    } catch (error) {
      ToastAndroid.show('Failed to forward message', ToastAndroid.SHORT);
    }
  };

  // Handle delete message
  const handleDelete = async (deleteForAll: boolean) => {
    if (!actionsMessage || !user || !token) return;
    
    try {
      const url = deleteForAll 
        ? `/chats/${actionsMessage.id}?all=true`
        : `/chats/${actionsMessage.id}`;
      
      await api.delete(url);
      setMessages(prev => prev.filter(msg => msg.id !== actionsMessage.id));
      ToastAndroid.show(
        deleteForAll ? 'Message deleted for everyone' : 'Message deleted for you', 
        ToastAndroid.SHORT
      );
      setShowDeleteModal(false);
      setActionsMessage(null);
    } catch (error) {
      ToastAndroid.show('Failed to delete message', ToastAndroid.SHORT);
    }
  };

  // Handle edit message
  const handleEdit = async () => {
    if (!actionsMessage || !user || !token || !editText.trim()) return;
    
    try {
      await api.put(`/chats/${actionsMessage.id}`, {
        message: editText.trim()
      });
      setMessages(prev => prev.map(msg => 
        msg.id === actionsMessage.id 
          ? { ...msg, text: editText.trim() }
          : msg
      ));
      ToastAndroid.show('Message edited', ToastAndroid.SHORT);
      setIsEditing(false);
      setEditText('');
      setActionsMessage(null);
    } catch (error) {
      ToastAndroid.show('Failed to edit message', ToastAndroid.SHORT);
    }
  };

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
            if (activeChat) {
              fetchMessages(activeChat.id);
            }
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

  // Handler to show actions bar
  const handleShowActionsBar = (message: Message) => {
    setActionsMessage(message);
    setShowActionsBar(true);
  };

  // Handler to hide actions bar
  const handleHideActionsBar = () => {
    setActionsMessage(null);
    setShowActionsBar(false);
  };

  // Handler for chat actions (reply, delete, etc.)
  const handleChatAction = async (action: string, message: Message) => {
    handleHideActionsBar();
    await handleMessageAction(action, message);
  };

  // Handler for more actions (like edit, report, copy)
  const handleMoreAction = async (action: string) => {
    switch (action) {
      case 'viewContact':
        // TODO: Implement view contact functionality
        console.log("View contact for:", activeChat?.id);
        break;
      case 'media':
        // TODO: Implement media view functionality
        console.log("View media for chat:", activeChat?.id);
        break;
      case 'search':
        // TODO: Implement search functionality
        console.log("Search in chat:", activeChat?.id);
        break;
      case 'mute':
        // TODO: Implement mute notifications functionality
        console.log("Toggle mute for chat:", activeChat?.id);
        break;
      case 'wallpaper':
        // TODO: Implement wallpaper functionality
        console.log("Change wallpaper for chat:", activeChat?.id);
        break;
      case 'report':
        // TODO: Implement report functionality
        console.log("Report chat:", activeChat?.id);
        break;
      case 'block':
        // TODO: Implement block functionality
        console.log("Block user:", activeChat?.id);
        break;
      default:
        console.log("Unknown more action:", action);
    }
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
    <ChatErrorBoundary>
      <ImageBackground
        source={colors.chatroom.backgroundImage}
        style={[styles.container, { backgroundColor: colors.chatroom.background, justifyContent: 'flex-end' }]}
        resizeMode="cover"
        imageStyle={{ resizeMode: 'cover', opacity: 0.7, alignSelf: 'center' }}
        onLoad={() => console.log("🎨 Background image loaded successfully")}
        onError={(error) => console.log("🎨 Background image failed to load:", error)}
      >
        <ErrorDisplay />
        <LoadingOverlay />
        
        {/* Content Overlay */}
        <View style={[styles.content, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          {showActionsBar && actionsMessage ? (
            <ChatActionsBar
              message={actionsMessage}
              onAction={handleChatAction}
              onClose={handleHideActionsBar}
              colors={colors}
              user={user}
            />
          ) : (
            <ChatHeader
              activeChat={activeChat}
              isFollowing={isFollowing}
              onBack={onBack}
              onFollowToggle={handleFollowToggle}
              colors={colors}
            />
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 20}
          >
            <ChatMessageList
              messages={messages}
              loading={loading}
              error={error}
              onLoadMore={loadMoreMessages}
              onRetry={() => activeChat && fetchMessages(activeChat.id)}
              onMessageAction={handleMessageAction}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              colors={colors}
              user={user}
              activeChat={activeChat}
              flatListRef={flatListRef as React.RefObject<FlatList<any>>}
              isLoadingMore={isLoadingMore}
              hasMoreMessages={hasMoreMessages}
              onLongPressMessage={handleShowActionsBar}
            />

            <ChatInput
              messageText={messageText}
              setMessageText={setMessageText}
              drafts={drafts}
              setDrafts={setDrafts}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onSendMessage={handleSendMessage}
              onAttachmentPress={() => setShowAttachmentModal(true)}
              sending={sending}
              colors={colors}
              user={user}
              activeChat={activeChat}
              isEditing={isEditing}
              editText={editText}
              setEditText={setEditText}
              onEditSubmit={handleEdit}
              onEditCancel={() => {
                setIsEditing(false);
                setEditText('');
                setActionsMessage(null);
              }}
            />
          </KeyboardAvoidingView>
        </View>

        {isScrolledUp && (
          <TouchableOpacity
            style={styles.skipToBottomButton}
            onPress={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
              setIsScrolledUp(false);
            }}
            activeOpacity={0.8}
          >
            <ArrowLeft style={{ transform: [{ rotate: '90deg' }] }} size={28} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Modals */}
        <ChatAttachmentModal
          visible={showAttachmentModal}
          onClose={() => setShowAttachmentModal(false)}
          onMediaSelect={(media) => setDrafts(prev => [...prev, media])}
          colors={colors}
          user={user}
        />

        <ChatForwardModal
          visible={showForwardModal}
          followers={followers}
          forwardSelected={forwardSelected}
          setForwardSelected={setForwardSelected}
          onClose={() => {
            setShowForwardModal(false);
            setForwardSelected([]);
            setActionsMessage(null);
          }}
          onForward={handleForward}
          colors={colors}
        />

        <ChatDeleteModal
          visible={showDeleteModal}
          message={actionsMessage}
          onClose={() => {
            setShowDeleteModal(false);
            setActionsMessage(null);
          }}
          onDelete={handleDelete}
          colors={colors}
          user={user}
        />

        <ChatInfoModal
          visible={showInfoModal}
          messageInfo={messageInfo}
          onClose={() => {
            setShowInfoModal(false);
            setMessageInfo(null);
          }}
          colors={colors}
        />
      </ImageBackground>
    </ChatErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardView: {
    flex: 1,
  },
  chatActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    minHeight: 60,
    flexShrink: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionsHeaderContent: {
    flex: 1,
  },
  actionsHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  actionsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
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
  skipToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    backgroundColor: '#fff',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
});

export default ChatRoom; 