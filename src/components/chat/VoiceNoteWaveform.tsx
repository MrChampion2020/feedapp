import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface VoiceNoteWaveformProps {
  isRecording?: boolean;
  isPlaying?: boolean;
  color?: string;
  height?: number;
  width?: number;
}

export const VoiceNoteWaveform: React.FC<VoiceNoteWaveformProps> = ({
  isRecording = false,
  isPlaying = false,
  color = '#25D366',
  height = 24,
  width = 120,
}) => {
  const animatedValues = useRef<Animated.Value[]>([]).current;

  // Initialize animated values for waveform bars
  useEffect(() => {
    if (animatedValues.length === 0) {
      for (let i = 0; i < 5; i++) {
        animatedValues.push(new Animated.Value(0.3));
      }
    }
  }, []);

  // Animate waveform when recording or playing
  useEffect(() => {
    if (isRecording || isPlaying) {
      const animations = animatedValues.map((value, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(value, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false,
            }),
            Animated.timing(value, {
              toValue: 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false,
            }),
          ])
        );
      });

      Animated.parallel(animations).start();
    } else {
      // Reset to static state when not recording or playing
      animatedValues.forEach(value => {
        value.setValue(0.3);
      });
    }
  }, [isRecording, isPlaying]);

  return (
    <View style={[styles.container, { width, height }]}>
      {animatedValues.map((animatedValue, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [height * 0.2, height],
              }),
              width: width / 8,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: {
    borderRadius: 2,
  },
}); 