# Architecture

Default architecture rules for the maccing-code-reviewer.

---

## Separation of Concerns

Keep UI, business logic, and data access separate:

**Bad:**
```typescript
// Component doing everything
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Data fetching in component
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        // Business logic in component
        const formattedUser = {
          ...data,
          fullName: `${data.firstName} ${data.lastName}`,
          isAdult: data.age >= 18,
        };
        setUser(formattedUser);
      });
  }, [userId]);

  return <div>{user?.fullName}</div>;
}
```

**Good:**
```typescript
// Data layer
async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

// Business logic layer
function formatUser(user: User): FormattedUser {
  return {
    ...user,
    fullName: `${user.firstName} ${user.lastName}`,
    isAdult: user.age >= 18,
  };
}

// UI layer
function UserProfile({ userId }) {
  const { data: user } = useQuery(['user', userId], () => fetchUser(userId));
  const formattedUser = user ? formatUser(user) : null;

  return <div>{formattedUser?.fullName}</div>;
}
```

---

## Dependency Direction

Dependencies should flow downward only:

```
UI Components
     |
     v
Business Logic / Use Cases
     |
     v
Data Access / Infrastructure
```

**Bad:**
```typescript
// Business logic importing UI components
import { Button } from '@/components/ui/Button';

// Data layer importing business logic
import { validateUser } from '@/services/userService';
```

**Good:**
```typescript
// UI imports business logic
import { useUserService } from '@/services/userService';

// Business logic imports data layer
import { userRepository } from '@/repositories/userRepository';
```

---

## Circular Dependencies

Never create circular import chains:

**Bad:**
```typescript
// userService.ts
import { orderService } from './orderService';
export const userService = { /* uses orderService */ };

// orderService.ts
import { userService } from './userService'; // Circular!
export const orderService = { /* uses userService */ };
```

**Good:**
```typescript
// Extract shared logic to a third module
// userOrderService.ts
import { userRepository } from './userRepository';
import { orderRepository } from './orderRepository';

export const userOrderService = {
  getUserOrders(userId: string) { /* ... */ },
  createOrderForUser(userId: string, order: Order) { /* ... */ },
};
```

---

## One Component Per File

Each file should contain a single component:

**Bad:**
```typescript
// UserComponents.tsx
export function UserAvatar() { /* ... */ }
export function UserName() { /* ... */ }
export function UserProfile() { /* ... */ }
export function UserSettings() { /* ... */ }
```

**Good:**
```
components/
  user/
    UserAvatar.tsx
    UserName.tsx
    UserProfile.tsx
    UserSettings.tsx
    index.ts  // Re-exports only
```

---

## File Colocation

Keep related files together:

**Bad:**
```
src/
  components/
    UserProfile.tsx
  tests/
    components/
      UserProfile.test.tsx
  types/
    components/
      UserProfile.types.ts
  styles/
    components/
      UserProfile.css
```

**Good:**
```
src/
  components/
    UserProfile/
      UserProfile.tsx
      UserProfile.test.tsx
      UserProfile.types.ts
      UserProfile.css
      index.ts
```

---

## Layer Boundaries

Respect architectural layer boundaries:

| Layer | Can Import | Cannot Import |
|-------|------------|---------------|
| UI Components | Services, Hooks, Utils, Types | Database, External APIs directly |
| Services | Repositories, Utils, Types | UI Components |
| Repositories | Database clients, Utils, Types | Services, UI Components |
| Utils | Only other Utils, Types | Everything else |

**Bad:**
```typescript
// React component directly using Prisma
import { prisma } from '@/lib/prisma';

function UserList() {
  const users = await prisma.user.findMany(); // Direct DB access in component!
}
```

**Good:**
```typescript
// Component uses service
import { getUsers } from '@/services/userService';

function UserList() {
  const { data: users } = useQuery(['users'], getUsers);
}

// Service uses repository
// userService.ts
import { userRepository } from '@/repositories/userRepository';

export async function getUsers() {
  return userRepository.findAll();
}

// Repository uses database
// userRepository.ts
import { prisma } from '@/lib/prisma';

export const userRepository = {
  findAll: () => prisma.user.findMany(),
};
```

---

## Barrel Files

Use barrel files (index.ts) only for public API exports:

**Bad:**
```typescript
// index.ts that just re-exports everything
export * from './UserProfile';
export * from './UserAvatar';
export * from './UserSettings';
export * from './useUserData';
export * from './userUtils';
export * from './userTypes';
// Every internal file exposed
```

**Good:**
```typescript
// index.ts with curated public API
export { UserProfile } from './UserProfile';
export { UserAvatar } from './UserAvatar';
export type { UserProps } from './UserProfile.types';

// Internal utilities not exported, used only within the module
```

---

## Module Boundaries

Define clear module boundaries with explicit public APIs:

```
src/
  modules/
    auth/
      index.ts           # Public API only
      internal/          # Private implementation
        authService.ts
        authRepository.ts
        authUtils.ts
    users/
      index.ts           # Public API only
      internal/          # Private implementation
```

```typescript
// auth/index.ts (Public API)
export { login, logout, getCurrentUser } from './internal/authService';
export type { AuthState, User } from './internal/authTypes';

// Other modules import from the public API only
import { login, getCurrentUser } from '@/modules/auth';
```
