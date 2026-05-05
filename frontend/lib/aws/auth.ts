import { Amplify } from 'aws-amplify';

// Configure Amplify in index file or similar
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '',
      allowGuestAccess: false,
    }
  }
});

// Re-export current auth functions for easier usage if needed
export { getCurrentUser, fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';
