import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

interface ChatInfoModalProps {
  visible: boolean;
  messageInfo: any;
  onClose: () => void;
  colors: any;
}

const ChatInfoModal: React.FC<ChatInfoModalProps> = ({
  visible,
  messageInfo,
  onClose,
  colors,
}) => {
  if (!messageInfo) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Message Info
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text }]}>Sent:</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {new Date(messageInfo.sentAt || messageInfo.createdAt).toLocaleString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text }]}>Status:</Text>
            <Text style={[styles.value, { color: messageInfo.isRead ? colors.primary : colors.chatroom.secondary }]}>
              {messageInfo.isRead ? 'Read' : 'Delivered'}
            </Text>
          </View>

          {messageInfo.readAt && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.text }]}>Read at:</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {new Date(messageInfo.readAt).toLocaleString()}
              </Text>
            </View>
          )}

          {messageInfo.messageType && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.text }]}>Type:</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {messageInfo.messageType}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  closeButton: {
    marginTop: 16,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ChatInfoModal; 