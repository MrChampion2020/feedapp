import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DateSeparatorProps {
  date: string;
  colors: any;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date, colors }) => {
  const displayDate = date || 'Unknown Date';
  const isDark = colors.theme === 'dark';

  return (
    <View style={[styles.container, { marginTop: 20, marginBottom: 20 }]}> 
      <View style={[
        styles.separator,
        {
          backgroundColor: isDark ? '#232D36' : 'rgba(36, 36, 36, 0.96)',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 4,
        },
      ]}>
        <Text style={[
          styles.dateText,
          { color: isDark ? '#e0e0e0' : colors.text, fontWeight: 'bold', letterSpacing: 0.5 },
        ]}>
          {displayDate}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  separator: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 28,
  },
  dateText: {
    fontSize: 13,
    textAlign: 'center',
  },
}); 