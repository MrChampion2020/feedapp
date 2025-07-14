export interface ChatItem {
  id: string;
  _id?: string;
  name: string;
  username?: string;
  fullName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar: string;
}

export interface Message {
  id: string;
  text?: string;
  image?: string;
  audio?: string;
  video?: string;
  images?: string[];
  videos?: string[];
  audios?: string[];
  messageType:
    | "text"
    | "image"
    | "text-image"
    | "post-comment"
    | "audio"
    | "video"
    | "text-audio"
    | "text-video"
    | "multiple-media";
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePicture?: string;
  };
  timestamp: string;
  replyTo?: Message;
  postData?: {
    image: string;
    caption: string;
    timestamp: string;
  };
  isDraft?: boolean;
  isRead?: boolean;
  createdAt?: string;
  reactions?: { [key: string]: number };
}

export interface MessageStatus {
  [key: string]: 'sent' | 'delivered' | 'read';
}

export interface ChatError {
  message: string;
  code?: string;
  context?: string;
}

export interface ChatState {
  messages: Message[];
  drafts: Message[];
  loading: boolean;
  error: ChatError | null;
  isFollowing: boolean;
  replyingTo: Message | null;
  selectedMessage: Message | null;
  messageStatus: MessageStatus;
  unreadCount: number;
  isScrolledUp: boolean;
  sending: boolean;
}
