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
