
import type React from "react"
import { useEffect, useState, useRef } from "react"
import { AppState, type AppStateStatus } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

interface AppStateManagerProps {
  children: React.ReactNode
  onAppStateChange?: (state: AppStateStatus) => void
}

export const AppStateManager: React.FC<AppStateManagerProps> = ({ children, onAppStateChange }) => {
  const appState = useRef(AppState.currentState)
  const [isAppLocked, setIsAppLocked] = useState(false)
  const [showBlankScreen, setShowBlankScreen] = useState(false)

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
        setIsAppLocked(true)
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App is going to background
      setShowBlankScreen(true)
    }

    appState.current = nextAppState
    onAppStateChange?.(nextAppState)
  }

  return (
    <>
      {children}
      {/* Add your blank screen and lock components here */}
    </>
  )
}
