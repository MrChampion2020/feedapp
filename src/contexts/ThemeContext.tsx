import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useColorScheme } from "react-native"

type ThemeType = "light" | "dark"

interface ThemeColors {
  primary: string
  background: string
  card: string
  text: string
  border: string
  icon: string
  placeholder: string
  error: string
  success: string
  fill: string
  hashtag: string
  like: string
  grey: string
  overlay: string
  secondary: string
  link: string
  chatbg: string
  chatrec: string
  lightgrey: string
  chatcom: string
  transparent: string

  // Chat-specific colors for X-style chat room
  chatPrimary: string
  chatSecondary: string
  chatBackground: string
  chatCard: string
  chatText: string
  chatBorder: string
  chatIcon: string
  chatLink: string
}

interface ThemeContextType {
  theme: ThemeType
  colors: ThemeColors
  toggleTheme: () => void
  setTheme: (theme: ThemeType) => void
}

const lightColors: ThemeColors = {
  primary: "black",
  secondary: "grey",
  background: "#FFFFFF",
  card: "#FFFFFF",
  text: "#14171A",
  border: "#E1E8ED",
  icon: "#657786",
  placeholder: "black",
  error: "#E74C3C",
  success: "#27AE60",
  fill: "red",
  hashtag: "#0A84FF",
  like: "#E91E63",
  grey: "grey",
  lightgrey: "#E5E4E2",
  overlay: "white",
  link: "#ADD8E6",
  chatbg: "#d3d3d3",
  chatcom: "#F0FFFF",
  chatrec: "#71797E",
  transparent: "transparent",


  
// Updated chat-specific colors for a WhatsApp/X-inspired light theme
  chatPrimary: "#DCF8C6", // Soft teal-green for user chat bubbles, send button (WhatsApp-inspired)
  chatSecondary: "#82939E", // Muted gray for timestamps, subtle accents
  chatBackground: "#F7F9FA", // Off-white for a clean chat room base
  chatCard: "#ECEFF1", // Light gray for other users' chat bubbles
  chatText: "#2A2A2A", // Dark gray for readable text
  chatBorder: "#D8DDE1", // Subtle gray for reply previews
  chatIcon: "#607D8B", // Medium gray for chat icons (media buttons)
  chatLink: "#1DA1F2" // X Blue for clickable links

  // chatPrimary: "#E8F5FD", // Light Blue: User chat bubbles, send button
  // chatSecondary: "grey", // Soft Gray: Timestamps, subtle accents
  // chatBackground: "#FFFFFF", // White: Clean chat room base
  // chatCard: "#F5F8FA", // Light Gray: Other users' chat bubbles
  // chatText: "#14171A", // Dark Gray: Readable text
  // chatBorder: "#E1E8ED", // Subtle Gray: Borders for reply previews
  // chatIcon: "#657786", // Medium Gray: Chat icons (media buttons)
  // chatLink: "#1DA1F2" // X Blue: Clickable links
}

const darkColors: ThemeColors = {
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

  // X-style chat-specific colors for dark theme
  chatPrimary: "#253341", // Dark Grayish-Blue: User chat bubbles, send button
  chatSecondary: "#8899A6", // Muted Gray: Timestamps, subtle accents
  chatBackground: "#15202B", // Dark Gray: Sleek chat room base
  chatCard: "#192734", // Slightly Lighter Gray: Other users' chat bubbles
  chatText: "#D9D9D9", // Off-White: Readable text
  chatBorder: "#38444C", // Dark Gray: Borders for reply previews
  chatIcon: "#8899A6", // Light Gray: Chat icons (media buttons)
  chatLink: "#1DA1F2" // X Blue: Clickable links
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme()
  const [theme, setThemeState] = useState<ThemeType>("light")

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("theme")
        if (savedTheme) {
          setThemeState(savedTheme as ThemeType)
        } else {
          setThemeState(systemColorScheme === "dark" ? "dark" : "light")
        }
      } catch (error) {
        console.error("Error loading theme:", error)
        setThemeState("light")
      }
    }
    loadTheme()
  }, [systemColorScheme])

  const toggleTheme = async () => {
    try {
      const newTheme = theme === "light" ? "dark" : "light"
      setThemeState(newTheme)
      await AsyncStorage.setItem("theme", newTheme)
    } catch (error) {
      console.error("Error saving theme:", error)
    }
  }

  const setTheme = async (newTheme: ThemeType) => {
    try {
      setThemeState(newTheme)
      await AsyncStorage.setItem("theme", newTheme)
    } catch (error) {
      console.error("Error saving theme:", error)
    }
  }

  const colors = theme === "light" ? lightColors : darkColors

  const contextValue: ThemeContextType = {
    theme,
    colors,
    toggleTheme,
    setTheme,
  }

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}



// import type React from "react"
// import { createContext, useContext, useState, useEffect } from "react"
// import AsyncStorage from "@react-native-async-storage/async-storage"
// import { useColorScheme } from "react-native"

// type ThemeType = "light" | "dark"

// interface ThemeColors {
//   primary: string
//   background: string
//   card: string
//   text: string
//   border: string
//   icon: string
//   placeholder: string
//   error: string
//   success: string
//   fill: string
//   hashtag: string
//   like: string
//   grey: string
//   overlay: string
//   secondary: string
//   link: string
//   chatbg: string
//   chatrec: string
//   lightgrey: string
//   chatcom: string


// }

// interface ThemeContextType {
//   theme: ThemeType
//   colors: ThemeColors
//   toggleTheme: () => void
//   setTheme: (theme: ThemeType) => void
// }

// const lightColors: ThemeColors = {
//   primary: "black",
//   secondary: "grey",
//   background: "#FFFFFF",
//   card: "#FFFFFF",
//   text: "#14171A",
//   border: "#E1E8ED",
//   icon: "#657786",
//   placeholder: "black",
//   error: "#E74C3C",
//   success: "#27AE60",
//   fill: "red",
//   hashtag: "#0A84FF",
//   like: "#E91E63",
//   grey: "grey",
//   lightgrey: "#E5E4E2",
//   overlay: "white",
//   link: "#ADD8E6",
//   chatbg: "#d3d3d3",
//   chatcom: "#71797E",
//   chatrec: "#40826D"
// }

// const darkColors: ThemeColors = {
//   primary: "#0A84FF",
//   secondary: "#E5E4E2",
//   background: "black",
//   card: "black",
//   text: "#FFFFFF",
//   border: "#0A84FF",
//   icon: "lightgrey",
//   placeholder: "black",
//   error: "#E74C3C",
//   success: "#27AE60",
//   fill: "red",
//   like: "#E91E63",
//   hashtag: "#0A84FF",
//   grey: "grey",
//   lightgrey: "#E5E4E2",
//   overlay: "black",
//   link: "#ADD8E6",
//   chatbg: "#36454F",
//   chatcom: "#71797E",
//   chatrec: "#40826D"
// }

// const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// export const useTheme = () => {
//   const context = useContext(ThemeContext)
//   if (!context) {
//     throw new Error("useTheme must be used within a ThemeProvider")
//   }
//   return context
// }

// export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const systemColorScheme = useColorScheme()
//   const [theme, setThemeState] = useState<ThemeType>("light")

//   useEffect(() => {
//     const loadTheme = async () => {
//       try {
//         const savedTheme = await AsyncStorage.getItem("theme")
//         if (savedTheme) {
//           setThemeState(savedTheme as ThemeType)
//         } else {
//           // Use system theme as default
//           setThemeState(systemColorScheme === "dark" ? "dark" : "light")
//         }
//       } catch (error) {
//         console.error("Error loading theme:", error)
//         setThemeState("light")
//       }
//     }
//     loadTheme()
//   }, [systemColorScheme])

//   const toggleTheme = async () => {
//     try {
//       const newTheme = theme === "light" ? "dark" : "light"
//       setThemeState(newTheme)
//       await AsyncStorage.setItem("theme", newTheme)
//     } catch (error) {
//       console.error("Error saving theme:", error)
//     }
//   }

//   const setTheme = async (newTheme: ThemeType) => {
//     try {
//       setThemeState(newTheme)
//       await AsyncStorage.setItem("theme", newTheme)
//     } catch (error) {
//       console.error("Error saving theme:", error)
//     }
//   }

//   const colors = theme === "light" ? lightColors : darkColors

//   const contextValue: ThemeContextType = {
//     theme,
//     colors,
//     toggleTheme,
//     setTheme,
//   }

//   return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
// }


