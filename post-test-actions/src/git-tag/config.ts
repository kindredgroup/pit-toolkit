export class GitConfig {
  static PARAM_GIT_REPOSTIRY_URL = "--git-repository-url"
  static PARAM_GIT_REF = "--git-ref"

  constructor(readonly gitRepoUrl: string, readonly gitRef: string) {}
}