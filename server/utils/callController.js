// Runs an Express controller function in-process, as if a request had come
// in, and returns { status, body }. The agents use it to create records
// through the same controllers (and validation) the section pages use.
// Must be called inside the user's request (runAsUser), which it inherits.

function callController(handler, { session, body = {}, params = {}, query = {} }) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(payload) {
        resolve({ status: statusCode, body: payload });
        return res;
      },
      send(payload) {
        resolve({ status: statusCode, body: payload });
        return res;
      },
      set() {
        return res;
      },
      setHeader() {},
      on() {}
    };

    Promise.resolve(handler({ session, body, params, query, headers: {}, get: () => "" }, res)).catch(reject);
  });
}

module.exports = { callController };
