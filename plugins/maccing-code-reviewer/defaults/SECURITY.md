# Security

Default security rules for the maccing-code-reviewer.

---

## Secrets in Code

Never commit secrets to the codebase:

- API keys
- Passwords
- Tokens
- Private keys
- Connection strings with credentials

**Bad:**
```typescript
const API_KEY = 'sk-1234567890abcdef';
const DB_PASSWORD = 'super_secret_password';
const JWT_SECRET = 'my-jwt-secret-key';
```

**Good:**
```typescript
const API_KEY = process.env.API_KEY;
const DB_PASSWORD = process.env.DB_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

// Validate at startup
if (!API_KEY) {
  throw new Error('API_KEY environment variable is required');
}
```

---

## Input Validation

Validate all user input at system boundaries:

**Bad:**
```typescript
app.post('/users', (req, res) => {
  const user = req.body;
  database.insert('users', user); // Direct insertion
});
```

**Good:**
```typescript
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().optional(),
});

app.post('/users', (req, res) => {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }

  database.insert('users', result.data);
});
```

---

## SQL Injection

Never concatenate user input into SQL queries:

**Bad:**
```typescript
const query = `SELECT * FROM users WHERE id = ${userId}`;
const query = `SELECT * FROM users WHERE name = '${userName}'`;
```

**Good:**
```typescript
// Parameterized queries
const query = 'SELECT * FROM users WHERE id = $1';
await db.query(query, [userId]);

// Using ORM
await prisma.user.findUnique({ where: { id: userId } });
```

---

## XSS Prevention

Sanitize output and use proper encoding:

**Bad:**
```typescript
// React - dangerous
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// Template literals
element.innerHTML = `<p>${userComment}</p>`;
```

**Good:**
```typescript
// React - safe by default
<div>{userInput}</div>

// If HTML is required, sanitize first
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

---

## Command Injection

Never pass user input directly to shell commands:

**Bad:**
```typescript
// Using shell with string interpolation - DANGEROUS
childProcess.execSync(`convert ${userFilename} output.png`);
```

**Good:**
```typescript
// Validate filename first
if (!/^[a-zA-Z0-9_-]+\.(jpg|png|gif)$/.test(userFilename)) {
  throw new Error('Invalid filename');
}

// Use execFile with arguments array (no shell)
childProcess.execFileSync('convert', [userFilename, 'output.png']);
```

---

## Authentication

Enforce authentication on all protected endpoints:

**Bad:**
```typescript
app.get('/api/users/:id', (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user);
});
```

**Good:**
```typescript
app.get('/api/users/:id', requireAuth, async (req, res) => {
  const user = await getUser(req.params.id);

  // Authorization check
  if (user.id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(user);
});
```

---

## Sensitive Data in Logs

Never log sensitive information:

**Bad:**
```typescript
console.log('User login:', { email, password });
console.log('API request:', { headers: req.headers }); // May contain auth tokens
console.log('Payment:', { cardNumber, cvv });
```

**Good:**
```typescript
console.log('User login:', { email });
console.log('API request:', { path: req.path, method: req.method });
console.log('Payment:', { last4: cardNumber.slice(-4), amount });
```

---

## HTTPS

Ensure all external requests use HTTPS:

**Bad:**
```typescript
fetch('http://api.example.com/data');
```

**Good:**
```typescript
fetch('https://api.example.com/data');

// Or enforce in configuration
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure) {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

---

## Rate Limiting

Protect endpoints from abuse:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later.',
});

app.use('/api/', limiter);

// Stricter limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: 'Too many login attempts, please try again later.',
});

app.use('/api/auth/login', authLimiter);
```

---

## Dependency Security

- Keep dependencies updated
- Audit for vulnerabilities regularly
- Use lock files (package-lock.json, yarn.lock)
- Review new dependencies before adding

```bash
# Check for vulnerabilities
npm audit
yarn audit

# Update dependencies
npm update
yarn upgrade
```
