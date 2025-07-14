import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Message } from '../../types/ChatItem';

interface ChatDeleteModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onDelete: (deleteForAll: boolean) => void;
  colors: any;
  user: any;
}

const ChatDeleteModal: React.FC<ChatDeleteModalProps> = ({
  visible,
  message,
  onClose,
  onDelete,
  colors,
  user,
}) => {
  if (!message) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.container, { backgroundColor: colors.card }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Delete message?</Text>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.error }]}
            onPress={() => onDelete(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>Delete for me</Text>
          </TouchableOpacity>
          {message.sender._id === user?.id && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.primary }]}
              onPress={() => onDelete(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>Delete for everyone</Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 280,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  deleteButton: {
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ChatDeleteModal; 