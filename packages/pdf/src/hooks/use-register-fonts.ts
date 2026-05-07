import type { FontWeight } from "@reactive-resume/fonts";
import type { Typography } from "@reactive-resume/schema/resume/data";
import { Font } from "@react-pdf/renderer";
import { getFont, getWebFontSource, isStandardPdfFontFamily } from "@reactive-resume/fonts";

type FontWeightRange = {
	lowest: number;
	highest: number;
};

const registeredFontVariants = new Set<string>();
const fallbackFontFamily = "IBM Plex Serif";

const getFontWeightRange = (fontWeights: string[]): FontWeightRange => {
	const numericWeights = fontWeights.map(Number).filter((weight) => Number.isFinite(weight));
	if (numericWeights.length === 0) return { lowest: 400, highest: 700 };

	const lowest = Math.min(...numericWeights);
	const rawHighest = Math.max(...numericWeights);
	const highest = rawHighest <= lowest ? 700 : rawHighest;

	return { lowest, highest };
};

const toFontWeight = (weight: number): FontWeight => {
	if (weight <= 100) return "100";
	if (weight <= 200) return "200";
	if (weight <= 300) return "300";
	if (weight <= 400) return "400";
	if (weight <= 500) return "500";
	if (weight <= 600) return "600";
	if (weight <= 700) return "700";
	if (weight <= 800) return "800";
	return "900";
};

const resolvePdfFontFamily = (family: string) => {
	return getFont(family) ? family : fallbackFontFamily;
};

const resolvePdfTypography = (typography: Typography): Typography => {
	const bodyFontFamily = resolvePdfFontFamily(typography.body.fontFamily);
	const headingFontFamily = resolvePdfFontFamily(typography.heading.fontFamily);

	if (bodyFontFamily === typography.body.fontFamily && headingFontFamily === typography.heading.fontFamily) {
		return typography;
	}

	return {
		...typography,
		body: { ...typography.body, fontFamily: bodyFontFamily },
		heading: { ...typography.heading, fontFamily: headingFontFamily },
	};
};

export const registerFonts = (typography: Typography): Typography => {
	Font.registerHyphenationCallback((word) => [word]);

	const pdfTypography = resolvePdfTypography(typography);
	const bodyFontFamily = pdfTypography.body.fontFamily;
	const headingFontFamily = pdfTypography.heading.fontFamily;
	const bodyRange = getFontWeightRange(pdfTypography.body.fontWeights);
	const headingRange = getFontWeightRange(pdfTypography.heading.fontWeights);

	const registerFont = (family: string, weight: number, italic = false) => {
		if (isStandardPdfFontFamily(family)) return;

		const normalizedWeight = toFontWeight(weight);
		const fontStyle = italic ? "italic" : "normal";
		const key = `${family}:${normalizedWeight}:${fontStyle}`;
		if (registeredFontVariants.has(key)) return;

		const source = getWebFontSource(family, normalizedWeight, italic);
		if (!source) return;

		Font.register({ family, src: source, fontWeight: Number(normalizedWeight), fontStyle });
		registeredFontVariants.add(key);
	};

	for (const italic of [false, true]) {
		registerFont(bodyFontFamily, bodyRange.lowest, italic);
		registerFont(bodyFontFamily, bodyRange.highest, italic);
		registerFont(headingFontFamily, headingRange.lowest, italic);
		registerFont(headingFontFamily, headingRange.highest, italic);
	}

	return pdfTypography;
};
