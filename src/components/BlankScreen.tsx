"use client"

import type React from "react"
import { View, StyleSheet, Image } from "react-native"
import { useTheme } from "../contexts/ThemeContext"

interface BlankScreenOverlayProps {
  visible: boolean
}

export const BlankScreenOverlay: React.FC<BlankScreenOverlayProps> = ({ visible }) => {
  const { colors } = useTheme()

  if (!visible) return null

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image source={require("../assets/images/feeda.png")} style={{ width: 120, height: 120, resizeMode: 'contain' }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
})
