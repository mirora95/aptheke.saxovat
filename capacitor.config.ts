import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mirora.pharmacy',
  appName: 'MIRORA Pharmacy',
  webDir: 'dist',
  android: {
    // Allow mixed content so the WebView can reach an HTTP API during development.
    // In production this should be HTTPS-only — remove this flag once your API has TLS.
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      // Use the native HTTP stack instead of the WebView fetch.
      // Avoids CORS issues when calling the backend from within the app.
      enabled: true,
    },
  },
};

export default config;
