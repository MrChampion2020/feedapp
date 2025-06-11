import Icon from "react-native-vector-icons/Ionicons";

export const iconColors = {
  back: "#000",
  forward: "#000",
  menu: "#000",
  close: "#000",
  location: "#007AFF",
  bike: "#FF9500",
  car: "#4CD964",
  truck: "#5856D6",
  user: "#8E8E93",
  chat: "white",
  star: "#FFD700",
  starOutline: "#C7C7CC",
  calendar: "#FF3B30",
  money: "#34C759",
  package: "#FF9500",
  info: "#007AFF",
  warning: "#FFCC00",
  success: "#28A745",
  error: "#FF3B30",
};

export const icons = {
  back: "chevron-back",
  forward: "chevron-forward",
  menu: "menu",
  close: "close",
  location: "location",
  bike: "bicycle",
  car: "car",
  truck: "truck",
  user: "person",
  chat: "chatbubble",
  star: "star",
  starOutline: "star-outline",
  calendar: "calendar",
  money: "cash",
  package: "cube",
  info: "information-circle",
  warning: "warning",
  success: "checkmark-circle",
  error: "alert-circle",

  // Location
  senderLocation: require("../assets/icons/sender.png"),
  receiverLocation: require("../assets/icons/receiver.png"),

  // Communication
  phone: require("../assets/icons/phone.png"),
  phoneb: require("../assets/icons/phoneb.png"),
  chats: require("../assets/icons/Chat.png"),
  chevronTriple: require('../assets/icons/chevron.png'),


  // Status
  color: require("../assets/icons/black.png"),
  time: require("../assets/icons/time.png"),
  // starOutline: require("../assets/icons/time.png"),

} as const;

export type IconName = keyof typeof icons;
