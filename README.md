# Purl

Purl is a feature-rich, highly secure real-time messaging and calling application built with React Native and Expo. It provides an intuitive and native-feeling user experience with end-to-end encryption, high-quality audio/video calls, and seamless media sharing.

## 🚀 Features

- **Authentication**: Multiple sign-in methods including Google Sign-In, Email/Password, and Phone number authentication.
- **Real-time Messaging**: Fast, real-time chat powered by Firebase Firestore.
- **End-to-End Encryption (E2EE)**: Secure communication using advanced cryptographic algorithms (`tweetnacl`, AES-GCM).
- **Voice & Video Calling**: High-quality real-time communications integrated with Agora and `react-native-callkeep` for native call screens.
- **Media Sharing**: Easily share photos and videos from your camera or gallery.
- **Presence Tracking**: Real-time online/offline status using Firebase Realtime Database.
- **Push Notifications**: Reliable notifications for messages and calls via FCM and Notifee.
- **QR Code Invites**: Generate and scan QR codes to quickly add contacts.
- **Deep Linking**: Native deep link support for sharing profiles and groups.
- **Adaptive UI**: Full support for both Light and Dark modes with smooth transitions.

## 🛠️ Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/) (SDK 55)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Backend as a Service**: [Firebase](https://firebase.google.com/) (Auth, Firestore, Storage, Realtime DB, Functions)
- **Communications**: [Agora RTC](https://www.agora.io/en/)
- **Encryption**: `react-native-aes-gcm-crypto`, `tweetnacl`

## 📂 Project Structure

```text
purl-app/
├── app/                  # Expo Router pages and layouts
│   ├── (app)/            # Main authenticated app screens (Tabs: chats, calls, settings, status)
│   ├── (auth)/           # Authentication screens (welcome, email, phone, username)
│   ├── _layout.tsx       # Root layout, Firebase initialization, theming
│   └── index.tsx         # Entry point, routing logic based on auth state
├── src/                  # Core application logic
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks (e.g., usePresence)
│   ├── services/         # Integrations (Firebase, Agora, Notifee, Encryption, Deep Linking)
│   ├── store/            # Zustand global state (authStore)
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Helper functions and constants
├── assets/               # Static assets (icons, splash screens)
├── functions/            # Firebase Cloud Functions
├── android/              # Native Android project files
└── ios/                  # Native iOS project files
```

## ⚙️ Prerequisites

- **Node.js**: `v18` or newer
- **Bun**: `v1.0+` (Used as the package manager, indicated by `bun.lock`)
- **Expo CLI**: Installed globally or via `npx expo`
- **React Native Environment**: XCode for iOS development, Android Studio for Android.
- **Firebase Project**: A Firebase project with Auth, Firestore, Realtime DB, and Storage enabled.
- **Agora Account**: For voice and video calling features.

## 🚀 Getting Started

1. **Clone the repository** (if applicable) and navigate to the project directory:
   ```bash
   cd purl-app
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure Firebase**:
   - Add your `GoogleService-Info.plist` to the root directory for iOS.
   - Add your `google-services.json` to the root directory for Android.
   - Ensure your Firebase project has the necessary services enabled and rules deployed (see `firestore.rules`, `storage.rules`, `database.rules.json`).

4. **Environment Setup**:
   - Make sure you configure any required API keys for Agora or Google Sign-In within the project codebase (usually in `src/services` or via environment variables).

5. **Prebuild & Run**:
   Because this app uses custom native code and modules (like WebRTC, Agora, Notifee, and Crypto), you need to run it via Expo Dev Client or build it natively.
   
   To run on iOS:
   ```bash
   bun run ios
   ```
   
   To run on Android:
   ```bash
   bun run android
   ```

## 🏗️ Building for Production

This project uses **EAS (Expo Application Services)** for building.

1. Ensure you have the EAS CLI installed:
   ```bash
   npm install -g eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

3. Build the application:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

## 📄 License

This project is proprietary and confidential.
