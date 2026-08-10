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
  const [isAdmin, setIsAdmin] = useState(cachedUserId === user?.id ? !!cachedResult : false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }
      if (cachedUserId === user.id && cachedResult !== null) {
        setIsAdmin(cachedResult);
        return;
      }
      const result = await AdminApiService.checkAccess();
      cachedUserId = user.id;
      cachedResult = result;
      if (!cancelled) {
        setIsAdmin(result);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return isAdmin;
};

export default useAdminCheck;
