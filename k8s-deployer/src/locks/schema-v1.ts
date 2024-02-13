export type ErrorDetails = {
  error: string
}

export type AcquireRequest = {
  lockId: string
  owner: string
  expiryInSec?: number
}

export type AcquireResponse = {
  lockId: string
  acquired: boolean
  lockExpiry?: string // string formatted as date
}

export type KeepAliveRequest = {
  lockIds: Array<string>
  owner: string
  expiryInSec?: number
}

export type LockId = string
export type KeepAliveResponse = Array<LockId>

export type ReleaseRequest = {
  lockIds: Array<string>
  owner: string
}

export type ReleaseResponse = Array<LockId>