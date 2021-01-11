---
title: Decline Friend Request
---

import ApiHeader from '../../../src/components/apiheader'

<ApiHeader method="post" requiresAuth={true}>/friends/declineByUsername</ApiHeader>

### Description
Decline a friend request by username

### Parameters
| Field    | Type   | Description                                 |
|----------|--------|---------------------------------------------|
| username | String | Username of the user to decline as a friend |

### Errors
| Reason                | Description                                      |
|-----------------------|--------------------------------------------------|
| user.unkownTarget     | The user does not exist                          |
| user.noPendingRequest | There is no pending friend request from the user |