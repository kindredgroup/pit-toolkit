import * as chai from "chai"

import * as K8s from "../src/k8s.js"

describe("K8S API", () => {
  it ("Generate service URL for access via proxy", () => {
    let url = K8s.makeServiceUrl("http://localhost:8001", "ns", "service-1", "test-1", { exposedViaProxy: true })
    chai.expect(url).eq("http://localhost:8001/api/v1/namespaces/ns/services/service-1:80/proxy")

    url = K8s.makeServiceUrl("http://localhost:8001", "ns", "service-1", "test-1", { exposedViaProxy: true, servicePort: 100 })
    chai.expect(url).eq("http://localhost:8001/api/v1/namespaces/ns/services/service-1:100/proxy")
  })

  it ("Generate service URL for access via ingress", () => {
    let url = K8s.makeServiceUrl("http://localhost:80", "ns", "service-1", "test-1", { exposedViaProxy: false })
    chai.expect(url).eq("http://localhost:80/ns.test-1")

    url = K8s.makeServiceUrl("http://localhost:80", "ns", "service-1", "test-1")
    chai.expect(url).eq("http://localhost:80/ns.test-1")
  })

  it ("Generate service URL should fallback to service name via ingress", () => {
    let url = K8s.makeServiceUrl("http://localhost:80", "ns", "service-1")
    chai.expect(url).eq("http://localhost:80/ns.service-1")
  })
})