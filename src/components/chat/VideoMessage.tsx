import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, Modal } from "react-native";
import { useVideoPlayer, VideoView, VideoContentFit } from "expo-video";
import Ionicons from "react-native-vector-icons/dist/Ionicons";
import { useTheme } from "../../../src/hooks/useTheme";

interface VideoMessageProps {
  uri: string;
  isOwn: boolean;
  style?: any;
  contentFit?: VideoContentFit;
}

export const VideoMessage: React.FC<VideoMessageProps> = ({
  uri,
  isOwn,
  style,
  contentFit = "cover",
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
  });
  React.useEffect(() => {
    if (isFullscreen) {
      player.play();
    } else {
      player.pause();
    }
  }, [isFullscreen]);
  const { colors } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit={contentFit}
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
      />
      {!isFullscreen && (
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => setIsFullscreen(true)}
        >
          <Ionicons name="play" size={32} color={colors.surface} />
        </TouchableOpacity>
      )}
      <Modal
        visible={isFullscreen}
        onRequestClose={() => setIsFullscreen(false)}
        transparent={false}
        animationType="fade"
      >
        <View style={styles.fullscreenContainer}>
          <VideoView
            style={styles.fullscreenVideo}
            player={player}
            contentFit="contain"
          />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsFullscreen(false)}
          >
            <Ionicons name="close" size={32} color={colors.surface} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },

  fullscreenVideo: {
    width: "100%",
    height: "100%",
  },

  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  container: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  playButton: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    color: "#fff",
    fontSize: 24,
    marginLeft: 4,
  },
});
