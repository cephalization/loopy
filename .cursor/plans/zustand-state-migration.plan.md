# Zustand State Migration Plan

## Current Architecture Issues

- [`CanvasProvider.tsx`](src/components/canvas/CanvasProvider.tsx) has 500+ lines with interleaved state
- Multiple `useMemo`/`useCallback` cascades when Zero data changes
- Selection state stored separately from node data (double re-renders)
- `ConversationNode` directly calls `useZero` for mutations
- History stored in `useRef` with mutable function dependencies

## Target Architecture

```
Zero (persistence/sync)
        ↓ useQuery
   Zustand Store (single source of UI truth)
        ↓ selectors
   Components (FlowCanvas, ConversationNode, Toolbar)
```

## Store Structure

Create [`src/store/canvasStore.ts`](src/store/canvasStore.ts):

```typescript
interface CanvasState {
  // Zero-synced data (updated via effect)
  conversationId: string;
  rawNodes: Node[];
  rawEdges: Edge[];
  
  // React Flow derived state
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  
  // UI state
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  edgeExecutionStates: Map<string, EdgeExecutionState>;
  isGenerating: boolean;
  
  // History
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];
  
  // Zero mutate reference (set once at init)
  zeroMutate: ZeroMutate | null;
}
```

## Key Implementation Details

1. **Optimistic local state**: Zustand store updates immediately for responsive UI. Components read from Zustand, never directly from Zero queries.

2. **Smart sync to Zero**:

   - **Immediate writes**: Discrete actions (add/delete node, connect edges) push to Zero immediately
   - **Debounced writes**: High-frequency updates (dragging positions, typing in prompts) batch to Zero after ~300ms of inactivity
   - **Pending changes map**: Track which nodes have unsaved position changes

3. **Sync from Zero**: One effect subscribes to Zero queries and merges remote changes, respecting local pending changes (don't overwrite positions mid-drag)

4. **ConversationNode uses store**: Replace direct `useZero` calls with store actions like `store.updateNodeData(id, data)`

5. **History tracks intent**: Undo/redo operates on logical actions (move complete, not each pixel), stored in Zustand

6. **Selectors for performance**: Components subscribe only to needed slices via `useCanvasStore(state => state.nodes)`

## Debouncing Strategy

```typescript
updateNodePosition: (nodeId, x, y) => {
  // 1. Optimistic local update
  set(state => ({ nodes: updatePos(state.nodes, nodeId, x, y) }));
  // 2. Track pending
  get().pendingPositions.set(nodeId, { x, y });
  // 3. Debounced flush to Zero
  debouncedFlushPositions();
}
```

## Streaming Response Optimization

**Problem**: Streaming chunks recreate entire node objects, causing all nodes to re-render.

**Solution**: Store streaming responses in a separate map and use fine-grained selectors:

```typescript
interface CanvasState {
  // ... other state
  nodeResponses: Map<string, { response: string; loading: boolean }>;
}

// In ConversationNode - only subscribes to its own response
const { response, loading } = useCanvasStore(
  useCallback(s => s.nodeResponses.get(nodeId) ?? { response: '', loading: false }, [nodeId]),
  shallow
);
```

This ensures:

- Streaming updates only re-render the affected node
- Other nodes don't re-render when one node's response changes
- The `nodes` array stays stable during streaming (position/selection changes only)

## Files to Modify

| File | Changes |

|------|---------|

| `src/store/canvasStore.ts` | **New** - Main Zustand store |

| `src/store/index.ts` | **New** - Export store and hooks |

| `src/components/canvas/CanvasProvider.tsx` | Slim down to Zero sync + store init |

| `src/components/canvas/useCanvas.ts` | Re-export store selectors |

| `src/components/ConversationNode.tsx` | Use store instead of useZero |

| `src/hooks/useCanvasActions.ts` | Move logic into store actions |

| `src/hooks/useCanvasHistory.ts` | Move logic into store |

| `src/hooks/useRunFlow.ts` | Use store for state and updates |