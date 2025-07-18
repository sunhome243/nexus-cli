import { injectable } from "inversify";
import { IDiffEngine } from "../../interfaces/sync/IDiffEngine";

@injectable()
export class MockDiffEngine implements IDiffEngine {
  computeDiff(beforeMessages: any[], afterMessages: any[]): any {
    // Simple mock implementation - detect if arrays are different
    const hasChanges = beforeMessages.length !== afterMessages.length ||
      JSON.stringify(beforeMessages) !== JSON.stringify(afterMessages);
    
    if (!hasChanges) {
      return { operations: [], hasChanges: false };
    }

    // Mock diff operations
    const operations = [];
    for (let i = beforeMessages.length; i < afterMessages.length; i++) {
      operations.push({
        type: 'ADD',
        index: i,
        content: afterMessages[i]
      });
    }

    return { operations, hasChanges: operations.length > 0 };
  }

  applyOperations(messages: any[], operations: any[]): any[] {
    const result = [...messages];
    for (const op of operations) {
      if (op.type === 'ADD') {
        result.push(op.content);
      }
    }
    return result;
  }

  isMessageSimilar(message1: any, message2: any): boolean {
    // Simple mock comparison
    return JSON.stringify(message1) === JSON.stringify(message2);
  }

  getMessagePreview(message: any): string {
    // Simple mock preview
    if (message.content?.text) {
      return message.content.text.substring(0, 50);
    }
    return '[mock message]';
  }
}