# Brownie

Brownie is a housekeeping daemon wose repsonsibility is to find and remove stale resources which were:
- Created by PIT but could not be cleanup for technical reasons
- Are not used any more

Brownie scans for old resources and removes them. Currently only PostgresSQL databases and Kafka topics are supported. More resources may be added in the future.

Application need to be configured with: 
- The access to Postgres Database and Kafka using elevated priviledges;
- The regexp pattern. Browny will use pattarn for determining which resources are old.
- The retention period of old resources