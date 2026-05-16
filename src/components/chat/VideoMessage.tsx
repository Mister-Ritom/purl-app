import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView, VideoContentFit } from 'expo-video';
import { COLORS } from '../../utils/constants';

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
  contentFit = 'cover'
}) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <View style={[styles.container, style]}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit={contentFit}
      />
      {!player.playing && (
        <TouchableOpacity 
          style={styles.playButton}
          onPress={() => player.play()}
        >
          <Text style={styles.playIcon}>▶</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 24,
    marginLeft: 4,
  },
});
