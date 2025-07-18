import React from 'react';
import { TodoRendererProps } from '../types/common.js';

/**
 * Shared TodoRenderer component for handling TodoWrite/TodoRead operations
 * Provides consistent todo rendering across providers
 */
export const TodoRenderer: React.FC<TodoRendererProps> = ({
  toolData,
  renderTodoContent
}) => {
  // Special rendering for TodoWrite and TodoRead results
  if ((toolData.toolName === 'TodoWrite' || toolData.toolName === 'TodoRead') && 
      !toolData.isError && !toolData.isExecuting && renderTodoContent) {
    
    // TodoWrite contains todos in args.todos, try that first
    const todos = (toolData.args as any)?.todos;
    
    if (Array.isArray(todos)) {
      return <>{renderTodoContent(todos)}</>;
    }
  }
  
  return null;
};

/**
 * Higher-order function to create todo renderer for tool renderers
 */
export const createTodoRenderer = (renderTodoContent?: (args: any) => React.ReactNode) => {
  return (toolData: any) => {
    if ((toolData.toolName === 'TodoWrite' || toolData.toolName === 'TodoRead') && 
        !toolData.isError && !toolData.isExecuting && renderTodoContent) {
      
      // TodoWrite contains todos in args.todos
      const todos = toolData.args?.todos;
      
      if (Array.isArray(todos)) {
        return renderTodoContent(todos);
      }
    }
    return null;
  };
};