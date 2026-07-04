// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
	it("renders the Reactive Resume logo and spinner", () => {
		render(<LoadingScreen />);

		expect(screen.getAllByAltText("Reactive Resume")).toHaveLength(2);
		expect(screen.getByLabelText("Loading")).toBeInTheDocument();
	});

	it("fills the viewport (fixed inset-0)", () => {
		const { container } = render(<LoadingScreen />);

		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper.className).toContain("fixed");
		expect(wrapper.className).toContain("inset-0");
	});
});
