import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSoundWithStates } from 'react-native-nitro-sound';
import { COLORS } from '../../utils/constants';

interface AudioMessageProps {
  uri: string;
  isOwn: boolean;
}

export const AudioMessage: React.FC<AudioMessageProps> = ({ uri, isOwn }) => {
  const {
    state,
    startPlayer,
    pausePlayer,
    resumePlayer,
  } = useSoundWithStates({
    subscriptionDuration: 0.05, // 50ms updates
  });

  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const togglePlay = async () => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      if (state.isPlaying) {
        await pausePlayer();
      } else {
        if (hasStarted && state.playback.position > 0 && state.playback.position < state.playback.duration) {
          await resumePlayer();
        } else {
          await startPlayer(uri);
          setHasStarted(true);
        }
      }
    } catch (err) {
      console.error("Failed to toggle playback:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentPosition = state.playback.position;
  const duration = state.playback.duration || 1; // Prevent division by zero

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.theirContainer]}>
      <TouchableOpacity onPress={togglePlay} style={styles.playBtn} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.playIcon}>{state.isPlaying ? '⏸' : '▶'}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.waveformContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progress, 
              { width: `${(currentPosition / duration) * 100}%` }
            ]} 
          />
        </View>
        <Text style={[styles.timeText, isOwn ? styles.ownText : styles.theirText]}>
          {formatTime(currentPosition)} / {formatTime(state.playback.duration || 0)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    minWidth: 180,
  },
  ownContainer: {},
  theirContainer: {},
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playIcon: {
    color: '#fff',
    fontSize: 16,
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    marginBottom: 4,
  },
  progress: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  timeText: {
    fontSize: 10,
  },
  ownText: {
    color: 'rgba(255,255,255,0.8)',
  },
  theirText: {
    color: COLORS.textSecondary,
  },
});
