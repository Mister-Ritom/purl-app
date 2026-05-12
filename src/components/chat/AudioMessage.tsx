import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { COLORS } from '../../utils/constants';

interface AudioMessageProps {
  uri: string;
  isOwn: boolean;
}

export const AudioMessage: React.FC<AudioMessageProps> = ({ uri, isOwn }) => {
  const player = useAudioPlayer(uri);
  const [status, setStatus] = useState({
    playing: false,
    duration: 0,
    currentTime: 0,
  });

  // Since expo-audio might not have a simple status listener like expo-av yet,
  // we might need to poll or use the provided event listeners if available.
  // Based on the search results, the API is object-oriented.
  
  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.theirContainer]}>
      <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
        <Text style={styles.playIcon}>{player.playing ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <View style={styles.waveformContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progress, 
              { width: `${(player.currentTime / player.duration) * 100}%` || '0%' }
            ]} 
          />
        </View>
        <Text style={[styles.timeText, isOwn ? styles.ownText : styles.theirText]}>
          {formatTime(player.currentTime)} / {formatTime(player.duration)}
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
