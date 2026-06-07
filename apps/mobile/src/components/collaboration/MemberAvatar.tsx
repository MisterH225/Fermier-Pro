import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius } from "../../theme/mobileTheme";

type Props = {
  name: string;
  size?: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const COLORS = [
  "#7E3FF2", "#1C7ED6", "#2F9E44", "#E8590C",
  "#F59F00", "#D64545", "#0CA678"
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length] ?? COLORS[0]!;
}

export function MemberAvatar({ name, size = 40 }: Props) {
  const bg = colorForName(name);
  const fs = Math.round(size * 0.35);
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${bg}22` }
      ]}
    >
      <Text style={[styles.txt, { fontSize: fs, color: bg }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center"
  },
  txt: {
    fontWeight: "700"
  }
});
