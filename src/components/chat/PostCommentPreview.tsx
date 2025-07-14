import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

interface PostCommentPreviewProps {
  postData: {
    image: string;
    caption: string;
    timestamp: string;
  };
  comment: string;
  colors: any;
}

export const PostCommentPreview: React.FC<PostCommentPreviewProps> = ({
  postData,
  comment,
  colors,
}) => {
  console.log("🖼️ Rendering PostCommentPreview:", { postData, comment });
  
  return (
    <View style={{backgroundColor: colors.commentCard, borderRadius: 12, padding: 10, marginVertical: 4}}>
      <View style={styles.postPreviewContainer}>
        {postData.image ? (
          <Image 
            source={{ uri: postData.image }} 
            style={styles.postPreviewImage}
            onError={(error) => console.log("❌ Image load error:", error)}
            onLoad={() => console.log("✅ Image loaded successfully:", postData.image)}
          />
        ) : (
          <View style={[styles.postPreviewImage, { backgroundColor: colors.chatroom.border, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: colors.chatroom.secondary, fontSize: 12 }}>No Image</Text>
          </View>
        )}
        <View style={[styles.postDetailsContainer, { backgroundColor: colors.chatroom.com }]}>
          <Text style={[styles.postLabel, { color: colors.chatroom.headerText }]}>Post:</Text>
          <Text style={[styles.postCaption, { color: colors.chatroom.headerText }]} numberOfLines={1}>
            {postData.caption}
          </Text>
          <Text style={[styles.postTimestamp, { color: colors.chatroom.secondary }]}>{postData.timestamp}</Text>
        </View>
      </View>
      <View style={[styles.commentContainer, { backgroundColor: colors.chatroom.rec }]}>
        <Text style={[styles.commentLabel, { color: colors.chatroom.text }]}>Comment: </Text>
        <Text style={[styles.commentText, { color: colors.chatroom.text }]}>{comment}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  postPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  postDetailsContainer: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
  },
  postLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  postCaption: {
    fontSize: 14,
    marginBottom: 2,
  },
  postTimestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
  commentContainer: {
    padding: 8,
    borderRadius: 8,
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentText: {
    fontSize: 14,
    marginTop: 2,
  },
}); 