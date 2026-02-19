import { Redirect } from 'expo-router';

// Redirect old /auth/register to new role-based passenger register
export default function RegisterRedirect() {
  return <Redirect href="/(auth)/passenger/register" />;
}
