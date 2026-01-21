import type { InferSelectModel } from "drizzle-orm";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import type { schema } from "@/integrations/drizzle";
import { printMarginTemplates } from "@/schema/templates";
import { env } from "@/utils/env";
import { generatePrinterToken } from "@/utils/printer-token";
import { getStorageService, uploadFile } from "./storage";

type PressureResponse = {
	cpu: number;
	date: number;
	isAvailable: boolean;
	maxConcurrent: number;
	maxQueued: number;
	memory: number;
	message: string;
	queued: number;
	reason: string;
	recentlyRejected: number;
	running: number;
};

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
	healthcheck: async (): Promise<PressureResponse> => {
		const printerEndpoint = env.PRINTER_ENDPOINT;

		const headers = new Headers({ Accept: "application/json" });
		const endpoint = new URL(printerEndpoint);
		endpoint.protocol = endpoint.protocol === "wss:" ? "https:" : "http:";
		endpoint.pathname = "/pressure";

		const response = await fetch(endpoint, { headers });
		const data = (await response.json()) as { pressure: PressureResponse };

		return data.pressure;
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

		if (!pdfBrowser || !pdfBrowser.connected) {
			pdfBrowser = await puppeteer.connect({
				acceptInsecureCerts: true,
				browserWSEndpoint: env.PRINTER_ENDPOINT,
			});
		}

		await pdfBrowser.setCookie({ name: "locale", value: locale, domain });

		const page = await pdfBrowser.newPage();

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

		if (!screenshotBrowser || !screenshotBrowser.connected) {
			screenshotBrowser = await puppeteer.connect({
				acceptInsecureCerts: true,
				defaultViewport: { width: 794, height: 1123 },
				browserWSEndpoint: env.PRINTER_ENDPOINT,
			});
		}

		await screenshotBrowser.setCookie({ name: "locale", value: locale, domain });

		const page = await screenshotBrowser.newPage();

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
