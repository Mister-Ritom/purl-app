export const AGORA_APP_ID = "1d20376e7a054b3cad2a8c50f92e9ab7";

export const FIREBASE_PROJECT_ID = "purl-app";
export const FIREBASE_STORAGE_BUCKET = "purl-app.firebasestorage.app";
export const FIREBASE_DATABASE_URL = "https://purl-app-default-rtdb.asia-southeast1.firebasedatabase.app";

export const COLORS_DARK = {
  primary: "#5E5CE6", // Apple-style Indigo for Dark Mode
  primaryDark: "#4F46E5",
  background: "#000000", // OLED True Black
  surface: "#1C1C1E", // Apple System Gray 6
  surfaceElevated: "#2C2C2E", // Apple System Gray 5
  border: "#38383A",
  text: "#FFFFFF",
  textSecondary: "#EBEBF599", // iOS Secondary Label (60% opacity)
  textMuted: "#EBEBF54D", // iOS Tertiary Label (30% opacity)
  online: "#32D74B", // Apple Green
  error: "#FF453A", // Apple Red
  warning: "#FF9F0A", // Apple Orange
  success: "#32D74B",
  sent: "#5E5CE6",
  received: "#2C2C2E",
  inputBg: "#1C1C1E",
  glass: "rgba(28, 28, 30, 0.7)", // For BlurViews
};

export const COLORS_LIGHT = {
  primary: "#4F46E5", // Electric Indigo
  primaryDark: "#4338CA",
  background: "#FFFFFF",
  surface: "#F2F2F7", // Apple System Gray 6
  surfaceElevated: "#E5E5EA", // Apple System Gray 5
  border: "#C6C6C8",
  text: "#000000",
  textSecondary: "#3C3C4399", // iOS Secondary Label (60% opacity)
  textMuted: "#3C3C434D", // iOS Tertiary Label (30% opacity)
  online: "#34C759", // Apple Green
  error: "#FF3B30", // Apple Red
  warning: "#FF9500", // Apple Orange
  success: "#34C759",
  sent: "#4F46E5",
  received: "#E5E5EA",
  inputBg: "#F2F2F7",
  glass: "rgba(255, 255, 255, 0.7)", // For BlurViews
};

// Legacy export for backward compatibility
export const COLORS = COLORS_DARK;

export const FONTS = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  bold: "Inter_700Bold",
  mono: "Courier New",
};

export const SIZES = {
  avatarSm: 36,
  avatarMd: 48,
  avatarLg: 80,
  avatarXl: 120,
  borderRadius: 16, // Squircular feel
  borderRadiusSm: 10,
  borderRadiusLg: 24,
  borderRadiusFull: 999,
};

export const PURL_SCHEME = "purl";
export const MAX_IMAGE_DIMENSION = 1280;
export const IMAGE_QUALITY = 0.8;
export const TYPING_DEBOUNCE_MS = 300;
export const TYPING_TIMEOUT_MS = 3000;
export const USERNAME_CHECK_DEBOUNCE_MS = 500;
export const MESSAGES_PER_PAGE = 30;
export const STATUS_DURATION_MS = 24 * 60 * 60 * 1000;
export const AGORA_TOKEN_EXPIRY_SECONDS = 3600;
export const DELETE_FOR_EVERYONE_LIMIT_MS = 60 * 60 * 1000;

export const CACHE_DIR_NAME = "purl";

export const KEYCHAIN_SERVICE_ENCRYPTION = "purl_encryption";
export const MMKV_INSTANCE_ID = "purl-store";
