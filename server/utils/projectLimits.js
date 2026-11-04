// Project-wide limits, settable in .env. Defaults: 10 accounts sharing
// 200 MB, so 20 MB each.
const MB = 1024 * 1024;

const maxUsers = () => Number(process.env.MAX_USERS) || 10;

const storageLimits = () => {
  const totalMb = Number(process.env.STORAGE_LIMIT_MB) || 200;

  return {
    totalBytes: totalMb * MB,
    perUserBytes: (Number(process.env.USER_STORAGE_LIMIT_MB) || totalMb / maxUsers()) * MB
  };
};

module.exports = { maxUsers, storageLimits };
