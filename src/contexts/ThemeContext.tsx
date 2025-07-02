import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme, StatusBar, Platform, ImageSourcePropType } from "react-native";
// Use require instead of import for images
const chatlight = require("../assets/images/chatlight.png");
const chatdark = require("../assets/images/chatdark.jpg");
// Attempt to import react-native-navigation-bar-color with fallback
let setColor, setNavigationBarLight, setNavigationBarContrastEnforced;
try {
  const navigationBar = require("react-native-navigation-bar-color");
  setColor = navigationBar.setColor || (() => {});
  setNavigationBarLight = navigationBar.setNavigationBarLight || (() => {});
  setNavigationBarContrastEnforced = navigationBar.setNavigationBarContrastEnforced || (() => {});
  console.log("NavigationBar imported successfully:", typeof setColor === "function");
} catch (e) {
  console.error("Failed to import react-native-navigation-bar-color:", e);
  setColor = () => {};
  setNavigationBarLight = () => {};
  setNavigationBarContrastEnforced = () => {};
}

type ThemeType = "light" | "dark";

interface ThemeColors {
  tabbg: string;
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  icon: string;
  placeholder: string;
  error: string;
  success: string;
  fill: string;
  hashtag: string;
  like: string;
  grey: string;
  overlay: string;
  secondary: string;
  link: string;
  chatbg: string;
  chatrec: string;
  lightgrey: string;
  chatcom: string;
  transparent: string;
  chatPrimary: string;
  chatSecondary: string;
  chatBackground: string;
  chatCard: string;
  chatText: string;
  chatBorder: string;
  chatIcon: string;
  chatLink: string;
  chatBackgroundImage: ImageSourcePropType;
  chatroom: {
    primary: string;
    accent: string;
    background: string;
    card: string;
    text: string;
    border: string;
    icon: string;
    placeholder: string;
    senderBubble: string;
    receiverBubble: string;
    bubbleText: string;
    headerText: string;
    inputBg: string;
    inputText: string;
    inputBorder: string;
    inputPlaceholder: string;
    link: string;
    backgroundImage: any;
    com: string;
    secondary: string;
  };
  iconBg: string;
  iconFg: string;
  iconBack: string;
  iconBackBg: string;
  iconPress: string;
  placeholderDark: string;
  senderBubble: string;
  senderText: string;
  receiverBubble: string;
  receiverText: string;
  replyPreview: string;
  commentCard: string;
}

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
}

const lightColors: ThemeColors = {
  tabbg: "white",
  primary: "black",
  secondary: "#657786",
  background: "#FFFFFF",
  card: "white",
  text: "#000000",
  border: "#D3D3D3",
  icon: "#657786",
  placeholder: "#A9A9A9",
  error: "#E74C3C",
  success: "#27AE60",
  fill: "#FF4500",
  hashtag: "#1DA1F2",
  like: "#E91E63",
  grey: "#808080",
  lightgrey: "#D3D3D3",
  overlay: "#FFFFFF",
  link: "#1DA1F2",
  chatbg: "#d3d3d3",
  chatcom: "lightgrey",
  chatrec: "#71797E",
  transparent: "transparent",
  chatPrimary: "#E5E5EA",
  chatSecondary: "#657786",
  chatBackground: "#FFFFFF",
  chatCard: "#1DA1F2",
  chatText: "#000000",
  chatBorder: "#D3D3D3",
  chatIcon: "white",
  chatLink: "#1DA1F2",
  chatBackgroundImage: chatlight,
  chatroom: {
    primary: "#075E54",
    accent: "#25D366",
    background: "#ece5dd",
    card: "#fff",
    text: "black",
    border: "#ece5dd",
    icon: "grey",
    placeholder: "#999",
    senderBubble: "#fff",
    receiverBubble: "#075E54",
    bubbleText: "white",
    headerText: "#fff",
    inputBg: "#fff",
    inputText: "#222",
    inputBorder: "#ddd",
    inputPlaceholder: "#999",
    link: "#075E54",
    backgroundImage: chatlight,
    com: "lightgrey",
    secondary: "black",
  },
  iconBg: "#000",
  iconFg: "#fff",
  iconBack: "#000",
  iconBackBg: "transparent",
  iconPress: "#D3D3D3",
  placeholderDark: "#555",
  senderBubble: "#DCF8C6",
  senderText: "#000",
  receiverBubble: "#fff",
  receiverText: "#000",
  replyPreview: "rgba(220, 248, 198, 0.5)",
  commentCard: "#F7F7F7",
};

const darkColors: ThemeColors = {
  tabbg: "black",
  primary: "#0A84FF",
  secondary: "#E5E4E2",
  background: "black",
  card: "black",
  text: "#FFFFFF",
  border: "#0A84FF",
  icon: "lightgrey",
  placeholder: "black",
  error: "#E74C3C",
  success: "#27AE60",
  fill: "red",
  like: "#E91E63",
  hashtag: "#0A84FF",
  grey: "grey",
  lightgrey: "#E5E4E2",
  overlay: "black",
  link: "#ADD8E6",
  chatbg: "#36454F",
  chatcom: "grey",
  chatrec: "#71797E",
  transparent: "transparent",
  chatPrimary: "#253341",
  chatSecondary: "#8899A6",
  chatBackground: "#15202B",
  chatCard: "#192734",
  chatText: "#D9D9D9",
  chatBorder: "#38444C",
  chatIcon: "#8899A6",
  chatLink: "#1DA1F2",
  chatBackgroundImage: chatdark,
  chatroom: {
    primary: "#075E54",
    accent: "#25D366",
    background: "#121B22",
    card: "#1F2C34",
    text: "#fff",
    border: "#2A3942",
    icon: "#25D366",
    placeholder: "#8696A0",
    senderBubble: "#005C4B",
    receiverBubble: "#202C33",
    bubbleText: "#fff",
    headerText: "#fff",
    inputBg: "#202C33",
    inputText: "#fff",
    inputBorder: "#2A3942",
    inputPlaceholder: "#8696A0",
    link: "#25D366",
    backgroundImage: chatdark,
    com: "grey",
    secondary: "#E5E4E2",
  },
  iconBg: "#fff",
  iconFg: "#000",
  iconBack: "#fff",
  iconBackBg: "transparent",
  iconPress: "#222",
  placeholderDark: "#AAA",
  senderBubble: "#075E54",
  senderText: "#fff",
  receiverBubble: "#fff",
  receiverText: "#000",
  replyPreview: "rgba(7, 94, 84, 0.5)",
  commentCard: "#232D36",
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>("light");

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("theme");
        if (savedTheme) {
          setThemeState(savedTheme as ThemeType);
        } else {
          setThemeState(systemColorScheme === "dark" ? "dark" : "light");
        }
      } catch (error) {
        console.error("Error loading theme:", error);
        setThemeState("light");
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  useEffect(() => {
    const applyThemeToNavigationBar = async () => {
      try {
        if (theme === "dark") {
          if (Platform.OS === "android") {
            await setColor("#15202B");
            await setNavigationBarContrastEnforced(false);
            await setNavigationBarLight(false);
          } else if (Platform.OS === "ios") {
            StatusBar.setBackgroundColor("#15202B");
            StatusBar.setBarStyle("light-content");
          }
        } else {
          if (Platform.OS === "android") {
            await setColor("#FFFFFF");
            await setNavigationBarContrastEnforced(false);
            await setNavigationBarLight(true);
          } else if (Platform.OS === "ios") {
            StatusBar.setBackgroundColor("#FFFFFF");
            StatusBar.setBarStyle("dark-content");
          }
        }
      } catch (error) {
        console.error("Error setting navigation bar:", error);
        console.log("NavigationBar available:", typeof setColor === "function");
      }
    };
    applyThemeToNavigationBar();
  }, [theme]);

  const toggleTheme = async () => {
    try {
      const newTheme = theme === "light" ? "dark" : "light";
      setThemeState(newTheme);
      await AsyncStorage.setItem("theme", newTheme);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  const setTheme = async (newTheme: ThemeType) => {
    try {
      setThemeState(newTheme);
      await AsyncStorage.setItem("theme", newTheme);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  const colors = theme === "light" ? lightColors : darkColors;

  const contextValue: ThemeContextType = {
    theme,
    colors,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};



