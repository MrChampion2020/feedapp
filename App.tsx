import { StatusBar } from "expo-status-bar"
import React, { useState, useEffect, useRef } from "react"
import { View, Text, AppState, type AppStateStatus } from "react-native"
import { AuthProvider } from "./src/contexts/AuthContext"
import { ThemeProvider } from "./src/contexts/ThemeContext"
import AppNavigator from "./src/navigation/index"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { BlankScreenOverlay } from "./src/components/BlankScreen"
import { AppLockScreen } from "./src/components/LockScreen"
import AsyncStorage from "@react-native-async-storage/async-storage"

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
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
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
        </View>
      )
    }

    return this.props.children
  }
}

export default function App() {
  const [showBlankScreen, setShowBlankScreen] = useState(false)
  const [showAppLock, setShowAppLock] = useState(false)
  const appState = useRef(AppState.currentState)

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <AppNavigator />
            <StatusBar style="auto" />

            {/* Blank screen overlay when app is in background */}
            <BlankScreenOverlay visible={showBlankScreen} />

            {/* App lock screen */}
            <AppLockScreen visible={showAppLock} onUnlock={handleUnlock} />
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}



// import { StatusBar } from "expo-status-bar"
// import React, { useState, useEffect } from "react"
// import { View, Text, AppState } from "react-native"
// import { AuthProvider } from "./src/contexts/AuthContext"
// import { ThemeProvider } from "./src/contexts/ThemeContext"
// import AppNavigator from "./src/navigation/index"
// import { GestureHandlerRootView } from "react-native-gesture-handler"
// import { BlankScreenOverlay } from "./src/components/BlankScreen"
// import { AppLockScreen } from "./src/components/LockScreen"
// import AsyncStorage from "@react-native-async-storage/async-storage"

// // Error Boundary Component
// class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
//   constructor(props: { children: React.ReactNode }) {
//     super(props)
//     this.state = { hasError: false, error: null }
//   }

//   static getDerivedStateFromError(error: Error) {
//     return { hasError: true, error }
//   }

//   componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
//     console.error("App Error:", error, errorInfo)
//   }

//   render() {
//     if (this.state.hasError) {
//       return (
//         <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
//           <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>Something went wrong</Text>
//           <Text style={{ textAlign: "center", marginBottom: 20 }}>
//             {this.state.error?.message || "An unexpected error occurred"}
//           </Text>
//           <Text
//             style={{ color: "#1DA1F2", textDecorationLine: "underline" }}
//             onPress={() => this.setState({ hasError: false, error: null })}
//           >
//             Try Again
//           </Text>
//         </View>
//       )
//     }

//     return this.props.children
//   }
// }

// export default function App() {
//   const [showBlankScreen, setShowBlankScreen] = useState(false)
//   const [showAppLock, setShowAppLock] = useState(false)
//   const [appState, setAppState] = useState(AppState.currentState)

//   useEffect(() => {
//     const subscription = AppState.addEventListener("change", handleAppStateChange)

//     return () => subscription?.remove()
//   }, [])

//   const handleAppStateChange = async (nextAppState: any) => {
//     console.log("App state changed from", appState, "to", nextAppState)

//     // Check if app lock is enabled
//     const appLockEnabled = await AsyncStorage.getItem("appLockEnabled")

//     if (appState.match(/inactive|background/) && nextAppState === "active") {
//       // App has come to the foreground
//       setShowBlankScreen(false)

//       if (appLockEnabled === "true") {
//         setShowAppLock(true)
//       }
//     } else if (nextAppState.match(/inactive|background/)) {
//       // App is going to background
//       setShowBlankScreen(true)
//     }

//     setAppState(nextAppState)
//   }

//   const handleUnlock = () => {
//     setShowAppLock(false)
//   }

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <ErrorBoundary>
//         <ThemeProvider>
//           <AuthProvider>
//             <AppNavigator />
//             <StatusBar style="auto" />

//             {/* Blank screen overlay when app is in background */}
//             <BlankScreenOverlay visible={showBlankScreen} />

//             {/* App lock screen */}
//             <AppLockScreen visible={showAppLock} onUnlock={handleUnlock} />
//           </AuthProvider>
//         </ThemeProvider>
//       </ErrorBoundary>
//     </GestureHandlerRootView>
//   )
// }


// // "use client"
// // import { StatusBar } from "expo-status-bar"
// // import React from "react"
// // import { View, Text } from "react-native"
// // import { AuthProvider } from "./src/contexts/AuthContext"
// // import { ThemeProvider } from "./src/contexts/ThemeContext"
// // import AppNavigator from "./src/navigation/index"
// // import { GestureHandlerRootView } from 'react-native-gesture-handler';

// // // Error Boundary Component
// // class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
// //   constructor(props: { children: React.ReactNode }) {
// //     super(props)
// //     this.state = { hasError: false, error: null }
// //   }

// //   static getDerivedStateFromError(error: Error) {
// //     return { hasError: true, error }
// //   }

// //   componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
// //     console.error("App Error:", error, errorInfo)
// //   }

// //   render() {
// //     if (this.state.hasError) {
// //       return (
// //         <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
// //           <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>Something went wrong</Text>
// //           <Text style={{ textAlign: "center", marginBottom: 20 }}>
// //             {this.state.error?.message || "An unexpected error occurred"}
// //           </Text>
// //           <Text
// //             style={{ color: "#1DA1F2", textDecorationLine: "underline" }}
// //             onPress={() => this.setState({ hasError: false, error: null })}
// //           >
// //             Try Again
// //           </Text>
// //         </View>
// //       )
// //     }

// //     return this.props.children
// //   }
// // }

// // export default function App() {
// //   return (
// //     <GestureHandlerRootView style={{ flex: 1 }}>
// //     <ErrorBoundary>
// //       <ThemeProvider>
// //         <AuthProvider>
// //           <AppNavigator />
// //           <StatusBar style="auto" />
// //         </AuthProvider>
// //       </ThemeProvider>
// //     </ErrorBoundary>
// //     </GestureHandlerRootView>
// //   )
// // }

