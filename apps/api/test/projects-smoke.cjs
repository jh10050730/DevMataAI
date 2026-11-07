require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { GithubService } = require('../dist/projects/github.service');
(async () => {
  const result = await new GithubService(new ConfigService()).activity('octocat/Hello-World');
  console.log(JSON.stringify({ repository: result.repository, connected: result.connected, sections: result.sections.map(s => ({ kind: s.kind, ok: s.ok, count: s.items.length, truncated: s.truncated })) }));
  if (!result.sections.every(s => s.ok)) process.exitCode = 1;
})().catch(() => { console.error('GitHub smoke test failed'); process.exitCode = 1; });
