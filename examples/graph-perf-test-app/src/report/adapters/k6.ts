import * as report from "../schema-v1.js"

export const convertFrom = (id: string, started: Date, finished: Date, k6Report: any): report.TestScenario => {
  const expectedLatency = new report.DistributionMetric(
    "latency",
    new Map([[90.0, 2.0], [95.0, 2.5]])
  )
  const expectedTps = new report.ScalarMetric("throughput", 490.0)

  const actualTps = new report.ScalarMetric(expectedTps.name, k6Report.metrics.http_reqs.rate)

  const data: Map<number, number> = new Map()
  data.set(90.0, k6Report.metrics.http_req_duration["p(90)"])
  data.set(95.0, k6Report.metrics.http_req_duration["p(95)"])

  const actualLatency = new report.DistributionMetric(expectedLatency.name, data)

  const stream: report.TestStream = new report.TestStream(
    id,
    [ expectedLatency, expectedTps ],
    [ actualLatency, actualTps ],
    report.TestOutcomeType.PASS
  )

  return new report.TestScenario(id, started, finished, [ stream ])
}