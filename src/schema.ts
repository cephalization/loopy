import {
  createSchema,
  definePermissions,
  Row,
  ANYONE_CAN,
  table,
  string,
  number,
  relationships,
  PermissionsConfig,
  json,
} from "@rocicorp/zero";

const conversation = table("conversation")
  .columns({
    id: string(),
    title: string(),
    createdAt: number().from("created_at"),
  })
  .primaryKey("id");

const node = table("node")
  .columns({
    id: string(),
    type: string(),
    positionX: number().from("position_x"),
    positionY: number().from("position_y"),
    data: json(),
    conversationID: string().from("conversation_id"),
  })
  .primaryKey("id");

const edge = table("edge")
  .columns({
    id: string(),
    source: string(),
    target: string(),
    sourceHandle: string().from("source_handle").optional(),
    targetHandle: string().from("target_handle").optional(),
    conversationID: string().from("conversation_id"),
  })
  .primaryKey("id");

const nodeRelationships = relationships(node, ({ one }) => ({
  conversation: one({
    sourceField: ["conversationID"],
    destField: ["id"],
    destSchema: conversation,
  }),
}));

const edgeRelationships = relationships(edge, ({ one }) => ({
  conversation: one({
    sourceField: ["conversationID"],
    destField: ["id"],
    destSchema: conversation,
  }),
}));

export const schema = createSchema({
  tables: [conversation, node, edge],
  relationships: [nodeRelationships, edgeRelationships],
});

export type Schema = typeof schema;
export type Conversation = Row<typeof schema.tables.conversation>;
export type Node = Row<typeof schema.tables.node>;
export type Edge = Row<typeof schema.tables.edge>;

type AuthData = {
  sub: string | null;
};

export const permissions = definePermissions<AuthData, Schema>(schema, () => {
  return {
    conversation: {
      row: {
        select: ANYONE_CAN,
        insert: ANYONE_CAN,
        update: {
          preMutation: ANYONE_CAN,
          postMutation: ANYONE_CAN,
        },
        delete: ANYONE_CAN,
      },
    },
    node: {
      row: {
        select: ANYONE_CAN,
        insert: ANYONE_CAN,
        update: {
          preMutation: ANYONE_CAN,
          postMutation: ANYONE_CAN,
        },
        delete: ANYONE_CAN,
      },
    },
    edge: {
      row: {
        select: ANYONE_CAN,
        insert: ANYONE_CAN,
        update: {
          preMutation: ANYONE_CAN,
          postMutation: ANYONE_CAN,
        },
        delete: ANYONE_CAN,
      },
    },
  } satisfies PermissionsConfig<AuthData, Schema>;
});
