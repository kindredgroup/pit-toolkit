## Currently

## API 
The APIs are unauthenticated and open to use only by the client

```http
POST: /locks/acquire

Request:
Body:
JSON:
    [{
        "lockKey": "235d2770-84ed-11ee-b9d1-0242ac120012",
        "owner": "amnkau",
        "expiryInSec":"300"
    },
    {
        "lockKey": "225d2770-84ed-11ee-b9d1-0242ac121002",
        "owner": "amnkau",
        "expiryInSec":"30"
    }]

Response:
JSON:
    [
        {
            "lockKey": "235d2770-84ed-11ee-b9d1-0242ac120012",
            "acquired": true
        },
        {
            "lockKey": "225d2770-84ed-11ee-b9d1-0242ac121002",
            "acquired": true
        }
    ]

```

```http

POST: `/locks/acquire`

Request:
Body:
JSON:
    [
        "225d2770-84ed-11ee-b9d1-0242ac121002",
        "235d2770-84ed-11ee-b9d1-0242ac120012"
    ]

Response:
    [
        "225d2770-84ed-11ee-b9d1-0242ac121002",
        "235d2770-84ed-11ee-b9d1-0242ac120012"
    ]


```

## DB ops and configs
DB Name : lock_manager
Table name: keys_table
Prim key : lock_key
Min Pool size : 10
Isolation-level: default (Read-committed)

UPSERT in case the key is present will check the expiration of the lock before upsert is commited


# TODO
Logs - right now all is console log
Types - right now not organised and incomplete
Exception Handling - right now not enough thought into exception handling