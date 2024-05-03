import { Kafka } from "kafkajs"
import { v4 as uuid } from 'uuid'

export const TOPIC = "local_pit_consumer_metrics"
export const CONSUMER_GROUP = "local_pit_group"
export const PRINT_PROGRESS_EVERY = 50_000

export const kafkaClient = new Kafka( {
  brokers: [ "127.0.0.1:9092" ],
  clientId: uuid(),
  sasl: {
    mechanism: "scram-sha-512",
    username: "admin",
    password: "admin",
  }
})