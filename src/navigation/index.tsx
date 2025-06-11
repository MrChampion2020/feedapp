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
  const tabBarTranslateY = useRef(new Animated.Value(0)).current

  const handleTabBarVisibilityChange = (visible: boolean) => {
    setTabBarVisible(visible)
    Animated.timing(tabBarTranslateY, {
      toValue: visible ? 0 : 100,
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
          },
        ]}
      >
        <TabBar
          activeTab="Home"
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
    const routes = state.routes
    const currentRoute = routes[state.index]
    const authRoutes = ["/", "Login", "SignUp", "Verify", "ChangePassword"]
    return authRoutes.includes(currentRoute.name)
  }

  // Handle navigation state changes
  const handleNavigationStateChange = (state: any) => {
    if (!state) return
    const currentRoute = state.routes[state.index]
    if (["HomeTab", "Chat", "Add", "Profile", "Settings"].includes(currentRoute.name)) {
      setCurrentTab(currentRoute.name === "HomeTab" ? "Home" : currentRoute.name)
    }
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
// "use client"
