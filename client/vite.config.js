import { createRequire } from 'node:module'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const STATIC_SITE = process.env.VITE_STATIC_SITE === 'true'
const demoFile = (path) => new URL(`./src/demo/${path}`, import.meta.url).pathname
const serverFile = (path) => new URL(`../server/${path}`, import.meta.url).pathname

// The GitHub Pages demo runs the server's job matching and agents in the
// browser. These server files are swapped for browser versions there: no
// PDF or Word readers, no database, no file system, no A2A agents.
const demoAliases = STATIC_SITE
  ? [
      { find: 'pdf-parse', replacement: demoFile('emptyModule.js') },
      { find: 'jszip', replacement: demoFile('emptyModule.js') },
      { find: /^(node:)?crypto$/, replacement: demoFile('agents/shims/crypto.js') },
      { find: /^@langchain\/langgraph$/, replacement: '@langchain/langgraph/web' }
    ]
  : []

const SWAPS = {
  [serverFile('utils/userDatabase.js')]: demoFile('agents/shims/userDatabase.js'),
  [serverFile('models/userModels.js')]: demoFile('emptyModule.js'),
  [serverFile('a2a/designerClient.js')]: demoFile('agents/shims/designerClient.js'),
  [serverFile('services/nlp/modelFiles.js')]: demoFile('agents/shims/modelFiles.js'),
  [serverFile('services/agents/workspace.js')]: demoFile('agents/workspace.js'),
  [serverFile('services/resume/resumeData.js')]: demoFile('agents/shims/resumeData.js'),
  [serverFile('services/portfolio/entryVisibility.js')]: demoFile('agents/shims/entryVisibility.js'),
  [serverFile('services/resume/ollama.js')]: demoFile('agents/shims/ollama.js'),
  [serverFile('a2a/atsReviewerClient.js')]: demoFile('agents/shims/atsReviewerClient.js')
}

// The schema details the agents read (field types, required, choices), taken
// from the server's models when the demo is built, so they never drift
function schemaDetails() {
  const require = createRequire(serverFile('package.json'))
  require(serverFile('models/userModels.js'))
  const { schemaOf, userModelCollections } = require(serverFile('utils/userDatabase.js'))
  const details = {}
  for (const { model } of userModelCollections()) {
    const paths = {}
    schemaOf(model).eachPath((name, type) => {
      const { required, maxlength, min, max, match } = type.options || {}
      paths[name] = {
        instance: type.instance,
        enumValues: type.enumValues || [],
        options: { required: Boolean(required), maxlength, min, max, match: match ? String(match) : undefined }
      }
    })
    details[model] = paths
  }
  return details
}

const demoAgents = {
  name: 'demo-agents',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (source === 'virtual:demo-schemas') return '\0demo-schemas'
    if (!importer?.includes('/server/')) return null
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
    return resolved && SWAPS[resolved.id] ? SWAPS[resolved.id] : null
  },
  load(id) {
    return id === '\0demo-schemas' ? `export default ${JSON.stringify(schemaDetails())}` : null
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...(STATIC_SITE ? [demoAgents] : [])],
  resolve: { alias: demoAliases },
  // The server code reads its settings from process.env. The demo has no
  // language model, embedding model or A2A agents to reach.
  define: STATIC_SITE
    ? { 'process.env': JSON.stringify({ OLLAMA_EMBED_MODEL: 'off', A2A_DESIGNER_URL: 'off', A2A_REVIEWER_URL: 'off' }) }
    : {},
})
