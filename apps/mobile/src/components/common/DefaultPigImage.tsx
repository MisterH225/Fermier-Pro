import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { mobileColors } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  width?: number | string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Illustration porc par défaut (marketplace, pas d’icône patte). */
export function DefaultPigImage({ width = "100%", height = 160, style }: Props) {
  return (
    <View style={[styles.wrap, { height }, style]}>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid meet"
      >
        <Ellipse cx="200" cy="230" rx="150" ry="28" fill={mobileColors.border} opacity={0.6} />
        <Ellipse cx="200" cy="175" rx="118" ry="88" fill={uiNamedColors.cF9C9B8} />
        <Ellipse cx="200" cy="178" rx="98" ry="72" fill={uiNamedColors.cFBD4C6} />
        <Circle cx="128" cy="118" r="34" fill={uiNamedColors.cF9C9B8} />
        <Circle cx="272" cy="118" r="34" fill={uiNamedColors.cF9C9B8} />
        <Ellipse cx="200" cy="108" rx="72" ry="58" fill={uiNamedColors.cFBD4C6} />
        <Circle cx="172" cy="102" r="7" fill={uiNamedColors.c3D3D3D} />
        <Circle cx="228" cy="102" r="7" fill={uiNamedColors.c3D3D3D} />
        <Circle cx="174" cy="100" r="2.5" fill={mobileColors.background} />
        <Circle cx="230" cy="100" r="2.5" fill={mobileColors.background} />
        <Ellipse cx="200" cy="128" rx="26" ry="18" fill={uiNamedColors.cF5A89A} />
        <Path
          d="M 188 128 Q 200 138 212 128"
          stroke={uiNamedColors.cE07A6A}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <Ellipse cx="108" cy="188" rx="22" ry="14" fill={uiNamedColors.cF9C9B8} />
        <Ellipse cx="292" cy="188" rx="22" ry="14" fill={uiNamedColors.cF9C9B8} />
        <Ellipse cx="168" cy="228" rx="18" ry="12" fill={uiNamedColors.cF5A89A} />
        <Ellipse cx="232" cy="228" rx="18" ry="12" fill={uiNamedColors.cF5A89A} />
        <Path
          d="M 248 108 Q 278 98 290 118 Q 278 128 258 122"
          fill={uiNamedColors.cF9C9B8}
          stroke={uiNamedColors.cF0B5A5}
          strokeWidth={1}
        />
        <Path
          d="M 152 108 Q 122 98 110 118 Q 122 128 142 122"
          fill={uiNamedColors.cF9C9B8}
          stroke={uiNamedColors.cF0B5A5}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    backgroundColor: uiNamedColors.cF5F5F5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }
});
