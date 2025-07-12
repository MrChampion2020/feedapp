"use client"

import type React from "react"
import { useRef } from "react"
import { View, Text, StyleSheet, Image, Animated, TouchableOpacity } from "react-native"
import { PanGestureHandler, State } from "react-native-gesture-handler"
import { Reply } from "lucide-react-native"

interface MessageSender {
  _id: string
  username: string
  fullName: string
  profilePicture?: string
}

export interface MessageItemProps {
  item: {
    id: string
    text?: string
    image?: string
    messageType: "text" | "image" | "text-image" | "post-comment"
    sender: MessageSender
    timestamp: string
    replyTo?: any
    postData?: {
      image: string
      caption: string
      timestamp: string
    }
  }
  user: any
  colors: any
  handleSwipeGesture: (event: any, message: any) => void
  renderTextWithLinks: (text: string) => any
}

// Parse custom message format for post comments
const parsePostCommentMessage = (text: string) => {
  if (!text) return { isPostComment: false, text }

  const imgMatch = text.match(/\[img\](.*?)\[\/img\]/)
  const faintMatch = text.match(/\[faint\](.*?)\[\/faint\]/)
  const commentMatch = text.match(/Comment: (.*)/)

  if (imgMatch && faintMatch && commentMatch) {
    const imageUrl = imgMatch[1]
    const postDetails = faintMatch[1]
    const comment = commentMatch[1]

    // Extract caption and original caption from faint text
    const parts = postDetails.split(" (")
    const caption = parts[0]
    const originalCaption = parts[1] ? parts[1].replace(")", "") : caption

    return {
      isPostComment: true,
      postData: {
        image: imageUrl,
        caption: caption,
        originalCaption: originalCaption,
        timestamp: "2days ago", // You can make this dynamic
      },
      comment: comment,
    }
  }

  return { isPostComment: false, text }
}

const PostCommentPreview = ({ postData, comment, colors }: { postData: any; comment: string; colors: any }) => (
  <View style={[styles.postCommentContainer, { backgroundColor: colors.primary }]}>
    <View style={styles.postPreviewContainer}>
      <Image source={{ uri: postData.image }} style={styles.postPreviewImage} />
      <View style={[styles.postDetailsContainer, { backgroundColor: colors.primary }]}>
        <Text style={styles.postLabel}>Post:</Text>
        <Text style={styles.postCaption} numberOfLines={2}>
          {postData.caption}
        </Text>
        <Text style={styles.postTimestamp}>{postData.timestamp}</Text>
      </View>
    </View>
    <View style={styles.commentContainer}>
      <Text style={styles.commentLabel}>Comment: </Text>
      <Text style={styles.commentText}>{comment}</Text>
    </View>
  </View>
)

export const MessageItem: React.FC<MessageItemProps> = ({
  item,
  user,
  colors,
  handleSwipeGesture,
  renderTextWithLinks,
}) => {
  const translateX = useRef(new Animated.Value(0)).current

  const onGestureEvent = (event: any) => {
    const translationX = event.nativeEvent.translationX || 0
    if (translationX >= 0) {
      translateX.setValue(translationX)
    } else {
      translateX.setValue(0)
    }
  }

  const onHandlerStateChange = (event: any) => {
    const { translationX, state } = event.nativeEvent || {}

    if (typeof translationX !== "number") {
      return
    }

    if (translationX < 0) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
      return
    }

    if (state === State.END && translationX > 50) {
      handleSwipeGesture(event, item)
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
    } else if (state === State.END) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
    }
  }

  // Parse the message to check if it's a post comment
  const parsedMessage = item.text ? parsePostCommentMessage(item.text) : { isPostComment: false, text: "" }

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-10, 10]}
      activeOffsetY={[-10, 10]}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <View
          style={[
            styles.messageBubble,
            item.sender._id === user?.id ? styles.userMessage : styles.otherMessage,
            {
              backgroundColor: parsedMessage.isPostComment
                ? colors.primary
                : item.sender._id === user?.id
                  ? colors.primary
                  : colors.card,
            },
          ]}
        >
          {item.replyTo && (
            <View style={[styles.replyContainer, { borderLeftColor: colors.border }]}>
              <Reply size={16} color={colors.placeholder} style={{ marginRight: 6 }} />
              <Text style={[styles.replyText, { color: colors.placeholder }]} numberOfLines={1}>
                {String(item.replyTo.text || "📷 Image")}
              </Text>
            </View>
          )}

          {parsedMessage.isPostComment ? (
            <PostCommentPreview postData={parsedMessage.postData} comment={parsedMessage.comment} colors={colors} />
          ) : item.messageType === "image" && item.image ? (
            <TouchableOpacity onPress={() => console.log("Image pressed - could open full screen view")}>
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </TouchableOpacity>
                    ) : item.messageType === "text-image" && item.image && item.text ? (
            <>
              <TouchableOpacity onPress={() => console.log("Image pressed - could open full screen view")}> 
                <Image source={{ uri: item.image }} style={styles.messageImage} />
              </TouchableOpacity>
              <View style={styles.messageContainer}>
                {renderTextWithLinks(item.text || "")}
              </View>
            </>
          ) : (
            <View style={styles.messageContainer}>
              {renderTextWithLinks(item.text || "")}
            </View>
          )}

          <Text
            style={[
              styles.timestamp,
              { color: item.sender._id === user?.id ? "rgba(255,255,255,0.7)" : colors.placeholder },
            ]}
          >
            {item.timestamp}
          </Text>
        </View>
      </Animated.View>
    </PanGestureHandler>
  )
}

const styles = StyleSheet.create({
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  userMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    marginBottom: 4,
  },
  messageContainer: {
    marginBottom: 4,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 10,
    alignSelf: "flex-end",
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 8,
    paddingVertical: 4,
  },
  replyText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  // Post Comment Styles
  postCommentContainer: {
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 280,
  },
  postPreviewContainer: {
    flexDirection: "row",
    height: 120,
  },
  postPreviewImage: {
    width: 120,
    height: 120,
    borderTopLeftRadius: 12,
  },
  postDetailsContainer: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  postLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  postCaption: {
    color: "white",
    fontSize: 14,
    flex: 1,
  },
  postTimestamp: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  commentContainer: {
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  commentLabel: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  commentText: {
    color: "white",
    fontSize: 14,
    marginTop: 2,
  },
})

export default MessageItem
