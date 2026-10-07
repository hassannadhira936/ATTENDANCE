/*
  SESSION MANAGEMENT
  ------------------
  The logged-in administrator / employee is kept in sessionStorage
  (cleared when the browser tab is closed) and expires after 8 hours.
  Nothing about employees, attendance or settings is stored in the browser any
  more - all of that lives in MySQL and is read through the API.
*/

const KEYS = {
  admin: "session_admin",
  employee: "session_employee",
};

const SESSION_HOURS = 8;

export const saveSession = (role, user) => {
  sessionStorage.setItem(
    KEYS[role],
    JSON.stringify({
      user,
      expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
    })
  );
};

export const getSession = (role) => {
  try {
    const saved = sessionStorage.getItem(KEYS[role]);

    if (!saved) return null;

    const session = JSON.parse(saved);

    if (!session?.user || Date.now() > session.expiresAt) {
      sessionStorage.removeItem(KEYS[role]);
      return null;
    }

    return session.user;
  } catch {
    sessionStorage.removeItem(KEYS[role]);
    return null;
  }
};

export const updateSession = (role, patch) => {
  const current = getSession(role);

  if (!current) return null;

  const updated = { ...current, ...patch };

  saveSession(role, updated);

  return updated;
};

export const clearSession = (role) => {
  sessionStorage.removeItem(KEYS[role]);
};

/*
  Old versions of the project stored fake employees, attendance and even
  passwords in localStorage. Remove that leftover data once.
*/
export const purgeLegacyStorage = () => {
  [
    "employees",
    "employeeAttendance",
    "adminSettings",
    "adminData",
    "adminLoggedIn",
    "employeeLoggedIn",
    "loggedInEmployee",
  ].forEach((key) => localStorage.removeItem(key));
};
