const crypto = require('node:crypto');
const { createJsonFile } = require('./json-store');

const PROJECT_KINDS = ['apostila', 'capa'];
const MAX_PROJECTS_PER_USER = 500;

function createProjectStore(filePath) {
  const file = createJsonFile(filePath, []);
  const mine = (projects, ownerId) => projects.filter(project => project.ownerId === ownerId);
  return {
    async list(ownerId) {
      return mine(await file.read(), ownerId)
        .map(({ id, name, kind, updatedAt }) => ({ id, name, kind, updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(ownerId, id) {
      return mine(await file.read(), ownerId).find(project => project.id === id) || null;
    },
    save(ownerId, input) {
      return file.mutate(projects => {
        const now = new Date().toISOString();
        const index = input.id ? projects.findIndex(project => project.id === input.id && project.ownerId === ownerId) : -1;
        if (index === -1 && mine(projects, ownerId).length >= MAX_PROJECTS_PER_USER) {
          throw Object.assign(new Error(`Limite de ${MAX_PROJECTS_PER_USER} projetos atingido. Exclua projetos antigos.`), { status: 409 });
        }
        const project = {
          id: index === -1 ? crypto.randomUUID() : input.id,
          ownerId,
          name: input.name,
          kind: input.kind,
          settings: input.settings,
          prompt: input.prompt,
          createdAt: index === -1 ? now : projects[index].createdAt,
          updatedAt: now
        };
        if (index === -1) projects.push(project); else projects[index] = project;
        return { save: projects, value: project };
      });
    },
    remove(ownerId, id) {
      return file.mutate(projects => {
        const next = projects.filter(project => !(project.id === id && project.ownerId === ownerId));
        if (next.length === projects.length) return { value: false };
        return { save: next, value: true };
      });
    },
    // Projetos criados antes do login não têm dono; passam a pertencer ao primeiro administrador.
    adoptOrphans(ownerId) {
      return file.mutate(projects => {
        const orphans = projects.filter(project => !project.ownerId);
        orphans.forEach(project => { project.ownerId = ownerId; });
        return orphans.length ? { save: projects, value: orphans.length } : { value: 0 };
      });
    },
    removeAllFrom(ownerId) {
      return file.mutate(projects => {
        const next = projects.filter(project => project.ownerId !== ownerId);
        return { save: next, value: projects.length - next.length };
      });
    }
  };
}

function validateProject(payload) {
  const fail = (message, status = 400) => Object.assign(new Error(message), { status });
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : '';
  if (!name) throw fail('Dê um nome ao projeto.');
  if (!PROJECT_KINDS.includes(payload.kind)) throw fail('Tipo de projeto inválido.');
  if (!payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) throw fail('Configurações do projeto inválidas.');
  const settings = Object.fromEntries(Object.entries(payload.settings)
    .filter(([key, value]) => key.length <= 60 && ['string', 'boolean', 'number'].includes(typeof value))
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 20_000) : value]));
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.slice(0, 100_000) : '';
  const id = typeof payload.id === 'string' && /^[0-9a-f-]{36}$/.test(payload.id) ? payload.id : undefined;
  return { id, name, kind: payload.kind, settings, prompt };
}

module.exports = { createProjectStore, validateProject, PROJECT_KINDS };
