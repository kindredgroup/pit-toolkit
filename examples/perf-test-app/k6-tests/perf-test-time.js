import http from 'k6/http'
import { check, fail } from 'k6'

//"GET /time [10s using 50 users at 500 TPS]"
export const options = {
  scenarios: {
    s1: {
      executor: "constant-arrival-rate",
      duration: '5s', // total duration
      preAllocatedVUs: 50,
      rate: 500, // 500 TPS
      timeUnit: '1s',
    },
  },
};

export default function () {
  const response = http.get(`${__ENV.TARGET_SERVICE_URL}/time`)
  check(response, {
    'Status is 200': (_r) => response.status === 200,
    'Content-Type header': (_r) => response.headers['Content-Type'] === 'application/json; charset=utf-8',
    'Response payload': (_r) => response.status === 200 &&
                             response.json().app === 'node-1' &&
                             response.json().time
  })
}