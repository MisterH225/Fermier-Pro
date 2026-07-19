import { FlatList, StyleSheet, View } from "react-native";
import type { FarmTaskDto } from "../../lib/api";
import { mobileSpacing } from "../../theme/mobileTheme";
import { TaskCard } from "./TaskCard";

type Props = {
  tasks: FarmTaskDto[];
  onPressTask: (t: FarmTaskDto) => void;
  onToggleDone: (t: FarmTaskDto) => void;
  /**
   * Dans un ScrollView parent : rend les cartes sans FlatList imbriquée
   * (évite le scroll bloqué sur dashboard tech / véto).
   */
  embedded?: boolean;
};

export function TaskListView({
  tasks,
  onPressTask,
  onToggleDone,
  embedded = false
}: Props) {
  if (embedded) {
    return (
      <View style={styles.embeddedList}>
        {tasks.map((item) => (
          <TaskCard
            key={item.id}
            task={item}
            mode="list"
            onPress={() => onPressTask(item)}
            onToggleDone={() => onToggleDone(item)}
          />
        ))}
      </View>
    );
  }

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
  },
  embeddedList: {
    gap: mobileSpacing.sm
  }
});
