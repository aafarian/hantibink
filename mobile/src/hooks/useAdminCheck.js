import { useState, useEffect } from 'react';
import AdminApiService from '../services/AdminApiService';
import { useAuth } from '../contexts/AuthContext';

// Session-level cache: one check per app launch per user
let cachedResult = null;
let cachedUserId = null;

/**
 * Whether the signed-in user may see the admin entry point.
 * The server is the authority (email allowlist); this boolean only decides
 * whether the Admin row renders in settings.
 */
const useAdminCheck = () => {
  const { user } = useAuth();
  // AuthContext exposes the API user id as `uid` on every sign-in path;
  // `.id` only exists on some of them (Google sign-in builds the user
  // object without it, which used to skip the check entirely)
  const userId = user?.uid || user?.id;
  const [isAdmin, setIsAdmin] = useState(cachedUserId === userId ? !!cachedResult : false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!userId) {
        setIsAdmin(false);
        return;
      }
      if (cachedUserId === userId && cachedResult !== null) {
        setIsAdmin(cachedResult);
        return;
      }
      const result = await AdminApiService.checkAccess();
      // A transient failure (API restarting, offline) returns null — never
      // cache it, or the Admin row stays hidden for the whole session
      if (result !== null) {
        cachedUserId = userId;
        cachedResult = result;
      }
      if (!cancelled) {
        setIsAdmin(!!result);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return isAdmin;
};

export default useAdminCheck;
