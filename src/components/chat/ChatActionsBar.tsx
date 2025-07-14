import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  Star,
  Copy,
  Trash2,
  Share2,
  Reply,
  MoreVertical,
  Info,
} from 'lucide-react-native';
import { Message } from '../../types/ChatItem';

interface ChatActionsBarProps {
  message: Message;
  onAction: (action: string, message: Message) => void;
  onClose: () => void;
  colors: any;
  user: any;
}

const ChatActionsBar: React.FC<ChatActionsBarProps> = ({
  message,
  onAction,
  onClose,
  colors,
  user,
}) => {
  const handleAction = (action: string) => {
    try {
      onAction(action, message);
    } catch (error) {
      console.error(`Error handling action ${action}:`, error);
    }
  };

  const actions = [
    {
      icon: Star,
      label: "Star",
      action: "star",
      color: colors.primary,
    },
    {
      icon: Copy,
      label: "Copy",
      action: "copy",
      color: colors.primary,
    },
    {
      icon: Trash2,
      label: "Delete",
      action: "delete",
      color: colors.error || '#ff6b6b',
    },
    {
      icon: Share2,
      label: "Forward",
      action: "forward",
      color: colors.primary,
    },
    {
      icon: Reply,
      label: "Reply",
      action: "reply",
      color: colors.primary,
    },
    // Only show Info for user's own messages
    ...(message.sender._id === user?.id ? [{
      icon: Info,
      label: "Info",
      action: "info",
      color: colors.primary,
    }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
      {/* Header row with back button, message preview, and three-dot menu */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.primary + '20' }]}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>×</Text>
        </TouchableOpacity>
        
        <View style={styles.messagePreview}>
          <Text style={[styles.messageText, { color: colors.chatroom.text }]} numberOfLines={1}>
            {message.text || (message.image ? '📷 Image' : message.video ? '🎥 Video' : message.audio ? '🎵 Audio' : 'Message')}
          </Text>
          <Text style={[styles.messageTime, { color: colors.chatroom.text + '80' }]}>
            {message.timestamp}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.moreButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => handleAction('more')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MoreVertical size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionButton}
            onPress={() => handleAction(action.action)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: action.color + '20' }]}>
              <action.icon size={20} color={action.color} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.chatroom.text }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    minHeight: 80,
    flexShrink: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  messagePreview: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 12,
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 50,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ChatActionsBar; 