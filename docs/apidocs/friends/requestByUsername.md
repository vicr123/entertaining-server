---
title: Send Friend Request
---

import ApiHeader from '../../../src/components/apiheader'

<ApiHeader method="post" requiresAuth={true}>/friends/requestByUsername</ApiHeader>

### Description
Send a friend request to another uesr by username

### Parameters
| Field    | Type   | Description                                  |
|----------|--------|----------------------------------------------|
| username | String | Username of the user to request friends with |

### Errors
| Reason                 | Description                                      |
|------------------------|--------------------------------------------------|
| user.unknownTarget     | The user does not exist                          |