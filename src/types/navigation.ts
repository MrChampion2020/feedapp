import type { RouteProp } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"

export type RootStackParamList = {
  HomeTab: undefined
  Login: undefined
  Signup: undefined
  UploadFeed: undefined
  Search: { initialQuery?: string; initialType?: string; activeHashtag?: string }
  Notifications: undefined
  Chat: { userId?: string }
  UserProfile: { userId: string }
  PostView: { post?: any; postId?: string; activeHashtag?: string }
  Terms: undefined
  Privacy: undefined
}

export type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "HomeTab">

export type HomeScreenRouteProp = RouteProp<RootStackParamList, "HomeTab">



// // Updated navigation types to avoid conflicts
// export type RootStackParamList = {
//   // Auth Stack
//   Onboard: undefined
//   Login: undefined
//   SignUp: undefined
//   Verify: { email: string }
//   ChangePassword: undefined

//   // Main App
//   MainTabs: undefined

//   // Individual screens
//   HomeFeed: undefined
//   UserProfile: { userId: string }
//   Chat: undefined
//   UploadFeed: undefined
//   Settings: undefined

//   // Additional screens you might have
//   PostDetails: { postId: string }
//   EditProfile: undefined
// }

// export type MainTabParamList = {
//   HomeTab: undefined
//   ChatTab: undefined
//   UploadTab: undefined
//   ProfileTab: undefined
//   SettingsTab: undefined
// }

// // Screen props types for type safety
// import type { NativeStackScreenProps } from "@react-navigation/native-stack"
// import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs"

// export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>

// export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<MainTabParamList, T>
