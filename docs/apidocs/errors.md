---
title: Standard Errors
---

If you've received a return code other than `2xx` from the server, this table lists the possible reasons:

| Status Code | Meaning                                                                                            |
|-------------|----------------------------------------------------------------------------------------------------|
| 200         | The request was successful                                                                         |
| 204         | The request was successful. There is no response from the server.                                  |
| 400         | The request may be malformed. Check that the request is formatted correctly.                       |
| 401         | The endpoint requires [authentication](auth), but you haven't provided any authentication details. |
| 403         | The endpoint is not usable by the current user at this point in time.                              |
| 404         | The endpoint does not exist                                                                        |
| 405         | The endpoint does not support the requested HTTP method                                            |
| 5xx         | The server seems to be having some trouble. Retry the request later.                               |