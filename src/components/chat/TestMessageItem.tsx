import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MessageItem } from './MessageItem';
import { DebugWrapper } from '../../utils/debugUtils';

// Test component to verify text warning fixes
export const TestMessageItem: React.FC = () => {
  const testMessage = {
    id: '1',
    text: 'Test message with links https://example.com',
    messageType: 'text' as const,
    sender: { 
      _id: '1', 
      username: 'testuser', 
      fullName: 'Test User',
      profilePicture: undefined
    },
    timestamp: '12:00',
    isRead: true,
    createdAt: new Date().toISOString()
  };

  const testUser = { 
    id: '1',
    username: 'testuser',
    fullName: 'Test User'
  };

  const testColors = {
    senderBubble: '#dcf8c6',
    receiverBubble: '#fff',
    senderText: '#000',
    receiverText: '#000',
    chatroom: {
      secondary: '#666',
      primary: '#25D366',
      text: '#000',
      background: '#f0f0f0',
      border: '#ddd',
      inputBg: '#fff',
      inputText: '#000',
      link: '#1DA1F2'
    },
    iconBg: '#f0f0f0',
    iconFg: '#666',
    primary: '#25D366',
    text: '#000',
    replyPreview: '#f0f0f0'
  };

  const renderTextWithLinks = (text: string, textColor?: string) => {
    return <Text style={{ color: textColor }}>{text}</Text>;
  };

  const getMessageTick = (msg: any) => {
    // This should now return a string instead of a React element
    return "✓✓";
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Testing MessageItem Component</Text>
      
      <DebugWrapper name="TestMessageItem" enabled={__DEV__}>
        <MessageItem
          item={testMessage}
          user={testUser}
          colors={testColors}
          handleSwipeGesture={() => {}}
          renderTextWithLinks={renderTextWithLinks}
          flatListRef={null}
          onRemoveDraft={undefined}
          onLongPress={() => {}}
          selectedMessage={null}
          getMessageTick={getMessageTick}
          messageStatus={{ '1': 'read' }}
        />
      </DebugWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
}); 