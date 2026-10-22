/**
 * PostgREST errors are written for developers ("new row violates row-level
 * security policy for table ..."). A user can trigger a handful of them by
 * acting normally — asking to join a community they already requested, editing
 * a record they do not own — so translate the ones that are reachable into a
 * sentence the user can act on.
 */

interface DbError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export function describeDbError(error: DbError | null | undefined, fallback = 'Something went wrong.'): string {
  if (!error) return fallback;

  const message = error.message || '';
  const code = error.code || '';

  if (code === '42501' || /row-level security/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (code === '23505' || /duplicate key/i.test(message)) {
    return 'That already exists.';
  }
  if (code === '23503' || /foreign key/i.test(message)) {
    return 'That refers to something that no longer exists.';
  }
  if (code === '42P17' || /infinite recursion/i.test(message)) {
    return 'The server blocked this request. Please try again.';
  }
  if (code === 'PGRST116' || /JSON object requested/i.test(message)) {
    return "That record couldn't be found.";
  }
  if (code === 'PGRST100' || /failed to parse/i.test(message)) {
    return 'The server could not understand this request. Please try again.';
  }
  if (error.code === 'PGRST301' || /JWT expired/i.test(message)) {
    return 'Your session expired. Please sign in again.';
  }

  return message || fallback;
}

/**
 * PostgREST answers a write that matched no rows with an empty array and NO
 * error, so "no error" does not mean "it worked". Anything that mutates a row
 * has to check that a row actually changed.
 */
export function didWriteSucceed(data: unknown): boolean {
  return Array.isArray(data) ? data.length > 0 : data != null;
}
