export type RootStackParamList = {
  MainApp: undefined;
  Auth: undefined;
  "/": undefined;
  Login: undefined;
  SignUp: undefined;
  Verify: undefined;
  ChangePassword: undefined;
};

export type TabNavigatorParamList = {
  Home: undefined;
  Chat: undefined;
  Settings: undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  Support: undefined;
  Address: undefined;
  Notifications: undefined;
  FAQs: undefined;
  EditProfile: undefined;
};




export interface Post {
  id: string;
  userId: string;
  amount: number;
  category: string;
  status: string;
  createdAt: string;
}

export interface User {
  username: string;
  email: string;
  deviceId: string;
}