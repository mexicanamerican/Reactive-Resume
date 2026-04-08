import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import z from "zod";

import { client } from "@/integrations/orpc/client";
import { jsonPatchOperationSchema } from "@/utils/resume/patch";

type PatchOperation = z.infer<typeof jsonPatchOperationSchema>;

/** Hierarchical MCP tool names (SEP-986-style namespacing). */
export const MCP_TOOL_NAME = {
  listResumes: "reactive_resume.list_resumes",
  getResume: "reactive_resume.get_resume",
  createResume: "reactive_resume.create_resume",
  duplicateResume: "reactive_resume.duplicate_resume",
  patchResume: "reactive_resume.patch_resume",
  deleteResume: "reactive_resume.delete_resume",
  lockResume: "reactive_resume.lock_resume",
  unlockResume: "reactive_resume.unlock_resume",
  exportResumePdf: "reactive_resume.export_resume_pdf",
  getResumeScreenshot: "reactive_resume.get_resume_screenshot",
  getResumeStatistics: "reactive_resume.get_resume_statistics",
} as const;

// ── Shared Helpers ──────────────────────────────────────────────

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorHint(error: unknown): string {
  const msg = errorMessage(error);
  const { unlockResume, listResumes, getResume } = MCP_TOOL_NAME;
  if (msg.includes("slug already exists")) return "\n\nHint: The slug is already in use. Try a different one.";
  if (msg.includes("locked")) return `\n\nHint: This resume is locked. Use \`${unlockResume}\` first.`;
  if (msg.includes("404") || msg.includes("not found"))
    return `\n\nHint: Resume not found. Use \`${listResumes}\` to find valid IDs.`;
  if (msg.includes("400"))
    return `\n\nHint: Invalid request. Check the input parameters or use \`${getResume}\` to inspect the resume structure.`;
  if (msg.includes("403"))
    return `\n\nHint: Permission denied. The resume may be locked — use \`${unlockResume}\` first.`;
  return "";
}

/**
 * Wraps an async tool handler with consistent error formatting.
 * On success, returns the handler's result directly.
 * On failure, returns `{ isError: true, content: [{ type: "text", text }] }` with actionable hints.
 */
function withErrorHandling<T>(label: string, handler: (params: T) => Promise<CallToolResult>) {
  return async (params: T): Promise<CallToolResult> => {
    try {
      return await handler(params);
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error ${label}: ${errorMessage(error)}${errorHint(error)}` }],
      };
    }
  };
}

function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

// ── Shared Zod Fragments ────────────────────────────────────────

const T = MCP_TOOL_NAME;

const resumeIdSchema = z.string().min(1).describe(`Resume ID. Use \`${T.listResumes}\` to find valid IDs.`);

// ── Tool Registration ───────────────────────────────────────────

export function registerTools(server: McpServer) {
  // ── List Resumes ──────────────────────────────────────────────
  server.registerTool(
    T.listResumes,
    {
      title: "List Resumes",
      description: [
        "Primary way to discover resume IDs for this account. Resumes are not listed as MCP resources;",
        "use this tool (not `resources/list`) to enumerate IDs.",
        "",
        "Returns an array of resume objects (without full resume data) containing:",
        "id, name, slug, tags, isPublic, isLocked, createdAt, updatedAt.",
        "",
        `Call this before \`${T.getResume}\`, \`${T.patchResume}\`, prompts, or \`resources/read\` with \`resume://{id}\`.`,
        "Results can be filtered by tags and sorted by last updated date, creation date, or name.",
      ].join("\n"),
      inputSchema: z.object({
        tags: z
          .array(z.string())
          .optional()
          .default([])
          .describe(
            "Filter resumes by tags. Only resumes matching ALL specified tags are returned. Default: no filter.",
          ),
        sort: z
          .enum(["lastUpdatedAt", "createdAt", "name"])
          .optional()
          .default("lastUpdatedAt")
          .describe("Sort order for results. Default: lastUpdatedAt."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(
      "listing resumes",
      async ({ tags, sort }: { tags: string[]; sort: "lastUpdatedAt" | "createdAt" | "name" }) => {
        const resumes = await client.resume.list({ tags, sort });

        if (resumes.length === 0) return text(`No resumes found. Use \`${T.createResume}\` to create one.`);

        return text(JSON.stringify(resumes, null, 2));
      },
    ),
  );

  // ── Get Resume ────────────────────────────────────────────────
  server.registerTool(
    T.getResume,
    {
      title: "Get Resume",
      description: [
        "Get the full data of a specific resume by its ID.",
        "",
        "Returns the complete resume data as JSON, including: basics (name, headline, email, phone,",
        "location, website), summary, picture settings, all sections (experience, education, skills,",
        "projects, etc.), custom sections, and metadata (template, layout, typography, colors).",
        "",
        `Use \`${T.listResumes}\` first to find valid IDs.`,
        "The `resume://_meta/schema` resource describes the full data structure for JSON Patch paths.",
      ].join("\n"),
      inputSchema: z.object({ id: resumeIdSchema }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("getting resume", async ({ id }: { id: string }) => {
      const resume = await client.resume.getById({ id });

      return text(JSON.stringify(resume.data, null, 2));
    }),
  );

  // ── Create Resume ─────────────────────────────────────────────
  server.registerTool(
    T.createResume,
    {
      title: "Create Resume",
      description: [
        "Create a new, empty resume with a name and URL-friendly slug.",
        "",
        "Returns the ID of the newly created resume.",
        "Set `withSampleData` to true to pre-fill with example content (useful for testing).",
        `After creating, use \`${T.getResume}\` to view or \`${T.patchResume}\` to populate it.`,
      ].join("\n"),
      inputSchema: z.object({
        name: z.string().min(1).max(64).describe("Display name for the resume (e.g. 'Software Engineer 2026')"),
        slug: z
          .string()
          .min(1)
          .max(64)
          .describe("URL-friendly slug, must be unique across your resumes (e.g. 'software-engineer-2026')"),
        tags: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Tags to categorize the resume (e.g. ['tech', 'senior'])"),
        withSampleData: z.boolean().optional().default(false).describe("Pre-fill with sample data. Default: false."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    withErrorHandling(
      "creating resume",
      async ({
        name,
        slug,
        tags,
        withSampleData,
      }: {
        name: string;
        slug: string;
        tags: string[];
        withSampleData: boolean;
      }) => {
        const id = await client.resume.create({ name, slug, tags, withSampleData });

        return text(
          `Created resume "${name}" (ID: ${id}) with slug "${slug}".${withSampleData ? " Pre-filled with sample data." : ""}\n\nNext steps: Use \`${T.getResume}\` to view it, or \`${T.patchResume}\` to start editing.`,
        );
      },
    ),
  );

  // ── Duplicate Resume ──────────────────────────────────────────
  server.registerTool(
    T.duplicateResume,
    {
      title: "Duplicate Resume",
      description: [
        "Create a copy of an existing resume with all its data.",
        "",
        "Returns the ID of the newly duplicated resume.",
        "You must provide a new name and slug for the copy.",
        "Useful for creating job-specific variants of a base resume.",
      ].join("\n"),
      inputSchema: z.object({
        id: resumeIdSchema.describe("ID of the resume to duplicate"),
        name: z.string().min(1).max(64).describe("Name for the duplicate"),
        slug: z.string().min(1).max(64).describe("URL-friendly slug for the duplicate (must be unique)"),
        tags: z.array(z.string()).optional().default([]).describe("Tags for the duplicate"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    withErrorHandling(
      "duplicating resume",
      async ({ id, name, slug, tags }: { id: string; name: string; slug: string; tags: string[] }) => {
        const newId = await client.resume.duplicate({ id, name, slug, tags });

        return text(
          `Duplicated resume as "${name}" (ID: ${newId}) with slug "${slug}".\n\nNext steps: Use \`${T.getResume}\` to view it, or \`${T.patchResume}\` to customize.`,
        );
      },
    ),
  );

  // ── Patch Resume ──────────────────────────────────────────────
  server.registerTool(
    T.patchResume,
    {
      title: "Patch Resume",
      description: [
        "Apply JSON Patch (RFC 6902) operations to partially update a resume's data.",
        "",
        `This is the primary way to edit resume content. Use \`${T.getResume}\` first to inspect the`,
        "current structure, and `resume://_meta/schema` to understand valid paths and types.",
        "",
        "Supported operations: add, remove, replace, move, copy, test.",
        "",
        "Common path examples:",
        "  /basics/name                          — Change the name",
        "  /basics/headline                      — Change the headline",
        "  /summary/content                      — Replace summary (HTML string)",
        "  /sections/experience/items/-           — Append a new experience item",
        "  /sections/experience/items/0/company   — Update first experience's company",
        "  /sections/skills/items/-               — Append a new skill",
        "  /metadata/template                     — Change the template (e.g. 'azurill', 'bronzor', 'onyx')",
        "  /metadata/design/colors/primary        — Change the primary color (rgba string)",
        "  /sections/interests/hidden              — Hide/show a section",
        "",
        "Important: HTML content fields (description, summary.content) must use valid HTML.",
        "New items must include a valid UUID as `id` and `hidden: false`.",
        `Locked resumes cannot be patched — use \`${T.unlockResume}\` first.`,
      ].join("\n"),
      inputSchema: z.object({
        id: resumeIdSchema,
        operations: z
          .array(jsonPatchOperationSchema)
          .min(1)
          .describe("Array of JSON Patch (RFC 6902) operations to apply"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    withErrorHandling("patching resume", async ({ id, operations }: { id: string; operations: PatchOperation[] }) => {
      const resume = await client.resume.patch({ id, operations });
      const summary = operations.map((op) => `${op.op} ${op.path}`).join(", ");

      return text(`Applied ${operations.length} operation(s) to "${resume.name}": ${summary}`);
    }),
  );

  // ── Delete Resume ─────────────────────────────────────────────
  server.registerTool(
    T.deleteResume,
    {
      title: "Delete Resume",
      description: [
        "Permanently delete a resume and all its associated files (screenshots, PDFs).",
        "",
        `This action is IRREVERSIBLE. Locked resumes cannot be deleted — use \`${T.unlockResume}\` first.`,
        `Consider using \`${T.duplicateResume}\` to create a backup before deleting.`,
      ].join("\n"),
      inputSchema: z.object({ id: resumeIdSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("deleting resume", async ({ id }: { id: string }) => {
      await client.resume.delete({ id });

      return text(`Successfully deleted resume (${id}) and all associated files.`);
    }),
  );

  // ── Lock Resume ───────────────────────────────────────────────
  server.registerTool(
    T.lockResume,
    {
      title: "Lock Resume",
      description: [
        "Lock a resume to prevent any modifications.",
        "",
        `When locked, a resume cannot be edited (${T.patchResume}), updated, or deleted.`,
        "Useful for protecting finalized resumes from accidental changes.",
        `Use \`${T.unlockResume}\` to re-enable editing.`,
      ].join("\n"),
      inputSchema: z.object({ id: resumeIdSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("locking resume", async ({ id }: { id: string }) => {
      await client.resume.setLocked({ id, isLocked: true });

      return text(`Resume (${id}) is now locked. It cannot be edited, patched, or deleted until unlocked.`);
    }),
  );

  // ── Unlock Resume ─────────────────────────────────────────────
  server.registerTool(
    T.unlockResume,
    {
      title: "Unlock Resume",
      description: "Unlock a previously locked resume, re-enabling edits, patches, and deletion.",
      inputSchema: z.object({ id: resumeIdSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("unlocking resume", async ({ id }: { id: string }) => {
      await client.resume.setLocked({ id, isLocked: false });

      return text(`Resume (${id}) is now unlocked. It can be edited, patched, and deleted.`);
    }),
  );

  // ── Export Resume as PDF ──────────────────────────────────────
  server.registerTool(
    T.exportResumePdf,
    {
      title: "Export Resume as PDF",
      description: [
        "Generate a PDF from the specified resume and return a download URL.",
        "",
        "The PDF is rendered using the resume's current template, layout, and design settings,",
        "then uploaded to storage. The returned URL can be shared or downloaded directly.",
        "PDF generation may take a few seconds depending on the resume's complexity.",
      ].join("\n"),
      inputSchema: z.object({ id: resumeIdSchema }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("exporting resume as PDF", async ({ id }: { id: string }) => {
      const { url } = await client.printer.printResumeAsPDF({ id });

      return text(`PDF generated successfully.\n\nDownload URL: ${url}`);
    }),
  );

  // ── Get Resume Screenshot ────────────────────────────────────
  server.registerTool(
    T.getResumeScreenshot,
    {
      title: "Get Resume Screenshot",
      description: [
        "Get a visual preview of the resume's first page as a WebP image URL.",
        "",
        "Screenshots are cached for up to 6 hours and regenerated automatically when the resume",
        "is updated. Returns null if the printer service is unavailable.",
        "Use this after making changes to visually verify the result.",
      ].join("\n"),
      inputSchema: z.object({ id: resumeIdSchema }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("getting resume screenshot", async ({ id }: { id: string }) => {
      const { url } = await client.printer.getResumeScreenshot({ id });

      if (!url) return text("Screenshot could not be generated. The printer service may be unavailable.");

      return text(
        `Resume screenshot URL: ${url}\n\nThis is a WebP image of the first page. Open the URL to view the current visual state of the resume.`,
      );
    }),
  );

  // ── Get Resume Statistics ────────────────────────────────────
  server.registerTool(
    T.getResumeStatistics,
    {
      title: "Get Resume Statistics",
      description: [
        "Get view and download statistics for a resume.",
        "",
        "Returns: isPublic (boolean), views (count), downloads (count),",
        "lastViewedAt (timestamp or null), lastDownloadedAt (timestamp or null).",
      ].join("\n"),
      inputSchema: z.object({ id: resumeIdSchema }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("getting resume statistics", async ({ id }: { id: string }) => {
      const stats = await client.resume.statistics.getById({ id });

      return text(JSON.stringify(stats, null, 2));
    }),
  );
}
