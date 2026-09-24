import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertLocalReviewEnvironment, reviewApiRequestAllowed } from './local-review-security.mjs';

test('local fixture hosts refuse explicit production mode', () => {
  for (const mode of ['production', 'PRODUCTION']) assert.throws(() => assertLocalReviewEnvironment(mode), /LOCAL_REVIEW_DISABLED_IN_PRODUCTION/);
  for (const mode of [undefined, 'development', 'test']) assert.doesNotThrow(() => assertLocalReviewEnvironment(mode));
});
test('host-created Session only: no new Session budget reset, other patient, publication or generic AI route', () => {
  for (const path of ['/v1/sessions', '/v1/review-sessions', '/v1/faculty/cases', '/v1/ai', '/v1/sessions/foreign/questions', '/v1/sessions/foreign/state', '/v1/sessions/current/publish']) {
    for (const method of ['GET', 'POST', 'PATCH']) assert.equal(reviewApiRequestAllowed(method, path, 'current'), false);
  }
  for (const suffix of ['questions', 'debriefs', 'actions/propose', 'actions/interpret', 'end']) assert.equal(reviewApiRequestAllowed('POST', `/v1/sessions/current/${suffix}`, 'current'), true);
  assert.equal(reviewApiRequestAllowed('GET', '/v1/sessions/current/state', 'current'), true);
  assert.equal(reviewApiRequestAllowed('POST', '/v1/voice/token', 'current'), true);
});
test('every V2-021/024/025/026 Expo host applies production refusal before secret or fixture composition', async () => {
  for (const name of ['v2-021-review-host', 'v2-024-review-host', 'v2-025-faculty-host', 'v2-026-review-host']) {
    const source = await readFile(new URL(`./${name}.mjs`, import.meta.url), 'utf8');
    const guard = source.indexOf('assertLocalReviewEnvironment(process.env.NODE_ENV)');
    assert.ok(guard >= 0 && guard < source.indexOf('const '), name);
    assert.match(source, /envDir: false/); assert.match(source, /NO_CLIENT_ENV__/);
    assert.match(source, /127\.0\.0\.1/); assert.match(source, /cross-site/);
    if (name !== 'v2-025-faculty-host') assert.match(source, /if \(!reviewApiRequestAllowed/);
  }
});
