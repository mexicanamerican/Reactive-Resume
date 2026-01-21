import type { InferSelectModel } from "drizzle-orm";
import puppeteer, { type Browser, type ConnectOptions, type Page } from "puppeteer-core";
import type { schema } from "@/integrations/drizzle";
import { printMarginTemplates } from "@/schema/templates";
import { env } from "@/utils/env";
import { generatePrinterToken } from "@/utils/printer-token";
import { getStorageService, uploadFile } from "./storage";

const pageDimensions = {
	a4: {
		width: "210mm",
		height: "297mm",
	},
	letter: {
		width: "8.5in",
		height: "11in",
	},
} as const;

const SCREENSHOT_TTL = 1000 * 60 * 60; // 1 hour

let pdfBrowser: Browser | null = null;
let screenshotBrowser: Browser | null = null;

async function getBrowser(type: "pdf" | "screenshot"): Promise<Browser> {
	const endpoint = new URL(env.PRINTER_ENDPOINT);
	const isWebSocket = endpoint.protocol.startsWith("ws");

	const connectOptions: ConnectOptions = { acceptInsecureCerts: true };

	if (isWebSocket) connectOptions.browserWSEndpoint = env.PRINTER_ENDPOINT;
	else connectOptions.browserURL = env.PRINTER_ENDPOINT;

	if (type === "screenshot") {
		if (screenshotBrowser?.connected) return screenshotBrowser;
		screenshotBrowser = await puppeteer.connect({ ...connectOptions, defaultViewport: { width: 794, height: 1123 } });
		return screenshotBrowser;
	}

	if (pdfBrowser?.connected) return pdfBrowser;
	pdfBrowser = await puppeteer.connect(connectOptions);
	return pdfBrowser;
}

async function interceptLocalhostRequests(page: Page) {
	await page.setRequestInterception(true);

	page.on("request", (request) => {
		const url = request.url();

		if (url.includes(env.APP_URL) && env.PRINTER_APP_URL) {
			const newUrl = url.replace(env.APP_URL, env.PRINTER_APP_URL);
			request.continue({ url: newUrl });
			return;
		}

		request.continue();
	});
}

export const printerService = {
	healthcheck: async (): Promise<object> => {
		const headers = new Headers({ Accept: "application/json" });
		const endpoint = new URL(env.PRINTER_ENDPOINT);

		endpoint.protocol = endpoint.protocol.replace("ws", "http");
		endpoint.pathname = "/json/version";

		const response = await fetch(endpoint, { headers });
		const data = await response.json();

		return data;
	},

	chromeDebug: async (): Promise<void> => {
		const browser = await getBrowser("pdf");

		const page = await browser.newPage();

		await page.goto("https://www.google.com");

		await page.pdf({ path: `screenshot-${Date.now()}.pdf` });

		await browser.disconnect();
	},

	printResumeAsPDF: async (
		input: Pick<InferSelectModel<typeof schema.resume>, "userId" | "id" | "data">,
	): Promise<string> => {
		const { id, userId, data } = input;

		const storageService = getStorageService();
		const pdfPrefix = `uploads/${userId}/pdfs/${id}`;

		await storageService.delete(pdfPrefix);

		const baseUrl = env.PRINTER_APP_URL ?? env.APP_URL;
		const domain = new URL(baseUrl).hostname;

		const format = data.metadata.page.format;
		const locale = data.metadata.page.locale;
		const template = data.metadata.template;

		const token = generatePrinterToken(id);
		const url = `${baseUrl}/printer/${id}?token=${token}`;

		let marginX = 0;
		let marginY = 0;

		if (printMarginTemplates.includes(template)) {
			marginX = Math.round(data.metadata.page.marginX / 0.75);
			marginY = Math.round(data.metadata.page.marginY / 0.75);
		}

		const browser = await getBrowser("pdf");

		await browser.setCookie({ name: "locale", value: locale, domain });

		const page = await browser.newPage();

		if (env.APP_URL.includes("localhost")) await interceptLocalhostRequests(page);

		await page.goto(url, { waitUntil: "networkidle0" });

		const pdfBuffer = await page.pdf({
			width: pageDimensions[format].width,
			height: pageDimensions[format].height,
			tagged: true,
			waitForFonts: true,
			printBackground: true,
			margin: {
				top: marginY,
				right: marginX,
				bottom: marginY,
				left: marginX,
			},
		});

		await page.close();

		const result = await uploadFile({
			userId,
			resumeId: id,
			data: new Uint8Array(pdfBuffer),
			contentType: "application/pdf",
			type: "pdf",
		});

		return result.url;
	},

	getResumeScreenshot: async (
		input: Pick<InferSelectModel<typeof schema.resume>, "userId" | "id" | "data">,
	): Promise<string> => {
		const { id, userId, data } = input;

		const storageService = getStorageService();
		const screenshotPrefix = `uploads/${userId}/screenshots/${id}`;

		const existingScreenshots = await storageService.list(screenshotPrefix);
		const now = Date.now();

		if (existingScreenshots.length > 0) {
			const sortedFiles = existingScreenshots
				.map((path) => {
					const filename = path.split("/").pop();
					const match = filename?.match(/^(\d+)\.webp$/);
					return match ? { path, timestamp: Number(match[1]) } : null;
				})
				.filter((item): item is { path: string; timestamp: number } => item !== null)
				.sort((a, b) => b.timestamp - a.timestamp);

			if (sortedFiles.length > 0) {
				const latest = sortedFiles[0];
				const age = now - latest.timestamp;

				if (age < SCREENSHOT_TTL) return new URL(latest.path, env.APP_URL).toString();

				await Promise.all(sortedFiles.map((file) => storageService.delete(file.path)));
			}
		}

		const baseUrl = env.PRINTER_APP_URL ?? env.APP_URL;
		const domain = new URL(baseUrl).hostname;

		const locale = data.metadata.page.locale;

		const token = generatePrinterToken(id);
		const url = `${baseUrl}/printer/${id}?token=${token}`;

		const browser = await getBrowser("screenshot");

		await browser.setCookie({ name: "locale", value: locale, domain });

		const page = await browser.newPage();

		if (env.APP_URL.includes("localhost")) await interceptLocalhostRequests(page);

		await page.goto(url, { waitUntil: "networkidle0" });

		const screenshotBuffer = await page.screenshot({ type: "webp", quality: 80 });

		await page.close();

		const result = await uploadFile({
			userId,
			resumeId: id,
			data: new Uint8Array(screenshotBuffer),
			contentType: "image/webp",
			type: "screenshot",
		});

		return result.url;
	},
};
