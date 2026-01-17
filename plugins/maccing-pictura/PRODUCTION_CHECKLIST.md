# Pictura Production Readiness Checklist

Use this checklist before deploying pictura to production.

## Automated Checks (via /pictura:validate)

Run `/pictura:validate --full` and ensure all pass:

- [ ] Config file exists with valid JSON
- [ ] Config permissions are 600 (user-only)
- [ ] Output directory exists and is writable
- [ ] At least one generation provider connected
- [ ] Smoke test generation succeeds
- [ ] Prompt enhancement working
- [ ] Retry logic working

## Manual Verification

### Security
- [ ] API keys are not committed to git
- [ ] `.gitignore` includes config path
- [ ] Environment variables used in CI/CD (not config file)
- [ ] No API keys in logs or error messages

### Rate Limits
- [ ] Understand your tier limits (Free: 2 IPM, Tier 1: 10 IPM)
- [ ] Retry logic handles 429 with exponential backoff
- [ ] Jitter added to prevent thundering herd

### Error Handling
- [ ] Content policy violations handled gracefully
- [ ] Network timeouts trigger retries
- [ ] Invalid API keys stop batch immediately
- [ ] Users see helpful error messages

### Cost Control
- [ ] Using draft mode for development
- [ ] Batch API considered for non-urgent work
- [ ] Request caching prevents duplicate generations

### Monitoring
- [ ] Generation success/failure logged
- [ ] API costs tracked
- [ ] Rate limit warnings logged

## Provider-Specific Checks

### Gemini
- [ ] API key from aistudio.google.com
- [ ] Model `gemini-2.5-flash-image` accessible
- [ ] Tier appropriate for expected volume

### OpenAI (if used)
- [ ] Using `gpt-image-1.5` (not deprecated DALL-E)
- [ ] Aware of 3-size limitation
- [ ] Ratio mapping configured

### Topaz (if used)
- [ ] API key from topazlabs.com
- [ ] Async polling implemented for generative models
- [ ] 500MB request limit understood

## Go/No-Go Decision

**GO** if:
- All automated checks pass
- At least one provider fully configured
- Security checklist complete

**NO-GO** if:
- Any automated check fails
- API keys exposed
- No provider configured
