import { Amplify } from 'aws-amplify';

export const configureAmplify = () => {
  const userPoolId = process.env.EXPO_PUBLIC_AWS_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.EXPO_PUBLIC_AWS_COGNITO_USER_POOL_CLIENT_ID;

  if (userPoolId && userPoolClientId) {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: userPoolId,
          userPoolClientId: userPoolClientId,
        }
      }
    });
  } else {
    console.warn("Faltan variables de entorno para AWS Cognito (EXPO_PUBLIC_AWS_COGNITO_USER_POOL_ID, EXPO_PUBLIC_AWS_COGNITO_USER_POOL_CLIENT_ID). La autenticación fallará.");
  }
};
