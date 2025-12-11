# Night City: Spanner schema converter

A slick, dark-mode "pair programming" interface for converting SQL schemas to Cloud Spanner.

## Features

### 1. Modern Tri-Panel Layout
- **Source Editor (Left)**: Monaco Editor for PostgreSQL/MySQL input.
- **Output/Diff View (Middle)**: Read-only view of the converted Spanner DDL.
- **Agent Chat (Right)**: Context-aware AI assistant.
- **Resizable Panels**: Smooth dragging between sections.

### 2. Context-Aware Interactions
- **Dual-Panel Selection**: Highlight code in **either** Source or Output editors to ask context-aware questions.
- **Floating Hints**: "Highlight code to ask agent" appears on hover in the interactive Spanner editor.

### 3. Agent "Apply Fix" Workflow
- **Interactive Chat**: The agent analyzes your request (detects "fix" or "pk").
- **Targeted Fixes**: Can apply fixes to **Source** (e.g. `SERIAL` -> `UUID`) or **Output** (e.g. optimizing Spanner DDL directly).
- **One-Click Apply**: Clicking "Apply Fix" updates the respective editor.

## Visuals

### Editor Workflow
1. **Source Dialect**: Select your SQL dialect (MySQL, Postgres, Oracle) from the slick dropdown.
2. **Locked by Default**: Editor starts locked. Click the lock icon to edit/paste.
3. **Smart Conversion**: The "Convert" button stays disabled until you select a dialect.

![Dialect Selection](assets/dialect_selection.png)

### Conversion Result
Once a dialect is chosen, click "Convert" to generate the Spanner DDL.

![Conversion Success](assets/conversion_result.png)

### Apply Fix Flow
1. **Selection**: User highlights code.
2. **Chat**: User asks to "fix".
3. **Result**: Agent suggests correction -> User Applies.

![After Applying Fix](assets/apply_fix.png)

## How to Run

```bash
npm install
npm run dev
```
Open [http://localhost:5174](http://localhost:5174).

### Sample MySQL schema 

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```