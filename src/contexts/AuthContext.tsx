import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"
import NetInfo from "@react-native-community/netinfo"

const API_URL = "https://feeda.onrender.com/api"
const SOCKET_URL = API_URL.replace(/\/api$/, '');

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
    console.log("Auth token set:", cleanToken.substring(0, 20) + "...")
  } else {
    delete api.defaults.headers.common["Authorization"]
    console.log("Auth token cleared")
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
    console.warn("useAuth must be used within an AuthProvider. Using default values.")
    return defaultContextValue
  }
  return context
}

export { api, API_URL, SOCKET_URL }

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
        console.log("Loading auth data from storage...")
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("token"),
        ])

        console.log("Stored user:", storedUser ? "Found" : "Not found")
        console.log("Stored token:", storedToken ? "Found" : "Not found")

        if (storedUser && storedToken) {
          const userData = JSON.parse(storedUser)
          setUser(userData)
          setToken(storedToken)
          setAuthToken(storedToken)

          console.log("Auth data loaded successfully for user:", userData.username)

          // Test token validity with a simple request
          try {
            console.log("Testing token validity...")
            const response = await api.get("/health")
            console.log("Token validation successful:", response.status)
          } catch (error: any) {
            console.log("Token validation failed:", error.response?.status, error.message)

            if (error.response?.status === 401 || error.response?.status === 403) {
              console.log("Token expired or invalid, attempting refresh...")
              try {
                await refreshTokenInternal(storedToken)
                console.log("Token refresh successful")
              } catch (refreshError) {
                console.log("Token refresh failed, clearing session")
                await logout()
              }
            }
          }
        } else {
          console.log("No stored auth data found")
        }
      } catch (error) {
        console.error("Error loading auth data:", error)
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
        console.log(
          `API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`,
        )
        return response
      },
      async (error) => {
        console.error(
          `API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`,
        )

        // Only attempt token refresh if not already refreshing and status is 401/403
        if (
          (error.response?.status === 401 || error.response?.status === 403) &&
          !isRefreshing &&
          token &&
          !error.config._retry
        ) {
          console.log("Authentication error detected in interceptor")
          error.config._retry = true

          try {
            setIsRefreshing(true)
            console.log("Attempting token refresh...")
            await refreshTokenInternal(token)

            // Retry the original request with new token
            const newToken = await AsyncStorage.getItem("token")
            if (newToken) {
              error.config.headers.Authorization = `Bearer ${newToken}`
              setIsRefreshing(false)
              return api.request(error.config)
            }
          } catch (refreshError) {
            console.log("Token refresh failed in interceptor")
            await logout()
          } finally {
            setIsRefreshing(false)
          }
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          // If already tried refreshing or no token, just logout
          if (isRefreshing || error.config._retry) {
            console.log("Token refresh already attempted or in progress")
          } else {
            console.log("No token available for refresh")
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

      console.log("Attempting signup for:", email)

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

      console.log("Signup successful:", userData)
    } catch (error: any) {
      console.error("Signup error:", error)
      const message = error.response?.data?.message || error.message || "Signup failed"
      throw new Error(message)
    }
  }

  const login = async (identifier: string, password: string, deviceId: string) => {
    try {
      if (!isConnected) {
        throw new Error("No internet connection")
      }

      console.log("Attempting login for:", identifier)

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

      console.log("Credentials validated, OTP verification required")

      // Note: We don't set the token here as we'll do that after OTP verification
    } catch (error: any) {
      console.error("Login error:", error)
      const message = error.response?.data?.message || error.message || "Login failed"
      throw new Error(message)
    }
  }

  const verifyOtp = async (email: string, otp: string) => {
    try {
      if (!isConnected) {
        throw new Error("No internet connection")
      }

      console.log("Verifying OTP for:", email)

      const response = await api.post("/auth/verify-otp", {
        email: email.toLowerCase().trim(),
        otp: otp.trim(),
      })

      const { token: userToken, user: userData } = response.data

      console.log("OTP verification successful, setting token")

      setToken(userToken)
      setAuthToken(userToken)

      // Update user data if provided
      if (userData) {
        setUser(userData)
        await AsyncStorage.setItem("user", JSON.stringify(userData))
      }

      await AsyncStorage.setItem("token", userToken)

      console.log("OTP verification and token setup complete")
    } catch (error: any) {
      console.error("OTP verification error:", error)
      const message = error.response?.data?.message || error.message || "Verification failed"
      throw new Error(message)
    }
  }

  const refreshTokenInternal = async (currentToken: string) => {
    try {
      if (!isConnected) {
        throw new Error("No internet connection")
      }

      console.log("Refreshing token...")

      // Temporarily set the current token for the refresh request
      const tempHeaders = { Authorization: `Bearer ${currentToken}` }

      const response = await api.post("/auth/refresh", { token: currentToken }, { headers: tempHeaders })
      const { token: newToken } = response.data

      console.log("Token refresh successful")

      setToken(newToken)
      setAuthToken(newToken)
      await AsyncStorage.setItem("token", newToken)

      return newToken
    } catch (error: any) {
      console.error("Token refresh failed:", error)
      throw error
    }
  }

  const refreshToken = async () => {
    if (isRefreshing) {
      console.log("Token refresh already in progress, skipping")
      return
    }

    try {
      if (!token || !isConnected) {
        throw new Error("No token available or no internet connection")
      }

      setIsRefreshing(true)
      await refreshTokenInternal(token)
    } catch (error: any) {
      console.error("Token refresh failed:", error)
      await logout()
      throw error
    } finally {
      setIsRefreshing(false)
    }
  }

  const logout = async () => {
    try {
      console.log("Logging out...")

      setUser(null)
      setToken(null)
      setAuthToken("")

      await Promise.all([AsyncStorage.removeItem("user"), AsyncStorage.removeItem("token")])

      console.log("Logout successful")
    } catch (error) {
      console.error("Error during logout:", error)
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



// import type React from "react"
// import { createContext, useContext, useState, useEffect } from "react"
// import AsyncStorage from "@react-native-async-storage/async-storage"
// import axios from "axios"
// import NetInfo from "@react-native-community/netinfo"

// const API_URL = "https://feeda.onrender.com/api"

// // "http://192.168.42.253:3000/api"

// // Create axios instance with better configuration
// const api = axios.create({
//   baseURL: API_URL,
//   headers: {
//     "Content-Type": "application/json",
//   },
//   timeout: 15000, // Increased timeout
// })

// const setAuthToken = (token: string) => {
//   if (token) {
//     const cleanToken = token.replace("Bearer ", "")
//     api.defaults.headers.common["Authorization"] = `Bearer ${cleanToken}`
//     console.log("Auth token set:", cleanToken.substring(0, 20) + "...")
//   } else {
//     delete api.defaults.headers.common["Authorization"]
//     console.log("Auth token cleared")
//   }
// }

// interface User {
//   id: string
//   email: string
//   username: string
//   fullName: string
//   profilePicture?: string
//   isVerified: boolean
// }

// interface AuthContextType {
//   signup: (
//     email: string,
//     fullName: string,
//     username: string,
//     password: string,
//     securityAnswers: { q1: string; q2: string; q3: string },
//     deviceId: string,
//   ) => Promise<void>
//   login: (identifier: string, password: string, deviceId: string) => Promise<void>
//   verifyOtp: (email: string, otp: string) => Promise<void>
//   logout: () => Promise<void>
//   refreshToken: () => Promise<void>
//   user: User | null
//   token: string | null
//   isLoading: boolean
//   isConnected: boolean
// }

// // Default context value
// const defaultContextValue: AuthContextType = {
//   signup: async () => {},
//   login: async () => {},
//   verifyOtp: async () => {},
//   logout: async () => {},
//   refreshToken: async () => {},
//   user: null,
//   token: null,
//   isLoading: true,
//   isConnected: true,
// }

// const AuthContext = createContext<AuthContextType>(defaultContextValue)

// export const useAuth = () => {
//   const context = useContext(AuthContext)
//   if (!context) {
//     console.warn("useAuth must be used within an AuthProvider. Using default values.")
//     return defaultContextValue
//   }
//   return context
// }

// export { api, API_URL }

// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const [user, setUser] = useState<User | null>(null)
//   const [token, setToken] = useState<string | null>(null)
//   const [isLoading, setIsLoading] = useState(true)
//   const [isConnected, setIsConnected] = useState(true)

//   // Network connectivity monitoring
//   useEffect(() => {
//     const unsubscribe = NetInfo.addEventListener((state) => {
//       setIsConnected(state.isConnected ?? false)
//     })

//     return () => unsubscribe()
//   }, [])

//   // Load auth data on app start
//   useEffect(() => {
//     const loadAuthData = async () => {
//       try {
//         console.log("Loading auth data from storage...")
//         const [storedUser, storedToken] = await Promise.all([
//           AsyncStorage.getItem("user"),
//           AsyncStorage.getItem("token"),
//         ])

//         console.log("Stored user:", storedUser ? "Found" : "Not found")
//         console.log("Stored token:", storedToken ? "Found" : "Not found")

//         if (storedUser && storedToken) {
//           const userData = JSON.parse(storedUser)
//           setUser(userData)
//           setToken(storedToken)
//           setAuthToken(storedToken)

//           console.log("Auth data loaded successfully for user:", userData.username)

//           // Test token validity with a simple request
//           try {
//             console.log("Testing token validity...")
//             const response = await api.get("/health")
//             console.log("Token validation successful:", response.status)
//           } catch (error: any) {
//             console.log("Token validation failed:", error.response?.status, error.message)

//             if (error.response?.status === 401 || error.response?.status === 403) {
//               console.log("Token expired or invalid, attempting refresh...")
//               try {
//                 await refreshTokenInternal(storedToken)
//                 console.log("Token refresh successful")
//               } catch (refreshError) {
//                 console.log("Token refresh failed, clearing session")
//                 await logout()
//               }
//             }
//           }
//         } else {
//           console.log("No stored auth data found")
//         }
//       } catch (error) {
//         console.error("Error loading auth data:", error)
//         await logout()
//       } finally {
//         setIsLoading(false)
//       }
//     }

//     loadAuthData()
//   }, [])

//   // Response interceptor for handling auth errors
//   useEffect(() => {
//     const responseInterceptor = api.interceptors.response.use(
//       (response) => {
//         console.log(
//           `API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`,
//         )
//         return response
//       },
//       async (error) => {
//         console.error(
//           `API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`,
//         )

//         if (error.response?.status === 401 || error.response?.status === 403) {
//           console.log("Authentication error detected in interceptor")

//           // Try to refresh token once
//           if (token && !error.config._retry) {
//             error.config._retry = true
//             try {
//               console.log("Attempting token refresh...")
//               await refreshTokenInternal(token)

//               // Retry the original request with new token
//               const newToken = await AsyncStorage.getItem("token")
//               if (newToken) {
//                 error.config.headers.Authorization = `Bearer ${newToken}`
//                 return api.request(error.config)
//               }
//             } catch (refreshError) {
//               console.log("Token refresh failed in interceptor")
//               await logout()
//             }
//           } else {
//             console.log("Token refresh already attempted or no token available")
//             await logout()
//           }
//         }
//         return Promise.reject(error)
//       },
//     )

//     return () => {
//       api.interceptors.response.eject(responseInterceptor)
//     }
//   }, [token])

//   const signup = async (
//     email: string,
//     fullName: string,
//     username: string,
//     password: string,
//     securityAnswers: { q1: string; q2: string; q3: string },
//     deviceId: string,
//   ) => {
//     try {
//       if (!isConnected) {
//         throw new Error("No internet connection")
//       }

//       console.log("Attempting signup for:", email)

//       const response = await api.post("/auth/signup", {
//         email: email.toLowerCase().trim(),
//         username: username.toLowerCase().trim(),
//         fullName: fullName.trim(),
//         password,
//         securityAnswers,
//         deviceId,
//       })

//       const userData = response.data.user
//       setUser(userData)
//       await AsyncStorage.setItem("user", JSON.stringify(userData))

//       console.log("Signup successful:", userData)
//     } catch (error: any) {
//       console.error("Signup error:", error)
//       const message = error.response?.data?.message || error.message || "Signup failed"
//       throw new Error(message)
//     }
//   }

//   const login = async (identifier: string, password: string, deviceId: string) => {
//     try {
//       if (!isConnected) {
//         throw new Error("No internet connection")
//       }

//       console.log("Attempting login for:", identifier)

//       // First, validate credentials without completing login
//       const response = await api.post("/auth/login", {
//         identifier: identifier.toLowerCase().trim(),
//         password,
//         deviceId,
//       })

//       const { user: userData } = response.data

//       // Store user data but don't set token yet (will be set after OTP verification)
//       setUser(userData)
//       await AsyncStorage.setItem("user", JSON.stringify(userData))

//       console.log("Credentials validated, OTP verification required")

//       // Note: We don't set the token here as we'll do that after OTP verification
//     } catch (error: any) {
//       console.error("Login error:", error)
//       const message = error.response?.data?.message || error.message || "Login failed"
//       throw new Error(message)
//     }
//   }

//   const verifyOtp = async (email: string, otp: string) => {
//     try {
//       if (!isConnected) {
//         throw new Error("No internet connection")
//       }

//       console.log("Verifying OTP for:", email)

//       const response = await api.post("/auth/verify-otp", {
//         email: email.toLowerCase().trim(),
//         otp: otp.trim(),
//       })

//       const { token: userToken, user: userData } = response.data

//       console.log("OTP verification successful, setting token")

//       setToken(userToken)
//       setAuthToken(userToken)

//       // Update user data if provided
//       if (userData) {
//         setUser(userData)
//         await AsyncStorage.setItem("user", JSON.stringify(userData))
//       }

//       await AsyncStorage.setItem("token", userToken)

//       console.log("OTP verification and token setup complete")
//     } catch (error: any) {
//       console.error("OTP verification error:", error)
//       const message = error.response?.data?.message || error.message || "Verification failed"
//       throw new Error(message)
//     }
//   }

//   const refreshTokenInternal = async (currentToken: string) => {
//     try {
//       if (!isConnected) {
//         throw new Error("No internet connection")
//       }

//       console.log("Refreshing token...")

//       // Temporarily set the current token for the refresh request
//       const tempHeaders = { Authorization: `Bearer ${currentToken}` }

//       const response = await api.post("/auth/refresh", { token: currentToken }, { headers: tempHeaders })
//       const { token: newToken } = response.data

//       console.log("Token refresh successful")

//       setToken(newToken)
//       setAuthToken(newToken)
//       await AsyncStorage.setItem("token", newToken)

//       return newToken
//     } catch (error: any) {
//       console.error("Token refresh failed:", error)
//       throw error
//     }
//   }

//   const refreshToken = async () => {
//     try {
//       if (!token || !isConnected) {
//         throw new Error("No token available or no internet connection")
//       }

//       await refreshTokenInternal(token)
//     } catch (error: any) {
//       console.error("Token refresh failed:", error)
//       await logout()
//       throw error
//     }
//   }

//   const logout = async () => {
//     try {
//       console.log("Logging out...")

//       setUser(null)
//       setToken(null)
//       setAuthToken("")

//       await Promise.all([AsyncStorage.removeItem("user"), AsyncStorage.removeItem("token")])

//       console.log("Logout successful")
//     } catch (error) {
//       console.error("Error during logout:", error)
//     }
//   }

//   const contextValue: AuthContextType = {
//     signup,
//     login,
//     verifyOtp,
//     logout,
//     refreshToken,
//     user,
//     token,
//     isLoading,
//     isConnected,
//   }

//   return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
// }


