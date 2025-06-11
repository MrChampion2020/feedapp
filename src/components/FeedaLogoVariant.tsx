"use client"

import type React from "react"
import { View } from "react-native"
import FeedaLogo from "./FeedaLogo"
import FeedaTextLogo from "./FeedaTextLogo"
import FeedaCursiveLogo from "./FeedaCursiveLogo"

interface FeedaLogoVariantsProps {
  variant?: "svg" | "text" | "cursive" | "combined"
  size?: number
  animated?: boolean
  showGradient?: boolean
  style?: any
}

const FeedaLogoVariants: React.FC<FeedaLogoVariantsProps> = ({
  variant = "cursive",
  size = 120,
  animated = true,
  showGradient = true,
  style,
}) => {
  switch (variant) {
    case "svg":
      return <FeedaLogo size={size} animated={animated} showGradient={showGradient} style={style} />

    case "text":
      return <FeedaTextLogo size={size * 0.4} animated={animated} style={style} />

    case "cursive":
      return <FeedaCursiveLogo size={size} animated={animated} showGradient={showGradient} style={style} />

    case "combined":
    default:
      return (
        <View style={[{ alignItems: "center" }, style]}>
          <FeedaCursiveLogo size={size} animated={animated} showGradient={showGradient} />
          <View style={{ marginTop: -size * 0.1 }}>
            <FeedaTextLogo size={size * 0.2} animated={animated} />
          </View>
        </View>
      )
  }
}

export default FeedaLogoVariants
