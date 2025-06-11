
import React, { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Image, KeyboardAvoidingView, Platform } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import Icon from "react-native-vector-icons/Ionicons"
import type { RootStackParamList } from "../../types/navigation"
import { useTheme } from "../../contexts/ThemeContext"

type SupportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Support">

type MessageType = "agent" | "user" | "options" | "form" | "formSubmission" | "typing"

interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  options?: string[]
  formData?: {
    fullName?: string
    phoneNumber?: string
    email?: string
  }
}

export default function SupportScreen() {
  const navigation = useNavigation<SupportScreenNavigationProp>()
  const scrollViewRef = useRef<ScrollView>(null)
  const { colors: themeColors } = useTheme()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    email: ""
  })
  const [isTyping, setIsTyping] = useState(false)
  
  useEffect(() => {
    const initialMessages: Message[] = [
      {
        id: "1",
        type: "agent",
        content: "Hello! I'm your Feeda Support Assistant. How can I help you connect with the Feeda community today?",
        timestamp: new Date()
      },
      {
        id: "2",
        type: "options",
        content: "Select an issue to get started",
        timestamp: new Date(),
        options: [
          "Account Issues",
          "Post Visibility",
          "Community Guidelines",
          "Technical Problems",
          "Other"
        ]
      }
    ]
    setMessages(initialMessages)
  }, [])
  
  const handleSendMessage = () => {
    if (inputText.trim() === "") return
    
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputText,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
    setInputText("")
    simulateAgentTyping()
  }
  
  const handleSelectOption = (option: string) => {
    setSelectedIssue(option)
    
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: option,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
    simulateAgentTyping()
    
    setTimeout(() => {
      const formRequestMessage: Message = {
        id: Date.now().toString(),
        type: "agent",
        content: "Please provide your details so we can assist you better.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, formRequestMessage])
      setShowForm(true)
    }, 1500)
  }
  
  const handleSubmitForm = () => {
    if (!formData.fullName || !formData.phoneNumber || !formData.email) return
    
    const formSubmissionMessage: Message = {
      id: Date.now().toString(),
      type: "formSubmission",
      content: "Submitted Details",
      timestamp: new Date(),
      formData: {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        email: formData.email
      }
    }
    
    setMessages(prev => [...prev, formSubmissionMessage])
    setShowForm(false)
    simulateAgentTyping()
    
    setTimeout(() => {
      const finalMessage: Message = {
        id: Date.now().toString(),
        type: "agent",
        content: "Thank you for reaching out! A Feeda support team member will contact you soon.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, finalMessage])
    }, 1500)
  }
  
  const simulateAgentTyping = () => {
    setIsTyping(true)
    setTimeout(() => setIsTyping(false), 1500)
  }
  
  useEffect(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages, isTyping, showForm])
  
  const renderMessage = (message: Message) => {
    switch (message.type) {
      case "agent":
        return (
          <View style={styles.agentMessageContainer}>
            <Image source={require("../../assets/images/icon0.png")} style={styles.agentAvatar} />
            <View style={[styles.agentMessage, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.messageText, { color: themeColors.text }]}>{message.content}</Text>
              <Text style={[styles.timestamp, { color: themeColors.placeholder }]}>Just now</Text>
            </View>
          </View>
        )
      case "user":
        return (
          <View style={styles.userMessageContainer}>
            <View style={[styles.userMessage, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.userMessageText}>{message.content}</Text>
              <Text style={styles.userTimestamp}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>
        )
      case "options":
        return (
          <View style={styles.optionsContainer}>
            <Text style={[styles.optionsTitle, { color: themeColors.text }]}>{message.content}</Text>
            {message.options?.map((option, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.optionButton, { backgroundColor: themeColors.card }]}
                onPress={() => handleSelectOption(option)}
              >
                <Text style={[styles.optionText, { color: themeColors.text }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      case "formSubmission":
        return (
          <View style={styles.userMessageContainer}>
            <View style={[styles.formSubmissionMessage, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.formSubmissionTitle}>{message.content}</Text>
              <View style={styles.formSubmissionDetail}>
                <Text style={styles.formSubmissionLabel}>Name</Text>
                <Text style={styles.formSubmissionValue}>{message.formData?.fullName}</Text>
              </View>
              <View style={styles.formSubmissionDetail}>
                <Text style={styles.formSubmissionLabel}>Phone</Text>
                <Text style={styles.formSubmissionValue}>{message.formData?.phoneNumber}</Text>
              </View>
              <View style={styles.formSubmissionDetail}>
                <Text style={styles.formSubmissionLabel}>Email</Text>
                <Text style={styles.formSubmissionValue}>{message.formData?.email}</Text>
              </View>
              <Text style={styles.formSubmissionTimestamp}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>
        )
      default:
        return null
    }
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feeda Support</Text>
        <View style={styles.headerRight} />
      </View>
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map(message => (
            <View key={message.id}>{renderMessage(message)}</View>
          ))}
          {isTyping && (
            <View style={styles.typingContainer}>
              <View style={[styles.typingIndicator, { backgroundColor: themeColors.card }]}>
                <View style={[styles.typingDot, { backgroundColor: themeColors.text }]} />
                <View style={[styles.typingDot, { backgroundColor: themeColors.text }]} />
                <View style={[styles.typingDot, { backgroundColor: themeColors.text }]} />
              </View>
            </View>
          )}
          {showForm && (
            <View style={[styles.formContainer, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.formLabel, { color: themeColors.text }]}>Full Name</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
                placeholder="Your Name"
                placeholderTextColor={themeColors.placeholder}
                value={formData.fullName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
              />
              <Text style={[styles.formLabel, { color: themeColors.text }]}>Phone Number</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
                placeholder="Your Phone"
                placeholderTextColor={themeColors.placeholder}
                keyboardType="phone-pad"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
              />
              <Text style={[styles.formLabel, { color: themeColors.text }]}>Email</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
                placeholder="Your Email"
                placeholderTextColor={themeColors.placeholder}
                keyboardType="email-address"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              />
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: themeColors.primary }]} onPress={handleSubmitForm}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        
        <View style={[styles.inputContainer, { backgroundColor: themeColors.card }]}>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.background, color: themeColors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={themeColors.text}
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={[styles.sendButton, { backgroundColor: themeColors.primary }]} onPress={handleSendMessage}>
            <Icon name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 130
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 16,
    borderBottomColor: "lightgrey",
    borderBottomWidth: 0.5
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerRight: {
    width: 40,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  agentMessageContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  agentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  agentMessage: {
    borderRadius: 12,
    padding: 10,
    maxWidth: "70%",
  },
  messageText: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  userMessageContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  userMessage: {
    borderRadius: 12,
    padding: 10,
    maxWidth: "70%",
  },
  userMessageText: {
    fontSize: 14,
    color: "#FFF",
  },
  userTimestamp: {
    fontSize: 10,
    color: "#FFF",
    marginTop: 4,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  optionsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  optionButton: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    textAlign: "center",
  },
  formContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  formInput: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  submitButton: {
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "500",
  },
  formSubmissionMessage: {
    borderRadius: 12,
    padding: 10,
    maxWidth: "70%",
  },
  formSubmissionTitle: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "500",
    marginBottom: 8,
  },
  formSubmissionDetail: {
    marginBottom: 4,
  },
  formSubmissionLabel: {
    fontSize: 12,
    color: "#FFF",
    opacity: 0.7,
  },
  formSubmissionValue: {
    fontSize: 14,
    color: "#FFF",
  },
  formSubmissionTimestamp: {
    fontSize: 10,
    color: "#FFF",
    opacity: 0.7,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  typingContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  typingIndicator: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
})
