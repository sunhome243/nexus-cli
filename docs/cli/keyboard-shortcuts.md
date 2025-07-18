# Keyboard Shortcuts Reference

This comprehensive reference covers all keyboard shortcuts available in Nexus CLI, organized by functionality.

## Application Control

### Core Navigation

| Shortcut    | Action                                     | Context           |
| ----------- | ------------------------------------------ | ----------------- |
| `Ctrl+S`    | Switch between Claude and Gemini providers | Global            |
| `Shift+Tab` | Cycle Claude permission modes              | Claude only       |
| `Ctrl+C`    | Exit application                           | Global            |
| `ESC`       | Close overlays                             | Context-sensitive |

### Permission Mode Cycling (Claude Only)

`Shift+Tab` cycles through Claude permission modes:

1. **Default** (Grey border) - Prompts for non-safe tools (Edit, Write, Bash, etc.)
2. **Accept Edits** (Blue border) - Auto-approves file operations, prompts for system tools
3. **Plan** (Green border) - Prompts for all non-read operations, enables Auto Opus
4. **Bypass Permissions** (Red border) - Auto-approves all tools (use with caution)

#### Tool Categories:

- **Safe Tools**: Read, LS, Glob, Grep, TodoRead, WebSearch - Always approved
- **Edit Tools**: Edit, Write, MultiEdit, NotebookEdit - Approved in Accept Edits mode
- **System Tools**: Bash, Task, exit_plan_mode - Require approval except in Bypass mode

## Text Input & Editing

### Basic Cursor Movement

| Shortcut | Action                          |
| -------- | ------------------------------- |
| `←`      | Move cursor left one character  |
| `→`      | Move cursor right one character |
| `↑`      | Move cursor up one line         |
| `↓`      | Move cursor down one line       |
| `Home`   | Move to beginning of line       |
| `End`    | Move to end of line             |

### Word Movement

| Shortcut            | Action                                  |
| ------------------- | --------------------------------------- |
| `Ctrl+←` / `Meta+←` | Move cursor left by word                |
| `Ctrl+→` / `Meta+→` | Move cursor right by word               |
| `Meta+B`            | Move cursor left by word (alternative)  |
| `Meta+F`            | Move cursor right by word (alternative) |

### Emacs-Style Navigation

| Shortcut | Action                          |
| -------- | ------------------------------- |
| `Ctrl+A` | Move to beginning of line       |
| `Ctrl+E` | Move to end of line             |
| `Ctrl+B` | Move cursor left one character  |
| `Ctrl+F` | Move cursor right one character |

### Text Deletion

| Shortcut    | Action                                       |
| ----------- | -------------------------------------------- |
| `Backspace` | Delete character before cursor               |
| `Delete`    | Delete character after cursor                |
| `Ctrl+H`    | Delete character before cursor (alternative) |
| `Ctrl+D`    | Delete character after cursor (alternative)  |

### Word & Line Deletion

| Shortcut                            | Action                                  |
| ----------------------------------- | --------------------------------------- |
| `Ctrl+W`                            | Delete word before cursor               |
| `Ctrl+Backspace` / `Meta+Backspace` | Delete word before cursor               |
| `Ctrl+Delete` / `Meta+Delete`       | Delete word after cursor                |
| `Ctrl+K`                            | Delete from cursor to end of line       |
| `Ctrl+U`                            | Delete from cursor to beginning of line |

### Multiline Support

| Shortcut      | Action                                     |
| ------------- | ------------------------------------------ |
| `Enter`       | Submit message/input                       |
| `Shift+Enter` | Insert newline (multiline mode)            |
| `\+Enter`     | Insert newline (alternative for terminals) |

## Dashboard & Overlays

### Dashboard Navigation (`/dashboard`)

| Shortcut | Action                        |
| -------- | ----------------------------- |
| `↑`      | Navigate up through options   |
| `↓`      | Navigate down through options |
| `Enter`  | Select/toggle current option  |
| `ESC`    | Close dashboard               |

### MCP Manager Navigation

| Shortcut | Action                            |
| -------- | --------------------------------- |
| `↑`      | Navigate up through MCP servers   |
| `↓`      | Navigate down through MCP servers |
| `Enter`  | Select/configure MCP server       |
| `ESC`    | Close MCP Manager                 |

## Permission Handling

### Permission Prompts (Both Providers)

| Shortcut | Action                    |
| -------- | ------------------------- |
| `Y`      | Accept permission request |
| `N`      | Deny permission request   |
| `ESC`    | Cancel permission request |

## Streaming & Response Control

### During Streaming Responses

Currently, streaming responses run to completion and cannot be cancelled via keyboard shortcuts. The system handles streaming responses automatically.

## Slash Commands

### Command Discovery

| Shortcut | Action                         |
| -------- | ------------------------------ |
| `/`      | Show available slash commands  |
| `Enter`  | Execute selected slash command |

### Built-in Slash Commands

| Command           | Action                                    |
| ----------------- | ----------------------------------------- |
| `/claude [model]` | Switch Claude models (`sonnet` or `opus`) |
| `/dashboard`      | Open dashboard overlay                    |

## Special Features

### File Path Integration

- **Drag & Drop**: Dragging files automatically adds `@` prefix
- **Auto-Detection**: Quoted paths like `'path/to/file'` convert to `@path/to/file`

### Bracketed Paste Support

- **Large Text Pastes**: Automatically handles large clipboard content
- **Format Preservation**: Maintains formatting and special characters

## Visual Indicators

### Permission Mode Borders (Claude Only)

- **Grey border**: Default mode
- **Blue border**: Accept Edits mode
- **Green border**: Plan mode (triggers Auto Opus if enabled)
- **Red border**: Bypass Permissions mode

### Status Bar Information

```
Claude (Available) | Permission: default | Model: Sonnet | MCP: Connected
```

## Context-Sensitive Behavior

### When Dashboard is Open

- Input is disabled
- Only dashboard navigation shortcuts work
- `ESC` closes dashboard and returns to normal input

### When Streaming Response

- Streaming responses run to completion automatically
- Most shortcuts remain available during streaming
- Input is accepted but queued until streaming completes

### When Permission Prompt is Active

- Only permission response shortcuts (`Y`/`N`/`ESC`) are active
- Input disabled until permission is resolved

## Quick Reference Card

### Most Used Shortcuts

```
┌─ Essential Shortcuts ──────────────────┐
│ Ctrl+S       Switch providers          │
│ Shift+Tab    Cycle permission modes    │
│ Shift+Enter  Add newline               │
│ ESC          Close overlays            │
│ /dashboard   Open settings             │
│ /claude      Switch Claude models      │
└────────────────────────────────────────┘
```

### Text Editing Essentials

```
┌─ Text Editing ─────────────────────────┐
│ Ctrl+A/E     Beginning/End of line     │
│ Ctrl+W       Delete word               │
│ Ctrl+K/U     Delete to end/beginning   │
│ Ctrl+←/→     Move by word              │
└────────────────────────────────────────┘
```

## Tips for Efficient Usage

### Workflow Shortcuts

1. **Provider Comparison**: Use `Ctrl+S` to quickly compare responses between Claude and Gemini
2. **Plan Mode**: Use `Shift+Tab` to cycle to plan mode for complex tasks (auto-triggers Opus if enabled)
3. **Quick Settings**: Use `/dashboard` for fast access to Auto Opus and MCP settings
4. **Multiline Editing**: Use `Shift+Enter` for code blocks and detailed explanations

### Text Editing Efficiency

1. **Word Navigation**: Use `Ctrl+←/→` for faster cursor movement
2. **Quick Deletion**: Use `Ctrl+W` to delete words, `Ctrl+K` to clear to end
3. **File References**: Drag files directly to auto-generate `@path/to/file` syntax

### Permission Management

1. **Accept Edits Mode**: Use `Shift+Tab` to blue border for trusted coding sessions
2. **Plan Mode**: Use green border for complex task planning with enhanced context
3. **Quick Approval**: Use `Y` for quick permission approval, `N` for denial

## Accessibility Notes

- All shortcuts work with standard accessibility tools
- Visual indicators provide clear feedback for permission modes
- Text editing follows standard terminal conventions
- Screen readers compatible with status information

This keyboard shortcuts reference ensures you can efficiently navigate and control all aspects of Nexus CLI without reaching for the mouse.
