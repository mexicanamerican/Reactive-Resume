import { describe, expect, test } from "vitest";
import { getInlineItemWebsiteUrl, shouldRenderSeparateItemWebsite } from "./section-links";

describe("section item website links", () => {
	test("uses inline website URL and suppresses the separate website link when inlineLink is true", () => {
		const website = {
			url: "https://example.com/company",
			label: "example.com/company",
			inlineLink: true,
		};

		expect(getInlineItemWebsiteUrl(website)).toBe("https://example.com/company");
		expect(shouldRenderSeparateItemWebsite(website)).toBe(false);
	});

	test("renders the website separately when inlineLink is false", () => {
		const website = {
			url: "https://example.com/company",
			label: "example.com/company",
			inlineLink: false,
		};

		expect(getInlineItemWebsiteUrl(website)).toBeUndefined();
		expect(shouldRenderSeparateItemWebsite(website)).toBe(true);
	});

	test("does not create an inline or separate link without a URL", () => {
		const website = {
			url: "",
			label: "",
			inlineLink: true,
		};

		expect(getInlineItemWebsiteUrl(website)).toBeUndefined();
		expect(shouldRenderSeparateItemWebsite(website)).toBe(false);
	});
});
