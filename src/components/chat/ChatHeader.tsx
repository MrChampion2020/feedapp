import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { ArrowLeft, UserPlus, UserCheck } from 'lucide-react-native';
import VerifiedBadge from '../VerifiedBadge';
import { getUserVerificationStatus } from '../../utils/userUtils';

interface ChatHeaderProps {
  activeChat: any;
  isFollowing: boolean;
  onBack: () => void;
  onFollowToggle: () => void;
  colors: any;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeChat,
  isFollowing,
  onBack,
  onFollowToggle,
  colors,
}) => {
  if (!activeChat) return null;

  const getEmojiFromName = (name: string) => {
    const firstLetter = name.charAt(0).toUpperCase();
    const emojiMap: { [key: string]: string } = {
      A: '😀', B: '😂', C: '😊', D: '👍', E: '❤️', F: '😎', G: '🎉', H: '🌟', I: '🌈',
      J: '💡', K: '🔥', L: '🌹', M: '🎶', N: '🌍', O: '🚀', P: '💕', Q: '🌺', R: '🎵',
      S: '🌞', T: '🍎', U: '🌴', V: '🐱', W: '🐶', X: '🐼', Y: '🐰', Z: '🐸',
    };
    return emojiMap[firstLetter] || '👤';
  };

  return (
    <View style={[styles.header, {
      backgroundColor: colors.theme === 'dark' ? colors.background : colors.background,
      borderBottomColor: 'transparent',
      paddingTop: Platform.OS === 'ios' ? 44 : 0
    }]}> 
      <TouchableOpacity
        onPress={onBack}
        style={[styles.backButton, { backgroundColor: colors.iconBackBg }]}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ArrowLeft color={colors.theme === 'dark' ? '#fff' : 'grey'} />
      </TouchableOpacity>
      <View style={[styles.avatarContainer, {backgroundColor: colors.background}]}>
        <View style={[styles.avatar, { backgroundColor: activeChat.avatar?.startsWith('http') ? colors.transparent : colors.icon }]}> 
          {activeChat.avatar?.startsWith('http') ? (
            <Image source={{ uri: activeChat.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.emojiText, { color: colors.theme === 'dark' ? '#fff' : '#222' }]}>{String(activeChat.avatar) || getEmojiFromName(activeChat.name)}</Text>
          )}
        </View>
        <View style={styles.nameRow}>
          <Text style={[styles.chatName, { color: colors.theme === 'dark' ? '#fff' : colors.text }]} numberOfLines={1}>
            {(activeChat.fullName || activeChat.name).split(' ')[0]}
          </Text>
          {(() => {
            const { isVerified, isPremiumVerified } = getUserVerificationStatus(activeChat.id);
            return (
              <VerifiedBadge size={20} />
            );
          })()}
        </View>
      </View>
      <View style={styles.headerIcons}>
        {/* Follow/Unfollow Button */}
        <TouchableOpacity 
          onPress={onFollowToggle}
          style={[
            styles.followButton,
            {
              backgroundColor: isFollowing ? (colors.theme === 'dark' ? 'rgba(32,44,51,0.7)' : colors.transparent) : colors.background,
              borderColor: colors.primary,
            },
          ]}
          activeOpacity={0.8}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          {isFollowing ? <UserCheck size={16} color={colors.theme === 'dark' ? colors.text : colors.text} /> : <UserPlus size={16} color={colors.theme === 'dark' ? colors.text : colors.text} />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  emojiText: {
    fontSize: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  chatName: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 120,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
});

export default ChatHeader; 