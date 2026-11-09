// The demo person the agents are working for, and their data. Set before each
// agent run, so the browser versions of the server's data files know whose
// data to read and change.
let current = null;

export const openAccount = (account, store) => {
  current = { account, store };
};

export function currentStore() {
  if (!current) throw new Error("No demo account is open");
  return current.store;
}

export const currentAccount = () => current?.account || "";
