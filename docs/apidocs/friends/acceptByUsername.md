---
title: Accept Friend Request
---

import ApiHeader from '../../../src/components/apiheader'

<ApiHeader method="post" requiresAuth={true}>/friends/acceptByUsername</ApiHeader>

### Description
Accept a friend request by username

### Parameters
| Field    | Type   | Description                                |
|----------|--------|--------------------------------------------|
| username | String | Username of the user to accept as a friend |

### Errors
| Reason                 | Description                                      |
|------------------------|--------------------------------------------------|
| user.unknownTarget     | The user does not exist                          |
| user.noPendingRequest  | There is no pending friend request from the user |