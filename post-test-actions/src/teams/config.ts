export class PublisherConfig {
  static PARAM_WEBHOOK = "--teams-webhook"

  constructor(readonly webhookUrl: string) {}
}