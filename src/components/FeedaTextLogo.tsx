
import type React from "react"
import { useEffect, useRef } from "react"
import { Animated, Easing } from "react-native"
import { useTheme } from "../contexts/ThemeContext"

interface FeedaTextLogoProps {
  size?: number
  animated?: boolean
  style?: any
}

const FeedaTextLogo: React.FC<FeedaTextLogoProps> = ({ size = 32, animated = true, style }) => {
  const { colors, theme } = useTheme()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const letterAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current

  useEffect(() => {
    if (animated) {
      // Main container animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start()

      // Staggered letter animations
      const letterAnimations = letterAnims.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: index * 100,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      )

      Animated.stagger(50, letterAnimations).start()
    } else {
      fadeAnim.setValue(1)
      scaleAnim.setValue(1)
      letterAnims.forEach((anim) => anim.setValue(1))
    }
  }, [animated])

  // Dynamic styling based on theme
  const logoStyle = {
    fontSize: size,
    fontWeight: "300" as const,
    letterSpacing: size * 0.05,
    color: colors.text,
    textShadowColor: theme === "dark" ? "rgba(74, 158, 255, 0.4)" : "rgba(26, 115, 232, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: "System", // You can replace with a custom font
  }

  const letters = ["F", "e", "e", "d", "a"]

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          flexDirection: "row",
          alignItems: "center",
        },
        style,
      ]}
    >
      {letters.map((letter, index) => (
        <Animated.Text
          key={index}
          style={[
            logoStyle,
            {
              transform: [
                {
                  translateY: letterAnims[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
                {
                  scale: letterAnims[index].interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.8, 1.1, 1],
                  }),
                },
              ],
              opacity: letterAnims[index],
            },
          ]}
        >
          {letter}
        </Animated.Text>
      ))}
    </Animated.View>
  )
}

export default FeedaTextLogo
