import { createLogger, format, transports } from "winston"

const logger = createLogger({
    level: "info",
    format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.align(),
        format.splat(),
        format.printf(({ timestamp, level, message }) => `${ timestamp } - ${ level }: ${ message }`)
    ),
    transports: [
        new transports.Console()
    ],
})

export { logger }