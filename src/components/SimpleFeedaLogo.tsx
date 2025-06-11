"use client"

import type React from "react"
import { View, StyleSheet } from "react-native"
import Svg, { Path } from "react-native-svg"
import { useTheme } from "../contexts/ThemeContext"
import * as Animatable from "react-native-animatable"

interface SimpleFeedaLogoProps {
  size?: number
  color?: string
  style?: any
}

const SimpleFeedaLogo: React.FC<SimpleFeedaLogoProps> = ({ size = 120, color, style }) => {
  const { colors } = useTheme()

  // Use provided color or default to theme text color
  const logoColor = color || colors.text

  // Define animation for the SVG container
  const animationProps = {
    animation: {
      0: { opacity: 0, scale: 0.8 },
      0.5: { opacity: 1, scale: 1.1 },
      1: { opacity: 1, scale: 1 },
    },
    duration: 1000,
    easing: "ease-out-elastic" as Animatable.Easing,
    iterationCount: 1,
  }

  return (
    <View style={[styles.container, style]}>
      <Animatable.View {...animationProps}>
        <Svg width={size} height={size * 0.4} viewBox="0 0 500 200">
          {/* Main "Feeda" path - simplified cursive style */}
          <Path
            d="M50 160 
               C 50 120, 80 100, 120 140
               C 140 160, 160 140, 180 160
               C 200 180, 220 140, 250 160
               C 280 180, 300 140, 330 160
               C 360 180, 380 140, 420 160
               C 440 170, 460 150, 480 160"
            stroke={logoColor}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Letter "F" flourish */}
          <Path
            d="M45 150 C 60 130, 80 140, 95 150"
            stroke={logoColor}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />

          {/* Letter "F" crossbar */}
          <Path
            d="M65 155 L 85 155"
            stroke={logoColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </Animatable.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent", // Ensure no background
  },
})

export default SimpleFeedaLogo