// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandList } from "@reactive-resume/ui/components/command";
import { useCommandPaletteStore } from "../store";

const queryOptionsMock = vi.fn((options?: unknown) => options ?? {});

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
	useRouteContext: () => ({ session: { user: { id: "user-1" } } }),
}));

vi.mock("@/dialogs/store", () => ({
	useDialogStore: () => ({ openDialog: vi.fn() }),
}));

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		resume: {
			list: {
				queryOptions: queryOptionsMock,
			},
		},
	},
}));

const { ResumesCommandGroup } = await import("./resumes");

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

afterEach(() => {
	vi.clearAllMocks();
	useCommandPaletteStore.setState({ open: false, search: "", pages: [] });
});

const renderGroup = () =>
	render(
		<I18nProvider i18n={i18n}>
			<Command>
				<CommandList>
					<ResumesCommandGroup />
				</CommandList>
			</Command>
		</I18nProvider>,
	);

describe("ResumesCommandGroup", () => {
	it("loads resumes with the default list input on the resumes page", () => {
		useCommandPaletteStore.setState({ pages: ["resumes"] });
		vi.mocked(useQuery).mockReturnValue({
			data: [{ id: "resume-1", name: "Evil Apricot Pike" }],
			isLoading: false,
		} as ReturnType<typeof useQuery>);

		renderGroup();

		expect(queryOptionsMock).toHaveBeenCalledWith({
			enabled: true,
			input: { sort: "lastUpdatedAt", tags: [] },
		});
		expect(screen.getByText("Evil Apricot Pike")).toBeInTheDocument();
	});
});
