# Canvas UX Improvements

A list of potential UX enhancements for the loopy canvas.

## Completed ✅

- [x] **Double-click to create nodes** - Create new nodes at the clicked position
- [x] **Keyboard shortcuts** - Delete, duplicate, select all, deselect, undo/redo
- [x] **Undo/Redo** - Full history tracking with Cmd/Ctrl+Z support
- [x] **Box selection** - Shift+drag to select multiple nodes
- [x] **Help dialog** - Info icon with shortcuts and tips
- [x] **Auto-layout** - Button to automatically arrange nodes in a tree/graph layout

---

## Quick Wins 🚀

- [ ] **Animated edge connections** - Add glow effect when connecting nodes
- [ ] **Snap-to-handle** - Visual snapping when dragging connections near valid targets
- [ ] **Connection hover feedback** - Highlight valid connection targets when dragging an edge
- [ ] **Multi-select with Shift+click** - Add nodes to selection by shift-clicking

## Medium Effort ✨

- [ ] **Right-click context menu** - Add different node types, delete, duplicate, etc.
- [ ] **Command palette** - Quick access via Cmd/Ctrl+K to search and add nodes
- [ ] **Auto-align** - Align selected nodes horizontally or vertically
- [ ] **Connection validation** - Prevent invalid connections (e.g., self-loops)
- [ ] **Copy/Paste** - Cmd/Ctrl+C/V to copy and paste nodes

## Polish 💎

- [ ] **Node entry animation** - Smooth fade/scale animation when creating nodes
- [ ] **Edge flow animation** - Animated dashes showing data direction
- [ ] **Hover effects** - Subtle glow or lift effect on node hover
- [ ] **Execution visualization** - Nodes light up as they're processed during flow run
- [ ] **Edge pulse animation** - Show data flowing between nodes during execution

## Navigation & Viewport

- [ ] **Mini-map click navigation** - Click on mini-map to jump to that location
- [ ] **Fit-to-selection** - Button/shortcut to zoom to fit selected nodes
- [ ] **Zoom to cursor** - More intuitive zooming centered on mouse position
- [ ] **Keyboard navigation** - Arrow keys to move between nodes

## Advanced Features

- [ ] **Node grouping** - Group nodes together into collapsible containers
- [ ] **Node templates** - Save and reuse common node configurations
- [ ] **Drag from toolbar** - Drag node types directly from a sidebar/toolbar
- [ ] **Touch/tablet support** - Pinch to zoom, better touch targets
- [ ] **Collaborative cursors** - Show other users' cursors in real-time (leveraging Zero)

---

## Notes

- All actions should support undo/redo where applicable
- Keep keyboard shortcuts discoverable via the help dialog
- Prioritize features that reduce friction in common workflows
