import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Video from "react-native-video";

interface VideoPlayerProps {
  source: string;
  style: any;
  onError?: (error: any) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ source, style, onError }) => {
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={style}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load video</Text>
        </View>
      ) : (
        <Video
          source={{ uri: source }}
          style={style}
          controls
          resizeMode="contain"
          onError={(err) => {
            setError("Video playback failed");
            if (onError) onError(err);
          }}
          paused // Start paused to avoid auto-play issues
          audioOnly={false}
          ignoreSilentSwitch="ignore" // For iOS
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default VideoPlayer;