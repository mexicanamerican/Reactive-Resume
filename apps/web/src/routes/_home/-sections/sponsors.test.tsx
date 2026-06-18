// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Sponsors } from "./sponsors";

const sponsorUrl = "https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=reactive-resume";

i18n.loadAndActivate({ locale: "en", messages: {} });

const renderSponsors = (show: boolean) =>
	render(
		<I18nProvider i18n={i18n}>
			<Sponsors show={show} />
		</I18nProvider>,
	);

describe("Sponsors", () => {
	it("renders nothing when sponsors are hidden", () => {
		const { container } = renderSponsors(false);

		expect(container).toBeEmptyDOMElement();
	});

	it("renders the Atlas Cloud sponsor link when sponsors are visible", () => {
		const { getByRole } = renderSponsors(true);

		const link = getByRole("link", { name: "Atlas Cloud" });
		expect(link).toHaveAttribute("href", sponsorUrl);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("renders the full Atlas Cloud logo", () => {
		const { getByAltText } = renderSponsors(true);

		const logo = getByAltText("Atlas Cloud");
		expect(logo).toHaveAttribute("src", "/sponsors/atlas-cloud-logo-black.svg");
		expect(logo).toHaveClass("h-20");
	});

	it("thanks sponsors and links sponsorship inquiries to email", () => {
		const { getByRole, getByText, queryByText } = renderSponsors(true);

		expect(queryByText("Sponsors")).not.toBeInTheDocument();
		expect(getByRole("heading", { name: "Thank you to our sponsors" })).toBeInTheDocument();
		expect(getByText(/stays free, open-source, and independent/i)).toBeInTheDocument();
		expect(getByRole("link", { name: "hello@amruthpillai.com" })).toHaveAttribute(
			"href",
			"mailto:hello@amruthpillai.com",
		);
	});
});
