// How each logged action is shown
export const DATA_ACTIONS = {
  created: { label: "Added", icon: "bi-plus-circle", color: "success" },
  uploaded: { label: "Uploaded", icon: "bi-cloud-arrow-up", color: "success" },
  updated: { label: "Updated", icon: "bi-pencil", color: "primary" },
  reordered: { label: "Reordered", icon: "bi-arrow-down-up", color: "primary" },
  deleted: { label: "Deleted", icon: "bi-trash", color: "danger" }
};

export const AUTH_ACTIONS = {
  signed_in: { label: "Signed in", icon: "bi-box-arrow-in-right", color: "success" },
  signed_out: { label: "Signed out", icon: "bi-box-arrow-right", color: "secondary" },
  sign_in_failed: { label: "Failed sign-in attempt", icon: "bi-exclamation-triangle", color: "warning" },
  unlocked: { label: "Opened the activity log", icon: "bi-unlock", color: "primary" },
  unlock_failed: { label: "Failed attempt to open the activity log", icon: "bi-exclamation-triangle", color: "warning" },
  signed_out_others: { label: "Signed out other devices", icon: "bi-phone", color: "secondary" },
  signed_out_by_admin: { label: "Signed out by an administrator", icon: "bi-shield-exclamation", color: "danger" },
  disabled_by_admin: { label: "Account disabled by an administrator", icon: "bi-shield-x", color: "danger" },
  password_reset_requested: { label: "Password reset requested", icon: "bi-envelope", color: "warning" },
  password_reset: { label: "Password reset by email", icon: "bi-key", color: "danger" },
  password_changed: { label: "Password changed", icon: "bi-key", color: "primary" }
};

export const actionStyle = (kind, action) =>
  (kind === "auth" ? AUTH_ACTIONS : DATA_ACTIONS)[action] ||
  { label: action, icon: "bi-dot", color: "secondary" };
