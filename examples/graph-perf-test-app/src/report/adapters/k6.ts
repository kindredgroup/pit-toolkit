import * as report from "../schema-v1.js"

export const convertFrom = (k6Report: Array<any>): Array<report.TestScenario> => {
  const statsPerScenario = new Map<string, any>()
  for (let metric of k6Report) {
    const name = metric.data.tags.scenario
    if (!statsPerScenario.has(name)) {
      statsPerScenario.set(name, { scenrio: name, count: 0 })
    }

    const stats = statsPerScenario.get(name)
    const time = new Date(Date.parse(metric.data.time))
    if (!stats.timeFrom) {
      stats.timeFrom = time
    } else if (stats.timeFrom.getTime() > time.getTime()) {
      stats.timeFrom = time
    }

    if (!stats.timeTo) {
      stats.timeTo = time
    } else if (stats.timeTo.getTime() <= time.getTime()) {
      stats.timeTo = time
    }

    stats.count++
  }

  const expected = new Map()
  expected.set("u5_duration_5s", new report.ScalarMetric("throughput", 600.0))
  expected.set("u10_duration_10s", new report.ScalarMetric("throughput", 400.0))

  const scenarios = Array.from(statsPerScenario.keys()).map(scenarioName => {
    const expectedTps = expected.get(scenarioName)
    const stats = statsPerScenario.get(scenarioName)
    const elapsed = (stats.timeTo.getTime() - stats.timeFrom.getTime()) / 1_000.0
    const rate = stats.count / elapsed
    const actualTps = new report.ScalarMetric(expectedTps.name, rate)

    return new report.TestScenario(
      scenarioName,
      stats.timeFrom,
      stats.timeTo,
      [
        new report.TestStream(
          "default",
          [ expectedTps ],
          [ actualTps ],
          expectedTps.value <= rate ? report.TestOutcomeType.PASS : report.TestOutcomeType.FAIL)
      ])
  })

  return scenarios
}