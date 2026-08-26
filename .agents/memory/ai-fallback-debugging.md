---
name: Debugging silent AI-feature fallbacks
description: When an OpenAI-backed feature always returns its safe fallback, verify API access with a raw fetch before assuming a code bug.
---

Helpers wrapping an LLM call to "never block the user flow" typically catch every error and return a safe default, so a bad/rate-limited/quota-exhausted API key produces the exact same visible output as "the model found nothing" — the two are indistinguishable from the feature's result alone.

**How to apply:** when an AI-backed feature always hits its fallback path, make a raw request to the provider directly with the same key/payload, outside the app's error-swallowing wrapper, and read the actual HTTP status/error body before assuming the application logic is at fault.
