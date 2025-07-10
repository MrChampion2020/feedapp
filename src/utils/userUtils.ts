// Utility functions for user verification status

/**
 * Get user verification status based on user ID
 * TEMPORARY: All users get verified badge for testing
 */
export const getUserVerificationStatus = (userId: string) => {
  if (!userId) {
    return {
      isVerified: false,
      isPremiumVerified: false,
    }
  }

  // TEMPORARY: Make all users verified for testing
  return {
    isVerified: true,
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

/**
 * Test function to debug verification system
 * Call this in your app to see what's happening
 */
export const testVerificationSystem = () => {
  // Test with different user IDs
  const testUserIds = [
    "507f1f77bcf86cd799439011", // MongoDB ObjectId format
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013",
    "507f1f77bcf86cd799439014",
    "507f1f77bcf86cd799439015",
    "user123", // Simple string
    "user456",
    "user789",
    "testuser1",
    "testuser2"
  ]
  
  testUserIds.forEach((userId, index) => {
    const { isVerified, isPremiumVerified } = getUserVerificationStatus(userId)
    const badgeType = getVerificationBadgeType(userId)
  })
}
