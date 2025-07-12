import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  SafeAreaView,
  Image,
  StatusBar,
  ScrollView,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../contexts/ThemeContext"
import { ArrowRight } from "lucide-react-native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../types/navigation"
import { useStatusBar } from "../../../App"

const { width, height } = Dimensions.get("window")

type OnboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Onboard">

const screens = [
  {
    id: 1,
    title: "Share Memes\nWith Friends",
    subtitle: "Express Yourself",
    description: "Create and share hilarious memes with your friends. Let your creativity shine and make everyone laugh with your unique sense of humor.",
    image: require("../../assets/images/meme.jpg"),
  },
  {
    id: 2,
    title: "React and\nChat",
    subtitle: "Connect Instantly",
    description: "React to posts with emojis and start meaningful conversations. Build connections through shared interests and engaging discussions.",
    image: require("../../assets/images/reacted.png"),
  },
  {
    id: 3,
    title: "Follow\nCreators",
    subtitle: "Stay Updated",
    description: "Follow your favorite creators and never miss their latest content. Get notified about new posts and stay connected with the community.",
    image: require("../../assets/images/soc.png"),
  },
]

const Onboard: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState(0)
  const navigation = useNavigation<OnboardScreenNavigationProp>()
  const { colors, theme } = useTheme()
  const { setStatusBarStyle } = useStatusBar()
  const scrollViewRef = useRef<ScrollView>(null)

  // Update StatusBar style based on theme
  useEffect(() => {
    setStatusBarStyle(theme === "dark" ? "light" : "dark")
  }, [theme, setStatusBarStyle])

  const goToNext = () => {
    if (currentScreen < screens.length - 1) {
      const nextScreen = currentScreen + 1
      setCurrentScreen(nextScreen)
      // Programmatically scroll to the next screen
      scrollViewRef.current?.scrollTo({
        x: nextScreen * width,
        animated: true
      })
    }
  }

  const handleSkip = () => {
    navigation.navigate("Login")
  }

  const handleGetStarted = () => {
    navigation.navigate("Login")
  }

  const handleButtonPress = () => {
    if (currentScreen === screens.length - 1) {
      handleGetStarted()
    } else {
      goToNext()
    }
  }

  const handleScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const screenIndex = Math.round(offsetX / width)
    
    if (screenIndex !== currentScreen) {
      setCurrentScreen(screenIndex)
    }
  }

  const renderScreen = (screen: any, index: number) => (
    <View key={screen.id} style={[styles.screen, { width }]}>
      <View style={styles.imageContainer}>
        <Image source={screen.image} style={styles.image} resizeMode="cover" />
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: colors.text }]}>
          {screen.title}
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.primary }]}>
          {screen.subtitle}
        </Text>
        
        <Text style={[styles.description, { color: colors.grey }]}>
          {screen.description}
        </Text>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.primary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Screens */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scrollView}
        contentContainerStyle={{ width: width * screens.length }}
        scrollEnabled={true}
      >
        {screens.map((screen, index) => renderScreen(screen, index))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          {screens.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index === currentScreen ? colors.primary : colors.border,
                  width: index === currentScreen ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleButtonPress}
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>
            {currentScreen === screens.length - 1 ? "Get Started" : "Next"}
          </Text>
          <ArrowRight size={20} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 0 : 20,
    paddingBottom: 20,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    width: width * 0.8,
    height: height * 0.4,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 40,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    paddingHorizontal: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    gap: 8,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    gap: 8,
  },
  actionButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
})

export default Onboard

