import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { user, userProfile, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!userProfile) {
    return <Redirect href="/(auth)/username" />;
  }

  return <Redirect href="/(app)/chats" />;
}
