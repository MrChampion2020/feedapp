// Utility functions for message processing

export const parsePostCommentMessage = (text: string) => {
  if (!text) return { isPostComment: false, text };

  // Try multiple patterns for comment messages
  const patterns = [
    // Pattern 1: [img]URL[/img][faint]details[/faint]Comment: text
    {
      imgMatch: text.match(/\[img\](.*?)\[\/img\]/),
      faintMatch: text.match(/\[faint\](.*?)\[\/faint\]/),
      commentMatch: text.match(/Comment: (.*)/)
    },
    // Pattern 2: Comment on post with image URL directly
    {
      imgMatch: text.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i),
      faintMatch: text.match(/Post: (.*?)(?=Comment:|$)/),
      commentMatch: text.match(/Comment: (.*)/)
    },
    // Pattern 3: Just look for image URLs in comment messages
    {
      imgMatch: text.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i),
      faintMatch: text.match(/\[faint\](.*?)\[\/faint\]/),
      commentMatch: text.match(/Comment: (.*)/)
    }
  ];

  for (const pattern of patterns) {
    if (pattern.imgMatch && pattern.commentMatch) {
      const imageUrl = pattern.imgMatch[1];
      const comment = pattern.commentMatch[1];
      let caption = "Post";
      let timestamp = "2 days ago";

      if (pattern.faintMatch) {
        const postDetails = pattern.faintMatch[1];
        const parts = postDetails.split(" (");
        caption = parts[0];
        timestamp = parts[1] ? parts[1].replace(")", "") : "2 days ago";
      }

      return {
        isPostComment: true,
        postData: {
          image: imageUrl,
          caption: caption,
          timestamp: timestamp,
        },
        comment: comment,
      };
    }
  }

  return { isPostComment: false, text };
};

export const getEmojiFromName = (name: string) => {
  const firstLetter = name.charAt(0).toUpperCase();
  const emojiMap: { [key: string]: string } = {
    A: "😀", B: "😂", C: "😊", D: "👍", E: "❤️", F: "😎", G: "🎉", H: "🌟", I: "🌈",
    J: "💡", K: "🔥", L: "🌹", M: "🎶", N: "🌍", O: "🚀", P: "💕", Q: "🌺", R: "🎵",
    S: "🌞", T: "🍎", U: "🌴", V: "🐱", W: "🐶", X: "🐼", Y: "🐰", Z: "🐸",
  };
  return emojiMap[firstLetter] || "👤";
};

export const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}wk`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}month`;
  return `${Math.floor(diffInSeconds / 31536000)}year`;
};

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const groupMessagesByDate = (messages: any[] = [], userId?: string) => {
  const groups: { [key: string]: any[] } = {};
  if (!Array.isArray(messages) || messages.length === 0) return groups;
  
  // Use a more efficient approach with Map for better performance
  const groupMap = new Map<string, any[]>();
  
  // Pre-calculate dates for better performance
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayString = today.toDateString();
  const yesterdayString = yesterday.toDateString();
  
  // Separate unread and read messages in one pass
  const unreadMessages: any[] = [];
  const readMessages: any[] = [];
  
  for (const message of messages) {
    if (message.sender._id !== userId && !message.isRead) {
      unreadMessages.push(message);
    } else {
      readMessages.push(message);
    }
  }
  
  // Group unread messages if any exist
  if (unreadMessages.length > 0) {
    groupMap.set('Unread Messages', unreadMessages);
  }
  
  // Group read messages by date with optimized date checking
  for (const message of readMessages) {
    const date = message.createdAt ? new Date(message.createdAt) : new Date();
    const dateString = date.toDateString();
    
    let dateKey: string;
    if (dateString === todayString) {
      dateKey = 'Today';
    } else if (dateString === yesterdayString) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, []);
    }
    groupMap.get(dateKey)!.push(message);
  }
  
  // Convert Map back to object
  return Object.fromEntries(groupMap);
}; 