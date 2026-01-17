---
description: Run AI-guided validation to verify pictura installation and configuration
---

# Pictura Validate

Run comprehensive validation to verify the pictura plugin is correctly installed and configured.

## What This Command Does

Claude will:
1. Execute the validation script against your configuration
2. Analyze results and identify issues
3. Provide specific remediation steps for any failures
4. Confirm production readiness

## Arguments

$ARGUMENTS is optional. Can be:
- `--full`: Run all checks including live API tests (may incur costs)
- `--quick`: Run only pre-flight checks (no API calls)
- `--provider gemini|openai|topaz`: Test specific provider only

## AI-Guided Process

When you run this command, Claude will:

1. **Check pre-flight conditions:**
   - Config file exists and is valid JSON
   - Permissions are secure (600)
   - Output directory is writable

2. **Verify provider connections:**
   - Test each configured API key
   - Verify quota/rate limit status
   - Check available models

3. **Run smoke tests:**
   - Generate a simple test image
   - Verify prompt enhancement
   - Test retry logic

4. **Provide remediation:**
   - For each failure, provide specific fix
   - Explain root cause
   - Link to relevant documentation

## Examples

```
/pictura:validate
/pictura:validate --full
/pictura:validate --provider gemini
```

## Production Readiness Criteria

The plugin is production-ready when:
- [ ] Config file exists with secure permissions
- [ ] At least one generation provider is configured and connected
- [ ] Output directory is writable
- [ ] Smoke tests pass

## Troubleshooting

If validation fails, Claude will guide you through fixes. Common issues:

| Issue | Cause | Fix |
|-------|-------|-----|
| Config not found | First run | Run `/pictura:setup` |
| Invalid API key | Expired or wrong key | Regenerate at provider dashboard |
| Rate limited | Quota exceeded | Wait or upgrade tier |
| Permission denied | File permissions | `chmod 600 config.json` |
