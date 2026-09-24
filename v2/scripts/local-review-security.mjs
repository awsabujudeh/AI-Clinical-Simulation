/** Expo fixture hosts are loopback-only development tools, not authentication servers. */
export function assertLocalReviewEnvironment(mode) {
  if (mode?.toLowerCase() === 'production') throw Error('LOCAL_REVIEW_DISABLED_IN_PRODUCTION');
}

/** Only the host-created Session is reachable. In particular a caller cannot start
 * fresh Sessions to bypass a host's live-provider limits or select another Case. */
export function reviewApiRequestAllowed(method, path, sessionId) {
  if (method === 'POST' && path === '/v1/voice/token') return true;
  const base = `/v1/sessions/${sessionId}`;
  if (method === 'GET') return ['state', 'timeline', 'assessment', 'questions'].some(p => path === `${base}/${p}`)
    || (path.startsWith(`${base}/investigations/`) && /^[A-Za-z0-9._:-]+$/.test(path.slice(`${base}/investigations/`.length)));
  return method === 'POST' && ['actions/propose', 'actions/interpret', 'questions', 'debriefs', 'end'].some(p => path === `${base}/${p}`);
}
