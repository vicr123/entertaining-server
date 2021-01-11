---
title: The Friends Object
---

import ApiHeader from '../../../src/components/apiheader'

<ApiHeader method="object">Friends</ApiHeader>

### Members
| Name                               | Type            | Description                                                        |
|------------------------------------|-----------------|--------------------------------------------------------------------|
| username                           | String          | The username of the user                                           |
| status                             | String          | The friend status of the user                                      |
| onlineState                        | Object? \| Bool | The online state of the player                                     |
| onlineState.application            | String          | The application name that the user is currently logged into        |
| onlineState.applicationDisplayName | String          | The application name displayed in the Friends and Relations dialog |

### Remarks
- The `status` field can be one of three values:
    - `friend`: This user is currently a confirmed friend of the authenticated user
    - `request-outgoing`: This user has yet to respond to an outgoing friend request from the authenticated user
    - `request-incoming`: This user has sent a friend request to the authenticated user, which has yet to be responded to.
- The `onlineState` field can be one of two values:
    - `false`: the user is not currently online
    - `[Object]`: the user is currently online

### Examples
```json
{
    "username": "vicr123",
    "status": "friend",
    "onlineState": false
}
```
```json
{
    "username": "vicr123",
    "status": "request-incoming"
}
```
```json
{
    "username": "Akribes",
    "status": "friend",
    "onlineState": {
        "application": "EntertainingChess",
        "applicationDisplayName": "Entertaining Chess"
    }
}
```