import schemas from "virtual:demo-schemas";

// The field details the agents read from the models' schemas, recorded from
// the server's schemas when the demo is built
export const schemaOf = (name) => {
  const paths = schemas[name];
  return paths ? { path: (path) => paths[path] || undefined } : null;
};

export const userModel = () => ({});
export const runAsUser = (userId, fn) => fn();
