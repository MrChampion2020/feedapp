"use client"

import { useState, useRef } from "react"
import { StyleSheet, View, Platform, Animated } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { GestureHandlerRootView } from "react-native-gesture-handler"

// Import the TabBar component
import { TabBar } from "../components/TabBar"

// Import Auth Context
import { useAuth } from "../contexts/AuthContext"

// Import Theme Context
import { ThemeProvider, useTheme } from "../contexts/ThemeContext"

// Registration Screens
import Onboard from "../screens/register/Onboard"
import Login from "../screens/register/Login"
import SignUp from "../screens/register/SignUp"
import Verify from "../screens/register/Verify"
import ChangePassword from "../screens/register/ChangePassword"

// Home Screens
import HomeScreen from "../screens/Home/HomeScreen"
import UserProfileScreen from "../screens/Home/UserProfileScreen"
import UploadFeed from "../screens/Home/UploadFeed"
import PostView from "../screens/Home/PostView"
import SearchScreen from "../screens/Home/SearchScreen"

// Other Screens
import ChatScreen from "../screens/Chat"
import SettingsScreen from "../screens/Settings/index"
import NotificationScreen from "../screens/Settings/Notification"
import FAQsScreen from "../screens/Settings/FAQs"
import SupportScreen from "../screens/Settings/Support"

import type { RootStackParamList, TabNavigatorParamList, SettingsStackParamList } from "../types/navigation"

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<TabNavigatorParamList>()
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>()

function SettingsNavigator() {
  const { logout } = useAuth()
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain">
        {(props) => <SettingsScreen {...props} onLogout={logout} />}
      </SettingsStack.Screen>
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="FAQs" component={FAQsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
    </SettingsStack.Navigator>
  )
}

function HomeStack() {
  const [tabBarVisible, setTabBarVisible] = useState(true)

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain">
        {(props) => <HomeScreen {...props} onTabBarVisibilityChange={setTabBarVisible} />}
      </Stack.Screen>
      <Stack.Screen name="UploadFeed" component={UploadFeed} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="PostView" component={PostView} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
    </Stack.Navigator>
  )
}

function TabNavigator() {
  const { user } = useAuth()
  const [tabBarVisible, setTabBarVisible] = useState(true)
  const [activeTab, setActiveTab] = useState("Home")
  const tabBarTranslateY = useRef(new Animated.Value(0)).current

  const handleTabBarVisibilityChange = (visible: boolean, currentRouteName: string) => {
    // Hide tab bar if the current route is "Chat", "Add", or "Settings" or any nested route within them
    const isHiddenRoute = ["Chat", "Add", "Settings"].includes(currentRouteName)
    const shouldShowTabBar = !isHiddenRoute && visible
    setTabBarVisible(shouldShowTabBar)
    Animated.timing(tabBarTranslateY, {
      toValue: shouldShowTabBar ? 0 : 100,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" }, // Hide the default tab bar
        }}
        screenListeners={{
          state: (e) => {
            const state = e.data.state
            const currentRoute = state.routes[state.index]
            let currentRouteName = currentRoute.name === "HomeTab" ? "Home" : currentRoute.name

            // Check for nested routes
            if (currentRoute.state) {
              const nestedRoute = currentRoute.state.routes[currentRoute.state.index]
              currentRouteName = nestedRoute.name === "HomeTab" ? "Home" : nestedRoute.name
            }

            setActiveTab(currentRouteName)
            handleTabBarVisibilityChange(true, currentRouteName)
          },
        }}
      >
        <Tab.Screen name="HomeTab" options={{ tabBarButton: () => null }}>
          {(props) => <HomeStack />}
        </Tab.Screen>
        <Tab.Screen name="Chat" children={() => <ChatScreen />} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Add" children={() => <UploadFeed />} options={{ tabBarButton: () => null }} />
        <Tab.Screen
          name="Profile"
          children={() => <UserProfileScreen userId={user?.id || ""} />}
          options={{ tabBarButton: () => null }}
        />
        <Tab.Screen name="Settings" component={SettingsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="PostView" component={PostView} />
        <Tab.Screen name="Search" options={{ tabBarButton: () => null }}>
          {(props) => <SearchScreen {...props} />}
        </Tab.Screen>
      </Tab.Navigator>

      <Animated.View
        style={[
          styles.tabBarWrapper,
          {
            transform: [{ translateY: tabBarTranslateY }],
            display: tabBarVisible ? "flex" : "none",
          },
        ]}
      >
        <TabBar
          activeTab={activeTab}
          onTabPress={(tab) => {
            // Handle tab navigation
          }}
        />
      </Animated.View>
    </>
  )
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="/" component={Onboard} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="SignUp" component={SignUp} />
      <Stack.Screen name="Verify" component={Verify} />
      <Stack.Screen name="ChangePassword" component={ChangePassword} />
    </Stack.Navigator>
  )
}

export function Navigation() {
  const { user, token } = useAuth()
  const [currentTab, setCurrentTab] = useState("Home")
  const [hideTabBar, setHideTabBar] = useState(false)
  const navigationRef = useRef<any>(null)
  const { colors } = useTheme()

  // Function to handle tab press
  const handleTabPress = (tabName: string) => {
    setCurrentTab(tabName)
    if (navigationRef.current) {
      if (tabName === "Add") {
        navigationRef.current.navigate("Add")
      } else if (tabName === "Profile") {
        navigationRef.current.navigate("Profile", { userId: user?.id || "" })
      } else if (tabName === "Home") {
        navigationRef.current.navigate("HomeTab")
      } else {
        navigationRef.current.navigate(tabName)
      }
    }
  }

  // Determine if we should hide the tab bar based on the current route
  const shouldHideTabBar = (state: any): boolean => {
    if (!state) return false

    // Get the current active route
    const routes = state.routes
    const currentRoute = routes[state.index]

    // Hide tab bar for auth routes
    const authRoutes = ["/", "Login", "SignUp", "Verify", "ChangePassword"]
    if (authRoutes.includes(currentRoute.name)) {
      return true
    }

    // Hide tab bar for Chat, Add, and Settings tabs
    if (["Chat", "Add", "Settings"].includes(currentRoute.name)) {
      return true
    }

    // For nested navigators, check their state too
    if (currentRoute.state) {
      // Check if any screen in the nested navigator is within Chat, Add, or Settings
      const nestedRoutes = currentRoute.state.routes
      const nestedCurrentRoute = nestedRoutes[currentRoute.state.index]
      if (["Chat", "Add", "Settings"].includes(nestedCurrentRoute.name)) {
        return true
      }

      // Continue checking deeper nested states
      return shouldHideTabBar(currentRoute.state)
    }

    return false
  }

  // Handle navigation state changes
  const handleNavigationStateChange = (state: any) => {
    if (!state) return

    // Get the current active route
    const currentRoute = state.routes[state.index]

    // Update the current tab if it's a main tab
    if (["HomeTab", "Chat", "Add", "Profile", "Settings"].includes(currentRoute.name)) {
      setCurrentTab(currentRoute.name === "HomeTab" ? "Home" : currentRoute.name)
    }

    // Determine if we should hide the tab bar
    setHideTabBar(shouldHideTabBar(state))
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={handleNavigationStateChange}
      onReady={() => {
        const state = navigationRef.current?.getRootState()
        if (state) {
          setHideTabBar(shouldHideTabBar(state))
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Main" options={{ headerShown: false }}>
            {() => (
              <View style={[styles.container, { backgroundColor: colors.background }]}>
                <TabNavigator />
                {!hideTabBar && (
                  <View style={styles.tabBarWrapper}>
                    <TabBar activeTab={currentTab} onTabPress={handleTabPress} />
                  </View>
                )}
              </View>
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Navigation />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 20 : 0,
    backgroundColor: "transparent",
    zIndex: 999,
  },
})









// import { useState, useRef } from "react"
// import { StyleSheet, View, Platform, Animated } from "react-native"
// import { NavigationContainer } from "@react-navigation/native"
// import { createNativeStackNavigator } from "@react-navigation/native-stack"
// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
// import { GestureHandlerRootView } from "react-native-gesture-handler"

// // Import the TabBar component
// import { TabBar } from "../components/TabBar"

// // Import Auth Context
// import { useAuth } from "../contexts/AuthContext"

// // Import Theme Context
// import { ThemeProvider, useTheme } from "../contexts/ThemeContext"

// // Registration Screens
// import Onboard from "../screens/register/Onboard"
// import Login from "../screens/register/Login"
// import SignUp from "../screens/register/SignUp"
// import Verify from "../screens/register/Verify"
// import ChangePassword from "../screens/register/ChangePassword"

// // Home Screens
// import HomeScreen from "../screens/Home/HomeScreen"
// import UserProfileScreen from "../screens/Home/UserProfileScreen"
// import UploadFeed from "../screens/Home/UploadFeed"
// import PostView from "../screens/Home/PostView"
// import SearchScreen from "../screens/Home/SearchScreen"

// // Other Screens
// import ChatScreen from "../screens/Chat"
// import SettingsScreen from "../screens/Settings/index"
// import NotificationScreen from "../screens/Settings/Notification"
// import FAQsScreen from "../screens/Settings/FAQs"
// import SupportScreen from "../screens/Settings/Support"

// import type { RootStackParamList, TabNavigatorParamList, SettingsStackParamList } from "../types/navigation"

// const Stack = createNativeStackNavigator<RootStackParamList>()
// const Tab = createBottomTabNavigator<TabNavigatorParamList>()
// const SettingsStack = createNativeStackNavigator<SettingsStackParamList>()

// function SettingsNavigator() {
//   const { logout } = useAuth()
//   return (
//     <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
//       <SettingsStack.Screen name="SettingsMain">
//         {(props) => <SettingsScreen {...props} onLogout={logout} />}
//       </SettingsStack.Screen>
//       <Stack.Screen name="Notifications" component={NotificationScreen} />
//       <Stack.Screen name="FAQs" component={FAQsScreen} />
//       <Stack.Screen name="Support" component={SupportScreen} />
//     </SettingsStack.Navigator>
//   )
// }

// function HomeStack() {
//   const [tabBarVisible, setTabBarVisible] = useState(true)

//   return (
//     <Stack.Navigator screenOptions={{ headerShown: false }}>
//       <Stack.Screen name="HomeMain">
//         {(props) => <HomeScreen {...props} onTabBarVisibilityChange={setTabBarVisible} />}
//       </Stack.Screen>
//       <Stack.Screen name="UploadFeed" component={UploadFeed} />
//       <Stack.Screen name="UserProfile" component={UserProfileScreen} />
//       <Stack.Screen name="PostView" component={PostView} />
//       <Stack.Screen name="Notifications" component={NotificationScreen} />
//       <Stack.Screen name="Search" component={SearchScreen} />
//     </Stack.Navigator>
//   )
// }

// function TabNavigator() {
//   const { user } = useAuth()
//   const [tabBarVisible, setTabBarVisible] = useState(true)
//   const tabBarTranslateY = useRef(new Animated.Value(0)).current

//   const handleTabBarVisibilityChange = (visible: boolean) => {
//     setTabBarVisible(visible)
//     Animated.timing(tabBarTranslateY, {
//       toValue: visible ? 0 : 100,
//       duration: 200,
//       useNativeDriver: true,
//     }).start()
//   }

//   return (
//     <>
//       <Tab.Navigator
//         screenOptions={{
//           headerShown: false,
//           tabBarStyle: { display: "none" }, // Hide the default tab bar
//         }}
//       >
//         <Tab.Screen name="HomeTab" options={{ tabBarButton: () => null }}>
//           {(props) => <HomeStack />}
//         </Tab.Screen>
//         <Tab.Screen name="Chat" children={() => <ChatScreen />} options={{ tabBarButton: () => null }} />
//         <Tab.Screen name="Add" children={() => <UploadFeed />} options={{ tabBarButton: () => null }} />
//         <Tab.Screen
//           name="Profile"
//           children={() => <UserProfileScreen userId={user?.id || ""} />}
//           options={{ tabBarButton: () => null }}
//         />
//         <Tab.Screen name="Settings" component={SettingsNavigator} options={{ tabBarButton: () => null }} />

//         <Tab.Screen name="PostView" component={PostView} />
//         <Tab.Screen name="Search" options={{ tabBarButton: () => null }}>
//           {(props) => <SearchScreen {...props} />}
//         </Tab.Screen>
//       </Tab.Navigator>

//       <Animated.View
//         style={[
//           styles.tabBarWrapper,
//           {
//             transform: [{ translateY: tabBarTranslateY }],
//           },
//         ]}
//       >
//         <TabBar
//           activeTab="Home"
//           onTabPress={(tab) => {
//             // Handle tab navigation
//           }}
//         />
//       </Animated.View>
//     </>
//   )
// }

// function AuthStack() {
//   return (
//     <Stack.Navigator screenOptions={{ headerShown: false }}>
//       <Stack.Screen name="/" component={Onboard} />
//       <Stack.Screen name="Login" component={Login} />
//       <Stack.Screen name="SignUp" component={SignUp} />
//       <Stack.Screen name="Verify" component={Verify} />
//       <Stack.Screen name="ChangePassword" component={ChangePassword} />
//     </Stack.Navigator>
//   )
// }

// export function Navigation() {
//   const { user, token } = useAuth()
//   const [currentTab, setCurrentTab] = useState("Home")
//   const [hideTabBar, setHideTabBar] = useState(false)
//   const navigationRef = useRef<any>(null)
//   const { colors } = useTheme()

//   // Function to handle tab press
//   const handleTabPress = (tabName: string) => {
//     setCurrentTab(tabName)
//     if (navigationRef.current) {
//       if (tabName === "Add") {
//         navigationRef.current.navigate("Add")
//       } else if (tabName === "Profile") {
//         navigationRef.current.navigate("Profile", { userId: user?.id || "" })
//       } else if (tabName === "Home") {
//         navigationRef.current.navigate("HomeTab")
//       } else {
//         navigationRef.current.navigate(tabName)
//       }
//     }
//   }

//   // Determine if we should hide the tab bar based on the current route
//   const shouldHideTabBar = (state: any): boolean => {
//     if (!state) return false
//     const routes = state.routes
//     const currentRoute = routes[state.index]
//     const authRoutes = ["/", "Login", "SignUp", "Verify", "ChangePassword"]
//     return authRoutes.includes(currentRoute.name)
//   }

//   // Handle navigation state changes
//   const handleNavigationStateChange = (state: any) => {
//     if (!state) return
//     const currentRoute = state.routes[state.index]
//     if (["HomeTab", "Chat", "Add", "Profile", "Settings"].includes(currentRoute.name)) {
//       setCurrentTab(currentRoute.name === "HomeTab" ? "Home" : currentRoute.name)
//     }
//     setHideTabBar(shouldHideTabBar(state))
//   }

//   return (
//     <NavigationContainer
//       ref={navigationRef}
//       onStateChange={handleNavigationStateChange}
//       onReady={() => {
//         const state = navigationRef.current?.getRootState()
//         if (state) {
//           setHideTabBar(shouldHideTabBar(state))
//         }
//       }}
//     >
//       <Stack.Navigator screenOptions={{ headerShown: false }}>
//         {token ? (
//           <Stack.Screen name="Main" options={{ headerShown: false }}>
//             {() => (
//               <View style={[styles.container, { backgroundColor: colors.background }]}>
//                 <TabNavigator />
//                 {!hideTabBar && (
//                   <View style={styles.tabBarWrapper}>
//                     <TabBar activeTab={currentTab} onTabPress={handleTabPress} />
//                   </View>
//                 )}
//               </View>
//             )}
//           </Stack.Screen>
//         ) : (
//           <Stack.Screen name="Auth" component={AuthStack} />
//         )}
//       </Stack.Navigator>
//     </NavigationContainer>
//   )
// }

// export default function App() {
//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <ThemeProvider>
//         <Navigation />
//       </ThemeProvider>
//     </GestureHandlerRootView>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   tabBarWrapper: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     alignItems: "center",
//     paddingBottom: Platform.OS === "ios" ? 20 : 0,
//     backgroundColor: "transparent",
//     zIndex: 999,
//   },
// })
// // "use client"
