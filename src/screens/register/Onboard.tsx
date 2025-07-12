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
  ScrollView,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../contexts/ThemeContext"
import { ArrowRight } from "lucide-react-native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../types/navigation"

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
  const [progress, setProgress] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const navigation = useNavigation<OnboardScreenNavigationProp>()
  const { colors, theme } = useTheme()
  const scrollViewRef = useRef<ScrollView>(null)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const imageScaleAnim = useRef(new Animated.Value(1)).current
  const imageRotateAnim = useRef(new Animated.Value(0)).current
  const buttonProgressAnim = useRef(new Animated.Value(0)).current
  const buttonScaleAnim = useRef(new Animated.Value(1)).current
  const titleAnim = useRef(new Animated.Value(0)).current
  const subtitleAnim = useRef(new Animated.Value(0)).current

  // Auto-advance with 15-second duration
  useEffect(() => {
    if (!isAutoPlaying || isUserScrolling) return

    const duration = 15000 // 15 seconds
    const interval = 50 // Update every 50ms for smoother progress
    const steps = duration / interval
    let currentStep = 0

    // Reset progress at start
    setProgress(0)
    buttonProgressAnim.setValue(0)

    const progressInterval = setInterval(() => {
      currentStep++
      const newProgress = (currentStep / steps) * 100
      setProgress(newProgress)

      // Button fills in 2 seconds (first 2 seconds of 15-second cycle)
      const buttonProgress = Math.min(1, (currentStep * interval) / 2000)
      Animated.timing(buttonProgressAnim, {
        toValue: buttonProgress,
        duration: interval,
        useNativeDriver: true,
      }).start()

      if (currentStep >= steps) {
        // Complete the screen
        if (currentScreen < screens.length - 1) {
          goToNext()
        } else {
          // Reset to first screen
          goToScreen(0)
        }
        setProgress(0)
        buttonProgressAnim.setValue(0)
      }
    }, interval)

    return () => {
      clearInterval(progressInterval)
    }
  }, [currentScreen, isAutoPlaying, isUserScrolling])

  // Image and text animation on screen change
  useEffect(() => {
    // Reset animations
    titleAnim.setValue(0)
    subtitleAnim.setValue(0)
    imageScaleAnim.setValue(1)
    imageRotateAnim.setValue(0)

    // Animate image with reverse scale and rotation
    Animated.parallel([
      Animated.timing(imageScaleAnim, {
        toValue: 0.8,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(imageRotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start()

    // Animate text elements in sequence
    Animated.sequence([
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()

    // Scroll to current screen only if not user scrolling
    if (!isUserScrolling && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: currentScreen * width,
        animated: true,
      })
    }
  }, [currentScreen, isUserScrolling])

  const goToNext = () => {
    if (currentScreen < screens.length - 1) {
      goToScreen(currentScreen + 1)
    }
  }

  const goToScreen = (index: number) => {
    setCurrentScreen(index)
    setProgress(0)
    setIsAutoPlaying(true)
    setIsUserScrolling(false)

    // Reset button progress immediately
    buttonProgressAnim.setValue(0)

    // Smooth transition animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: index * width,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
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

  const handleButtonPress = () => {
    // Add button press animation
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start()

    // Immediate response - no waiting for animation
    if (currentScreen === screens.length - 1) {
      handleGetStarted()
    } else {
      goToNext()
    }
  }

  const handleScrollBegin = () => {
    setIsUserScrolling(true)
    setIsAutoPlaying(false)
  }

  const handleScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const screenIndex = Math.round(offsetX / width)
    
    if (screenIndex !== currentScreen) {
      setCurrentScreen(screenIndex)
    }
    
    // Resume auto-play after a short delay
    setTimeout(() => {
      setIsUserScrolling(false)
      setIsAutoPlaying(true)
    }, 1000)
  }

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying)
    if (!isAutoPlaying) {
      setProgress(0)
      Animated.timing(buttonProgressAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }).start()
    }
  }

  const currentScreenData = screens[currentScreen]

  // Custom animated text component for letter-by-letter color change
  const AnimatedText = ({ text, progress }: { text: string; progress: number }) => {
    return (
      <View style={{ flexDirection: 'row' }}>
        {text.split('').map((char, index) => {
          // All text changes to white at 20% fill
          const isCovered = progress >= 0.2;
          
          return (
            <Text
              key={index}
              style={[
                styles.actionText,
                {
                  color: isCovered ? "white" : "black",
                }
              ]}
            >
              {char}
            </Text>
          );
        })}
      </View>
    );
  };

  // Animated arrow icon
  const AnimatedArrow = ({ progress }: { progress: number }) => {
    const arrowAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      if (progress >= 0.2) {
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        arrowAnim.setValue(0);
      }
    }, [progress]);

    return (
      <Animated.View
        style={{
          transform: [
            {
              translateX: arrowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 5],
              }),
            },
          ],
        }}
      >
        <ArrowRight 
          size={20} 
          color={progress >= 0.2 ? "white" : "black"}
          style={styles.arrowIcon} 
        />
      </Animated.View>
    );
  };

  // Render individual screen
  const renderScreen = (screen: any, index: number) => (
    <View key={index} style={[styles.screenContainer, { width }]}>
      {/* Animated Image */}
      <View style={styles.imageContainer}>
        <Animated.Image 
          source={screen.image} 
          style={[
            styles.image,
            {
              transform: [
                {
                  scale: imageScaleAnim,
                },
                {
                  rotate: imageRotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-5deg'],
                  }),
                },
              ],
            },
          ]} 
          resizeMode="cover" 
        />
        
        {/* Progress Dots at bottom of image */}
        <View style={styles.imageProgressContainer}>
          {screens.map((_, dotIndex) => (
            <TouchableOpacity key={dotIndex} onPress={() => goToScreen(dotIndex)}>
              <View
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: dotIndex === currentScreen ? colors.primary : colors.border,
                    width: dotIndex === currentScreen ? 24 : 8,
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.textSection}>
        {/* Animated Title */}
        <Animated.Text 
          style={[
            styles.title, 
            { 
              color: colors.text,
              opacity: titleAnim,
              transform: [{
                translateY: titleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                })
              }]
            }
          ]}
        >
          {screen.title}
        </Animated.Text>

        {/* Animated Subtitle */}
        <Animated.Text 
          style={[
            styles.subtitle, 
            { 
              color: colors.primary,
              opacity: subtitleAnim,
              transform: [{
                translateY: subtitleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [15, 0],
                })
              }]
            }
          ]}
        >
          {screen.subtitle}
        </Animated.Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
        translucent={false}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Skip Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipText, { color: colors.placeholder }]}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content with Horizontal Scroll */}
        <View style={styles.content}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={handleScrollBegin}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
            contentContainerStyle={styles.scrollContent}
            decelerationRate="normal"
            snapToInterval={width}
            snapToAlignment="center"
            bounces={false}
          >
            {screens.map((screen, index) => renderScreen(screen, index))}
          </ScrollView>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Progress-based Action Button */}
          <View style={styles.buttonContainer}>
            <Animated.View
              style={[
                styles.buttonProgress,
                {
                  backgroundColor: colors.primary,
                  transform: [{
                    scaleX: buttonProgressAnim,
                  }],
                  borderRadius: buttonProgressAnim._value > 0 ? 16 : 0,
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  transform: [{ scale: buttonScaleAnim }],
                },
              ]}
              onPress={handleButtonPress}
              activeOpacity={0.8}
            >
              <AnimatedText 
                text={currentScreen === screens.length - 1 ? "Get Started" : "Next"}
                progress={buttonProgressAnim._value}
              />
              <AnimatedArrow 
                progress={buttonProgressAnim._value}
              />
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: Platform.OS === "ios" ? 5 : 10,
    paddingBottom: 10,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: {
    alignItems: "center",
  },
  screenContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: width,
  },
  imageContainer: {
    position: "relative",
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    width: width - 48, // Account for container padding
    height: height * 0.6,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  imageProgressContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  textSection: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bottomSection: {
    paddingBottom: Platform.OS === "ios" ? 40 : 30,
  },
  buttonContainer: {
    position: "relative",
    overflow: "hidden",
  },
  buttonProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
    backgroundColor: "transparent",
    gap: 8,
    zIndex: 2,
  },
  actionText: {
    fontSize: 18,
    fontWeight: "700",
  },
  arrowIcon: {
    marginLeft: 4,
  },
})

export default Onboard

