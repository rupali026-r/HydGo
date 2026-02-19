import { Redirect } from 'expo-router';

// Redirect old /auth/login to new role-based passenger login
export default function LoginRedirect() {
  return <Redirect href="/(auth)/passenger/login" />;
}
