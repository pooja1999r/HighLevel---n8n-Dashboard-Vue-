# Vue Workflow Editor

A visual workflow automation builder built with Vue 3, TypeScript, and Vue Flow. Create, configure, and execute automated workflows with a drag-and-drop interface.

## Features

### Workflow Canvas
- **Drag & Drop Nodes**: Drag nodes from the left panel onto the canvas
- **Connect Nodes**: Create edges between nodes by dragging from one handle to another
- **Pan & Zoom**: Navigate the canvas with mouse drag and scroll
- **Tidy Up**: Automatically arrange nodes in a clean tree layout
- **Delete All**: Clear all nodes from the canvas at once

### Node Types

#### Trigger Nodes (Start your workflow)
- **Manual Trigger**: Start the workflow manually with a button click
- **Schedule Trigger**: Run workflows automatically on a schedule (seconds, minutes, hours, days, weeks, months)

#### Action Nodes
- **Run Code**: Execute custom JavaScript code
- **API Call**: Make HTTP requests (GET, POST, PUT, DELETE, PATCH) to external APIs
- **Computation**: Perform mathematical calculations or expressions

### Node Actions
- **Execute**: Run a single node independently
- **Enable/Disable**: Mute nodes to skip them during workflow execution
- **Rename**: Change the node's display name
- **Copy**: Copy node configuration to clipboard
- **Duplicate**: Create a copy of the node on the canvas
- **Delete**: Remove the node from the workflow

### Workflow Controls
- **Zoom to Fit**: Fit all nodes in the viewport
- **Zoom In/Out**: Adjust canvas zoom level
- **Tidy Up**: Auto-arrange nodes in a hierarchical layout
- **Delete All**: Remove all nodes at once
- **Export**: Download workflow as JSON file (includes nodes and edges)
- **Import**: Upload a JSON file to restore a workflow

### Execution
- **Execute Workflow**: Run the entire workflow in topological order
- **Execute Single Node**: Run individual nodes independently
- **Scheduled Execution**: Automatic execution based on trigger configuration
- **Abort Execution**: Stop a running scheduled workflow
- **Execution Logs**: View detailed logs with input/output for each node

### Notifications
- **Success/Error Banners**: Visual feedback for actions and execution results
- **Auto-dismiss**: Notifications automatically disappear after 5 seconds

## Project Structure

```
src/
├── App.vue                     # Root application component
├── main.ts                     # Application entry point
├── style.css                   # Global styles
├── vite-env.d.ts              # Vite type definitions
│
├── components/
│   ├── WorkFlowEditor.vue      # Main canvas with Vue Flow integration
│   ├── WorkflowNode.vue        # Custom node component with actions
│   ├── LeftSidePanel.vue       # Node palette (drag source)
│   ├── NodeInfoModal.vue       # Node configuration modal
│   ├── ExecutionLogPanel.vue   # Execution history and logs
│   ├── constants.ts            # Node type definitions and configurations
│   │
│   └── ui-components/
│       ├── NotificationBanner.vue  # Success/error notifications
│       ├── ListView.vue            # List display component
│       └── SearchBar.vue           # Search input component
│
├── stores/                     # Pinia state management
│   ├── index.ts               # Store exports
│   ├── workflow.ts            # Workflow nodes, edges, and configuration
│   ├── executionLog.ts        # Execution history and notifications
│   └── nodeModal.ts           # Modal state management
│
└── services/
    └── nodeService.ts         # Node execution logic and utilities
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vue-project

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## How to Use

### Creating a Workflow

1. **Add a Trigger**: Drag a "Manual Trigger" or "Schedule Trigger" from the left panel onto the canvas
2. **Add Action Nodes**: Drag action nodes (Run Code, API Call, Computation) onto the canvas
3. **Connect Nodes**: Click and drag from the bottom handle of one node to the top handle of another
4. **Configure Nodes**: Click on a node to open the configuration modal and set parameters

### Executing a Workflow

1. **Manual Execution**: Click the "Execute Workflow" button at the bottom-left
2. **Scheduled Execution**: Configure a Schedule Trigger and the workflow will run automatically
3. **Single Node**: Hover over a node and click the play button to execute just that node

### Managing Nodes

- **Hover** over a node to see action buttons
- **Click the play icon** to execute the node
- **Click the power icon** to enable/disable the node
- **Click the trash icon** to delete the node
- **Click the dots icon** for more options (Open, Rename, Copy, Duplicate)

### Import/Export Workflows

**Export:**
1. Click the download icon in the bottom-left panel
2. A JSON file will be downloaded containing all nodes and their connections

**Import:**
1. Click the upload icon in the bottom-left panel (visible when canvas is empty)
2. Select a workflow JSON file
3. Nodes and edges will be restored on the canvas

### Export Format Example

```json
{
  "nodes": [
    {
      "id": "node-123",
      "label": "Manual Trigger",
      "data": {
        "label": "Manual Trigger",
        "isTrigger": true,
        "actionType": "manual_trigger",
        "userInput": {},
        "position": { "x": 100, "y": 50 }
      }
    },
    {
      "id": "node-456",
      "label": "Run Code",
      "data": {
        "label": "Run Code",
        "isTrigger": false,
        "actionType": "run_code",
        "userInput": {
          "JAVASCRIPT_CODE": "console.log('Hello!')"
        },
        "executableCode": "console.log('Hello!')",
        "position": { "x": 100, "y": 200 }
      }
    }
  ],
  "edges": [
    {
      "source": "node-123",
      "target": "node-456"
    }
  ]
}
```

## Tech Stack

- **Vue 3** - Composition API with `<script setup>`
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Vue Flow** - Node-based graph editor
- **Pinia** - State management
