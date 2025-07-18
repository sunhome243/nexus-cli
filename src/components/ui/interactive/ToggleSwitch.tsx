import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../shared/ThemeProvider.js';

interface ToggleSwitchProps {
  value: boolean;
  onChange?: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onChange,
  label,
  disabled = false
}) => {
  const { theme } = useTheme();
  
  // Display checkbox style: [ ] or [✓]
  const checkbox = value ? '[✓]' : '[ ]';
  
  return (
    <Box>
      <Text color={disabled ? theme.text.muted : theme.text.primary}>
        {checkbox} {label}
      </Text>
    </Box>
  );
};

export default ToggleSwitch;