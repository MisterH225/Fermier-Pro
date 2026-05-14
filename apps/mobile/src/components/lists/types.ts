export type EventValueTone = "positive" | "negative" | "neutral";

export type EventIconKind =
  | "in"
  | "out"
  | "cancelled"
  | "check"
  | "custom";

export type EventItem = {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueType: EventValueTone;
  date: string;
  iconType: EventIconKind;
  /** Nom d’icône Ionicons si `iconType === "custom"`. */
  customIcon?: string;
  iconColor?: string;
  meta?: unknown;
};

export type FilterPill = {
  id: string;
  label: string;
};
