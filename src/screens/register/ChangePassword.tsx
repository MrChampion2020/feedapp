import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { CodeInput } from '../../components/CodeInput';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Step = 'email' | 'code' | 'password';

type ChangePasswordNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChangePassword'>;

// Validation schemas
const EmailSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
});

const PasswordSchema = Yup.object().shape({
  newPassword: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm password is required'),
});

const ChangePassword: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [timeLeft, setTimeLeft] = useState(59);
  const [verificationCode, setVerificationCode] = useState('');
  const navigation = useNavigation<ChangePasswordNavigationProp>();
  const { colors } = useTheme();

  useEffect(() => {
    if (timeLeft > 0 && currentStep === 'code') {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, currentStep]);

  const handleCodeComplete = (code: string) => {
    setVerificationCode(code);
  };

  const handleEmailSubmit = (values: { email: string }) => {
    setCurrentStep('code');
  };

  const handlePasswordSubmit = (values: { newPassword: string; confirmPassword: string }) => {
    navigation.navigate('Login');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'email':
        return (
          <>
            <Text style={[styles.subtitle, { color: colors.text }]}>Input email address</Text>
            <Formik
              initialValues={{ email: '' }}
              validationSchema={EmailSchema}
              onSubmit={handleEmailSubmit}
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
                  <TouchableOpacity 
                    style={styles.goBack}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={[styles.goBackText, { color: colors.icon }]}>Go back</Text>
                  </TouchableOpacity>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Enter Email</Text>
                    <TextInput
                      style={[styles.input, touched.email && errors.email && styles.inputError]}
                      value={values.email}
                      onChangeText={handleChange('email')}
                      onBlur={handleBlur('email')}
                      placeholder="Enter email address"
                      placeholderTextColor={colors.text}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {touched.email && errors.email && (
                      <Text style={styles.errorText}>{errors.email}</Text>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={[styles.submitButton, { backgroundColor: colors.icon }]} 
                    onPress={handleSubmit}
                  >
                    <Text style={[styles.submitButtonText, { color: colors.background }]}>Proceed</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Formik>
          </>
        );

      case 'code':
        return (
          <>
            <Text style={[styles.subtitle, { color: colors.text }]}>
              Input the code sent to your registered email
            </Text>
            <View style={[styles.form, { backgroundColor: colors.background }]}>
              <TouchableOpacity 
                style={styles.goBack}
                onPress={() => setCurrentStep('email')}
              >
                <Text style={[styles.goBackText, { color: colors.icon }]}>Go back</Text>
              </TouchableOpacity>

              <CodeInput 
                length={5} 
                onCodeComplete={handleCodeComplete} 
              />

              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: colors.icon }]} 
                onPress={() => setCurrentStep('password')}
              >
                <Text style={[styles.submitButtonText, { color: colors.background }]}>Proceed</Text>
              </TouchableOpacity>

              <Text style={[styles.timerText, { color: colors.text }]}>
                Code will be resent in{' '}
                <Text style={[styles.timer, { color: colors.icon }]}>
                  {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
                  {String(timeLeft % 60).padStart(2, '0')}
                </Text>{' '}
                sec
              </Text>
            </View>
          </>
        );

      case 'password':
        return (
          <>
            <Text style={[styles.subtitle, { color: colors.text }]}>Reset your password</Text>
            <Formik
              initialValues={{ newPassword: '', confirmPassword: '' }}
              validationSchema={PasswordSchema}
              onSubmit={handlePasswordSubmit}
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
                  <TouchableOpacity 
                    style={styles.goBack}
                    onPress={() => setCurrentStep('code')}
                  >
                    <Text style={[styles.goBackText, { color: colors.icon }]}>Go back</Text>
                  </TouchableOpacity>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>New Password</Text>
                    <TextInput
                      style={[styles.input, touched.newPassword && errors.newPassword && styles.inputError]}
                      value={values.newPassword}
                      onChangeText={handleChange('newPassword')}
                      onBlur={handleBlur('newPassword')}
                      placeholder="Enter new password"
                      placeholderTextColor={colors.text}
                      secureTextEntry
                    />
                    {touched.newPassword && errors.newPassword && (
                      <Text style={styles.errorText}>{errors.newPassword}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Re-enter Password</Text>
                    <TextInput
                      style={[styles.input, touched.confirmPassword && errors.confirmPassword && styles.inputError]}
                      value={values.confirmPassword}
                      onChangeText={handleChange('confirmPassword')}
                      onBlur={handleBlur('confirmPassword')}
                      placeholder="Re-enter new password"
                      placeholderTextColor={colors.text}
                      secureTextEntry
                    />
                    {touched.confirmPassword && errors.confirmPassword && (
                      <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={[styles.submitButton, { backgroundColor: colors.icon }]} 
                    onPress={handleSubmit}
                  >
                    <Text style={[styles.submitButtonText, { color: colors.background }]}>Proceed</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Formik>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Change Password</Text>
        {renderStep()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: 60,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 20,
  },
  form: {
    borderRadius: 20,
    padding: 20,
    height: '80%',
  },
  goBack: {
    alignSelf: 'flex-end',
  },
  goBackText: {
    textDecorationLine: 'underline',
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
  timerText: {
    textAlign: 'center',
  },
  timer: {},
});

export default ChangePassword;