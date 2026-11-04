import { createContext, useContext } from "react";

// The signed-in user from /api/auth/me ({ id, username, email, role, ... }),
// provided by ProtectedRoute
export const CurrentUserContext = createContext(null);

export const useCurrentUser = () => useContext(CurrentUserContext);
