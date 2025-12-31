# Clean Code

Default clean code rules for the maccing-code-reviewer.

---

## Unused Code

Remove all unused code:

- Unused variables
- Unused imports
- Unused functions
- Unused parameters
- Commented-out code blocks

**Bad:**
```typescript
import { unusedHelper } from './utils'; // Never used

function process(data: Data, options?: Options) { // options never used
  const temp = 'temporary'; // Never used
  return data.value;
}

// Old implementation
// function oldProcess(data) {
//   return data.value * 2;
// }
```

**Good:**
```typescript
function process(data: Data) {
  return data.value;
}
```

---

## Comments

Comments should explain **why**, not **what**.

**Bad:**
```typescript
// Increment counter by 1
counter++;

// Loop through users
for (const user of users) {
  // Check if user is active
  if (user.isActive) {
    // Add to active users array
    activeUsers.push(user);
  }
}
```

**Good:**
```typescript
// Compensate for zero-based indexing in display
counter++;

// Filter for billing purposes, inactive users shouldn't be charged
for (const user of users) {
  if (user.isActive) {
    activeUsers.push(user);
  }
}
```

---

## Type Safety

Avoid `any` type. Use proper types instead:

**Bad:**
```typescript
function process(data: any): any {
  return data.value;
}

const config: any = loadConfig();
```

**Good:**
```typescript
function process(data: ProcessInput): ProcessOutput {
  return data.value;
}

const config: AppConfig = loadConfig();

// When truly unknown, use unknown and narrow
function handleUnknown(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  return String(data);
}
```

---

## Linter Suppressions

Never suppress linter rules without justification:

**Bad:**
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = fetchData();
```

**Good:**
```typescript
// External API returns untyped data, validated at runtime by validateResponse()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawData: any = await externalApi.fetch();
const data = validateResponse(rawData);
```

---

## Ternary Operators

Avoid nested ternaries. Use if/else or early returns instead:

**Bad:**
```typescript
const result = condition1
  ? value1
  : condition2
    ? value2
    : condition3
      ? value3
      : defaultValue;
```

**Good:**
```typescript
function getResult() {
  if (condition1) return value1;
  if (condition2) return value2;
  if (condition3) return value3;
  return defaultValue;
}

const result = getResult();
```

---

## Error Handling

Use proper error handling patterns:

**Bad:**
```typescript
// Returning success boolean
function saveUser(user: User): boolean {
  try {
    database.save(user);
    return true;
  } catch {
    return false;
  }
}

// Silent failure
function deleteFile(path: string) {
  try {
    fs.unlinkSync(path);
  } catch {
    // Ignore
  }
}
```

**Good:**
```typescript
// Throw errors with context
function saveUser(user: User): void {
  try {
    database.save(user);
  } catch (error) {
    throw new DatabaseError(`Failed to save user ${user.id}`, { cause: error });
  }
}

// Explicit handling or re-throw
function deleteFile(path: string): void {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      // File already deleted, acceptable
      return;
    }
    throw error;
  }
}
```

---

## Function Length

Keep functions focused and short:

- Aim for functions under 20 lines
- Each function should do one thing
- Extract complex logic into helper functions

**Bad:**
```typescript
function processOrder(order: Order) {
  // 100+ lines of validation, calculation,
  // database calls, email sending, logging...
}
```

**Good:**
```typescript
function processOrder(order: Order) {
  validateOrder(order);
  const total = calculateTotal(order);
  const savedOrder = saveOrder(order, total);
  await sendConfirmationEmail(savedOrder);
  logOrderProcessed(savedOrder);
  return savedOrder;
}
```

---

## Magic Numbers and Strings

Extract magic values into named constants:

**Bad:**
```typescript
if (password.length < 8) {
  throw new Error('Password too short');
}

setTimeout(retry, 3000);

if (status === 'PENDING_REVIEW') {
  // ...
}
```

**Good:**
```typescript
const MIN_PASSWORD_LENGTH = 8;
const RETRY_DELAY_MS = 3000;
const OrderStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
} as const;

if (password.length < MIN_PASSWORD_LENGTH) {
  throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
}

setTimeout(retry, RETRY_DELAY_MS);

if (status === OrderStatus.PENDING_REVIEW) {
  // ...
}
```
