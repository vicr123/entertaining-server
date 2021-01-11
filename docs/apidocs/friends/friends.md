---
title: Get Friends
---

import ApiHeader from '../../../src/components/apiheader'

<ApiHeader method="get" requiresAuth={true}>/friends</ApiHeader>

### Description
Gets the list of friends for this user

### Response 200
| Field   | Type                       | Description                  |
|---------|----------------------------|------------------------------|
| friends | [Friends[]](friendsObject) | List of friends of this user |
