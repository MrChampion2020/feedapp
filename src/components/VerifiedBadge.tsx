import React from "react"
import { View, StyleSheet } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"
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
  // Check color: black for dark theme, white for light theme
  const dynamicCheckColor = checkColor || (theme === "dark" ? "#000" : "#fff")

  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle cx="16" cy="16" r="16" fill={badgeColor} />
        <Path
          d="M10 17l4 4 8-8"
          fill="none"
          stroke={dynamicCheckColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },
})

export default VerifiedBadge
