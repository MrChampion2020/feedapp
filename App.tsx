import { StatusBar } from "expo-status-bar"
import { View } from "react-native"
import React, { useState, useEffect, useRef, createContext, useContext } from "react"
import { View as RNView, Text, AppState, type AppStateStatus, Platform } from "react-native"

// Navigation bar theming is handled in ThemeContext.tsx
import { AuthProvider } from "./src/contexts/AuthContext"
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext"
import AppNavigator from "./src/navigation/index"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { BlankScreenOverlay } from "./src/components/BlankScreen"
import { AppLockScreen } from "./src/components/LockScreen"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

// Debug utilities for React Native text warnings
import { enableTextWarningDebug } from "./src/utils/debugUtils"

// StatusBar Context
const StatusBarContext = createContext<{
  setStatusBarStyle: (style: "light" | "dark") => void;
}>({
  setStatusBarStyle: () => {},
});

export const useStatusBar = () => useContext(StatusBarContext);

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App Error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <RNView style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ textAlign: "center", marginBottom: 20 }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Text
            style={{ color: "#1DA1F2", textDecorationLine: "underline" }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </Text>
        </RNView>
      )
    }

    return this.props.children
  }
}

function ThemedAppContent({ showBlankScreen, showAppLock, handleUnlock }: { showBlankScreen: boolean, showAppLock: boolean, handleUnlock: () => void }) {
  const { colors, theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} backgroundColor={colors.background} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppNavigator />
      </SafeAreaView>
      <BlankScreenOverlay visible={showBlankScreen} />
      <AppLockScreen visible={showAppLock} onUnlock={handleUnlock} />
    </View>
  );
}

export default function App() {
  // Enable text warning debugging in development
  if (__DEV__) {
    enableTextWarningDebug();
  }

  const [showBlankScreen, setShowBlankScreen] = useState(false)
  const [showAppLock, setShowAppLock] = useState(false)
  const appState = useRef(AppState.currentState)
  // Remove local statusBarStyle state
  // const [statusBarStyle, setStatusBarStyle] = useState<"light" | "dark">("dark")

  // Use theme from ThemeContext
  // const { colors, theme } = useTheme();

  // Load theme on app start to set initial StatusBar style
  useEffect(() => {
    const loadInitialTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("theme");
        const isDark = savedTheme === "dark";
        // setStatusBarStyle(isDark ? "light" : "dark"); // This line is removed
        console.log("🎨 App.tsx: Initial StatusBar style set to", isDark ? "light" : "dark");
      } catch (error) {
        console.error("❌ Failed to load initial theme:", error);
      }
    };
    loadInitialTheme();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange)

    return () => subscription?.remove()
  }, [])

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log("App state changed from", appState.current, "to", nextAppState)

    // Check if app lock is enabled
    const appLockEnabled = await AsyncStorage.getItem("appLockEnabled")

    if (appState.current.match(/inactive|background/) && nextAppState === "active") {
      // App has come to the foreground
      setShowBlankScreen(false)

      if (appLockEnabled === "true") {
        setShowAppLock(true)
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App is going to background
      setShowBlankScreen(true)
    }

    appState.current = nextAppState
  }

  const handleUnlock = () => {
    setShowAppLock(false)
  }

  // Navigation bar theming is handled in ThemeContext.tsx

  // Use View instead of SafeAreaView to prevent layout recalculation issues
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <ThemedAppContent showBlankScreen={showBlankScreen} showAppLock={showAppLock} handleUnlock={handleUnlock} />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}

