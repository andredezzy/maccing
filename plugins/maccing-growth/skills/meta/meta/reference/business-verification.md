## Contents

1. [Business Profile & Verification (WhatsApp)](#business-profile--verification-whatsapp)
   - [Business Profile Fields](#business-profile-fields)
   - [Business Verification](#business-verification)
   - [Official Business Account (Blue Badge)](#official-business-account-blue-badge)
2. [Business Verification Note (Meta Ads Defense Playbook)](#business-verification-note-meta-ads-defense-playbook)

---

## Business Profile & Verification (WhatsApp)

### Business Profile Fields

- Display name (must match external branding; requires approval)
- Description (up to 256 characters)
- Category (from predefined list)
- Website URL (up to 2 URLs)
- Email address
- Address
- Profile photo

**Update profile:**
```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/whatsapp_business_profile
{
  "messaging_product": "whatsapp",
  "about": "Your tagline here",
  "address": "123 Main St",
  "description": "Your business description",
  "email": "contact@example.com",
  "websites": ["https://example.com"],
  "vertical": "RETAIL"
}
```

### Business Verification

Required for: messaging tier upgrades beyond 250 messages/day, Official Business Account application, paid Meta ad integrations.

Documents accepted: Tax ID/business registration, incorporation documents, utility bill showing business name and address.

Timeline: 2-10 business days.

### Official Business Account (Blue Badge)

- WABA must be at least 30 days old
- Business verification complete
- 2FA enabled on WABA phone number
- Display name approved and matching external branding
- Business must be "notable" — significant organic media coverage (not paid PR)
- Submit up to 5 supporting links from reputable sources
- OBA badge application via BSP only (not self-service via WhatsApp Manager — unlike standard WABA setup which is self-service)
- Rejection: must wait 30 days before reapplying
- **Note:** As of mid-2024 (announced at Meta Conversations Conference, June 2024; rolled out through 2024-2025), the OBA badge is blue (not green), aligning with Facebook and Instagram verification symbols. Existing green badges converted automatically.

---

## Business Verification Note (Meta Ads Defense Playbook)

#### 1. Business Verification (critical)

Complete Business Verification with real CNPJ, real address, institutional email on company domain. Verified BMs get higher tolerance threshold before automatic ban and access to premium support. This is the single highest-ROI action.
