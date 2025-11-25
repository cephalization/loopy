<!-- 84e3a4be-390f-4178-810d-8d6d2811454e f453100f-66ae-4408-8475-e51530c5c4d8 -->
# Plan: Scaffold Loopy (Multiplayer Canvas)

We will build a local-first, multiplayer canvas app using **Rocicorp Zero**, **React Flow**, and **AI SDK**.

## 1. Initialization & Cleanup

- [ ] Clone `https://github.com/rocicorp/hello-zero.git` into `./loopy` ([Zero Quickstart](https://zero.rocicorp.dev/docs/quickstart)).
- [ ] Clean up the example "message" code (UI components, schema definitions) to prepare for our own logic.
- [ ] Ensure `docker-compose` and environment variables are correctly set up for the new project name.

## 2. Dependency Installation

- [ ] Install core libraries:
- `@xyflow/react` ([React Flow Docs](https://reactflow.dev/learn))
- `ai` and `@ai-sdk/openai` ([AI SDK Docs](https://sdk.vercel.ai/docs/introduction))
- `lucide-react` (Icons)
- [ ] Setup **shadcn/ui** (Vite + Tailwind v4) ([shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite)):
- Install `tailwindcss`, `@tailwindcss/vite`.
- Update `src/index.css` with `@import "tailwindcss";`.
- Configure `tsconfig.json` and `tsconfig.app.json` with `baseUrl` and paths alias `@/*`.
- Update `vite.config.ts` with `tailwindcss()` plugin and path aliases.
- Run `pnpm dlx shadcn@latest init` to initialize structure.
- Add basic components: `button`, `card`, `dialog`, `input`.

## 3. Schema Design (Zero)

- [ ] Define the database schema (Postgres) in `seed.sql` (or equivalent) for ([Zero Schema Docs](https://zero.rocicorp.dev/docs/using-zero/schema)):
- `node`: `id`, `type`, `position_x`, `position_y`, `data` (JSON), `conversation_id`.
- `edge`: `id`, `source`, `target`, `conversation_id`.
- [ ] Update Zero schema definitions (`schema.ts`) to match the database tables.
- [ ] Update permissions (allow public write for prototype or basic auth if provided in template).

## 4. Backend & AI Setup

- [ ] Create a simple **API Server** (Node.js/Express or Hono) to handle LLM requests securely (hiding API keys) ([AI SDK Providers](https://sdk.vercel.ai/docs/foundations/providers)).
- *Note: Since we chose Vite, we need a separate process or proxy for the AI endpoint.*
- [ ] Configure `docker-compose.yml` to optionally include this API service or run it locally.

## 5. Frontend Implementation

- [ ] **Canvas Component**:
- Initialize `ReactFlow` instance ([React Flow Quickstart](https://reactflow.dev/learn/getting-started/add-react-flow-app)).
- Bind nodes/edges to Zero's live query (`useQuery`) ([Zero Reading Data](https://zero.rocicorp.dev/docs/using-zero/reading-data)).
- Implement `onNodesChange` / `onEdgesChange` to mutate Zero state ([Zero Writing Data](https://zero.rocicorp.dev/docs/using-zero/writing-data)).
- [ ] **Custom Nodes**:
- Create a `ConversationNode` with text input and "Generate" button ([React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)).
- [ ] **AI Integration**:
- Connect the "Generate" button to the API server.
- Stream response back into the node's data ([AI SDK Streaming](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#streaming-text-generation)).

### To-dos

- [ ] Clone hello-zero and perform initial cleanup
- [ ] Install dependencies (React Flow, AI SDK, Shadcn)
- [ ] Define Zero Schema and Seed Data for Nodes/Edges
- [ ] Create simple API server for AI SDK
- [ ] Implement React Flow Canvas with Zero Sync