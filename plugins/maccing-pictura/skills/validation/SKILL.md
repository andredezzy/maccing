---
name: pictura-validation
description: Use when user wants to verify, validate, test, or check if pictura is working correctly. Also triggers for troubleshooting, debugging, or diagnosing pictura issues.
---

# Pictura Validation Skill

This skill guides comprehensive validation of the pictura plugin installation.

## When to Use

- User asks "is pictura working?"
- User reports generation failures
- After initial setup
- Before production deployment
- When troubleshooting issues

## Validation Process

### Step 1: Run Validation Script

Execute the validation runner via MCP tool:

```
pictura_validate
```

### Step 2: Analyze Results

For each check, interpret the result:

**PASS results:** Confirm working, no action needed.

**FAIL results:** This is critical. Provide:
1. What failed and why
2. Exact command or action to fix
3. How to verify the fix worked

**WARN results:** Not blocking but should be addressed:
1. Explain the risk
2. Provide remediation steps
3. Note if it can be ignored

**SKIP results:** Expected when feature not configured:
1. Explain what was skipped
2. Note if this is intentional

### Step 3: Production Readiness Assessment

After all checks, make a clear determination:
- Production Ready: All critical checks pass
- Not Ready: List blockers and next steps
