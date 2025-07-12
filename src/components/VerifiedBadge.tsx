import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { useTheme } from "../contexts/ThemeContext"

interface VerifiedBadgeProps {
  isVerified: boolean
  isPremiumVerified?: boolean
  size?: number
  style?: any
  checkColor?: string // allow override if needed
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ isVerified, isPremiumVerified = false, size = 12, style, checkColor }) => {
  const { colors, theme } = useTheme ? useTheme() : { colors: {}, theme: "light" };
  if (!isVerified && !isPremiumVerified) return null

  const badgeColor = isPremiumVerified ? "#FFD700" : "#1DA1F2"
  const dynamicCheckColor = checkColor || (theme === "dark" ? "#000" : "#fff")
  
  // Make the background container smaller based on the size prop
  const containerSize = Math.max(size + 2, 8) // Minimum 8px, otherwise size + 2px padding
  const checkmarkSize = Math.min(size, 14) // Cap checkmark at 14px max

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: badgeColor,
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2,
      }, 
      style
    ]}>
      <Text style={[styles.checkmark, { color: dynamicCheckColor, fontSize: checkmarkSize }]}>
        ✓
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  checkmark: {
    fontWeight: "bold",
  },
})

export default VerifiedBadge
