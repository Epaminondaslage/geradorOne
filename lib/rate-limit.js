// Limitador em memória: conta falhas por chave dentro de uma janela deslizante.
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  const prune = (key, now) => {
    const recent = (hits.get(key) || []).filter(time => now - time < windowMs);
    if (recent.length) hits.set(key, recent); else hits.delete(key);
    return recent;
  };
  return {
    blocked(key, now = Date.now()) {
      return prune(key, now).length >= max;
    },
    hit(key, now = Date.now()) {
      const recent = prune(key, now);
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 10_000) for (const k of hits.keys()) { prune(k, now); if (hits.size <= 5_000) break; }
    },
    reset(key) {
      hits.delete(key);
    }
  };
}

module.exports = { createLimiter };
