# 🤝 Contributing Guide

Thank you for your interest in contributing to the Industrial Digital Twin platform! This guide will help you get started.

---

## Getting Started

### 1. Fork & Clone

```bash
# Clone your fork
git clone https://github.com/your-username/industrial-digital-twin.git
cd industrial-digital-twin

# Add upstream remote
git remote add upstream https://github.com/original-repo/industrial-digital-twin.git
```

### 2. Install Dependencies

```bash
npm install
npm run dev
```

---

## Development Workflow

### Creating a Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/short-description
# or
git checkout -b fix/issue-number
# or
git checkout -b docs/improvement-description
```

### Naming Conventions

- **Features:** `feature/descriptive-name`
- **Bug fixes:** `fix/issue-description`
- **Documentation:** `docs/what-changed`
- **Performance:** `perf/optimization-description`
- **Tests:** `test/what-was-tested`

### Commit Message Format

Follow conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: improve code structure
perf: optimize performance
test: add tests
chore: update dependencies
```

Example:
```bash
git commit -m "feat: add real-time anomaly detection alerts"
git commit -m "fix: resolve chart rendering issue on mobile"
git commit -m "docs: update API documentation"
```

---

## Code Style Guide

### TypeScript

```typescript
// ✅ Do use const for immutable values
const API_URL = 'https://api.example.com';

// ✅ Do use type annotations
interface Asset {
  id: string;
  name: string;
  status: 'normal' | 'warning' | 'critical';
}

// ❌ Don't use any
function process(data: any) { } // Avoid!

// ✅ Do define types upfront
function process(data: Asset[]): void {
  // implementation
}
```

### React Components

```typescript
// ✅ Do: Functional components with hooks
export const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState(null);

  return <div>{prop1}</div>;
};

// ❌ Don't: Class components (legacy)
class MyComponent extends React.Component { }

// ✅ Do: Extract complex logic into hooks
const useAssetData = (assetId: string) => {
  const [asset, setAsset] = useState(null);

  useEffect(() => {
    apiService.getAsset(assetId).then(setAsset);
  }, [assetId]);

  return asset;
};

// ✅ Do: Memoize expensive components
const KPICard = memo(({ title, value }: Props) => (
  <div>{title}: {value}</div>
));
```

### Styling

```typescript
// ✅ Do: Use Tailwind classes
<div className="flex items-center gap-4 p-6 bg-slate-900 rounded-lg border border-slate-700">
  Content
</div>

// ✅ Do: Use consistent color palette
<div className="text-green-500 bg-green-500/10 border-green-500/30">Normal</div>
<div className="text-yellow-500 bg-yellow-500/10 border-yellow-500/30">Warning</div>
<div className="text-red-500 bg-red-500/10 border-red-500/30">Critical</div>

// ❌ Don't: Use inline styles
<div style={{ color: 'red', fontSize: '14px' }}>Bad</div>

// ❌ Don't: Use custom CSS (use Tailwind)
<style>.custom { color: blue; }</style>
```

### Comments

```typescript
// ✅ Do: Write meaningful comments
/**
 * Calculates the anomaly score for sensor data
 * @param data - Array of sensor readings
 * @returns Anomaly score between 0-100
 */
const calculateAnomalyScore = (data: SensorReading[]): number => {
  // ...
};

// ❌ Don't: State the obvious
const count = 0; // Set count to 0

// ✅ Do: Explain why, not what
// Reset counter to handle rapid requests
const count = 0;
```

---

## Testing Requirements

### Unit Tests

Every feature should have unit tests:

```typescript
describe('MyComponent', () => {
  it('should render with correct props', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<MyComponent onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### Test Coverage

- **Target:** 80%+ coverage
- **Run tests:** `npm run test`
- **Check coverage:** `npm run test:coverage`

---

## Pull Request Process

### 1. Push Your Branch

```bash
git push origin feature/your-feature-name
```

### 2. Create Pull Request

- Go to GitHub repository
- Click "New Pull Request"
- Select your branch
- Fill in PR template

### 3. PR Description Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Related Issues
Fixes #123

## Testing
- [ ] Unit tests added
- [ ] Manual testing done
- [ ] No regressions

## Checklist
- [ ] Code follows style guide
- [ ] No console errors
- [ ] Responsive design verified
- [ ] Documentation updated
- [ ] TypeScript strict mode passes
```

### 4. Code Review

- Respond to review comments
- Request changes if needed
- Maintain professional discussion

### 5. Merge

Once approved:
- Squash commits if needed
- Merge to main branch
- Delete feature branch

---

## Documentation Standards

### Component Documentation

```typescript
/**
 * Displays asset KPI metrics
 *
 * @component
 * @example
 * ```tsx
 * <KPICard
 *   title="Uptime"
 *   value={99.8}
 *   unit="%"
 *   trend={5}
 * />
 * ```
 */
export const KPICard: React.FC<Props> = ({ title, value, unit, trend }) => {
  // ...
};
```

### API Documentation

```typescript
/**
 * Retrieve all industrial assets
 *
 * @returns Promise resolving to array of assets
 * @throws Error if API request fails
 *
 * @example
 * ```ts
 * const assets = await apiService.getAssets();
 * console.log(assets); // Array of Asset objects
 * ```
 */
export const getAssets = async (): Promise<Asset[]> => {
  // ...
};
```

### README Updates

- Update relevant documentation files
- Add examples if introducing new features
- Link to related documentation

---

## Common Contribution Types

### Bug Fix

1. Create issue describing bug
2. Create `fix/issue-number` branch
3. Write failing test
4. Implement fix
5. Ensure tests pass
6. Create PR with `Fixes #123`

### New Feature

1. Discuss feature in issue first
2. Create `feature/name` branch
3. Implement feature with tests
4. Update documentation
5. Create PR with feature description

### Documentation

1. Create `docs/` branch
2. Update relevant documentation
3. Check links and formatting
4. Create PR with changes

### Performance Improvement

1. Measure baseline performance
2. Implement optimization
3. Verify improvement
4. Document changes
5. Add performance test

---

## Code Review Checklist

**When reviewing others' code:**

- [ ] Does code follow style guide?
- [ ] Are types correct?
- [ ] Are tests included?
- [ ] Is performance acceptable?
- [ ] Are edge cases handled?
- [ ] Is error handling present?
- [ ] Is documentation updated?
- [ ] Could it be clearer?

**When responding to reviews:**

- [ ] Address all feedback
- [ ] Explain reasoning if disagreeing
- [ ] Keep commits clean
- [ ] Request re-review when done

---

## Reporting Issues

### Bug Report Template

```markdown
## Description
Clear description of the bug.

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- Browser: Chrome 120
- OS: Windows 11
- Node: v18.17.0

## Screenshots
If applicable, add screenshots.
```

### Feature Request Template

```markdown
## Description
Clear description of desired feature.

## Use Case
Why this feature is needed.

## Suggested Implementation
How you think it could be implemented.

## Alternatives
Other ways to solve this.
```

---

## Development Tips

### Useful Commands

```bash
# Start dev server with specific port
npm run dev -- --port 3000

# Build and preview production
npm run build && npm run preview

# Type check
npx tsc --noEmit

# Format code
npx prettier --write src/

# Lint code
npx eslint src/
```

### Debugging

```typescript
// Use console for debugging
console.log('Value:', value);

// Use React DevTools extension
// Check component hierarchy and props

// Use browser DevTools
// Network tab to check API calls
// Performance tab to check rendering
```

### Performance Profiling

```bash
# Check bundle size
npm run build -- --visualize

# Profile React components
# DevTools → Profiler tab

# Check Lighthouse score
npm run build && npm run preview
# Then Chrome DevTools → Lighthouse
```

---

## Getting Help

- **Questions:** Discuss in GitHub Discussions
- **Issues:** Report bugs in GitHub Issues
- **Chat:** Contact team members
- **Documentation:** Check relevant guides

---

## Code of Conduct

- Be respectful and professional
- Provide constructive feedback
- Celebrate contributions
- Report inappropriate behavior

---

## Recognition

Contributors will be:
- Listed in project documentation
- Acknowledged in release notes
- Invited to team discussions

Thank you for contributing! 🎉

---

**Happy coding! Questions? Open a discussion or issue. 💡**
