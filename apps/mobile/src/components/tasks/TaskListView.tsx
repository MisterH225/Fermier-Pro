import { FlatList, StyleSheet } from "react-native";
import type { FarmTaskDto } from "../../lib/api";
import { mobileSpacing } from "../../theme/mobileTheme";
import { TaskCard } from "./TaskCard";

type Props = {
  tasks: FarmTaskDto[];
  onPressTask: (t: FarmTaskDto) => void;
  onToggleDone: (t: FarmTaskDto) => void;
};

export function TaskListView({ tasks, onPressTask, onToggleDone }: Props) {
  return (
    <FlatList
      data={tasks}
      key="list"
      contentContainerStyle={styles.list}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TaskCard
          task={item}
          mode="list"
          onPress={() => onPressTask(item)}
          onToggleDone={() => onToggleDone(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl
  }
});
