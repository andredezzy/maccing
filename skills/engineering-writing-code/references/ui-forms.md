# Forms — the schema stack

## The rule

All forms use the standard stack: a schema-validated form library with the validation schema defining the rules and a resolver bridging them. Raw local state per field with a hand-rolled regex is the observed default — and the failure.

```tsx
// ❌ Observed baseline: useState per field, regex in the component.
const [email, setEmail] = useState("");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ✅ The stack: schema owns the rules, the resolver bridges, the library owns the state.
const newsletterSchema = z.object({ email: z.string().email("Enter a valid email") });
type NewsletterValues = z.infer<typeof newsletterSchema>;

const form = useForm<NewsletterValues>({ resolver: zodResolver(newsletterSchema) });
```

## Full library adoption

When the design system provides Field/Control/Label/Message components, use them together — no raw `<input>` with an ad-hoc error `<span>`. The message component is where the schema's error strings land; sentence case for every label ("Email address", never "Email Address").
