import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Message, ChatItem } from '../../types/ChatItem';
import { MessageItem } from './MessageItem';
import { DateSeparator } from './DateSeparator';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';


interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
  onMessageAction: (action: string, message: Message) => void;
  replyingTo: Message | null;
  setReplyingTo: (message: Message | null) => void;
  colors: any;
  user: any;
  activeChat: ChatItem | null;
  flatListRef: React.RefObject<FlatList<any>>;
  isLoadingMore?: boolean;
  hasMoreMessages?: boolean;
  onLongPressMessage?: (message: Message) => void;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  loading,
  error,
  onLoadMore,
  onRetry,
  onMessageAction,
  replyingTo,
  setReplyingTo,
  colors,
  user,
  activeChat,
  flatListRef,
  isLoadingMore = false,
  hasMoreMessages = true,
  onLongPressMessage,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null); // Added state for selected message

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      // Small delay to ensure the message is rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Scroll to bottom when replying to a message
  useEffect(() => {
    if (replyingTo && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [replyingTo]);

  // Scroll to bottom when component mounts with messages
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, []);

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    // First, sort all messages by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date();
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date();
      return dateA.getTime() - dateB.getTime();
    });

    const groups: { [key: string]: Message[] } = {};
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    sortedMessages.forEach((message) => {
      // Try to get the actual date from createdAt first, then fallback to timestamp
      let messageDate: Date;
      
      if (message.createdAt) {
        messageDate = new Date(message.createdAt);
      } else if (message.timestamp) {
        // If timestamp is already a formatted time, we need to construct a full date
        // For now, assume it's from today if we can't parse it properly
        try {
          // Try to parse the timestamp as a full date first
          messageDate = new Date(message.timestamp);
          // If the parsed date is invalid (NaN), use today's date
          if (isNaN(messageDate.getTime())) {
            messageDate = new Date();
          }
        } catch (error) {
          messageDate = new Date();
        }
      } else {
        messageDate = new Date();
      }
      
      // Create a meaningful date key
      let dateKey: string;
      const messageDateString = messageDate.toDateString();
      
      if (messageDateString === today.toDateString()) {
        dateKey = 'Today';
      } else if (messageDateString === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        // For other dates, use a more descriptive format
        const diffInDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffInDays < 7) {
          // Within a week, show day name
          dateKey = messageDate.toLocaleDateString('en-US', { weekday: 'long' });
        } else if (diffInDays < 30) {
          // Within a month, show "X days ago"
          dateKey = `${diffInDays} days ago`;
        } else {
          // Older, show full date
          dateKey = messageDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    // Sort the groups by date (oldest first for proper chronological order)
    const sortedGroups = Object.entries(groups)
      .sort(([dateA], [dateB]) => {
        // Custom sorting for date keys - oldest first
        const dateOrder = { 'Today': 2, 'Yesterday': 1 };
        const orderA = dateOrder[dateA as keyof typeof dateOrder] ?? 0;
        const orderB = dateOrder[dateB as keyof typeof dateOrder] ?? 0;
        return orderA - orderB;
      })
      .map(([date, messages]) => ({
        type: 'date',
        date,
        messages,
      }));
    
    return sortedGroups;
  };

  // Prepare data for FlatList with proper structure
  const prepareFlatListData = () => {
    const groupedData = groupMessagesByDate(messages);
    const flatListData: any[] = [];
    
    console.log("📱 Preparing FlatList data:", {
      totalMessages: messages.length,
      groupedDataLength: groupedData.length,
      sampleMessage: messages[0]
    });
    
    groupedData.forEach(group => {
      // Add date separator
      flatListData.push({ type: 'date', date: group.date });
      // Add messages for this date
      group.messages.forEach(message => {
        flatListData.push({ type: 'message', ...message });
      });
    });
    
    console.log("📱 FlatList data prepared:", {
      totalItems: flatListData.length,
      dateSeparators: flatListData.filter(item => item.type === 'date').length,
      messages: flatListData.filter(item => item.type === 'message').length
    });
    
    return flatListData;
  };

  // Handle swipe gesture for message actions
  const handleSwipeGesture = (event: any, message: Message) => {
    try {
      const { direction } = event;
      
      if (direction === 'right') {
        // Swipe right - show reply option
        setReplyingTo(message);
      } else if (direction === 'left') {
        // Swipe left - show more options
        if (onLongPressMessage) {
          onLongPressMessage(message);
        }
      }
    } catch (error) {
      console.error('Error handling swipe gesture:', error);
    }
  };

  // Copy message to clipboard
  const copyMessage = async (message: Message) => {
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      await Clipboard.setString(message.text || '');
      console.log('Message copied to clipboard');
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await onRetry();
    } catch (error) {
      console.error('Error refreshing messages:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle load more
  const handleLoadMore = async () => {
    try {
      if (isLoadingMore || loading || !hasMoreMessages) return;
      
      await onLoadMore();
    } catch (error) {
      console.error('Error loading more messages:', error);
    }
  };

  // Handle message actions from ChatActionsModal
  const handleMessageAction = async (action: string, message: Message) => {
    try {
      setSelectedMessage(null);

      if (action === 'delete') {
        await onMessageAction('deleteMessage', message);
      } else if (action === 'forward') {
        await onMessageAction('forwardMessage', message);
      } else if (action === 'reply') {
        setReplyingTo(message);
      } else if (action.startsWith('react:')) {
        // Handle emoji reactions
        const reaction = action.replace('react:', '');
        await onMessageAction('reactToMessage', { ...message, reaction });
      }
    } catch (error) {
      console.error('Error handling message action:', error);
    }
  };

  // Render text with clickable links
  const renderTextWithLinks = (text: string, textColor?: string) => {
    try {
      if (!text || typeof text !== 'string') {
        return <Text style={{ color: textColor }}> </Text>;
      }
      
      const URL_REGEX = /(https?:\/\/www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|www\.[^\s]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
      const parts = text.split(URL_REGEX);
      const elements: React.ReactElement[] = [];
      
      parts.forEach((part, index) => {
        if (!part) {
          elements.push(<Text key={`empty-${index}`} style={{ color: textColor }}> </Text>);
          return;
        }
        
        if (URL_REGEX.test(part)) {
          elements.push(
            <Text
              key={`link-${index}`}
              style={[styles.linkText, { color: colors.chatroom.link || '#007AFF' }]}
              onPress={() => {
                try {
                  const { Linking } = require('react-native');
                  Linking.openURL(part.startsWith("http") ? part : `https://${part}`);
                } catch (error) {
                  console.error("Error opening link:", error);
                }
              }}
            >
              {part}
            </Text>
          );
        } else {
          elements.push(
            <Text key={`text-${index}`} style={{ color: textColor }}>{part}</Text>
          );
        }
      });
      
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {elements}
        </View>
      );
    } catch (error) {
      console.error("Error rendering text with links:", error);
      return <Text style={{ color: textColor || colors.text }}>Error rendering text</Text>;
    }
  };

  // Render message item
  const renderMessageItem = ({ item }: { item: Message }) => (
    <MessageItem
      item={item}
      user={user}
      colors={colors}
      handleSwipeGesture={(event: any, message: Message) => {
        handleSwipeGesture(event, message);
      }}
      renderTextWithLinks={renderTextWithLinks}
      flatListRef={flatListRef}
      onLongPress={(message: Message) => {
        if (onLongPressMessage) {
          onLongPressMessage(message);
        }
      }}
      getMessageTick={(msg: Message): string => {
        try {
          // Simple message status logic - you can enhance this based on your backend
          if (msg.isRead) return "✓✓";
          else if (msg.isDraft) return "⏳";
          else return "✓";
        } catch (error) {
          console.error("Error getting message tick:", error);
          return "";
        }
      }}
      messageStatus={{}}
    />
  );

  // Render date separator
  const renderDateSeparator = ({ item }: { item: { type: string; date: string } }) => (
    <DateSeparator date={item.date} colors={colors} />
  );

  // Render loading indicator
  const renderLoadingIndicator = () => {
    if (!loading) return null;
    
    return (
      <View style={[styles.loadingContainer, { backgroundColor: 'transparent' }]}>
        <ActivityIndicator size="large" color={colors.chatroom.primary} />
        <Text style={[styles.loadingText, { color: colors.chatroom.text }]}>
          Loading messages...
        </Text>
      </View>
    );
  };

  // Render error state
  const renderErrorState = () => {
    if (!error) return null;
    
    return (
      <View style={[styles.errorContainer, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.errorText, { color: colors.error || '#ff6b6b' }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={[styles.retryText, { color: '#fff' }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (loading || error || messages.length > 0) return null;
    
    return (
      <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.emptyText, { color: colors.chatroom.text }]}>
          No messages yet
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.chatroom.secondary }]}>
          Start a conversation by sending a message!
        </Text>
      </View>
    );
  };

  // Render footer for load more
  const renderFooter = () => {
    if (!isLoadingMore && hasMoreMessages) return null;
    
    if (isLoadingMore) {
      return (
        <View style={[styles.footerContainer, { backgroundColor: 'transparent' }]}>
          <ActivityIndicator size="small" color={colors.chatroom.primary} />
          <Text style={[styles.footerText, { color: colors.chatroom.secondary }]}>
            Loading more messages...
          </Text>
        </View>
      );
    }
    
    if (!hasMoreMessages && messages.length > 0) {
      return (
        <View style={[styles.footerContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.footerText, { color: colors.chatroom.secondary }]}>
            No more messages to load
          </Text>
        </View>
      );
    }
    
    return null;
  };

  const data = prepareFlatListData();

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {renderLoadingIndicator()}
      {renderErrorState()}
      
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={({ item }) => {
          if (item.type === 'date') {
            return renderDateSeparator({ item });
          }
          return renderMessageItem({ item });
        }}
        keyExtractor={(item, index) => {
          if (item.type === 'date') {
            return `date-${item.date}`;
          }
          return item.id || `message-${index}`;
        }}
        contentContainerStyle={[
          styles.listContainer,
          { 
            flexGrow: 1,
            justifyContent: 'flex-end', // Push content to bottom
            paddingBottom: messages.length > 0 ? 20 : 0 
          }
        ]}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={20}
        inverted={false} // Keep normal order
        getItemLayout={(data, index) => ({
          length: 80, // Approximate height of message items
          offset: 80 * index,
          index,
        })}
      />


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  footerContainer: {
    padding: 15,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 5,
    fontSize: 12,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
});

export default ChatMessageList; 