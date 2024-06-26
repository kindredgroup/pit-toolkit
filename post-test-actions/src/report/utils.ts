import { TestOutcomeType, TestReport } from "./schema-v1.js";

export const didTestFail = (report: TestReport): boolean => {
  return report.scenarios.flatMap(s => s.streams.map(st => st.outcome).filter(o => o === TestOutcomeType.FAIL)).length > 0
}