1. Unit test to cover exhaustive case example more than one lock being acquired with a failure
2. POST req params checks for empty, wrong data types
3. Right now Locks can only be inserted if not exists, upgrade to check if locks have expired then update to a new owner and expiry
4. 