# Feature Request: AI Chat Builder for Resume Editing

I don't know much about this, so I'm looking for volunteers to help with the implementation of this feature I'd like to see on Reactive Resume, and I hope the community finds interest in this feature too.

## Prerequisites

For this feature to work, the following conditions must be met:

- User is logged into Reactive Resume
- User has set up AI integration on their account
  - This means that an AI provider, model and API key should be available for usage on the browser through `useAIStore`

## User Story

1. I have just created a new resume, or I am currently editing a resume I made earlier and I'm on the builder screen.
2. I know what I want, I need to make a few edits here and there, rewrite my summary so it reads better, but I'm lazy.
3. I see a button (outline) on the header, right next to the name on the resume and the menu icon that reads **"Build with AI"** and has a sparkles ✨ icon on its left.
   - This button is only enabled if I have AI integration enabled. If I don't, this button shouldn't be visible at all so as to not hinder the user experience for non-AI enabled users.
4. Clicking on the button displays a chat overlay that can be toggled open/close which covers the right portion of the screen (about 380px width).
5. The chat window should animate open, sliding from the bottom. Below the window, there should be a floating action button which controls the visibility of this window. If the button hasn't been interacted with in the last 1 minute, hide the button until the user clicks on the "Build with AI" button again.
6. The AI chat should display an initial greeting message. Users can type in what they want to change specifically in the resume, some examples include:
   - "Rewrite the professional summary"
   - "Translate all of the section headings to German"
   - "Make my work experience descriptions more impactful"
   - "Add keywords related to software engineering"
7. The request should be sent using `await client.ai.chat({ input: { aiStoreData, resumeId } })`. Ideally, the oRPC chat route should explicitly accept the `resumeId` in its input and have it available in the context, ensuring that any AI-driven changes or updates are accurately mapped to the correct resume.
8. This should display the changes to be made to the resume and apply them. Maybe using tools? I'm not too sure if that's what tools are used for.

## What Already Exists

The codebase already has the foundational pieces in place:

### AI Store (`src/integrations/ai/store.ts`)

Manages the AI configuration stored in localStorage:

```typescript
type AIStoreState = {
  enabled: boolean;
  provider: AIProvider; // "openai" | "gemini" | "anthropic" | "ollama" | ...;
  model: string;
  apiKey: string;
  baseURL: string;
  testStatus: TestStatus;
};
```

You can check if AI is enabled via:

```typescript
const enabled = useAIStore((state) => state.enabled);
```

### oRPC AI Router (`src/integrations/orpc/router/ai.ts`)

Existing AI endpoints that demonstrate streaming patterns:

```typescript
// Example: testConnection streams a response
testConnection: protectedProcedure
  .input(z.object({ provider, model, apiKey, baseURL }))
  .handler(async function* ({ input }) {
    const stream = streamText({
      model: getModel(input),
      messages: [{ role: "user", content: 'Respond with "1"' }],
    });
    yield* stream.textStream;
  }),
```

The router also uses `generateText` with structured output for parsing documents - this pattern could be useful for applying changes to resume data.

### Resume Store (`src/components/resume/store/resume.ts`)

Provides `updateResumeData()` for modifying the resume:

```typescript
updateResumeData: (fn) => {
  set((state) => {
    if (!state.resume) return state;
    if (state.resume.isLocked) {
      // show error toast
      return state;
    }
    fn(state.resume.data as WritableDraft<ResumeData>);
    syncResume(current(state.resume));
  });
},
```

### Builder Header (`src/routes/builder/$resumeId/-components/header.tsx`)

This is where the "Build with AI" button should be placed, next to the resume name and dropdown menu.

## Technical Considerations

Here are some implementation hints for anyone interested in picking this up:

### 1. Button Placement

Add the button in the `BuilderHeader` component, conditionally rendered based on `useAIStore().enabled`:

```typescript
const enabled = useAIStore((state) => state.enabled);

// In the JSX, only show if enabled
{enabled && (
  <Button variant="outline" onClick={openChatPanel}>
    <SparkleIcon />
    Build with AI
  </Button>
)}
```

### 2. Chat Panel Component

- Create a new component (e.g., `AIChatPanel`) that renders as an overlay
- Width: ~380px, positioned on the right side of the screen
- Animate in from the bottom using Framer Motion (already in the project as `motion/react`)
- Include a floating action button (FAB) below the panel for quick toggle
- Auto-hide the FAB after 1 minute of inactivity

### 3. Chat State Management

Consider creating a new Zustand store for chat state:

```typescript
type AIChatStore = {
  isOpen: boolean;
  messages: ChatMessage[];
  lastInteraction: number;
  // actions...
};
```

### 4. oRPC Route for Chat

Create a new route in `src/integrations/orpc/router/ai.ts`:

```typescript
chat: protectedProcedure
  .input(z.object({
    ...aiCredentialsSchema.shape,
    resumeId: z.string(),
    message: z.string(),
  }))
  .handler(async function* ({ input, context }) {
    // Get resume data for context
    // Stream AI response
    // Optionally use tools for structured changes
  }),
```

### 5. Applying Changes

The tricky part is how to apply AI-suggested changes to the resume. Some options:

- **AI SDK Tools**: Use the Vercel AI SDK's tool calling feature to let the AI invoke specific functions like `updateSummary`, `translateHeadings`, etc.
- **Structured Output**: Have the AI return a JSON patch or specific update instructions that can be applied via `updateResumeData()`
- **Diff Display**: Show proposed changes before applying them, letting users accept/reject

### 6. Resume Data Schema

The resume data schema is defined in `src/schema/resume/data.ts` and includes sections like:
- `basics` (name, headline, summary, contact info)
- `experience`, `education`, `skills`, `projects`, etc.
- `metadata` (template, typography, colors)
- `customSections`

## Design Principles

The premise is simple and nothing that hasn't been done before, but I'd like to see it done **subtly** as this is not an AI-first app, it should just be AI-enabled.

- The feature should feel like an optional enhancement, not a core requirement
- Non-AI users should not feel like they're missing out or see disabled features
- The UI should be clean and non-intrusive
- Performance should not be impacted when AI features are not in use

## Getting Started

If you're interested in contributing:

1. Fork the repository
2. Set up the development environment (see README)
3. Configure AI settings in Dashboard > Settings > AI
4. Start exploring the code references mentioned above

## Questions?

Feel free to ask questions in the comments below. I'm happy to provide more context or clarify any requirements.

---

**Labels**: `enhancement`, `help wanted`, `good first issue`, `ai`
