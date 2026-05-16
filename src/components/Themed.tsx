import {
  Text as DefaultText,
  View as DefaultView,
  useColorScheme,
} from "react-native";
import { COLORS_LIGHT, COLORS_DARK } from "../utils/constants";

export type ColorName = keyof typeof COLORS_LIGHT;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ColorName,
) {
  const theme = useColorScheme() ?? "dark";

  const colorFromProps =
    theme in props ? props[theme as "light" | "dark"] : undefined;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme === "dark" ? COLORS_DARK[colorName] : COLORS_LIGHT[colorName];
  }
}

export type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
  type?: ColorName; // Allow specifying the color type (e.g. 'textSecondary', 'surface')
};

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, type = "text", ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, type);

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const {
    style,
    lightColor,
    darkColor,
    type = "background",
    ...otherProps
  } = props;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    type,
  );

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
