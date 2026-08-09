const buckets = new Map();

const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 20, message = 'Too many requests. Try again later.' } = {}) =>
  (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      return res.status(429).json({ message });
    }
    return next();
  };

module.exports = rateLimit;