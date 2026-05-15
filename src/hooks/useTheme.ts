import { useColorScheme } from 'react-native';
import { COLORS_LIGHT, COLORS_DARK } from '../utils/constants';

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
  
  return {
    colors,
    isDark,
    scheme,
  };
}
