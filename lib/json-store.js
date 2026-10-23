const fs = require('node:fs');
const path = require('node:path');

// Arquivo JSON com gravação atômica e fila: cada alteração lê, muda e grava em série.
function createJsonFile(filePath, fallback = []) {
  let queue = Promise.resolve();
  const read = async () => {
    try {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    } catch {
      return structuredClone(fallback);
    }
  };
  const write = async value => {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const tmp = `${filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
    await fs.promises.rename(tmp, filePath);
  };
  const mutate = task => {
    const run = queue.then(async () => {
      const current = await read();
      const result = await task(current);
      if (result && result.save !== undefined) await write(result.save);
      return result ? result.value : undefined;
    });
    queue = run.catch(() => {});
    return run;
  };
  return { read, mutate };
}

module.exports = { createJsonFile };
