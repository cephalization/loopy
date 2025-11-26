CREATE TABLE "conversation" (
  "id" VARCHAR PRIMARY KEY,
  "title" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL
);

CREATE TABLE "node" (
  "id" VARCHAR PRIMARY KEY,
  "type" VARCHAR NOT NULL,
  "position_x" REAL NOT NULL,
  "position_y" REAL NOT NULL,
  "data" JSONB NOT NULL,
  "conversation_id" VARCHAR REFERENCES "conversation"(id),
  "parent_node" VARCHAR -- For hierarchy if needed, optional
);

CREATE TABLE "edge" (
  "id" VARCHAR PRIMARY KEY,
  "source" VARCHAR NOT NULL,
  "target" VARCHAR NOT NULL,
  "source_handle" VARCHAR,
  "target_handle" VARCHAR,
  "conversation_id" VARCHAR REFERENCES "conversation"(id)
);

-- Seed Data
INSERT INTO "conversation" (id, title, created_at) VALUES ('demo-1', 'Demo Conversation', NOW());

INSERT INTO "node" (id, type, position_x, position_y, data, conversation_id) VALUES 
('node-1', 'default', 100, 100, '{"label": "Start"}', 'demo-1'),
('node-2', 'default', 100, 200, '{"label": "Middle"}', 'demo-1');

INSERT INTO "edge" (id, source, target, conversation_id) VALUES 
('edge-1', 'node-1', 'node-2', 'demo-1');
