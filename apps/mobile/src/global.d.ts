// Expo/React Native'de process.env.EXPO_PUBLIC_* runtime'da inline edilir.
// Node tiplerinden sadece process.env'i hedeflemek icin minimal declaration.

declare const process: {
  env: Record<string, string | undefined>;
};
