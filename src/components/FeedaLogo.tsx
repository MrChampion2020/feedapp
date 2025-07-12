
import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { useTheme } from "../contexts/ThemeContext"

interface FeedaLogoProps {
  size?: number
  animated?: boolean
  showGradient?: boolean
  color?: string
  style?: any
}

const FeedaLogo: React.FC<FeedaLogoProps> = ({ size = 120, animated = false, showGradient = false, color, style }) => {
  const { colors, theme } = useTheme()

  // Dynamic colors based on theme
  const logoColor = color || colors.text

  return (
    <View style={[styles.container, style]}>
      <Text style={[
        styles.logoText,
        {
          color: logoColor,
          fontSize: size * 0.3,
        }
      ]}>
        Feeda
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "cursive",
    fontWeight: "bold",
    textShadowColor: "#00000033",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
})

export default FeedaLogo
