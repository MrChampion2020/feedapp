import type React from "react"
import { View, StyleSheet } from "react-native"
import { CheckCircle, Crown } from "lucide-react-native"

interface VerifiedBadgeProps {
  isVerified: boolean
  isPremiumVerified?: boolean
  size?: number
  style?: any
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ isVerified, isPremiumVerified = false, size = 16, style }) => {
  if (!isVerified && !isPremiumVerified) {
    return null
  }

  return (
    <View style={[styles.container, style]}>
      {isPremiumVerified ? (
        <Crown size={size} color="#FFD700" fill="#FFD700" />
      ) : isVerified ? (
        <CheckCircle size={size} color="#1DA1F2" fill="#1DA1F2" />
      ) : null}
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
