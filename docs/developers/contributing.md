# Contributing Guidelines

Thank you for your interest in contributing to Nexus CLI! This guide covers the essential workflow and standards for contributions.

## 🚀 Getting Started

### Prerequisites

- **Node.js 20.0.0+** with npm
- **TypeScript** experience
- **Git** proficiency
- **Claude CLI** and **Gemini API** access for testing

### First-Time Setup

```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR-USERNAME/nexus-cli.git
cd nexus-cli

# Add upstream remote
git remote add upstream https://github.com/original-repo/nexus-cli.git

# Install dependencies and verify setup
npm install
npm run typecheck
npm test
```

## 📋 Contribution Workflow

### 1. Issue Selection

- Check existing issues and comment on ones you'd like to work on
- Wait for maintainer approval for large features
- Create an issue for bugs not already reported
- Look for `good first issue` and `help wanted` labels

### 2. Development Process

```bash
# Create feature branch from main
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name

# Make your changes
npm run dev  # Development mode

# Test your changes
npm run typecheck
npm test

# Commit and push
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### 3. Pull Request

- Create PR with clear title and description
- Link to related issues
- Ensure all tests pass
- Request review from maintainers

## 💻 Code Standards

### Essential Requirements

- **TypeScript**: Use strict mode with proper types (no `any`)
- **Testing**: Write tests for new functionality
- **Dependencies**: Use existing dependency injection patterns
- **Patterns**: Follow established architectural patterns

### Good Practices

```typescript
// ✅ Good: Proper TypeScript interfaces
interface IProviderService {
  initialize(): Promise<void>;
  sendMessage(message: string, context?: SessionContext): Promise<string>;
}

// ✅ Good: Dependency injection
class ProviderService implements IProviderService {
  constructor(@inject(TYPES.SessionManager) private sessionManager: ISessionManager) {}
}

// ❌ Avoid: Any types and direct instantiation
class BadService {
  private sessionManager = new SessionManager(); // Don't do this
  async sendMessage(message: any): Promise<any> {} // Don't do this
}
```

### Component Guidelines

```typescript
// ✅ Good: Functional components with proper typing
interface MessageProps {
  message: string;
  provider: ProviderType;
}

export const MessageDisplay: React.FC<MessageProps> = ({ message, provider }) => {
  return (
    <Box>
      <Text color={getProviderColor(provider)}>{provider.toUpperCase()}</Text>
      <Text>{message}</Text>
    </Box>
  );
};
```

## 🧪 Testing

### Test Requirements

- Write unit tests for new functions and components
- Add integration tests for provider interactions
- Ensure tests pass: `npm test`
- Maintain good test coverage

### Testing Example

```typescript
describe("ProviderService", () => {
  let providerService: ProviderService;
  let mockSessionManager: jest.Mocked<ISessionManager>;

  beforeEach(() => {
    mockSessionManager = createMockSessionManager();
    providerService = new ProviderService(mockSessionManager);
  });

  it("should switch providers and maintain context", async () => {
    const context = createTestContext();
    mockSessionManager.getCurrentContext.mockResolvedValue(context);

    await providerService.switchProvider("gemini");

    expect(mockSessionManager.syncContext).toHaveBeenCalledWith(context);
  });
});
```

## 🔍 Code Review Process

### Before Submitting

- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Code follows existing patterns
- [ ] Tests written for new functionality
- [ ] Documentation updated if needed

### Review Criteria

- **Functionality**: Does it work as intended?
- **Code Quality**: Follows TypeScript and architectural standards
- **Testing**: Adequate test coverage
- **Performance**: No obvious performance issues
- **Security**: No security vulnerabilities introduced

## 🛠️ Development Tips

### Understanding the Codebase

- Read **[Core Features](./core-features.md)** for system architecture
- Check existing tests for usage examples
- Look at similar existing features for patterns

### Common Patterns

- Use dependency injection for services
- Implement proper TypeScript interfaces
- Follow React functional component patterns
- Use proper error handling with typed exceptions

### Getting Help

- **GitHub Issues**: Ask questions on relevant issues
- **Core Features Docs**: Understand system architecture
- **Code Examples**: Check existing implementations

## 🤝 Community Guidelines

### Be Respectful

- Assume positive intent in discussions
- Provide constructive feedback
- Help other contributors when possible

### Communication

- Be clear and specific in issue descriptions
- Provide context for feature requests
- Include error messages and reproduction steps for bugs

---

Thank you for contributing to Nexus CLI! Your contributions help make unified AI assistance better for everyone. Please contact <sunhome243@gmail.com> for any questions.
