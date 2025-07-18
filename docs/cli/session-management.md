# Session Management Guide

Nexus CLI's unified session management system provides seamless conversation persistence and cross-provider synchronization. This guide explains how sessions work, their storage structure, and how to effectively manage them.

## Understanding Nexus's Session System

### Universal Session Architecture

Nexus CLI creates a unified session layer that coordinates between Claude and Gemini providers:

- **Session Tags**: Each session gets a unique identifier shared across providers
- **Cross-Provider Sync**: Conversations automatically synchronize between Claude and Gemini
- **Conversation Continuity**: Each message builds on previous conversation history
- **Process Isolation**: Multiple Nexus instances can run simultaneously without conflicts

### Session Anatomy

Each Nexus session consists of:

```
Session Tag: session-1752327517026-42915-1f7cb6bb
├── Claude Session: ~/.claude/projects/{hash}/{uuid}.jsonl
├── Gemini Session: ~/.gemini/tmp/{hash}/checkpoint-{tag}.json
├── Session Registry: .nexus/sessions.json
├── Claude Reference: .nexus/claude-ref/tagged-{tag}.ref
└── Sync State: .nexus/sync-state.json
```

## Session ID System

### ID Format

Session tags follow this pattern:

```
session-{timestamp}-{random}-{process-id}
```

**Example**: `session-1752327517026-42915-1f7cb6bb`

- **timestamp**: Session creation time in milliseconds
- **random**: Random identifier component
- **process-id**: Operating system process ID

### Session Registry

All sessions are tracked in `.nexus/sessions.json` with atomic file locking:

```json
{
  "version": "1.0.0",
  "createdAt": 1751870714358,
  "lastUpdated": 1752330022879,
  "sessions": {
    "session-1752327517026-42915-1f7cb6bb": {
      "tag": "session-1752327517026-42915-1f7cb6bb",
      "pid": 42915,
      "createdAt": 1752327529129,
      "lastActivity": 1752327529129,
      "providers": {
        "gemini": {
          "checkpointPath": "~/.gemini/tmp/abc123/checkpoint-session-1752327517026.json",
          "sessionId": "session-1752327517026"
        },
        "claude": {
          "memoryPath": "~/.claude/projects/encoded-path/f5e03e96-576b-46af-a30b-7318bfd674c4.jsonl",
          "sessionId": "f5e03e96-576b-46af-a30b-7318bfd674c4"
        }
      },
      "status": "active"
    }
  }
}
```

## Session Creation Process

### Automatic Creation

When you start Nexus CLI, the system:

1. **Generates Session Tag**: Creates unique session identifier
2. **Creates Provider Sessions**: Initializes sessions in both Claude and Gemini simultaneously
3. **Registers Session**: Adds session to the registry with atomic file locking
4. **Sets Up Sync**: Establishes synchronization tracking

### Initialization Sequence

```bash
# When you start Nexus CLI:

1. SessionManager.initialize()
   ├── Creates session tag: session-{timestamp}-{random}-{pid}
   ├── Initializes ProviderManager
   └── Sets up provider instances

2. Session Creation
   ├── Creates Claude session via ClaudeSessionService
   ├── Creates Gemini session via GeminiSessionService
   ├── Registers session in .nexus/sessions.json with atomic locking
   ├── Creates Claude reference file for fast lookup
   └── Initializes sync state

3. Ready for conversation with both providers active
```

## Session Storage Locations

### Claude Sessions

**Path**: `~/.claude/projects/{encoded-project-path}/{session-id}.jsonl`

**Format**: JSONL (JSON Lines) - one JSON object per line

```json
{"type":"user","message":{"role":"user","content":"Hello"},"uuid":"123","timestamp":"2024-01-01T12:00:00Z"}
{"type":"assistant","message":{"role":"assistant","content":"Hi there!"},"uuid":"456","timestamp":"2024-01-01T12:00:05Z"}
```

**Features**:

- Each line represents one conversation turn
- Linked-list structure with parent UUIDs
- Full conversation context preserved
- Compatible with Claude CLI tools

### Gemini Sessions

**Path**: `~/.gemini/tmp/{project-hash}/checkpoint-{tag}.json`

**Format**: JSON array of conversation turns

```json
[
  { "role": "user", "parts": [{ "text": "Hello" }] },
  { "role": "model", "parts": [{ "text": "Hi there!" }] }
]
```

**Features**:

- Single JSON file per session
- Array-based conversation structure
- Project-specific directory isolation
- Compatible with Gemini CLI tools

### Nexus Coordination Files

**Session Registry**: `.nexus/sessions.json`

- Central registry of all sessions with atomic file locking
- Maps session tags to provider files
- Tracks session status and metadata
- Process-aware for multi-instance support

**Claude References**: `.nexus/claude-ref/tagged-{tag}.ref`

- Fast lookup files mapping session tags to Claude session IDs
- Enables quick session resolution

**Sync State**: `.nexus/sync-state.json`

- Tracks synchronization between providers
- Stores backup paths and timestamps
- Manages diff computation state with Myers algorithm

## Session Synchronization

### Cross-Provider Sync Engine

The SyncEngine maintains conversation consistency:

1. **Message Translation**: ClaudeSyncHandler and GeminiSyncHandler convert between formats
2. **Diff Computation**: Uses MyersDiff algorithm to detect actual content changes
3. **Bidirectional Sync**: Supports claude-to-gemini, gemini-to-claude, and bidirectional modes
4. **Atomic Operations**: File locking prevents concurrent sync operations
5. **Backup and Restore**: Automatic backup before sync with verification
6. **Conflict Resolution**: Handles simultaneous updates with rollback capability

### Sync State Tracking

```json
{
  "version": "1.0.0",
  "lastUpdated": 1752330029629,
  "states": {
    "session-1752327517026-42915-1f7cb6bb": {
      "sessionTag": "session-1752327517026-42915-1f7cb6bb",
      "lastSyncTime": 1751873764264,
      "gemini": {
        "backupPath": ".nexus/gemini-backup/session-1752327517026-42915-1f7cb6bb.json",
        "lastBackupTime": 0
      },
      "claude": {
        "lastSessionId": "previous-session-uuid",
        "currentSessionId": "current-session-uuid",
        "lastSyncTime": 1751873764269
      }
    }
  }
}
```

### Synchronization Process

When you switch providers or send messages:

1. **State Capture**: Current conversation captured
2. **Backup Creation**: Provider files backed up for diff computation
3. **Diff Analysis**: Changes detected using MyersDiff algorithm
4. **Format Conversion**: Messages converted to universal format
5. **Provider Update**: Other provider session updated with atomic operations
6. **Registry Update**: Sync state recorded

## Session Lifecycle

### Active Sessions

**Creation**:

- Generated on CLI startup
- Registered in session registry with atomic locking
- Provider files created and initialized for both providers

**Management**:

- Automatic saving after each message
- Real-time synchronization between providers
- Process isolation for concurrent instances

**Monitoring**:

- Session health checked via process ID
- File existence validated
- Sync status monitored

### Session Recovery

**Conversation Management**:

- Each conversation continues from previous messages
- Context syncs between Claude and Gemini
- New sessions created when app starts (conversation-level resume only)

**Recovery Process**:

```bash
1. Check session registry for active sessions
2. Validate provider files exist
3. Check process liveness (PID validation)
4. Resume most recent valid session
5. Initialize providers with existing conversation
```

### Session Cleanup

**Orphaned Sessions**:

- Detected by checking process ID liveness
- Automatically marked as "orphaned" in registry
- Cleaned up after grace period

**Manual Cleanup**:

- Old sessions can be archived or deleted
- Registry provides session age and usage info
- Provider files remain for manual recovery

## Working with Sessions

### Session Information

Check current session status:

```bash
# Session files are located at:
.nexus/sessions.json           # Session registry with atomic locking
.nexus/sync-state.json         # Sync tracking
.nexus/claude-ref/tagged-*.ref # Claude session references
~/.claude/projects/*/          # Claude sessions
~/.gemini/tmp/*/checkpoint-*   # Gemini sessions
```

### Session Validation

The system validates sessions by:

1. **Registry Check**: Session exists in registry
2. **File Existence**: Provider files are accessible
3. **Content Validation**: Sessions contain actual messages
4. **Process Check**: Associated process is alive (for active sessions)

### Session Status Types

- **active**: Currently in use by a running process
- **archived**: Completed sessions no longer active
- **orphaned**: Sessions from dead processes

## Advanced Session Features

### Process Isolation

Multiple Nexus instances can run simultaneously:

- **Process ID Tracking**: Each session tied to specific process
- **File Locking**: Prevents concurrent access conflicts with atomic operations
- **Registry Coordination**: Central registry manages all instances
- **Cleanup Logic**: Dead processes automatically cleaned up

### Session Backup and Recovery

**Automatic Backups**:

- Gemini files backed up before sync operations
- Sync state preserves before/after file states
- Registry maintains full session history

**Recovery Options**:

- Resume from registry if files exist
- Partial recovery from individual provider files
- Manual session reconstruction from backups

### Cross-App Integration

**Claude CLI Compatibility**:

- Sessions compatible with Claude CLI tools
- Can resume Nexus sessions in Claude CLI
- Maintains Claude project structure and JSONL format

**Gemini CLI Compatibility**:

- Checkpoint files compatible with Gemini CLI
- Can resume sessions across different tools
- Preserves Gemini conversation format

## Troubleshooting Sessions

### Common Issues

**Session Not Found**:

```bash
# Check if session exists in registry
cat .nexus/sessions.json | grep "session-tag"

# Verify provider files exist
ls ~/.claude/projects/*/
ls ~/.gemini/tmp/*/checkpoint-*
```

**Sync Failures**:

```bash
# Check sync state
cat .nexus/sync-state.json

# Look for backup files
ls .nexus/gemini-backup/
```

**Orphaned Sessions**:

```bash
# Check for orphaned sessions
grep "orphaned" .nexus/sessions.json

# Manual cleanup if needed
rm .nexus/sessions.json  # Will regenerate on next start
```

### Recovery Procedures

**Corrupted Registry**:

1. Delete `.nexus/sessions.json`
2. Restart Nexus CLI
3. System will create fresh session with atomic locking

**Missing Provider Files**:

1. Check `.nexus/sync-state.json` for backup paths
2. Look for backup files in sync engine backup locations
3. Use Claude reference files in `.nexus/claude-ref/` for recovery
4. Manual session recreation if backups unavailable

**Sync Conflicts**:

1. Delete `.nexus/sync-state.json`
2. Restart to reset sync state
3. Provider switching will re-establish sync with atomic operations

## Best Practices

### Session Management

1. **Work in Consistent Directories**: Sessions tied to working directory
2. **Let System Manage**: Automatic session management handles most scenarios
3. **Monitor Disk Usage**: Session files accumulate over time
4. **Regular Cleanup**: Archive or delete old sessions periodically

### Performance Optimization

1. **Limit Session Length**: Very long conversations may slow synchronization
2. **Clean Old Sessions**: Remove unused sessions to improve performance
3. **Monitor Registry Size**: Large registries may slow startup
4. **Network Awareness**: Sync performance depends on provider connectivity

### Data Safety

1. **Backup Important Sessions**: Export critical conversations
2. **Monitor File Permissions**: Ensure session files are accessible
3. **Regular Validation**: Check session integrity periodically
4. **Provider Authentication**: Maintain valid credentials for both providers

The session management system in Nexus CLI provides robust, automatic conversation persistence with atomic operations and process-aware multi-instance support. The universal session layer enables seamless provider switching while maintaining compatibility with individual provider tools through sophisticated synchronization and backup mechanisms.
