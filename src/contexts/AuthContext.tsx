import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"
import NetInfo from "@react-native-community/netinfo"
import io from 'socket.io-client';

const API_URL = "https://feeda-5rz1.onrender.com/api"
const SOCKET_URL = API_URL.replace(/\/api$/, '');
const socket = io(SOCKET_URL, { autoConnect: false });

// Create axios instance with better configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000, // Increased timeout
})

const setAuthToken = (token: string) => {
  if (token) {
    const cleanToken = token.replace("Bearer ", "")
    api.defaults.headers.common["Authorization"] = `Bearer ${cleanToken}`
  } else {
    delete api.defaults.headers.common["Authorization"]
  }
}

interface User {
  id: string
  email: string
  username: string
  fullName: string
  profilePicture?: string
  isVerified: boolean
  isPremiumVerified?: boolean
}

interface AuthContextType {
  signup: (
    email: string,
    fullName: string,
    username: string,
    password: string,
    securityAnswers: { q1: string; q2: string; q3: string },
    deviceId: string,
  ) => Promise<void>
  login: (identifier: string, password: string, deviceId: string) => Promise<void>
  verifyOtp: (email: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  user: User | null
  token: string | null
  isLoading: boolean
  isConnected: boolean
  api: typeof api
}

// Default context value
const defaultContextValue: AuthContextType = {
  signup: async () => {},
  login: async () => {},
  verifyOtp: async () => {},
  logout: async () => {},
  refreshToken: async () => {},
  user: null,
  token: null,
  isLoading: true,
  isConnected: true,
  api: api,
}

const AuthContext = createContext<AuthContextType>(defaultContextValue)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    return defaultContextValue
  }
  return context
}

export { api, API_URL, SOCKET_URL, socket }

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false) // Track if token refresh is in progress

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false)
    })

    return () => unsubscribe()
  }, [])

  // Load auth data on app start
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("token"),
        ])

        if (storedUser && storedToken) {
          const userData = JSON.parse(storedUser)
          setUser(userData)
          setToken(storedToken)
          setAuthToken(storedToken)

          // Test token validity with a simple request
          try {
            const response = await api.get("/health")
          } catch (error: any) {
            if (error.response?.status === 401 || error.response?.status === 403) {
              try {
                await refreshTokenInternal(storedToken)
              } catch (refreshError) {
                await logout()
              }
            }
          }
        }
      } catch (error) {
        await logout()
      } finally {
        setIsLoading(false)
      }
    }

    loadAuthData()
  }, [])

  // Response interceptor for handling auth errors
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => {
        return response
      },
      async (error) => {
        if (
          (error.response?.status === 401 || error.response?.status === 403) &&
          !isRefreshing &&
          token &&
          !error.config._retry
        ) {
          error.config._retry = true

          try {
            setIsRefreshing(true)
            await refreshTokenInternal(token)

            // Retry the original request with new token
            const newToken = await AsyncStorage.getItem("token")
            if (newToken) {
              error.config.headers.Authorization = `Bearer ${newToken}`
              setIsRefreshing(false)
              return api.request(error.config)
            }
          } catch (refreshError) {
            await logout()
          } finally {
            setIsRefreshing(false)
          }
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          // If already tried refreshing or no token, just logout
          if (isRefreshing || error.config._retry) {
          } else {
          }
          await logout()
        }
        return Promise.reject(error)
      },
    )

    return () => {
      api.interceptors.response.eject(responseInterceptor)
    }
  }, [token, isRefreshing])

  const signup = async (
    email: string,
    fullName: string,
    username: string,
    password: string,
    securityAnswers: { q1: string; q2: string; q3: string },
    deviceId: string,
  ) => {
    try {
      if (!isConnected) {
        throw new Error("No internet connection")
      }

      const response = await api.post("/auth/signup", {
        email: email.toLowerCase().trim(),
        username: username.toLowerCase().trim(),
        fullName: fullName.trim(),
        password,
        securityAnswers,
        deviceId,
      })

      const userData = response.data.user
      setUser(userData)
      await AsyncStorage.setItem("user", JSON.stringify(userData))

    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Signup failed"
      throw new Error(message)
    }
  }

  const login = async (identifier: string, password: string, deviceId: string) => {
    try {
      if (!isConnected) {
        throw new Error("No internet connection")
      }

      // First, validate credentials without completing login
      const response = await api.post("/auth/login", {
        identifier: identifier.toLowerCase().trim(),
        password,
        deviceId,
      })

      const { user: userData } = response.data

      // Store user data but don't set token yet (will be set after OTP verification)
      setUser(userData)
      await AsyncStorage.setItem("user", JSON.stringify(userData))

      // Note: We don't set the token here as we'll do that after OTP verification
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Login failed"
      throw new Error(message)
    }
  }

  const verifyOtp = async (email: string, otp: string) => {
    try {
      if (!isConnected) {
        throw new Error("No internet connection")
      }

      const response = await api.post("/auth/verify-otp", {
        email: email.toLowerCase().trim(),
        otp: otp.trim(),
      })

      const { token: userToken, user: userData } = response.data

      setToken(userToken)
      setAuthToken(userToken)

      // Update user data if provided
      if (userData) {
        setUser(userData)
        await AsyncStorage.setItem("user", JSON.stringify(userData))
      }

      await AsyncStorage.setItem("token", userToken)

    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Verification failed"
      throw new Error(message)
    }
  }

  const refreshTokenInternal = async (currentToken: string) => {
    try {
      if (!isConnected) {
        throw new Error("No internet connection")
      }

      // Temporarily set the current token for the refresh request
      const tempHeaders = { Authorization: `Bearer ${currentToken}` }

      const response = await api.post("/auth/refresh", { token: currentToken }, { headers: tempHeaders })
      const { token: newToken } = response.data

      setToken(newToken)
      setAuthToken(newToken)
      await AsyncStorage.setItem("token", newToken)

      return newToken
    } catch (error: any) {
      throw error
    }
  }

  const refreshToken = async () => {
    if (isRefreshing) {
      return
    }

    try {
      if (!token || !isConnected) {
        throw new Error("No token available or no internet connection")
      }

      setIsRefreshing(true)
      await refreshTokenInternal(token)
    } catch (error: any) {
      await logout()
      throw error
    } finally {
      setIsRefreshing(false)
    }
  }

  const logout = async () => {
    try {
      setUser(null)
      setToken(null)
      setAuthToken("")

      await Promise.all([AsyncStorage.removeItem("user"), AsyncStorage.removeItem("token")])

    } catch (error) {
    }
  }

  const contextValue: AuthContextType = {
    signup,
    login,
    verifyOtp,
    logout,
    refreshToken,
    user,
    token,
    isLoading,
    isConnected,
    api,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

