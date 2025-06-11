
import type React from "react"
import { useEffect, useRef } from "react"
import { Animated, Easing, StyleSheet } from "react-native"
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from "react-native-svg"
import { useTheme } from "../contexts/ThemeContext"

interface FeedaLogoProps {
  size?: number
  animated?: boolean
  showGradient?: boolean
  color?: string
  style?: any
}

const FeedaLogo: React.FC<FeedaLogoProps> = ({ size = 120, animated = true, showGradient = false, color, style }) => {
  const { colors, theme } = useTheme()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const floatAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (animated) {
      // Initial entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start()

      // Continuous floating motion
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 3000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ).start()

      // Subtle glow animation
      if (showGradient) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 2000,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: false,
            }),
          ]),
        ).start()
      }
    } else {
      fadeAnim.setValue(1)
      scaleAnim.setValue(1)
    }
  }, [animated, showGradient])

  // Animation interpolations
  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  })

  const rotate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1deg"],
  })

  // Dynamic colors based on theme
  const logoColor = color || colors.text
  const primaryColor = theme === "dark" ? "#6366F1" : "#4F46E5"
  const secondaryColor = theme === "dark" ? "#EC4899" : "#E11D48"

  return (
    <Animated.View
      style={[
        styles.container,
        {
                      color: colors.text,
                      fontFamily: "cursive",
                      fontSize: 38,
                      fontWeight: "bold",
                      textShadowColor: "#00000033",
                      textShadowOffset: { width: 0, height: 2 },
                      textShadowRadius: 2,
        },
        style,
      ]}
    >
        Feeda
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
})

export default FeedaLogo
