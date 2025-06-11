"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  SafeAreaView,
  Image,
  Animated,
  StatusBar,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../contexts/ThemeContext"
import { Sparkles, Heart, Users, ArrowRight, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react-native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../types/navigation"

const { width, height } = Dimensions.get("window")

type OnboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Onboard">

const screens = [
  {
    id: 1,
    title: "Share Memes\nWith Friends",
    subtitle: "Express Yourself",
    // description: "Post and share your favorite memes with the Feeda community and make everyone laugh!",
    icon: Sparkles,
    gradient: ["#FF6B6B", "#4ECDC4"],
    image: require("../../assets/images/meme.jpg"),
    // features: ["Upload instantly", "Smart filters", "Viral potential"],
  },
  {
    id: 2,
    title: "React and\nChat",
    subtitle: "Connect Instantly",
    // description: "Like, comment, and chat privately with Feeda creators in real-time conversations!",
    icon: Heart,
    gradient: ["#A8E6CF", "#FFD93D"],
    image: require("../../assets/images/reacted.png"),
    // features: ["Real-time chat", "Emoji reactions", "Voice messages"],
  },
  {
    id: 3,
    title: "Follow\nCreators",
    subtitle: "Stay Updated",
    // description: "Follow your favorite Feeda creators and never miss their latest hilarious content!",
    icon: Users,
    gradient: ["#FFB6C1", "#87CEEB"],
    image: require("../../assets/images/soc.png"),
    // features: ["Personalized feed", "Push notifications", "Creator insights"],
  },
]

const Onboard: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState(0)
  const [isAutoPlay, setIsAutoPlay] = useState(true)
  const navigation = useNavigation<OnboardScreenNavigationProp>()
  const { colors, theme } = useTheme()

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(1)).current
  const scaleAnim = useRef(new Animated.Value(1)).current
  const progressAnim = useRef(new Animated.Value(0)).current

  // Auto-advance with progress animation
  useEffect(() => {
    if (!isAutoPlay) return

    const interval = setInterval(() => {
      if (currentScreen < screens.length - 1) {
        goToNext()
      } else {
        goToScreen(0)
      }
    }, 5000)

    // Progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start()

    return () => {
      clearInterval(interval)
      progressAnim.setValue(0)
    }
  }, [currentScreen, isAutoPlay])

  const goToNext = () => {
    if (currentScreen < screens.length - 1) {
      goToScreen(currentScreen + 1)
    }
  }

  const goToPrev = () => {
    if (currentScreen > 0) {
      goToScreen(currentScreen - 1)
    }
  }

  const goToScreen = (index: number) => {
    setCurrentScreen(index)
    progressAnim.setValue(0)

    // Smooth transition animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const handleSkip = () => {
    navigation.navigate("Login")
  }

  const handleGetStarted = () => {
    navigation.navigate("Login")
  }

  const toggleAutoPlay = () => {
    setIsAutoPlay(!isAutoPlay)
    if (isAutoPlay) {
      progressAnim.setValue(0)
    }
  }

  const currentScreenData = screens[currentScreen]
  const IconComponent = currentScreenData.icon

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Enhanced Status Bar */}
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
        translucent={false}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={[styles.skipButton, { borderColor: colors.border }]} onPress={handleSkip}>
            <Text style={[styles.skipText, { color: colors.text }]}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.autoPlayButton, { backgroundColor: colors.card }]} onPress={toggleAutoPlay}>
            {isAutoPlay ? <Pause size={20} color={colors.text} /> : <Play size={20} color={colors.text} />}
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon and Subtitle */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconWrapper, { backgroundColor: colors.primary + "20" }]}>
              <IconComponent size={32} color={colors.primary} />
            </View>
            <Text style={[styles.subtitle, { color: colors.primary }]}>{currentScreenData.subtitle}</Text>
          </View>

          {/* Image Container with Progress Lines at Bottom */}
          <View style={styles.imageSection}>
            <View style={styles.imageContainer}>
              <Image source={currentScreenData.image} style={styles.image} resizeMode="cover" />
              <View style={[styles.imageOverlay, { backgroundColor: colors.background + "40" }]} />
            </View>

            {/* Progress Lines at Bottom of Image */}
            <View style={styles.progressContainer}>
              {screens.map((_, index) => (
                <View key={index} style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        width:
                          index === currentScreen
                            ? progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0%", "100%"],
                              })
                            : index < currentScreen
                              ? "100%"
                              : "0%",
                      },
                    ]}
                  />
                </View>
              ))}
            </View>

            {/* Navigation Arrows Below Image */}
            <View style={styles.imageNavigation}>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: currentScreen === 0 ? 0.3 : 1,
                  },
                ]}
                onPress={goToPrev}
                disabled={currentScreen === 0}
              >
                <ChevronLeft size={24} color="white" />
              </TouchableOpacity>

              <View style={styles.pagination}>
                {screens.map((_, index) => (
                  <TouchableOpacity key={index} onPress={() => goToScreen(index)}>
                    <View
                      style={[
                        styles.paginationDot,
                        {
                          backgroundColor: index === currentScreen ? colors.primary : colors.border,
                          width: index === currentScreen ? 24 : 8,
                        },
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: currentScreen === screens.length - 1 ? 0.3 : 1,
                  },
                ]}
                onPress={goToNext}
                disabled={currentScreen === screens.length - 1}
              >
                <ChevronRight size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Text Content */}
          <View style={[styles.textContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.text }]}>{currentScreenData.title}</Text>
            <Text style={[styles.description, { color: colors.placeholder }]}>{currentScreenData.description}</Text>

            {/* Features */}
            {/* <View style={styles.featuresContainer}>
              {currentScreenData.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  {/* <View style={[styles.featureDot, { backgroundColor: colors.primary }]} /> */}
                  {/* <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text> */}
                {/* </View> */}
              {/* ))} */}
            {/* </View> */} 
          </View>
        </Animated.View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {currentScreen === screens.length - 1 ? (
            <TouchableOpacity
              style={[styles.getStartedButton, { backgroundColor: colors.primary }]}
              onPress={handleGetStarted}
            >
              <Text style={[styles.getStartedText, { color: "white" }]}>Get Started</Text>
              <ArrowRight size={20} color="white" style={styles.arrowIcon} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextButton, { borderColor: colors.primary }]} onPress={goToNext}>
              <Text style={[styles.nextText, { color: colors.primary }]}>Next</Text>
              <ArrowRight size={16} color={colors.primary} style={styles.arrowIcon} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: "space-between",
    paddingTop: 5
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 2,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  autoPlayButton: {
    padding: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
    
  },
  content: {
    flex: 1,
    paddingBottom: 2,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  imageSection: {
    marginBottom: 20,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  image: {
    width: "100%",
    height: height * 0.45, // Increased height from 0.3 to 0.45
    borderRadius: 20,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  progressContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 5,
    marginBottom: 5,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  imageNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  pagination: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    transition: "all 0.3s ease",
  },
  textContainer: {
    padding: 5,
    borderRadius: 20,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 40,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },
  featuresContainer: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    fontSize: 14,
    fontWeight: "500",
  },
  actionContainer: {
    paddingBottom: Platform.OS === "ios" ? 20 : 20,
    paddingTop: 20,
  },
  getStartedButton: {
    flexDirection: "row",
    marginTop: 10,
    
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: "700",
  },
  nextButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    gap: 8,
    marginTop: 10
  },
  nextText: {
    fontSize: 16,
    fontWeight: "600",
  },
  arrowIcon: {
    marginLeft: 4,
  },
})

export default Onboard

