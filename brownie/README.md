# Brownie

Brownie is a housekeeping daemon wose repsonsibility is to find and remove stale resources which were:
- created by PIT but could not be cleanup for technical reasons
- are not used any more

Brownie scans for old resources and removes them. Currently only PostgresSQL databases and Kafka topics are supported. More resources may be added in the future.