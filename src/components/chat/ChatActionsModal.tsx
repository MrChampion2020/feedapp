import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
} from 'react-native';
import {
  Star,
  Copy,
  Trash2,
  Share2,
  Reply,
  Info,
  MoreVertical,
} from 'lucide-react-native';
import { Message } from '../../types/ChatItem';

interface ChatActionsModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onAction: (action: string, message: Message) => void;
  colors: any;
  user: any;
}

const ChatActionsModal: React.FC<ChatActionsModalProps> = ({
  visible,
  message,
  onClose,
  onAction,
  colors,
  user,
}) => {
  const actionsAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(actionsAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(actionsAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleAction = (action: string) => {
    if (!message) return;
    
    try {
      onAction(action, message);
    } catch (error) {
      console.error(`Error handling action ${action}:`, error);
    }
  };

  const closeModal = () => {
    Animated.timing(actionsAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
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
    ...(message?.sender._id === user?.id ? [{
      icon: Info,
      label: "Info",
      action: "info",
      color: colors.primary,
    }] : []),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={closeModal}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                {
                  translateY: actionsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
              ],
              opacity: actionsAnim,
            },
          ]}
        >
          <View style={styles.row}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionButton}
                onPress={() => handleAction(action.action)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: colors.chatroom.background }]}>
                  <action.icon size={24} color={action.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.chatroom.text }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.chatroom.background }]}
            onPress={closeModal}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.cancelButtonText, { color: colors.chatroom.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  container: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 8,
    minHeight: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    width: '100%',
    marginBottom: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  actionLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 60,
  },
  cancelButton: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    width: '90%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  cancelButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ChatActionsModal; 