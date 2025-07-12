import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import * as Device from 'expo-device';

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

// Validation schema for step 1
const Step1Schema = Yup.object().shape({
  fullName: Yup.string().min(2, 'Name is too short').required('Full name is required'),
  username: Yup.string().min(3, 'Username is too short').required('Username is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

// Validation schema for step 2
const Step2Schema = Yup.object().shape({
  securityAnswer1: Yup.string().required('Security answer 1 is required'),
  securityAnswer2: Yup.string().required('Security answer 2 is required'),
  securityAnswer3: Yup.string().required('Security answer 3 is required'),
});

const SignUp: React.FC = () => {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const { signup } = useAuth();
  const { colors } = useTheme();
  const [step, setStep] = useState(1); // Step 1: Basic info, Step 2: Security questions
  const [error, setError] = useState('');
  const [formValues, setFormValues] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    securityAnswer1: '',
    securityAnswer2: '',
    securityAnswer3: '',
  });

  const handleStep1Submit = (values: {
    fullName: string;
    username: string;
    email: string;
    password: string;
  }) => {
    Keyboard.dismiss();
    setError('');
    setFormValues((prev) => ({ ...prev, ...values }));
    setStep(2);
  };

  const handleStep2Submit = async (values: {
    securityAnswer1: string;
    securityAnswer2: string;
    securityAnswer3: string;
  }) => {
    Keyboard.dismiss();
    setError('');
    const updatedValues = { ...formValues, ...values };
    try {
      const deviceId = Device.deviceName || 'unknown-device';
      const securityAnswers = {
        q1: updatedValues.securityAnswer1,
        q2: updatedValues.securityAnswer2,
        q3: updatedValues.securityAnswer3,
      };
      await signup(
        updatedValues.email,
        updatedValues.fullName,
        updatedValues.username, // Pass username to signup
        updatedValues.password,
        securityAnswers,
        deviceId
      );
      navigation.navigate('Verify', { email: updatedValues.email });
    } catch (err) {
      setError(err.message || 'Signup failed');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            {step === 1 ? 'Create an Account' : 'Security Questions'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            {step === 1 ? 'Join Feeda today!' : 'Set up your security answers'}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {step === 1 ? (
            <Formik
              initialValues={{
                fullName: formValues.fullName,
                username: formValues.username,
                email: formValues.email,
                password: formValues.password,
              }}
              validationSchema={Step1Schema}
              onSubmit={handleStep1Submit}
            >
              {({
                handleChange,
                handleBlur,
                handleSubmit,
                values,
                errors,
                touched,
              }) => (
                <View style={[styles.form, { backgroundColor: colors.background }]}>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
                    <TextInput
                      style={[styles.input, touched.fullName && errors.fullName && styles.inputError]}
                      placeholder="Enter full name"
                      placeholderTextColor={colors.placeholder}
                      value={values.fullName}
                      onChangeText={handleChange('fullName')}
                      onBlur={handleBlur('fullName')}
                      autoCapitalize="words"
                    />
                    {touched.fullName && errors.fullName && (
                      <Text style={styles.errorText}>{errors.fullName}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Username</Text>
                    <TextInput
                      style={[styles.input, touched.username && errors.username && styles.inputError]}
                      placeholder="Enter username"
                      placeholderTextColor={colors.placeholder}
                      value={values.username}
                      onChangeText={handleChange('username')}
                      onBlur={handleBlur('username')}
                      autoCapitalize="none"
                    />
                    {touched.username && errors.username && (
                      <Text style={styles.errorText}>{errors.username}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
                    <TextInput
                      style={[styles.input, touched.email && errors.email && styles.inputError]}
                      placeholder="Enter email address"
                      placeholderTextColor={colors.placeholder}
                      value={values.email}
                      onChangeText={handleChange('email')}
                      onBlur={handleBlur('email')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {touched.email && errors.email && (
                      <Text style={styles.errorText}>{errors.email}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Password</Text>
                    <TextInput
                      style={[styles.input, touched.password && errors.password && styles.inputError]}
                      placeholder="Enter password"
                      placeholderTextColor={colors.placeholder}
                      value={values.password}
                      onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')}
                      secureTextEntry
                    />
                    {touched.password && errors.password && (
                      <Text style={styles.errorText}>{errors.password}</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      { backgroundColor: colors.theme === 'light' ? '#000000' : '#FFFFFF' },
                    ]}
                    onPress={handleSubmit}
                  >
                    <Text
                      style={[
                        styles.submitButtonText,
                        { color: colors.theme === 'light' ? '#FFFFFF' : '#000000' },
                      ]}
                    >
                      Next
                    </Text>


                   

                  </TouchableOpacity>
                   <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={{color: colors.text, fontSize: 14, fontWeight: 600, textAlign: "center", paddingBottom: 10 }} >
                  Already have an account? Login
                </Text>
              </TouchableOpacity>


                  {step === 1 && (
                    <Text style={[styles.termsText, { color: colors.text }]}>
                      By continuing you agree with Feeda{' '}
                      <Text 
                        style={[styles.link, { color: colors.icon }]}
                        onPress={() => navigation.navigate("Terms")}
                      >
                        terms of agreement
                      </Text> and{' '}
                      <Text 
                        style={[styles.link, { color: colors.icon }]}
                        onPress={() => navigation.navigate("Privacy")}
                      >
                        privacy policy
                      </Text>
                    </Text>
                  )}
                </View>
              )}
            </Formik>
          ) : (
            <Formik
              initialValues={{
                securityAnswer1: formValues.securityAnswer1,
                securityAnswer2: formValues.securityAnswer2,
                securityAnswer3: formValues.securityAnswer3,
              }}
              validationSchema={Step2Schema}
              onSubmit={handleStep2Submit}
            >
              {({
                handleChange,
                handleBlur,
                handleSubmit,
                values,
                errors,
                touched,
              }) => (
                <View style={[styles.form, { backgroundColor: colors.background }]}>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>What is your favorite meme?</Text>
                    <TextInput
                      style={[styles.input, touched.securityAnswer1 && errors.securityAnswer1 && styles.inputError]}
                      placeholder="Enter answer"
                      placeholderTextColor={colors.text}
                      value={values.securityAnswer1}
                      onChangeText={handleChange('securityAnswer1')}
                      onBlur={handleBlur('securityAnswer1')}
                    />
                    {touched.securityAnswer1 && errors.securityAnswer1 && (
                      <Text style={styles.errorText}>{errors.securityAnswer1}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>What is your favorite meme character?</Text>
                    <TextInput
                      style={[styles.input, touched.securityAnswer2 && errors.securityAnswer2 && styles.inputError]}
                      placeholder="Enter answer"
                      placeholderTextColor={colors.text}
                      value={values.securityAnswer2}
                      onChangeText={handleChange('securityAnswer2')}
                      onBlur={handleBlur('securityAnswer2')}
                    />
                    {touched.securityAnswer2 && errors.securityAnswer2 && (
                      <Text style={styles.errorText}>{errors.securityAnswer2}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>What is your favorite meme website?</Text>
                    <TextInput
                      style={[styles.input, touched.securityAnswer3 && errors.securityAnswer3 && styles.inputError]}
                      placeholder="Enter answer"
                      placeholderTextColor={colors.text}
                      value={values.securityAnswer3}
                      onChangeText={handleChange('securityAnswer3')}
                      onBlur={handleBlur('securityAnswer3')}
                    />
                    {touched.securityAnswer3 && errors.securityAnswer3 && (
                      <Text style={styles.errorText}>{errors.securityAnswer3}</Text>
                    )}
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.backButton,
                        { backgroundColor: colors.theme === 'light' ? '#000000' : '#FFFFFF' },
                      ]}
                      onPress={() => setStep(1)}
                    >
                      <Text
                        style={[
                          styles.backButtonText,
                          { color: colors.theme === 'light' ? '#FFFFFF' : '#000000' },
                        ]}
                      >
                        Back
                      </Text>
                    </TouchableOpacity>


                


                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        { backgroundColor: colors.theme === 'light' ? '#000000' : '#FFFFFF' },
                      ]}
                      onPress={handleSubmit}
                    >
                      <Text
                        style={[
                          styles.submitButtonText,
                          { color: colors.theme === 'light' ? '#FFFFFF' : '#000000' },
                        ]}
                      >
                        Submit
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Formik>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 18,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 20,
  },
  form: {
    borderRadius: 20,
    padding: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 5,
  },
  submitButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  termsText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    textDecorationLine: 'underline',
  },
});

export default SignUp;
