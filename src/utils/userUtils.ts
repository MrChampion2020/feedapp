// Utility functions for user verification status

/**
 * Get user verification status based on user ID
 * First 1000 users get verified badge, others get premium verified badge
 */
export const getUserVerificationStatus = (userId: string) => {
  if (!userId) {
    return {
      isVerified: false,
      isPremiumVerified: false,
    }
  }

  // Extract numeric part from MongoDB ObjectId or use hash for consistent assignment
  const userIdHash = hashUserId(userId)
  const userNumber = userIdHash % 10000 // Use modulo to create a range

  // First 1000 users (0-999) get verified badge
  if (userNumber < 1000) {
    return {
      isVerified: true,
      isPremiumVerified: false,
    }
  }

  // Users 1000-2000 get premium verified badge
  if (userNumber < 2000) {
    return {
      isVerified: false,
      isPremiumVerified: true,
    }
  }

  // Others get no badge
  return {
    isVerified: false,
    isPremiumVerified: false,
  }
}

/**
 * Simple hash function to convert userId to a consistent number
 */
const hashUserId = (userId: string): number => {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Check if user should have verified badge (first 1000 users)
 */
export const isUserVerified = (userId: string): boolean => {
  const { isVerified } = getUserVerificationStatus(userId)
  return isVerified
}

/**
 * Check if user should have premium verified badge
 */
export const isUserPremiumVerified = (userId: string): boolean => {
  const { isPremiumVerified } = getUserVerificationStatus(userId)
  return isPremiumVerified
}

/**
 * Get verification badge type as string
 */
export const getVerificationBadgeType = (userId: string): "verified" | "premium" | "none" => {
  const { isVerified, isPremiumVerified } = getUserVerificationStatus(userId)

  if (isPremiumVerified) return "premium"
  if (isVerified) return "verified"
  return "none"
}
