export enum ResourceStatus {
  SKIP = "SKIP",
  CLEAN = "CLEAN",
  RETAIN = "RETAIN"
}

export const evaluateResource = (resourceName: string, pattern: RegExp, date: Date, retentionMinutes: number): ResourceStatus => {
  if (!pattern.test(resourceName)) return ResourceStatus.SKIP
  const rawTimestamp = pattern.exec(resourceName)
  const stamp = rawTimestamp[1].replace("ts", "")
  const year =    parseInt(stamp.substring(0, 4))
  const month =   parseInt(stamp.substring(4, 6))
  const day =     parseInt(stamp.substring(6, 8))
  const hours =   parseInt(stamp.substring(8, 10))
  const minutes = parseInt(stamp.substring(10, 12))
  const seconds = parseInt(stamp.substring(12, 14))

  // do some basic checks ignoring month-day relation.
  if (year < 2024) throw new Error(`Invalid year value: ${ year }. Expected 2024 or later`)
  if (!(month >= 1 && month <= 12)) throw new Error(`Invalid month value: ${ month }. Expected digit from 1 to 12`)
  if (!(day >= 1 && day <= 31)) throw new Error(`Invalid day value: ${ day }. Expected digit from 1 to 31`)
  if (!(hours >= 0 && hours <= 23)) throw new Error(`Invalid hours value: ${ hours }. Expected digit from 0 to 23`)
  if (!(minutes >= 0 && minutes <= 59)) throw new Error(`Invalid minutes value: ${ minutes }. Expected digit from 0 to 59`)
  if (!(seconds >= 0 && seconds <= 59)) throw new Error(`Invalid seconds value: ${ seconds }. Expected digit from 0 to 59`)

  const createdAt = new Date(year, month - 1, day, hours, minutes, seconds)
  const diffMin = (date.getTime() - createdAt.getTime()) / 60_000
  if (diffMin <= retentionMinutes) return ResourceStatus.RETAIN

  return ResourceStatus.CLEAN
}