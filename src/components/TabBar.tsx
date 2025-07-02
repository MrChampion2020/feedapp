import type React from "react"
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native"
import { Home, MessageSquare, Plus, User, Settings } from "lucide-react-native"
import { useTheme } from "../contexts/ThemeContext"

interface TabBarProps {
  activeTab: string
  onTabPress: (tabName: string) => void
  style?: any
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress, style }) => {
  const { colors, theme } = useTheme()

  const getIconColor = (tabName: string) => {
    if (activeTab === tabName) {
      return colors.primary // Blue when active
    }
    return theme === "dark" ? "#8899A6" : "#657786" // Light grey when inactive
  }

  const getIconFill = (tabName: string) => {
    return activeTab === tabName ? colors.primary : "none"
  }

  const tabs = [
    { name: "Home", icon: Home },
    { name: "Chat", icon: MessageSquare, },
    { name: "Add", icon: Plus },
    { name: "Profile", icon: User },
    { name: "Settings", icon: Settings },
  ]

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.tabbg }]}>
      <View style={[styles.tabBar, { borderTopColor: "transparent" } ]}>
         
        {tabs.map((tab) => {
          const IconComponent = tab.icon
          const isActive = activeTab === tab.name
          const isAddButton = tab.name === "Add"

          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, isAddButton && styles.addTab, isAddButton && { backgroundColor: colors.primary }]}
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={isAddButton ? 26 : 22}
                color={isAddButton ? "white" : getIconColor(tab.name)}
                fill={isAddButton ? "white" : getIconFill(tab.name)}
                strokeWidth={isActive && !isAddButton ? 2.5 : 2}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 5,
    paddingTop: 0,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  tab: {
    padding: 12,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  addTab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    marginBottom: 30
  },
})

