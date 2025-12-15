# Frontend Component Documentation

This document describes the key React components in the `schema-agent-ui` application. The UI is built with React, TypeScript, and Tailwind CSS.

## Core Components

### 1. App (`App.tsx`)
The main root component that orchestrates the entire application state and layout.

- **Responsibilities**:
  - Manages global state (converting, validating, migrating).
  - Handles API integration for core flows (convert, validate, migrate).
  - Renders the main `PanelGroup` for the 3-pane layout (Source, Output, Chat).
  - Integrates `IntroductionWizard` for onboarding.
  - Manages modal states (Validation Modal, Migrate Dialog).

### 2. SchemaEditor (`components/SchemaEditor.tsx`)
A powerful wrapper around the Monaco Editor, customized for SQL schema editing.

- **Props**:
  - `title`: Header title.
  - `type`: 'source' | 'output' (Determines which store selection to bind to).
  - `readOnly`: Whether edits are allowed.
  - `isLoading`: Shows a loading overlay with witty status messages.
  - `diffMode`: Enables Monaco's `DiffEditor` for reviewing changes.
- **Features**:
  - **Syntax Highlighting**: Supports SQL.
  - **Selection Sync**: Reports selected text range to the global store for context awareness.
  - **Decorations**: Highlights active selections referenced in chat.
  - **Loading Overlay**: Displays rotating "loading" messages during long operations.

### 3. ChatInterface (`components/ChatInterface.tsx`)
The conversational interface for interacting with the agent.

- **Features**:
  - **Message History**: Renders a list of chat messages (user and agent).
  - **Markdown Rendering**: Renders agent responses with `react-markdown`.
  - **Syntax Highlighting**: Code blocks in chat are syntax highlighted.
  - **Suggested Fixes**: Renders structured "Review Changes" blocks when the agent proposes a fix.
  - **Selection Context**: Shows a floating indicator when the user has selected code in an editor.
  - **Streaming Feedback**: Displays "Thinking..." or real-time typing indicators.

### 4. IntroductionWizard (`components/IntroductionWizard.tsx`)
an onboarding tour using `react-joyride`.

- **Props**:
  - `onComplete`: Callback when tour finishes.
- **Features**:
  - **Welcome Modal**: Initial splash screen to invite the user.
  - **Step-by-Step Tour**: Highlights key UI elements (Editors, Buttons, Chat) with explanations.
  - **Persistence**: Uses `localStorage` to remember if the user has seen the intro.

### 5. MigrateDialog (`components/MigrateDialog.tsx`)
A modal dialog for configuring and triggering the database migration.

- **Props**:
  - `isOpen`: Visibility state.
  - `onMigrate`: Callback to trigger migration.
  - `isMigrating`: Loading state.
  - `migrationResult`: Result object to show success/failure.
- **Features**:
  - **Form Inputs**: Project ID, Instance ID, Database ID.
  - **Pre-filling**: Fetches defaults from backend `config`.
  - **Validation**: Ensures all fields are filled.
  - **Success State**: Shows the database URI and a link to the Cloud Console upon success.

## State Management (`store.ts`)
The application uses `zustand` (implied from usage) for global state management, sharing data like:
- `sourceCode` / `outputCode`: SQL content.
- `messages`: Chat history.
- `selection`: Active text selection.
- `reviewState`: Context for reviewing fixes (diff mode).
