import { useState, useCallback } from "react";
import { View, Text, TextInput, SafeAreaView, TouchableOpacity, Pressable,
  StyleSheet, ScrollView, StatusBar, Alert, Modal, Vibration
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { CategoryService } from "@/utils/categoryService";

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';
const TASK_TYPES = ['mandatory', 'extra', 'challenge'];

export default function ManageTasksScreen() {
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // category form modal state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // null = creating
  const [categoryName, setCategoryName] = useState('');
  const [categoryAbbrv, setCategoryAbbrv] = useState('');

  // task form modal state
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null = creating
  const [taskName, setTaskName] = useState('');
  const [taskPoints, setTaskPoints] = useState('10');
  const [taskType, setTaskType] = useState('mandatory');
  const [taskDifficulty, setTaskDifficulty] = useState('1');
  const [taskCooldown, setTaskCooldown] = useState('0');
  const [taskCategoryId, setTaskCategoryId] = useState(null);

  const loadData = useCallback(async () => {
      setLoading(true);
      try {
        const [cats, allTasks] = await Promise.all([
          CategoryService.getCategories(),
          CategoryService.getAllTasks(),
        ]);
        setCategories(cats);
        setTasks(allTasks);
      } catch (e) {
        Alert.alert('Error loading data', String(e.message || e));
      } finally {
        setLoading(false);
      }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ---------------- Category actions ----------------
  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryAbbrv('');
    setCategoryModalVisible(true);
  };

  const openEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryAbbrv(category.abbrv || '');
    setCategoryModalVisible(true);
  };

  const saveCategory = async () => {
      if (!categoryName.trim()) {
        Alert.alert('Name required', 'Give the category a name.');
        return;
      }
      try {
        if (editingCategory) {
          await CategoryService.updateCategory(editingCategory.id, {
            name: categoryName,
            abbrv: categoryAbbrv,
          });
        } else {
          await CategoryService.createCategory({ name: categoryName, abbrv: categoryAbbrv });
        }
        Vibration.vibrate(15);
        setCategoryModalVisible(false);
        loadData();
      } catch (e) {
        Alert.alert('Error', String(e.message || e));
      }
  };

  const confirmDeleteCategory = (category) => {
      Alert.alert(
        `Delete "${category.name}"?`,
        'This also deletes every task in this category and their history. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await CategoryService.deleteCategory(category.id);
                Vibration.vibrate([0, 40, 30, 40]);
                loadData();
              } catch (e) {
                Alert.alert('Error', String(e.message || e));
              }
            },
          },
        ]
      );
  };

  // ---------------- Task actions ----------------

  const openNewTask = (categoryId = null) => {
      if (categories.length === 0) {
        Alert.alert('Add a category first', 'You need at least one category before adding tasks.');
        return;
      }
      setEditingTask(null);
      setTaskName('');
      setTaskPoints('10');
      setTaskType('mandatory');
      setTaskDifficulty('1');
      setTaskCooldown('0');
      setTaskCategoryId(categoryId ?? categories[0].id);
      setTaskModalVisible(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskPoints(String(task.points));
    setTaskType(task.task_type);
    setTaskDifficulty(String(task.difficulty));
    setTaskCooldown(String(task.cooldown_hours));
    setTaskCategoryId(task.category_id);
    setTaskModalVisible(true);
  };

  const saveTask = async () => {
      if (!taskName.trim()) {
        Alert.alert('Name required', 'Give the task a name.');
        return;
      }
      const points = parseInt(taskPoints, 10);
      const difficulty = parseInt(taskDifficulty, 10);
      const cooldownHours = parseInt(taskCooldown, 10);
  
      if (Number.isNaN(points) || points < 0) {
        Alert.alert('Invalid points', 'Points must be a non-negative number.');
        return;
      }
      if (Number.isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
        Alert.alert('Invalid difficulty', 'Difficulty must be between 1 and 5.');
        return;
      }
  
      try {
        if (editingTask) {
          await CategoryService.updateTask(editingTask.id, {
            name: taskName,
            points,
            taskType,
            difficulty,
            cooldownHours: Number.isNaN(cooldownHours) ? 0 : cooldownHours,
            categoryId: taskCategoryId,
          });
        } else {
          await CategoryService.createTask({
            categoryId: taskCategoryId,
            name: taskName,
            points,
            taskType,
            difficulty,
            cooldownHours: Number.isNaN(cooldownHours) ? 0 : cooldownHours,
          });
        }
        Vibration.vibrate(15);
        setTaskModalVisible(false);
        loadData();
      } catch (e) {
        Alert.alert('Error', String(e.message || e));
      }
  };

  const confirmDeleteTask = (task) => {
      Alert.alert(
        `Remove "${task.name}"?`,
        'Archive keeps its history but hides it from your daily plan. Delete permanently removes it and its history entirely.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            onPress: async () => {
              await CategoryService.deactivateTask(task.id);
              Vibration.vibrate(15);
              loadData();
            },
          },
          {
            text: 'Delete Permanently',
            style: 'destructive',
            onPress: async () => {
              await CategoryService.deleteTask(task.id);
              Vibration.vibrate([0, 40, 30, 40]);
              loadData();
            },
          },
        ]
      );
  };

  const toggleDailyPlan = async (task) => {
      try {
        const plan = await CategoryService.getDailyPlan();
        const inPlan = plan.some((p) => p.task_id === task.id);
        if (inPlan) {
          await CategoryService.removeFromDailyPlan(task.id);
        } else {
          await CategoryService.addToDailyPlan(task.id, task.task_type === 'mandatory');
        }
        Vibration.vibrate(10);
      } catch (e) {
        Alert.alert('Error', String(e.message || e));
      }
  };

  const tasksByCategory = categories.map((cat) => ({
    category: cat,
    tasks: tasks.filter((t) => t.category_id === cat.id),
  }));

  return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
  
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Manage Tasks</Text>
          <View style={{ width: 60 }} />
        </View>
  
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.addCategoryButton} onPress={openNewCategory}>
            <Text style={styles.addCategoryButtonText}>+ New Category</Text>
          </TouchableOpacity>
  
          {loading && <Text style={styles.emptyText}>Loading…</Text>}
  
          {!loading && categories.length === 0 && (
            <Text style={styles.emptyText}>
              No categories yet. Create one to start adding tasks.
            </Text>
          )}
  
          {tasksByCategory.map(({ category, tasks: categoryTasks }) => (
            <View key={category.id} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Pressable onPress={() => openEditCategory(category)} style={{ flex: 1 }}>
                  <Text style={styles.categoryName}>
                    {category.name}
                    {category.abbrv ? (
                      <Text style={styles.categoryAbbrv}>  ({category.abbrv})</Text>
                    ) : null}
                  </Text>
                </Pressable>
                <TouchableOpacity onPress={() => confirmDeleteCategory(category)}>
                  <Text style={styles.deleteIcon}>✕</Text>
                </TouchableOpacity>
              </View>
  
              {categoryTasks.map((task) => (
                <View
                  key={task.id}
                  style={[styles.taskRow, !task.is_active && styles.taskRowInactive]}
                >
                  <Pressable onPress={() => openEditTask(task)} style={{ flex: 1 }}>
                    <Text style={styles.taskName}>
                      {task.name} {!task.is_active ? '(archived)' : ''}
                    </Text>
                    <Text style={styles.taskMeta}>
                      {task.task_type} · {task.points}pt · diff {task.difficulty}
                      {task.cooldown_hours > 0 ? ` · ${task.cooldown_hours}h cooldown` : ''}
                    </Text>
                  </Pressable>
                  <TouchableOpacity onPress={() => toggleDailyPlan(task)} style={styles.planToggle}>
                    <Text style={styles.planToggleText}>Plan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteTask(task)}>
                    <Text style={styles.deleteIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
  
              <TouchableOpacity
                style={styles.addTaskButton}
                onPress={() => openNewTask(category.id)}
              >
                <Text style={styles.addTaskButtonText}>+ Add Task</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
  
        {/* ---------------- Category modal ---------------- */}
        <Modal visible={categoryModalVisible} transparent animationType="fade">
          <Pressable style={styles.modalBackdrop} onPress={() => setCategoryModalVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Edit Category' : 'New Category'}
              </Text>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Category name (e.g. Coding)"
                placeholderTextColor="rgba(242,245,245,0.35)"
                selectionColor={CYAN}
              />
              <TextInput
                style={styles.input}
                value={categoryAbbrv}
                onChangeText={setCategoryAbbrv}
                placeholder="Abbreviation (e.g. COD)"
                placeholderTextColor="rgba(242,245,245,0.35)"
                selectionColor={CYAN}
                maxLength={5}
                autoCapitalize="characters"
              />
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setCategoryModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveButton} onPress={saveCategory}>
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
  
        {/* ---------------- Task modal ---------------- */}
        <Modal visible={taskModalVisible} transparent animationType="fade">
          <Pressable style={styles.modalBackdrop} onPress={() => setTaskModalVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <ScrollView>
                <Text style={styles.modalTitle}>{editingTask ? 'Edit Task' : 'New Task'}</Text>
  
                <TextInput
                  style={styles.input}
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholder="Task name"
                  placeholderTextColor="rgba(242,245,245,0.35)"
                  selectionColor={CYAN}
                />
  
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.chip,
                        taskCategoryId === c.id && styles.chipSelected,
                      ]}
                      onPress={() => setTaskCategoryId(c.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          taskCategoryId === c.id && styles.chipTextSelected,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
  
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.chipRow}>
                  {TASK_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, taskType === t && styles.chipSelected]}
                      onPress={() => setTaskType(t)}
                    >
                      <Text
                        style={[styles.chipText, taskType === t && styles.chipTextSelected]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
  
                <Text style={styles.fieldLabel}>Points</Text>
                <TextInput
                  style={styles.input}
                  value={taskPoints}
                  onChangeText={setTaskPoints}
                  keyboardType="number-pad"
                  selectionColor={CYAN}
                />
  
                <Text style={styles.fieldLabel}>Difficulty (1-5)</Text>
                <TextInput
                  style={styles.input}
                  value={taskDifficulty}
                  onChangeText={setTaskDifficulty}
                  keyboardType="number-pad"
                  selectionColor={CYAN}
                />
  
                <Text style={styles.fieldLabel}>Cooldown hours (0 = none)</Text>
                <TextInput
                  style={styles.input}
                  value={taskCooldown}
                  onChangeText={setTaskCooldown}
                  keyboardType="number-pad"
                  selectionColor={CYAN}
                />
  
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setTaskModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSaveButton} onPress={saveTask}>
                    <Text style={styles.modalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,245,238,0.15)',
  },
  backButton: { width: 60 },
  backButtonText: { color: CYAN, fontSize: 16 },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  scrollContent: { padding: 16, paddingBottom: 48 },
  emptyText: {
    color: 'rgba(242,245,245,0.5)',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
  },
  addCategoryButton: {
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: CYAN,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  addCategoryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  categoryBlock: {
    borderWidth: 1,
    borderColor: 'rgba(185,245,238,0.25)',
    borderRadius: 16,
    backgroundColor: 'rgba(8,20,28,0.6)',
    padding: 14,
    marginBottom: 18,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryName: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  categoryAbbrv: { color: 'rgba(242,245,245,0.5)', fontWeight: '400', fontSize: 14 },
  deleteIcon: { color: '#FF8C8C', fontSize: 16, paddingHorizontal: 8, paddingVertical: 4 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
  },
  taskRowInactive: { opacity: 0.4 },
  taskName: { color: '#F2F5F5', fontSize: 15, fontWeight: '600' },
  taskMeta: { color: 'rgba(242,245,245,0.5)', fontSize: 12, marginTop: 2 },
  planToggle: {
    borderWidth: 1,
    borderColor: 'rgba(185,245,238,0.4)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
  },
  planToggleText: { color: CYAN, fontSize: 11, fontWeight: '700' },
  addTaskButton: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  addTaskButtonText: { color: CYAN, fontSize: 13, fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    backgroundColor: 'rgba(8, 20, 28, 0.97)',
    padding: 20,
    shadowColor: CYAN,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  fieldLabel: { color: 'rgba(242,245,245,0.6)', fontSize: 12, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(185,245,238,0.5)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 15,
    backgroundColor: 'rgba(143,243,232,0.05)',
    marginBottom: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(185,245,238,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: 'rgba(143,243,232,0.15)', borderColor: CYAN },
  chipText: { color: 'rgba(242,245,245,0.7)', fontSize: 13 },
  chipTextSelected: { color: CYAN, fontWeight: '700' },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalCancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: 'rgba(242,245,245,0.6)', fontSize: 15 },
  modalSaveButton: {
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginLeft: 10,
  },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
