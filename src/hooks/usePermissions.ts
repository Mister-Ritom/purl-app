import { useState, useEffect } from 'react';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import { Platform } from 'react-native';

type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'limited' | 'checking';

export function usePermissions(permissionType: 'camera' | 'microphone' | 'photos' | 'contacts') {
  const [status, setStatus] = useState<PermissionStatus>('checking');

  const getPermission = (): Permission => {
    if (Platform.OS === 'ios') {
      switch (permissionType) {
        case 'camera': return PERMISSIONS.IOS.CAMERA;
        case 'microphone': return PERMISSIONS.IOS.MICROPHONE;
        case 'photos': return PERMISSIONS.IOS.PHOTO_LIBRARY;
        case 'contacts': return PERMISSIONS.IOS.CONTACTS;
      }
    } else {
      switch (permissionType) {
        case 'camera': return PERMISSIONS.ANDROID.CAMERA;
        case 'microphone': return PERMISSIONS.ANDROID.RECORD_AUDIO;
        case 'photos': return PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
        case 'contacts': return PERMISSIONS.ANDROID.READ_CONTACTS;
      }
    }
  };

  const checkPermission = async () => {
    const result = await check(getPermission());
    setStatus(result as PermissionStatus);
  };

  const requestPermission = async (): Promise<boolean> => {
    const result = await request(getPermission());
    setStatus(result as PermissionStatus);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return { status, requestPermission, isGranted: status === 'granted' || status === 'limited' };
}
