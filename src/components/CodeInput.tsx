
import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { colors } from '../constants/colors';

interface CodeInputProps {
  length: number;
  onCodeComplete: (code: string) => void;
  allowBackspace?: boolean;
}

export const CodeInput: React.FC<CodeInputProps> = ({ 
  length, 
  onCodeComplete,
  allowBackspace = true 
}) => {
  const [code, setCode] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
    while (inputRefs.current.length < length) {
      inputRefs.current.push(null);
    }
  }, [length]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    
    // Handle paste of multiple digits
    if (text.length > 1) {
      const digits = text.split('').slice(0, length - index);
      digits.forEach((digit, digitIndex) => {
        const targetIndex = index + digitIndex;
        if (targetIndex < length) {
          newCode[targetIndex] = digit;
        }
      });
      
      setCode(newCode);
      
      // Focus on the next empty input or the last input
      const nextEmptyIndex = newCode.findIndex(digit => digit === '');
      if (nextEmptyIndex !== -1) {
        inputRefs.current[nextEmptyIndex]?.focus();
      } else {
        inputRefs.current[length - 1]?.focus();
      }
    } else {
      // Handle single digit input
      newCode[index] = text;
      setCode(newCode);

      // Move focus to next input if a digit was entered
      if (text.length === 1 && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    // Check if code is complete
    const completeCode = newCode.join('');
    if (completeCode.length === length) {
      onCodeComplete(completeCode);
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (!allowBackspace) return;
    
    const key = e.nativeEvent.key;
    
    // Handle backspace key
    if (key === 'Backspace') {
      const newCode = [...code];
      
      // If current input is empty and not the first input, move to previous input and clear it
      if (code[index] === '' && index > 0) {
        newCode[index - 1] = '';
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        newCode[index] = '';
        setCode(newCode);
      }
      
      // Notify about code change
      onCodeComplete(newCode.join(''));
    }
  };

  return (
    <View style={styles.container}>
      {Array(length).fill(0).map((_, index) => (
        <TextInput
          key={index}
          ref={ref => {
            inputRefs.current[index] = ref;
          }}
          style={styles.input}
          maxLength={1}
          keyboardType="numeric"
          value={code[index]}
          onChangeText={text => handleCodeChange(text, index)}
          onKeyPress={e => handleKeyPress(e, index)}
          selectTextOnFocus={true}
          autoFocus={index === 0}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  input: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 20,
    color: colors.text.primary,
  },
});