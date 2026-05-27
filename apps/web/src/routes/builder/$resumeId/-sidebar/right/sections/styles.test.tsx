// @vitest-environment happy-dom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { isValidElement } from "react";

const updateResumeData = vi.hoisted(() => vi.fn());
const styleRules = vi.hoisted(() => [
	{
		id: "style-global-heading",
		label: "All sections: Section heading",
		enabled: true,
		target: { scope: "global" },
		slots: { heading: { color: "rgba(220, 38, 38, 1)" } },
	},
]);

vi.mock("../shared/section-base", () => ({
	SectionBase: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/resume/builder/draft", () => ({
	useCurrentResume: () => ({
		data: {
			metadata: { styleRules },
			sections: {
				experience: { title: "Experience" },
				skills: { title: "Skills" },
			},
			customSections: [{ id: "custom-1", title: "Open Source", type: "projects" }],
		},
	}),
	useUpdateResumeData: () => updateResumeData,
}));

const { StylesSectionBuilder } = await import("./styles");
const { getSectionIcon, getSectionTitle } = await import("@/libs/resume/section");

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

beforeEach(() => {
	updateResumeData.mockClear();
});

const renderStyles = () =>
	render(
		<I18nProvider i18n={i18n}>
			<StylesSectionBuilder />
		</I18nProvider>,
	);

describe("StylesSectionBuilder", () => {
	beforeEach(() => {
		styleRules.splice(0, styleRules.length);
		styleRules.push({
			id: "style-global-heading",
			label: "All sections: Section heading",
			enabled: true,
			target: { scope: "global" },
			slots: { heading: { color: "rgba(220, 38, 38, 1)" } },
		});
	});

	it("renders structured style rule controls", () => {
		renderStyles();

		expect(screen.getByLabelText("Target Scope")).toBeInTheDocument();
		expect(screen.getByLabelText("Style Slot")).toBeInTheDocument();
		expect(screen.getByLabelText("Text Color")).toBeInTheDocument();
		expect(screen.getByLabelText("Text Decoration Color")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Color" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Text" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Spacing" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Border" })).toBeInTheDocument();
		expect(screen.getByLabelText("Font Style")).toBeInTheDocument();
		expect(screen.getByLabelText("Line Height")).toBeInTheDocument();
		expect(screen.getByLabelText("Letter Spacing")).toBeInTheDocument();
		expect(screen.getByLabelText("Text Decoration")).toBeInTheDocument();
		expect(screen.getByLabelText("Decoration Style")).toBeInTheDocument();
		expect(screen.getByLabelText("Text Align")).toBeInTheDocument();
		expect(screen.getByLabelText("Text Transform")).toBeInTheDocument();
		expect(screen.getByLabelText("Opacity")).toBeInTheDocument();
		expect(screen.getByLabelText("Margin Top")).toBeInTheDocument();
		expect(screen.getByLabelText("Margin Right")).toBeInTheDocument();
		expect(screen.getByLabelText("Margin Bottom")).toBeInTheDocument();
		expect(screen.getByLabelText("Margin Left")).toBeInTheDocument();
		expect(screen.getByLabelText("Row Gap")).toBeInTheDocument();
		expect(screen.getByLabelText("Column Gap")).toBeInTheDocument();
		expect(screen.getByLabelText("Border Style")).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Section heading" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "List" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "List item content" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "Bullet or number" })).not.toBeInTheDocument();
	});

	it("labels the empty font weight option as default", () => {
		renderStyles();

		const fontWeightSelect = screen.getByLabelText("Font Weight");
		expect(within(fontWeightSelect).getByRole("option", { name: "Default" })).toBeInTheDocument();
		expect(within(fontWeightSelect).queryByRole("option", { name: "Template default" })).not.toBeInTheDocument();
	});

	it("renames the sidebar entry and uses a distinct icon from design", () => {
		const designIcon = getSectionIcon("design");
		const stylesIcon = getSectionIcon("styles");

		expect(getSectionTitle("styles")).toBe("Custom Styles");
		expect(isValidElement(designIcon)).toBe(true);
		expect(isValidElement(stylesIcon)).toBe(true);
		expect(isValidElement(designIcon) && isValidElement(stylesIcon) && designIcon.type !== stylesIcon.type).toBe(true);
	});

	it("upserts one style rule for the selected target and slot", () => {
		styleRules.splice(0, styleRules.length);
		renderStyles();

		fireEvent.change(screen.getByLabelText("Text Color"), { target: { value: "rgba(220, 38, 38, 1)" } });

		expect(updateResumeData).toHaveBeenCalledTimes(1);
		const recipe = updateResumeData.mock.calls[0]?.[0] as (draft: { metadata: { styleRules: unknown[] } }) => void;
		const draft = { metadata: { styleRules: [] } };
		recipe(draft);

		expect(draft.metadata.styleRules).toEqual([
			{
				id: "style-global-heading",
				label: "All sections: Section heading",
				enabled: true,
				target: { scope: "global" },
				slots: { heading: { color: "rgba(220, 38, 38, 1)" } },
			},
		]);
	});

	it("stores padding as per-side values", () => {
		styleRules.splice(0, styleRules.length);
		renderStyles();

		expect(screen.queryByLabelText("Padding")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Padding Top")).toBeInTheDocument();
		expect(screen.getByLabelText("Padding Right")).toBeInTheDocument();
		expect(screen.getByLabelText("Padding Bottom")).toBeInTheDocument();
		expect(screen.getByLabelText("Padding Left")).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("Padding Top"), { target: { value: "12" } });

		expect(updateResumeData).toHaveBeenCalledTimes(1);
		const recipe = updateResumeData.mock.calls[0]?.[0] as (draft: { metadata: { styleRules: unknown[] } }) => void;
		const draft = { metadata: { styleRules: [] } };
		recipe(draft);

		expect(draft.metadata.styleRules).toEqual([
			{
				id: "style-global-heading",
				label: "All sections: Section heading",
				enabled: true,
				target: { scope: "global" },
				slots: { heading: { paddingTop: 12 } },
			},
		]);
	});

	it("stores text decoration intent", () => {
		styleRules.splice(0, styleRules.length);
		renderStyles();

		fireEvent.change(screen.getByLabelText("Text Decoration"), { target: { value: "underline" } });

		expect(updateResumeData).toHaveBeenCalledTimes(1);
		const recipe = updateResumeData.mock.calls[0]?.[0] as (draft: { metadata: { styleRules: unknown[] } }) => void;
		const draft = { metadata: { styleRules: [] } };
		recipe(draft);

		expect(draft.metadata.styleRules).toEqual([
			{
				id: "style-global-heading",
				label: "All sections: Section heading",
				enabled: true,
				target: { scope: "global" },
				slots: { heading: { textDecoration: "underline" } },
			},
		]);
	});

	it("stores margin and gap intent", () => {
		styleRules.splice(0, styleRules.length);
		renderStyles();

		expect(screen.getByLabelText("Margin Bottom")).toHaveAttribute("min", "-72");
		expect(screen.getByLabelText("Row Gap")).toHaveAttribute("min", "-72");

		fireEvent.change(screen.getByLabelText("Margin Bottom"), { target: { value: "-10" } });
		fireEvent.change(screen.getByLabelText("Row Gap"), { target: { value: "-6" } });

		expect(updateResumeData).toHaveBeenCalledTimes(2);

		const marginRecipe = updateResumeData.mock.calls[0]?.[0] as (draft: {
			metadata: { styleRules: unknown[] };
		}) => void;
		const marginDraft = { metadata: { styleRules: [] } };
		marginRecipe(marginDraft);

		expect(marginDraft.metadata.styleRules).toEqual([
			{
				id: "style-global-heading",
				label: "All sections: Section heading",
				enabled: true,
				target: { scope: "global" },
				slots: { heading: { marginBottom: -10 } },
			},
		]);

		const gapRecipe = updateResumeData.mock.calls[1]?.[0] as (draft: { metadata: { styleRules: unknown[] } }) => void;
		const gapDraft = { metadata: { styleRules: [] } };
		gapRecipe(gapDraft);

		expect(gapDraft.metadata.styleRules).toEqual([
			{
				id: "style-global-heading",
				label: "All sections: Section heading",
				enabled: true,
				target: { scope: "global" },
				slots: { heading: { rowGap: -6 } },
			},
		]);
	});

	it("stores list slot rules for rich text lists", () => {
		styleRules.splice(0, styleRules.length);
		renderStyles();

		fireEvent.change(screen.getByLabelText("Style Slot"), { target: { value: "richList" } });
		fireEvent.change(screen.getByLabelText("Row Gap"), { target: { value: "8" } });

		expect(updateResumeData).toHaveBeenCalledTimes(1);
		const recipe = updateResumeData.mock.calls[0]?.[0] as (draft: { metadata: { styleRules: unknown[] } }) => void;
		const draft = { metadata: { styleRules: [] } };
		recipe(draft);

		expect(draft.metadata.styleRules).toEqual([
			{
				id: "style-global-richList",
				label: "All sections: List",
				enabled: true,
				target: { scope: "global" },
				slots: { richList: { rowGap: 8 } },
			},
		]);
	});

	it("can reset the selected style rule", () => {
		renderStyles();

		fireEvent.click(screen.getByRole("button", { name: "Reset Style" }));

		expect(updateResumeData).toHaveBeenCalledTimes(1);
		const recipe = updateResumeData.mock.calls[0]?.[0] as (draft: {
			metadata: { styleRules: { id: string }[] };
		}) => void;
		const draft = {
			metadata: {
				styleRules: [
					{
						id: "style-global-heading",
						label: "All sections: Section heading",
						enabled: true,
						target: { scope: "global" },
						slots: { heading: { color: "rgba(0, 0, 0, 1)" } },
					},
					{
						id: "style-global-section",
						label: "All sections: Section container",
						enabled: true,
						target: { scope: "global" },
						slots: { section: { padding: 4 } },
					},
				],
			},
		};
		recipe(draft);

		expect(draft.metadata.styleRules.map((rule) => rule.id)).toEqual(["style-global-section"]);
	});

	it("lists applied style rules and toggles individual rules", () => {
		renderStyles();

		expect(screen.getByText("Applied Rules")).toBeInTheDocument();
		expect(screen.getByText("All sections: Section heading")).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText("Toggle All sections: Section heading"));

		expect(updateResumeData).toHaveBeenCalledTimes(1);
		const recipe = updateResumeData.mock.calls[0]?.[0] as (draft: {
			metadata: { styleRules: { id: string; enabled: boolean }[] };
		}) => void;
		const draft = { metadata: { styleRules: [{ id: "style-global-heading", enabled: true }] } };
		recipe(draft);

		expect(draft.metadata.styleRules[0]?.enabled).toBe(false);
	});

	it("opens a manage rules dialog with editable rule fields", () => {
		renderStyles();

		fireEvent.click(screen.getByRole("button", { name: "Manage Rules" }));

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Manage Style Rules")).toBeInTheDocument();
		expect(screen.getByLabelText("Rule Label")).toHaveValue("All sections: Section heading");
		expect(screen.getByLabelText("Dialog Text Color")).toHaveValue("rgba(220, 38, 38, 1)");
		expect(screen.getByLabelText("Dialog Padding Top")).toBeInTheDocument();
		expect(screen.getByLabelText("Dialog Padding Right")).toBeInTheDocument();
		expect(screen.getByLabelText("Dialog Padding Bottom")).toBeInTheDocument();
		expect(screen.getByLabelText("Dialog Padding Left")).toBeInTheDocument();
	});
});
