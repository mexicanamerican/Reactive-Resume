// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandList } from "@reactive-resume/ui/components/command";
import { useCommandPaletteStore } from "../store";

const mocks = vi.hoisted(() => ({
	pathname: "/",
	resumeQueryOptions: vi.fn((options?: unknown) => ({ entity: "resumes", ...(options ?? {}) })),
	applicationsListQueryOptions: vi.fn(() => ({ entity: "applications" })),
	threadsQueryOptions: vi.fn((options?: unknown) => ({ entity: "threads", ...(options ?? {}) })),
	navigate: vi.fn(),
	openDialog: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
	useRouteContext: () => ({ session: { user: { id: "user-1" } } }),
	useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
		select({ location: { pathname: mocks.pathname } }),
}));

vi.mock("@/dialogs/store", () => ({
	useDialogStore: () => ({ openDialog: mocks.openDialog }),
}));

vi.mock("@/features/applications/queries", () => ({
	applicationsListQueryOptions: mocks.applicationsListQueryOptions,
}));

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		resume: {
			list: {
				queryOptions: mocks.resumeQueryOptions,
			},
		},
		agent: {
			threads: {
				list: {
					queryOptions: mocks.threadsQueryOptions,
				},
			},
		},
	},
}));

const { ResumesCommandGroup } = await import("./resumes");
const { NavigationCommandGroup } = await import("./navigation");

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

afterEach(() => {
	vi.clearAllMocks();
	mocks.pathname = "/";
	useCommandPaletteStore.setState({ open: false, search: "", pages: [] });
});

const mockUseQueryData = (getData: (entity: string | undefined) => unknown) => {
	vi.mocked(useQuery).mockImplementation(((options: unknown) => {
		return { data: getData((options as { entity?: string }).entity), isLoading: false } as ReturnType<typeof useQuery>;
	}) as typeof useQuery);
};

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
		mocks.pathname = "/dashboard/resumes";
		mockUseQueryData((entity) =>
			entity === "resumes" ? [{ id: "resume-1", name: "Evil Apricot Pike", slug: "apricot" }] : [],
		);

		renderGroup();

		expect(mocks.resumeQueryOptions).toHaveBeenCalledWith({
			enabled: true,
			input: { sort: "lastUpdatedAt", tags: [] },
		});
		expect(screen.getByText("Evil Apricot Pike")).toBeInTheDocument();
	});

	it("filters resume results from the command palette search", () => {
		mocks.pathname = "/dashboard/resumes";
		useCommandPaletteStore.setState({ search: "apri" });
		mockUseQueryData((entity) =>
			entity === "resumes"
				? [
						{ id: "resume-1", name: "Evil Apricot Pike", slug: "apricot" },
						{ id: "resume-2", name: "Quiet Banana", slug: "banana" },
					]
				: [],
		);

		renderGroup();

		expect(screen.getByText("Evil Apricot Pike")).toBeInTheDocument();
		expect(screen.queryByText("Quiet Banana")).not.toBeInTheDocument();
	});

	it("loads applications on the applications page", () => {
		mocks.pathname = "/dashboard/applications";
		mockUseQueryData((entity) =>
			entity === "applications"
				? [{ id: "application-1", company: "Umbrella", role: "Staff Engineer", archived: false }]
				: [],
		);

		renderGroup();

		expect(screen.getByText("Umbrella")).toBeInTheDocument();
		expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
	});

	it("filters application results from the command palette search", () => {
		mocks.pathname = "/dashboard/applications";
		useCommandPaletteStore.setState({ search: "umbrella" });
		mockUseQueryData((entity) =>
			entity === "applications"
				? [
						{ id: "application-1", company: "Umbrella", role: "Staff Engineer", archived: false },
						{ id: "application-2", company: "Wayne Enterprises", role: "Product Engineer", archived: false },
					]
				: [],
		);

		renderGroup();

		expect(screen.getByText("Umbrella")).toBeInTheDocument();
		expect(screen.queryByText("Wayne Enterprises")).not.toBeInTheDocument();
	});

	it("opens the selected application by id", () => {
		mocks.pathname = "/dashboard/applications";
		mockUseQueryData((entity) =>
			entity === "applications"
				? [{ id: "application-1", company: "Umbrella", role: "Staff Engineer", archived: false }]
				: [],
		);

		renderGroup();
		fireEvent.click(screen.getByText("Umbrella"));

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/dashboard/applications",
			search: { applicationId: "application-1" },
		});
	});

	it("loads threads on agent pages", () => {
		mocks.pathname = "/agent";
		mockUseQueryData((entity) =>
			entity === "threads" ? [{ id: "thread-1", title: "Cover letter rewrite", resumeName: "Product Resume" }] : [],
		);

		renderGroup();

		expect(screen.getByText("Cover letter rewrite")).toBeInTheDocument();
		expect(screen.getByText("Product Resume")).toBeInTheDocument();
	});

	it("filters thread results from the command palette search", () => {
		mocks.pathname = "/agent";
		useCommandPaletteStore.setState({ search: "cover" });
		mockUseQueryData((entity) =>
			entity === "threads"
				? [
						{ id: "thread-1", title: "Cover letter rewrite", resumeName: "Product Resume" },
						{ id: "thread-2", title: "Resume cleanup", resumeName: "Staff Resume" },
					]
				: [],
		);

		renderGroup();

		expect(screen.getByText("Cover letter rewrite")).toBeInTheDocument();
		expect(screen.queryByText("Resume cleanup")).not.toBeInTheDocument();
	});
});

describe("NavigationCommandGroup", () => {
	it("shows application and thread navigation items", () => {
		render(
			<I18nProvider i18n={i18n}>
				<Command>
					<CommandList>
						<NavigationCommandGroup />
					</CommandList>
				</Command>
			</I18nProvider>,
		);

		expect(screen.getByText("Applications")).toBeInTheDocument();
		expect(screen.getByText("New Application")).toBeInTheDocument();
		expect(screen.getByText("Threads")).toBeInTheDocument();
		expect(screen.getByText("New Thread")).toBeInTheDocument();
	});

	it("navigates to new application and new thread destinations", () => {
		render(
			<I18nProvider i18n={i18n}>
				<Command>
					<CommandList>
						<NavigationCommandGroup />
					</CommandList>
				</Command>
			</I18nProvider>,
		);

		fireEvent.click(screen.getByText("New Application"));
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard/applications", search: { create: true } });

		fireEvent.click(screen.getByText("New Thread"));
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/agent/new" });
	});
});
