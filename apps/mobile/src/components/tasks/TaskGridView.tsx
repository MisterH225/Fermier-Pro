import { FlatList, StyleSheet, View } from "react-native";
import type { FarmTaskDto } from "../../lib/api";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import { mobileSpacing } from "../../theme/mobileTheme";
import { TaskCard } from "./TaskCard";
import type { TaskViewMode } from "./taskConstants";

type Props = {
  tasks: FarmTaskDto[];
  onPressTask: (t: FarmTaskDto) => void;
  onToggleDone: (t: FarmTaskDto) => void;
};

export function TaskGridView({ tasks, onPressTask, onToggleDone }: Props) {
  const scrollPad = useScrollBottomPad();

  return (
    <FlatList
      data={tasks}
      key="grid"
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.list, { paddingBottom: scrollPad }]}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <TaskCard
            task={item}
            mode="grid"
            onPress={() => onPressTask(item)}
            onToggleDone={() => onToggleDone(item)}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: mobileSpacing.lg
  },
  row: { gap: mobileSpacing.md },
  cell: { flex: 1 }
});
