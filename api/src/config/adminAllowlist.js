/**
 * Admin identity: a server-side email allowlist. There is no isAdmin flag
 * anywhere in the database — nothing a client (or a compromised client) can
 * flip. The client only ever receives a boolean from GET /admin/check to
 * decide whether to render the entry point.
 *
 * ROOT_ADMIN_EMAILS is compiled in and removable only by deploy;
 * ADMIN_EMAILS (comma-separated env) extends it at runtime and is also what
 * tests use.
 */

const ROOT_ADMIN_EMAILS = ['antoafarian@gmail.com'];

const normalize = (email) => (email || '').trim().toLowerCase();

const getAdminEmails = () => {
  const envEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(normalize)
    .filter(Boolean);
  return [...new Set([...ROOT_ADMIN_EMAILS.map(normalize), ...envEmails])];
};

const isAdminEmail = (email) => {
  const normalized = normalize(email);
  return !!normalized && getAdminEmails().includes(normalized);
};

module.exports = {
  ROOT_ADMIN_EMAILS,
  getAdminEmails,
  isAdminEmail,
};
