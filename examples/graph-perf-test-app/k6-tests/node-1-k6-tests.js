import http from 'k6/http'
import { check } from 'k6'

//"GET /time [5s using 5 users at 500 TPS] + [10s using 10 users at 500 TPS]"
export const options = {
  scenarios: {
    u5_duration_5s: {
      executor: "constant-arrival-rate",
      duration: '5s', // total duration
      preAllocatedVUs: 5,
      rate: 500, // 500 TPS
      timeUnit: '1s',
    },
    u10_duration_10s: {
      executor: "constant-arrival-rate",
      duration: '10s', // total duration
      preAllocatedVUs: 10,
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