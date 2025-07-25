import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const VerifiedBadge = ({ size = 120, style }) => (
  <View
    style={[
      styles.container,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
      style,
    ]}
  >
    <Image
      source={require('../assets/images/badge.png')}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
      resizeMode="cover"
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});

export default VerifiedBadge;
