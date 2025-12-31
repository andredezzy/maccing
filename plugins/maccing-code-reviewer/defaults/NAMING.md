# Naming Conventions

Default naming rules for the maccing-code-reviewer.

---

## Boolean Variables

Boolean variables must use one of these prefixes:

| Prefix | Usage | Examples |
|--------|-------|----------|
| `is` | State check | isActive, isLoading, isValid |
| `has` | Possession check | hasPermission, hasError, hasChildren |
| `should` | Recommendation | shouldUpdate, shouldRender, shouldFetch |
| `can` | Capability | canEdit, canDelete, canSubmit |
| `will` | Future action | willChange, willUpdate, willRedirect |

**Bad:**
```typescript
const active = true;
const loading = false;
const valid = checkValidity();
```

**Good:**
```typescript
const isActive = true;
const isLoading = false;
const isValid = checkValidity();
```

---

## Interfaces and Types

Use appropriate suffixes based on the layer:

| Layer | Suffix | Example |
|-------|--------|---------|
| API Request | `Request` | `CreateUserRequest` |
| API Response | `Response` | `CreateUserResponse` |
| Function Input | `Input` | `ValidateUserInput` |
| Function Output | `Output` | `ValidateUserOutput` |
| Component Props | `Props` | `ButtonProps` |
| Configuration | `Config` | `DatabaseConfig` |
| Options | `Options` | `FetchOptions` |

---

## Enums

Enum names should be PascalCase, values should be UPPER_SNAKE_CASE:

**Bad:**
```typescript
enum Status {
  active,
  inactive,
  pending
}
```

**Good:**
```typescript
enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING'
}
```

---

## Components

Component names must be:

- PascalCase
- Descriptive (not generic)
- Reflect their purpose

**Bad:**
```typescript
// Too generic
function DataTable() {}
function Modal() {}
function Card() {}
```

**Good:**
```typescript
// Descriptive
function UserListTable() {}
function ConfirmDeleteModal() {}
function ProductSummaryCard() {}
```

---

## Constants

Constants should use UPPER_SNAKE_CASE:

```typescript
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const API_BASE_URL = 'https://api.example.com';
```

---

## Functions

Functions should:

- Use camelCase
- Start with a verb
- Describe the action

| Prefix | Use Case | Example |
|--------|----------|---------|
| `get` | Retrieve data | `getUser`, `getProducts` |
| `set` | Assign value | `setTheme`, `setLocale` |
| `handle` | Event handler | `handleClick`, `handleSubmit` |
| `validate` | Validation | `validateEmail`, `validateForm` |
| `create` | Factory/constructor | `createUser`, `createConnection` |
| `update` | Modification | `updateProfile`, `updateSettings` |
| `delete` | Removal | `deleteUser`, `deleteFile` |
| `fetch` | Async data retrieval | `fetchUsers`, `fetchOrders` |
| `parse` | Data transformation | `parseJSON`, `parseDate` |
| `format` | Formatting | `formatCurrency`, `formatDate` |

---

## Files and Directories

- Components: PascalCase (`UserProfile.tsx`)
- Utilities: camelCase (`formatDate.ts`)
- Constants: camelCase or UPPER_SNAKE_CASE (`constants.ts`, `API_ROUTES.ts`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Types: PascalCase (`User.types.ts`)
