import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
} from 'react-native';

interface ChatForwardModalProps {
  visible: boolean;
  followers: any[];
  forwardSelected: string[];
  setForwardSelected: (selected: string[]) => void;
  onClose: () => void;
  onForward: () => void;
  colors: any;
}

const ChatForwardModal: React.FC<ChatForwardModalProps> = ({
  visible,
  followers,
  forwardSelected,
  setForwardSelected,
  onClose,
  onForward,
  colors,
}) => {
  const handleUserToggle = (userId: string) => {
    try {
      if (forwardSelected.includes(userId)) {
        setForwardSelected(forwardSelected.filter(id => id !== userId));
      } else if (forwardSelected.length < 5) {
        setForwardSelected([...forwardSelected, userId]);
      }
    } catch (error) {
      console.error("Error toggling user selection:", error);
    }
  };

  const handleForward = () => {
    try {
      if (forwardSelected.length === 0) {
        return;
      }
      onForward();
    } catch (error) {
      console.error("Error forwarding message:", error);
    }
  };

  const renderUser = ({ item }: { item: any }) => {
    try {
      const isSelected = forwardSelected.includes(item._id);
      
      return (
        <TouchableOpacity
          onPress={() => handleUserToggle(item._id)}
          style={styles.userItem}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: colors.primary,
                backgroundColor: isSelected ? colors.primary : 'transparent',
              },
            ]}
          />
          <Text style={[styles.userName, { color: colors.text }]}>
            {item.fullName || item.username || 'Unknown User'}
          </Text>
        </TouchableOpacity>
      );
    } catch (error) {
      console.error("Error rendering user:", error);
      return (
        <View style={styles.errorItem}>
          <Text style={[styles.errorText, { color: colors.error || '#ff6b6b' }]}>
            Unable to display user
          </Text>
        </View>
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Forward to (max 5):
          </Text>
          
          <FlatList
            data={followers}
            keyExtractor={(item) => item._id}
            renderItem={renderUser}
            style={styles.userList}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No followers available
                </Text>
              </View>
            }
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.forwardButton,
                {
                  backgroundColor: forwardSelected.length > 0 ? colors.primary : colors.chatroom.border,
                },
              ]}
              onPress={handleForward}
              disabled={forwardSelected.length === 0}
              activeOpacity={0.8}
            >
              <Text style={[styles.forwardButtonText, { color: forwardSelected.length > 0 ? '#fff' : colors.chatroom.secondary }]}>
                Forward ({forwardSelected.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 16,
    padding: 20,
    width: 320,
    maxHeight: 400,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 12,
  },
  userList: {
    maxHeight: 200,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    padding: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
  },
  errorItem: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 16,
  },
  forwardButton: {
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  forwardButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ChatForwardModal; 