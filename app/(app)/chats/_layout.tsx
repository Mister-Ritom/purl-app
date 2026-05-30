import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import Ionicons from "react-native-vector-icons/dist/Ionicons";
import { useTheme } from '../../../src/hooks/useTheme';

export default function ChatsLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Purl', 
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/contacts')}
              style={{ marginRight: 8 }}
            >
              <Ionicons name="people-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          )
        }} 
      />
    </Stack>
  );
}
