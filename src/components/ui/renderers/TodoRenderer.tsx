import React from "react";
import { Box, Text } from "ink";
import { NexusTheme } from "../../../themes/NexusTheme.js";

interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}

interface TodoRendererProps {
  theme: NexusTheme;
  todos: TodoItem[];
}

/**
 * TodoRenderer component - renders todo items with visual status indicators
 * Restored from original implementation with proper status icons and theme props
 */
export const TodoRenderer: React.FC<TodoRendererProps> = ({ theme, todos }) => {
  if (!todos || todos.length === 0) {
    return <Text color={theme.text.muted}>No todos available</Text>;
  }

  return (
    <Box flexDirection="column">
      {todos.map((todo) => (
        <TodoItemComponent key={todo.id} todo={todo} theme={theme} />
      ))}
    </Box>
  );
};

/**
 * Individual todo item component with status-based styling
 */
const TodoItemComponent: React.FC<{ todo: TodoItem; theme: NexusTheme }> = ({ todo, theme }) => {
  const getStatusIcon = (status: TodoItem["status"]): string => {
    switch (status) {
      case "completed":
        return "☒";
      case "in_progress":
        return "□";
      case "pending":
        return "☐";
      default:
        return "☐";
    }
  };

  const getStatusColor = (status: TodoItem["status"]): string => {
    switch (status) {
      case "completed":
        return "#888888"; // Gray for completed
      case "in_progress":
        return "#00ff00"; // Green for in progress
      case "pending":
        return "#cccccc"; // Light gray for pending
      default:
        return "#cccccc";
    }
  };

  const icon = getStatusIcon(todo.status);
  const color = getStatusColor(todo.status);
  const isCompleted = todo.status === "completed";

  return (
    <Box marginBottom={0}>
      <Text color="#555555"> </Text>
      <Text color={color} bold>
        {icon}
      </Text>
      <Text color={color} strikethrough={isCompleted} dimColor={isCompleted}>
        {todo.content}
      </Text>
    </Box>
  );
};

export default TodoRenderer;
