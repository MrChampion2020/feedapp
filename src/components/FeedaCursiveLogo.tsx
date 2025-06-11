"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { Animated, Easing } from "react-native"
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from "react-native-svg"
import { useTheme } from "../contexts/ThemeContext"

interface FeedaCursiveLogoProps {
  size?: number
  animated?: boolean
  showGradient?: boolean
  style?: any
}

const FeedaCursiveLogo: React.FC<FeedaCursiveLogoProps> = ({
  size = 120,
  animated = true,
  showGradient = true,
  style,
}) => {
  const { colors, theme } = useTheme()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const pathAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (animated) {
      // Main entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start()

      // Path drawing animation
      Animated.timing(pathAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start()

      // Subtle glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ).start()
    } else {
      fadeAnim.setValue(1)
      scaleAnim.setValue(1)
      pathAnim.setValue(1)
    }
  }, [animated])

  // Dynamic colors based on theme
  const primaryColor = theme === "dark" ? "#6366F1" : "#4F46E5"
  const secondaryColor = theme === "dark" ? "#EC4899" : "#E11D48"
  const accentColor = theme === "dark" ? "#10B981" : "#059669"
  const textColor = colors.text

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  })

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          shadowColor: primaryColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 10,
        },
        style,
      ]}
    >
      <Svg width={size} height={size * 0.5} viewBox="0 0 400 200">
        <Defs>
          {showGradient && (
            <>
              <LinearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={primaryColor} stopOpacity="1" />
                <Stop offset="30%" stopColor={secondaryColor} stopOpacity="1" />
                <Stop offset="70%" stopColor={accentColor} stopOpacity="1" />
                <Stop offset="100%" stopColor={primaryColor} stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.6" />
                <Stop offset="50%" stopColor={secondaryColor} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={accentColor} stopOpacity="0.6" />
              </LinearGradient>
            </>
          )}
        </Defs>

        {/* Glow effect background */}
        {showGradient && (
          <Path
            d="M30 120 Q40 80, 70 100 Q90 120, 110 90 Q130 60, 160 90 Q180 120, 200 90 Q220 60, 250 90 Q270 120, 290 90 Q310 60, 340 90 Q360 120, 380 100"
            stroke="url(#glowGradient)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={animated ? glowOpacity : 0.6}
          />
        )}

        {/* Main cursive "Feeda" path */}
        <Path
          d="M30 120 Q40 80, 70 100 Q90 120, 110 90 Q130 60, 160 90 Q180 120, 200 90 Q220 60, 250 90 Q270 120, 290 90 Q310 60, 340 90 Q360 120, 380 100"
          stroke={showGradient ? "url(#mainGradient)" : textColor}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Letter "F" flourish */}
        <Path
          d="M25 110 Q35 90, 45 110 Q55 130, 65 110"
          stroke={showGradient ? primaryColor : textColor}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity={animated ? 0.8 : 1}
        />

        {/* Letter "a" tail flourish */}
        <Path
          d="M370 105 Q380 85, 390 105 Q395 115, 385 125"
          stroke={showGradient ? accentColor : textColor}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity={animated ? 0.8 : 1}
        />

        {/* Decorative dots */}
        <Circle cx="80" cy="70" r="2.5" fill={showGradient ? primaryColor : textColor} opacity="0.8" />
        <Circle cx="200" cy="65" r="2" fill={showGradient ? secondaryColor : textColor} opacity="0.7" />
        <Circle cx="320" cy="70" r="2.2" fill={showGradient ? accentColor : textColor} opacity="0.9" />

        {/* Underline flourish */}
        <Path
          d="M40 140 Q200 150, 360 140"
          stroke={showGradient ? "url(#mainGradient)" : textColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity={0.6}
        />
      </Svg>
    </Animated.View>
  )
}

export default FeedaCursiveLogo
