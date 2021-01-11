---
title: Authentication
---

API Endpoints protected by authentication expect the `Authorization` header to be set.

```http {4}
GET /api/123

Content-Type: application/json
Authorization: Bearer jaWfaweifhawEFA4r3Wh$IT$#
```

:::info
Refer to `/users/token` for information on obtaining tokens.
:::
