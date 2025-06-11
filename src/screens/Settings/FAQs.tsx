
import React, { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, Modal, ScrollView, Platform } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import Icon from "react-native-vector-icons/Ionicons"
import type { RootStackParamList } from "../../types/navigation"
import { useTheme } from "../../contexts/ThemeContext"
import { colors } from "../../constants/colors"

type FAQsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "FAQs">

interface FAQ {
  id: string
  question: string
  answer: string
}

export default function FAQsScreen() {
  const navigation = useNavigation<FAQsScreenNavigationProp>()
  const { colors: themeColors } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null)
  
  const faqs: FAQ[] = [
    {
      id: "1",
      question: "What is Feeda?",
      answer: "Feeda is a vibrant social platform where you can connect with friends, share posts, stories, and join communities that match your interests."
    },
    {
      id: "2",
      question: "How do I post content on Feeda?",
      answer: "Tap the '+' icon on the home screen, choose your media (photo, video, or text), add a caption, and press 'Post' to share with your followers."
    },
    {
      id: "3",
      question: "How can I follow friends on Feeda?",
      answer: "Use the search bar to find a username, visit their profile, and tap the 'Follow' button to see their posts in your feed."
    },
    {
      id: "4",
      question: "How do I join a Feeda community?",
      answer: "Go to the 'Communities' tab, browse or search for groups, and tap 'Join' to participate in discussions and events."
    }
  ]
  
  const filteredFAQs = searchQuery.trim() === "" 
    ? faqs 
    : faqs.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
  
  const handleFAQPress = (faq: FAQ) => {
    setSelectedFAQ(faq)
  }
  
  const closeModal = () => {
    setSelectedFAQ(null)
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feeda FAQs</Text>
        <View style={styles.headerRight} />
      </View>
      
      <View style={[styles.searchContainer, { backgroundColor: themeColors.card }]}>
        <Icon name="search" size={18} color={themeColors.icon} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.text }]}
          placeholder="Search FAQs..."
          placeholderTextColor={themeColors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <ScrollView style={styles.faqList} contentContainerStyle={styles.faqContent}>
        {filteredFAQs.length === 0 ? (
          <Text style={[styles.noResultsText, { color: themeColors.text }]}>No FAQs found</Text>
        ) : (
          filteredFAQs.map((faq) => (
            <TouchableOpacity 
              key={faq.id} 
              style={[styles.faqItem, { backgroundColor: themeColors.card }]}
              onPress={() => handleFAQPress(faq)}
            >
              <Text style={[styles.faqQuestion, { color: themeColors.text }]}>{faq.question}</Text>
              <Icon name="chevron-forward" size={18} color={themeColors.icon} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      
      <Modal
        visible={selectedFAQ !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: themeColors.background + '80' }]}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>{selectedFAQ?.question}</Text>
              <TouchableOpacity onPress={closeModal} style={[styles.closeButton, { backgroundColor: themeColors.background }]}>
                <Icon name="close" size={18} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalAnswer, { color: themeColors.text }]}>{selectedFAQ?.answer}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 15,
    borderBottomColor: colors.lightgrey,
    borderBottomWidth: 0.5
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerRight: {
    width: 36,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  faqList: {
    flex: 1,
  },
  faqContent: {
    padding: 16,
  },
  faqItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  faqQuestion: {
    fontSize: 14,
    flex: 1,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    borderRadius: 12,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
})
