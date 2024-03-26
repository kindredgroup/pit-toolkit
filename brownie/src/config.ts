import { logger } from "./logger.js"

export class PgConfig {
  static PARAM_PGHOST: string = "--pghost"
  static PARAM_PGPORT: string = "--pgport"
  static PARAM_PGDATABASE: string = "--pgdatabase"
  static PARAM_PGUSER: string = "--pguser"
  static PARAM_PGPASSWORD: string = "--pgpassword"

  readonly port: number

  constructor(
    readonly host: string,
    private readonly portAsText: string,
    readonly database: string,
    readonly username: string,
    readonly password: string
  ) {
    this.port = parseInt(portAsText)
    if (isNaN(this.port)) throw new Error(`The port should be a number: ${ portAsText }`)
  }
}

export class KafkaConfig {
  static PARAM_BROKERS: string = "--kafka-brokers"
  static PARAM_PORT: string = "--kafka-port"
  static PARAM_CLIENT_ID: string = "--kafka-client-id"
  static PARAM_USERNAME: string = "--kafka-username"
  static PARAM_PASSWORD: string = "--kafka-password"
  static PARAM_SASL_MECHANISM: string = "--kafka-sasl-mechanism"

  readonly brokers: Array<string>

  constructor(
    private readonly brokersCsv: string,
    readonly clientId: string,
    readonly username: string,
    readonly password: string,
    private readonly portAsText?: string,
    readonly saslMechanism?: string,
  ) {
    const hosts = brokersCsv
      .split(",")
      .map(it => it.trim())

    const parsed = new Array<string>()
    for (let host of hosts) {
      if (host.indexOf(":") === -1) {
        if (!portAsText || (typeof(portAsText) === 'string' && (portAsText.trim().length === 0 || isNaN(parseInt(portAsText))))) {
          throw Error(`The broker host should be given with port or default port should be provided. Cannot use: "${ host }" without port`)
        }
        host = `${ host }:${ portAsText }`
      }
      parsed.push(host)
    }
    this.brokers = parsed
  }
}

export class Config {
  static PARAM_TIMESTAMP_PATTERN: string = "--timestamp-pattern"
  static PARAM_RETENTION_PERIOD: string = "--retention-period"
  static DEFAULT_TIMESTAMP_PATTERN: RegExp = /^pit_.*_(ts\d{14,14}).*$/
  static DEFAULT_RETENTION_PERIOD: string = "3days"

  constructor(
    readonly pg: PgConfig,
    readonly kafka: KafkaConfig,
    readonly timestampPattern: RegExp,
    readonly retentionMinutes: number
  ) {}

  static parseRetention = (value: string): number => {
    if (new RegExp(/^1day$/).test(value)) return 24 * 60
    if (new RegExp(/^\d{1,}days$/).test(value)) return parseInt(value.replaceAll("days", "")) * 24 * 60

    if (new RegExp(/^1hour$/).test(value)) return 60
    if (new RegExp(/^\d{1,}hours$/).test(value)) return parseInt(value.replaceAll("hours", "")) * 60

    if (new RegExp(/^1minute$/).test(value)) return 1
    if (new RegExp(/^\d{1,}minutes$/).test(value)) return parseInt(value.replaceAll("minutes", ""))

    throw new Error(`Invalid format for retention. Expected "<digit><unit>", got: ${ value }`)
  }
}