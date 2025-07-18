/**
 * Shared utilities for provider components
 */

/**
 * Path shortening utility for display purposes
 */
export const shortenPath = (filePath: string, maxLength: number = 60): string => {
  if (filePath.length <= maxLength) return filePath;
  
  const parts = filePath.split('/');
  if (parts.length <= 2) return filePath;
  
  const fileName = parts[parts.length - 1];
  const parentDir = parts[parts.length - 2];
  const rootPart = parts[0] + (parts[1] ? '/' + parts[1] : '');
  
  const shortened = `${rootPart}/.../${parentDir}/${fileName}`;
  return shortened.length < filePath.length ? shortened : filePath;
};