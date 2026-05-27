import type {
	ResumeData,
	StyleIntent,
	StyleRule,
	StyleRuleTarget,
	StyleSlot,
} from "@reactive-resume/schema/resume/data";
import type { ComponentProps, ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { SlidersHorizontalIcon, TrashSimpleIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { sectionTypeSchema } from "@reactive-resume/schema/resume/data";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Switch } from "@reactive-resume/ui/components/switch";
import { cn } from "@reactive-resume/utils/style";
import { ColorPicker } from "@/components/input/color-picker";
import { useCurrentResume, useUpdateResumeData } from "@/features/resume/builder/draft";
import { getSectionTitle } from "@/libs/resume/section";
import { SectionBase } from "../shared/section-base";

type TargetScope = StyleRuleTarget["scope"];

type StyleSlotOption = {
	value: StyleSlot;
	label: string;
	group: "Section" | "Rich text";
};

const styleSlotOptions: StyleSlotOption[] = [
	{ value: "section", label: "Section container", group: "Section" },
	{ value: "heading", label: "Section heading", group: "Section" },
	{ value: "item", label: "Item container", group: "Section" },
	{ value: "text", label: "Primary text", group: "Section" },
	{ value: "secondaryText", label: "Secondary text", group: "Section" },
	{ value: "link", label: "Link", group: "Section" },
	{ value: "icon", label: "Icon", group: "Section" },
	{ value: "level", label: "Level indicator", group: "Section" },
	{ value: "richParagraph", label: "Paragraph", group: "Rich text" },
	{ value: "richList", label: "List", group: "Rich text" },
	{ value: "richListItemRow", label: "List item row", group: "Rich text" },
	{ value: "richListItemContent", label: "List item content", group: "Rich text" },
	{ value: "richLink", label: "Inline link", group: "Rich text" },
	{ value: "richBold", label: "Bold text", group: "Rich text" },
	{ value: "richMark", label: "Highlight", group: "Rich text" },
];

const groupedStyleSlotOptions: [StyleSlotOption["group"], StyleSlotOption[]][] = [
	["Section", styleSlotOptions.filter((option) => option.group === "Section")],
	["Rich text", styleSlotOptions.filter((option) => option.group === "Rich text")],
];

const fontWeightOptions = ["100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;
const fontStyleOptions = [
	{ value: "normal", label: "Normal" },
	{ value: "italic", label: "Italic" },
] as const satisfies readonly { value: NonNullable<StyleIntent["fontStyle"]>; label: string }[];
const textDecorationOptions = [
	{ value: "none", label: "None" },
	{ value: "underline", label: "Underline" },
	{ value: "line-through", label: "Line through" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textDecoration"]>; label: string }[];
const textDecorationStyleOptions = [
	{ value: "solid", label: "Solid" },
	{ value: "dashed", label: "Dashed" },
	{ value: "dotted", label: "Dotted" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textDecorationStyle"]>; label: string }[];
const textAlignOptions = [
	{ value: "left", label: "Left" },
	{ value: "center", label: "Center" },
	{ value: "right", label: "Right" },
	{ value: "justify", label: "Justify" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textAlign"]>; label: string }[];
const textTransformOptions = [
	{ value: "none", label: "None" },
	{ value: "uppercase", label: "Uppercase" },
	{ value: "lowercase", label: "Lowercase" },
	{ value: "capitalize", label: "Capitalize" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textTransform"]>; label: string }[];
const borderStyleOptions = [
	{ value: "solid", label: "Solid" },
	{ value: "dashed", label: "Dashed" },
	{ value: "dotted", label: "Dotted" },
] as const satisfies readonly { value: NonNullable<StyleIntent["borderStyle"]>; label: string }[];

export function StylesSectionBuilder() {
	return (
		<SectionBase type="styles" className="space-y-4">
			<StylesSectionForm />
		</SectionBase>
	);
}

function StylesSectionForm() {
	const resume = useCurrentResume();
	const data = resume.data;
	const updateResumeData = useUpdateResumeData();
	const sectionOptions = useMemo(() => getSectionIdOptions(data), [data]);
	const styleRules = data.metadata.styleRules ?? [];

	const [targetScope, setTargetScope] = useState<TargetScope>("global");
	const [sectionType, setSectionType] = useState("summary");
	const [sectionId, setSectionId] = useState("summary");
	const [slot, setSlot] = useState<StyleSlot>("heading");
	const [isManageDialogOpen, setManageDialogOpen] = useState(false);

	const target = createTarget({ targetScope, sectionType, sectionId });
	const ruleId = getStyleRuleId(target, slot);
	const currentRule = styleRules.find((rule) => rule.id === ruleId);
	const currentIntent = currentRule?.slots[slot] ?? {};
	const targetLabel = getTargetLabel(data, target);
	const slotLabel = getSlotLabel(slot);

	const upsertIntent = (patch: Partial<StyleIntent>) => {
		const nextIntent = compactIntent({ ...currentIntent, ...patch });

		updateResumeData((draft) => {
			draft.metadata.styleRules ??= [];
			const rules = draft.metadata.styleRules;
			const existingIndex = rules.findIndex((rule) => rule.id === ruleId);
			const existingRule = rules[existingIndex];

			if (Object.keys(nextIntent).length === 0) {
				if (existingIndex >= 0) rules.splice(existingIndex, 1);
				return;
			}

			const nextRule: StyleRule = {
				id: ruleId,
				label: existingRule?.label || `${targetLabel}: ${slotLabel}`,
				enabled: existingRule?.enabled ?? true,
				target,
				slots: { [slot]: nextIntent },
			};

			if (existingIndex >= 0) rules[existingIndex] = nextRule;
			else rules.push(nextRule);
		});
	};

	const resetRule = () => {
		updateResumeData((draft) => {
			draft.metadata.styleRules = (draft.metadata.styleRules ?? []).filter((rule) => rule.id !== ruleId);
		});
	};

	const updateRuleEnabled = (ruleId: string, enabled: boolean) => {
		updateResumeData((draft) => {
			const rule = (draft.metadata.styleRules ?? []).find((rule) => rule.id === ruleId);
			if (rule) rule.enabled = enabled;
		});
	};

	const updateRuleLabel = (ruleId: string, label: string) => {
		updateResumeData((draft) => {
			const rule = (draft.metadata.styleRules ?? []).find((rule) => rule.id === ruleId);
			if (rule) rule.label = label;
		});
	};

	const updateRuleIntent = (ruleId: string, slot: StyleSlot, patch: Partial<StyleIntent>) => {
		updateResumeData((draft) => {
			const rules = draft.metadata.styleRules ?? [];
			const ruleIndex = rules.findIndex((rule) => rule.id === ruleId);
			const rule = rules[ruleIndex];
			if (!rule) return;

			const nextIntent = compactIntent({ ...(rule.slots[slot] ?? {}), ...patch });
			if (Object.keys(nextIntent).length === 0) delete rule.slots[slot];
			else rule.slots[slot] = nextIntent;

			if (getConfiguredSlots(rule).length === 0) rules.splice(ruleIndex, 1);
		});
	};

	const deleteRule = (ruleId: string) => {
		updateResumeData((draft) => {
			draft.metadata.styleRules = (draft.metadata.styleRules ?? []).filter((rule) => rule.id !== ruleId);
		});
	};

	return (
		<div className="space-y-4">
			<div className="grid @md:grid-cols-2 grid-cols-1 gap-3">
				<Field label="Target Scope" id="style-target-scope">
					<Select
						id="style-target-scope"
						value={targetScope}
						onChange={(event) => setTargetScope(event.target.value as TargetScope)}
					>
						<option value="global">All sections</option>
						<option value="sectionType">Section type</option>
						<option value="sectionId">Specific section</option>
					</Select>
				</Field>

				{targetScope === "sectionType" && (
					<Field label="Section Type" id="style-section-type">
						<Select
							id="style-section-type"
							value={sectionType}
							onChange={(event) => setSectionType(event.target.value)}
						>
							{sectionTypeSchema.options.map((type) => (
								<option key={type} value={type}>
									{getSectionTitle(type)}
								</option>
							))}
						</Select>
					</Field>
				)}

				{targetScope === "sectionId" && (
					<Field label="Section" id="style-section-id">
						<Select id="style-section-id" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
							{sectionOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</Select>
					</Field>
				)}

				<Field label="Style Slot" id="style-slot">
					<Select id="style-slot" value={slot} onChange={(event) => setSlot(event.target.value as StyleSlot)}>
						{groupedStyleSlotOptions.map(([group, options]) => (
							<optgroup key={group} label={group}>
								{options.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</optgroup>
						))}
					</Select>
				</Field>
			</div>

			<Separator />

			<RuleIntentEditor idPrefix="style" intent={currentIntent} onChange={upsertIntent} />

			<div className="flex justify-end">
				<Button type="button" variant="outline" onClick={resetRule}>
					<Trans>Reset Style</Trans>
				</Button>
			</div>

			<Separator />

			<AppliedRulesList
				data={data}
				rules={styleRules}
				onToggleRule={updateRuleEnabled}
				onDeleteRule={deleteRule}
				onManageRules={() => setManageDialogOpen(true)}
			/>

			<ManageStyleRulesDialog
				data={data}
				rules={styleRules}
				open={isManageDialogOpen}
				onOpenChange={setManageDialogOpen}
				onToggleRule={updateRuleEnabled}
				onUpdateRuleLabel={updateRuleLabel}
				onUpdateRuleIntent={updateRuleIntent}
				onDeleteRule={deleteRule}
			/>
		</div>
	);
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			{children}
		</div>
	);
}

function Select({ className, ...props }: ComponentProps<"select">) {
	return (
		<select
			className={cn(
				"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
				"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

function ColorField({
	label,
	id,
	value,
	placeholder,
	fallback,
	onChange,
}: {
	label: string;
	id: string;
	value: string | undefined;
	placeholder?: string;
	fallback: string;
	onChange: (value: string | undefined) => void;
}) {
	return (
		<Field label={label} id={id}>
			<div className="flex items-center gap-3">
				<ColorPicker value={value ?? fallback} defaultValue={fallback} onChange={(color) => onChange(color)} />
				<Input
					id={id}
					value={value ?? ""}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value.trim() || undefined)}
				/>
			</div>
		</Field>
	);
}

function NumberInput({
	label,
	id,
	value,
	min,
	max,
	step = 1,
	onChange,
}: {
	label: string;
	id?: string;
	value: number | undefined;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number | undefined) => void;
}) {
	const inputId = id ?? `style-${label.toLowerCase().replaceAll(" ", "-")}`;

	return (
		<Field label={label} id={inputId}>
			<Input
				id={inputId}
				value={value ?? ""}
				type="number"
				min={min}
				max={max}
				step={step}
				onChange={(event) => {
					const value = event.target.value;
					onChange(value === "" ? undefined : Number(value));
				}}
			/>
		</Field>
	);
}

function AppliedRulesList({
	data,
	rules,
	onToggleRule,
	onDeleteRule,
	onManageRules,
}: {
	data: ResumeData;
	rules: StyleRule[];
	onToggleRule: (ruleId: string, enabled: boolean) => void;
	onDeleteRule: (ruleId: string) => void;
	onManageRules: () => void;
}) {
	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<div className="space-y-0.5">
					<h3 className="font-medium text-sm">
						<Trans>Applied Rules</Trans>
					</h3>
					<p className="text-muted-foreground text-xs tabular-nums">
						{rules.length} {rules.length === 1 ? <Trans>rule</Trans> : <Trans>rules</Trans>}
					</p>
				</div>

				<Button type="button" variant="ghost" size="sm" onClick={onManageRules}>
					<SlidersHorizontalIcon data-icon="inline-start" />
					<Trans>Manage Rules</Trans>
				</Button>
			</div>

			{rules.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-muted-foreground text-sm">
					<Trans>No style rules yet.</Trans>
				</div>
			) : (
				<div className="space-y-2">
					{rules.map((rule) => (
						<AppliedRuleCard
							key={rule.id}
							data={data}
							rule={rule}
							onToggleRule={onToggleRule}
							onDeleteRule={onDeleteRule}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function AppliedRuleCard({
	data,
	rule,
	onToggleRule,
	onDeleteRule,
}: {
	data: ResumeData;
	rule: StyleRule;
	onToggleRule: (ruleId: string, enabled: boolean) => void;
	onDeleteRule: (ruleId: string) => void;
}) {
	const slots = getConfiguredSlots(rule);
	const primaryIntent = slots[0] ? rule.slots[slots[0]] : undefined;
	const fallbackLabel = getRuleFallbackLabel(data, rule);

	return (
		<div className={cn("rounded-lg border bg-background/70 p-3 transition-opacity", !rule.enabled && "opacity-60")}>
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex min-w-0 items-center gap-2">
						<span className="min-w-0 truncate font-medium text-sm">{rule.label || fallbackLabel}</span>
						{!rule.enabled && (
							<Badge variant="outline" className="text-muted-foreground">
								<Trans>Off</Trans>
							</Badge>
						)}
					</div>

					<div className="flex flex-wrap gap-1.5">
						<Badge variant="secondary">{getTargetLabel(data, rule.target)}</Badge>
						{slots.map((slot) => (
							<Badge key={slot} variant="outline">
								{getSlotLabel(slot)}
							</Badge>
						))}
					</div>

					{primaryIntent && <RulePropertySummary intent={primaryIntent} />}
				</div>

				<div className="flex shrink-0 items-center gap-1">
					<Switch
						size="sm"
						checked={rule.enabled}
						aria-label={`Toggle ${rule.label || fallbackLabel}`}
						onCheckedChange={(checked) => onToggleRule(rule.id, checked)}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label={`Delete ${rule.label || fallbackLabel}`}
						onClick={() => onDeleteRule(rule.id)}
					>
						<TrashSimpleIcon />
					</Button>
				</div>
			</div>
		</div>
	);
}

function ManageStyleRulesDialog({
	data,
	rules,
	open,
	onOpenChange,
	onToggleRule,
	onUpdateRuleLabel,
	onUpdateRuleIntent,
	onDeleteRule,
}: {
	data: ResumeData;
	rules: StyleRule[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onToggleRule: (ruleId: string, enabled: boolean) => void;
	onUpdateRuleLabel: (ruleId: string, label: string) => void;
	onUpdateRuleIntent: (ruleId: string, slot: StyleSlot, patch: Partial<StyleIntent>) => void;
	onDeleteRule: (ruleId: string) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[min(760px,calc(100svh-2rem))] gap-4 sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						<Trans>Manage Style Rules</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>Review and edit the style rules saved on this resume.</Trans>
					</DialogDescription>
				</DialogHeader>

				{rules.length === 0 ? (
					<div className="rounded-lg border border-dashed bg-muted/20 px-3 py-5 text-muted-foreground text-sm">
						<Trans>No style rules yet.</Trans>
					</div>
				) : (
					<div className="space-y-3">
						{rules.map((rule) => (
							<ManagedRuleCard
								key={rule.id}
								data={data}
								rule={rule}
								onToggleRule={onToggleRule}
								onUpdateRuleLabel={onUpdateRuleLabel}
								onUpdateRuleIntent={onUpdateRuleIntent}
								onDeleteRule={onDeleteRule}
							/>
						))}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function ManagedRuleCard({
	data,
	rule,
	onToggleRule,
	onUpdateRuleLabel,
	onUpdateRuleIntent,
	onDeleteRule,
}: {
	data: ResumeData;
	rule: StyleRule;
	onToggleRule: (ruleId: string, enabled: boolean) => void;
	onUpdateRuleLabel: (ruleId: string, label: string) => void;
	onUpdateRuleIntent: (ruleId: string, slot: StyleSlot, patch: Partial<StyleIntent>) => void;
	onDeleteRule: (ruleId: string) => void;
}) {
	const slots = getConfiguredSlots(rule);
	const fallbackLabel = getRuleFallbackLabel(data, rule);
	const labelId = `style-dialog-${slugify(rule.id)}-label`;

	return (
		<div className="space-y-3 rounded-lg border bg-background/70 p-3">
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1 space-y-2">
					<Field label="Rule Label" id={labelId}>
						<Input
							id={labelId}
							value={rule.label}
							onChange={(event) => onUpdateRuleLabel(rule.id, event.target.value)}
						/>
					</Field>

					<div className="flex flex-wrap gap-1.5">
						<Badge variant="secondary">{getTargetLabel(data, rule.target)}</Badge>
						{slots.map((slot) => (
							<Badge key={slot} variant="outline">
								{getSlotLabel(slot)}
							</Badge>
						))}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-1 pt-7">
					<Switch
						size="sm"
						checked={rule.enabled}
						aria-label={`Toggle ${rule.label || fallbackLabel}`}
						onCheckedChange={(checked) => onToggleRule(rule.id, checked)}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Delete ${rule.label || fallbackLabel}`}
						onClick={() => onDeleteRule(rule.id)}
					>
						<TrashSimpleIcon />
					</Button>
				</div>
			</div>

			{slots.map((slot) => (
				<RuleIntentEditor
					key={slot}
					idPrefix={`style-dialog-${slugify(rule.id)}-${slot}`}
					intent={rule.slots[slot] ?? {}}
					labelPrefix="Dialog"
					onChange={(patch) => onUpdateRuleIntent(rule.id, slot, patch)}
				/>
			))}
		</div>
	);
}

function RuleIntentEditor({
	idPrefix,
	intent,
	labelPrefix,
	onChange,
}: {
	idPrefix: string;
	intent: StyleIntent;
	labelPrefix?: string;
	onChange: (patch: Partial<StyleIntent>) => void;
}) {
	const labelStart = labelPrefix ? `${labelPrefix} ` : "";

	return (
		<div className="space-y-3">
			<ControlPanel title="Color">
				<div className="grid @md:grid-cols-2 grid-cols-1 gap-3">
					<ColorField
						label={`${labelStart}Text Color`}
						id={`${idPrefix}-color`}
						value={intent.color}
						placeholder="rgba(0, 0, 0, 1)"
						fallback="rgba(0, 0, 0, 1)"
						onChange={(color) => onChange({ color })}
					/>
					<ColorField
						label={`${labelStart}Background`}
						id={`${idPrefix}-background`}
						value={intent.backgroundColor}
						placeholder="rgba(255, 255, 255, 1)"
						fallback="rgba(255, 255, 255, 1)"
						onChange={(backgroundColor) => onChange({ backgroundColor })}
					/>
					<ColorField
						label={`${labelStart}Text Decoration Color`}
						id={`${idPrefix}-text-decoration-color`}
						value={intent.textDecorationColor}
						placeholder="rgba(0, 0, 0, 1)"
						fallback="rgba(0, 0, 0, 1)"
						onChange={(textDecorationColor) => onChange({ textDecorationColor })}
					/>
					<NumberInput
						label={`${labelStart}Opacity`}
						id={`${idPrefix}-opacity`}
						value={intent.opacity}
						min={0}
						max={1}
						step={0.05}
						onChange={(opacity) => onChange({ opacity })}
					/>
				</div>
			</ControlPanel>

			<ControlPanel title="Text">
				<div className="grid @md:grid-cols-2 grid-cols-1 gap-3">
					<NumberInput
						label={`${labelStart}Font Size`}
						id={`${idPrefix}-font-size`}
						value={intent.fontSize}
						min={6}
						max={48}
						onChange={(fontSize) => onChange({ fontSize })}
					/>
					<FontWeightField
						label={`${labelStart}Font Weight`}
						id={`${idPrefix}-font-weight`}
						value={intent.fontWeight}
						onChange={(fontWeight) => onChange({ fontWeight })}
					/>
					<IntentSelectField
						label={`${labelStart}Font Style`}
						id={`${idPrefix}-font-style`}
						value={intent.fontStyle}
						options={fontStyleOptions}
						onChange={(fontStyle) => onChange({ fontStyle })}
					/>
					<NumberInput
						label={`${labelStart}Line Height`}
						id={`${idPrefix}-line-height`}
						value={intent.lineHeight}
						min={0.5}
						max={4}
						step={0.05}
						onChange={(lineHeight) => onChange({ lineHeight })}
					/>
					<NumberInput
						label={`${labelStart}Letter Spacing`}
						id={`${idPrefix}-letter-spacing`}
						value={intent.letterSpacing}
						min={-16}
						max={16}
						step={0.1}
						onChange={(letterSpacing) => onChange({ letterSpacing })}
					/>
					<IntentSelectField
						label={`${labelStart}Text Decoration`}
						id={`${idPrefix}-text-decoration`}
						value={intent.textDecoration}
						options={textDecorationOptions}
						onChange={(textDecoration) => onChange({ textDecoration })}
					/>
					<IntentSelectField
						label={`${labelStart}Decoration Style`}
						id={`${idPrefix}-text-decoration-style`}
						value={intent.textDecorationStyle}
						options={textDecorationStyleOptions}
						onChange={(textDecorationStyle) => onChange({ textDecorationStyle })}
					/>
					<IntentSelectField
						label={`${labelStart}Text Align`}
						id={`${idPrefix}-text-align`}
						value={intent.textAlign}
						options={textAlignOptions}
						onChange={(textAlign) => onChange({ textAlign })}
					/>
					<IntentSelectField
						label={`${labelStart}Text Transform`}
						id={`${idPrefix}-text-transform`}
						value={intent.textTransform}
						options={textTransformOptions}
						onChange={(textTransform) => onChange({ textTransform })}
					/>
				</div>
			</ControlPanel>

			<ControlPanel title="Spacing">
				<div className="space-y-4">
					<ControlSubsection title="Padding">
						<PaddingSideInputs idPrefix={idPrefix} intent={intent} labelPrefix={labelPrefix} onChange={onChange} />
					</ControlSubsection>
					<ControlSubsection title="Margin">
						<MarginSideInputs idPrefix={idPrefix} intent={intent} labelPrefix={labelPrefix} onChange={onChange} />
					</ControlSubsection>
					<ControlSubsection title="Gap">
						<div className="grid @md:grid-cols-2 grid-cols-1 gap-3">
							<NumberInput
								label={`${labelStart}Row Gap`}
								id={`${idPrefix}-row-gap`}
								value={intent.rowGap}
								min={-72}
								max={72}
								onChange={(rowGap) => onChange({ rowGap })}
							/>
							<NumberInput
								label={`${labelStart}Column Gap`}
								id={`${idPrefix}-column-gap`}
								value={intent.columnGap}
								min={-72}
								max={72}
								onChange={(columnGap) => onChange({ columnGap })}
							/>
						</div>
					</ControlSubsection>
				</div>
			</ControlPanel>

			<ControlPanel title="Border">
				<div className="grid @md:grid-cols-3 grid-cols-1 gap-3">
					<IntentSelectField
						label={`${labelStart}Border Style`}
						id={`${idPrefix}-border-style`}
						value={intent.borderStyle}
						options={borderStyleOptions}
						onChange={(borderStyle) => onChange({ borderStyle })}
					/>
					<NumberInput
						label={`${labelStart}Border Width`}
						id={`${idPrefix}-border-width`}
						value={intent.borderWidth}
						min={0}
						max={24}
						onChange={(borderWidth) => onChange({ borderWidth })}
					/>
					<NumberInput
						label={`${labelStart}Border Radius`}
						id={`${idPrefix}-border-radius`}
						value={intent.borderRadius}
						min={0}
						max={72}
						onChange={(borderRadius) => onChange({ borderRadius })}
					/>
					<ColorField
						label={`${labelStart}Border Color`}
						id={`${idPrefix}-border-color`}
						value={intent.borderColor}
						placeholder="rgba(0, 0, 0, 1)"
						fallback="rgba(0, 0, 0, 1)"
						onChange={(borderColor) => onChange({ borderColor })}
					/>
				</div>
			</ControlPanel>
		</div>
	);
}

function ControlPanel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3 rounded-lg border bg-muted/10 p-3">
			<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{title}</h3>
			{children}
		</section>
	);
}

function ControlSubsection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="space-y-2">
			<div className="font-medium text-muted-foreground text-xs">{title}</div>
			{children}
		</div>
	);
}

function IntentSelectField<TValue extends string>({
	label,
	id,
	value,
	options,
	onChange,
}: {
	label: string;
	id: string;
	value: TValue | undefined;
	options: readonly { value: TValue; label: string }[];
	onChange: (value: TValue | undefined) => void;
}) {
	return (
		<Field label={label} id={id}>
			<Select
				id={id}
				value={value ?? ""}
				onChange={(event) => onChange((event.target.value || undefined) as TValue | undefined)}
			>
				<option value="">Default</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</Select>
		</Field>
	);
}

function FontWeightField({
	label,
	id,
	value,
	onChange,
}: {
	label: string;
	id: string;
	value: StyleIntent["fontWeight"] | undefined;
	onChange: (value: StyleIntent["fontWeight"] | undefined) => void;
}) {
	return (
		<Field label={label} id={id}>
			<Select
				id={id}
				value={value ?? ""}
				onChange={(event) => onChange((event.target.value || undefined) as StyleIntent["fontWeight"] | undefined)}
			>
				<option value="">Default</option>
				{fontWeightOptions.map((weight) => (
					<option key={weight} value={weight}>
						{weight}
					</option>
				))}
			</Select>
		</Field>
	);
}

const paddingSideOptions = [
	{ property: "paddingTop", label: "Top" },
	{ property: "paddingRight", label: "Right" },
	{ property: "paddingBottom", label: "Bottom" },
	{ property: "paddingLeft", label: "Left" },
] as const;

type PaddingSideProperty = (typeof paddingSideOptions)[number]["property"];

const marginSideOptions = [
	{ property: "marginTop", label: "Top" },
	{ property: "marginRight", label: "Right" },
	{ property: "marginBottom", label: "Bottom" },
	{ property: "marginLeft", label: "Left" },
] as const;

type MarginSideProperty = (typeof marginSideOptions)[number]["property"];

function PaddingSideInputs({
	idPrefix,
	intent,
	labelPrefix,
	onChange,
}: {
	idPrefix: string;
	intent: StyleIntent;
	labelPrefix?: string;
	onChange: (patch: Partial<StyleIntent>) => void;
}) {
	const labelStart = labelPrefix ? `${labelPrefix} ` : "";

	return (
		<div className="grid @lg:grid-cols-4 grid-cols-2 gap-3">
			{paddingSideOptions.map((side) => (
				<NumberInput
					key={side.property}
					label={`${labelStart}Padding ${side.label}`}
					id={`${idPrefix}-${side.property}`}
					value={getPaddingSideValue(intent, side.property)}
					min={-72}
					max={72}
					onChange={(value) => onChange(createPaddingSidePatch(intent, side.property, value))}
				/>
			))}
		</div>
	);
}

function MarginSideInputs({
	idPrefix,
	intent,
	labelPrefix,
	onChange,
}: {
	idPrefix: string;
	intent: StyleIntent;
	labelPrefix?: string;
	onChange: (patch: Partial<StyleIntent>) => void;
}) {
	const labelStart = labelPrefix ? `${labelPrefix} ` : "";

	return (
		<div className="grid @lg:grid-cols-4 grid-cols-2 gap-3">
			{marginSideOptions.map((side) => (
				<NumberInput
					key={side.property}
					label={`${labelStart}Margin ${side.label}`}
					id={`${idPrefix}-${side.property}`}
					value={intent[side.property]}
					min={-72}
					max={72}
					onChange={(value) => onChange(createMarginSidePatch(side.property, value))}
				/>
			))}
		</div>
	);
}

function getPaddingSideValue(intent: StyleIntent, property: PaddingSideProperty) {
	return intent[property] ?? intent.padding;
}

function createPaddingSidePatch(
	intent: StyleIntent,
	property: PaddingSideProperty,
	value: number | undefined,
): Partial<StyleIntent> {
	if (intent.padding === undefined) return { [property]: value };

	const patch: Partial<StyleIntent> = { padding: undefined };

	for (const side of paddingSideOptions) {
		patch[side.property] = intent[side.property] ?? intent.padding;
	}

	patch[property] = value;

	return patch;
}

function createMarginSidePatch(property: MarginSideProperty, value: number | undefined): Partial<StyleIntent> {
	return { [property]: value };
}

function RulePropertySummary({ intent }: { intent: StyleIntent }) {
	const properties = [
		intent.color && { label: "Text", value: intent.color, color: intent.color },
		intent.backgroundColor && { label: "Background", value: intent.backgroundColor, color: intent.backgroundColor },
		intent.textDecorationColor && {
			label: "Decoration",
			value: intent.textDecorationColor,
			color: intent.textDecorationColor,
		},
		intent.borderColor && { label: "Border", value: intent.borderColor, color: intent.borderColor },
		intent.opacity !== undefined && { label: "Opacity", value: `${intent.opacity}` },
		intent.fontSize && { label: "Size", value: `${intent.fontSize}` },
		intent.fontWeight && { label: "Weight", value: intent.fontWeight },
		intent.fontStyle && { label: "Style", value: intent.fontStyle },
		intent.lineHeight !== undefined && { label: "Line", value: `${intent.lineHeight}` },
		intent.letterSpacing !== undefined && { label: "Tracking", value: `${intent.letterSpacing}` },
		intent.textDecoration && { label: "Decoration", value: intent.textDecoration },
		intent.textDecorationStyle && { label: "Decoration Style", value: intent.textDecorationStyle },
		intent.textAlign && { label: "Align", value: intent.textAlign },
		intent.textTransform && { label: "Transform", value: intent.textTransform },
		getPaddingSummary(intent) && { label: "Padding", value: getPaddingSummary(intent) },
		getMarginSummary(intent) && { label: "Margin", value: getMarginSummary(intent) },
		getGapSummary(intent) && { label: "Gap", value: getGapSummary(intent) },
		intent.borderStyle && { label: "Border Style", value: intent.borderStyle },
		intent.borderWidth !== undefined && { label: "Border Width", value: `${intent.borderWidth}` },
		intent.borderRadius !== undefined && { label: "Radius", value: `${intent.borderRadius}` },
	].filter(Boolean) as { label: string; value: string; color?: string }[];

	if (properties.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5 text-muted-foreground text-xs">
			{properties.map((property) => (
				<span
					key={`${property.label}-${property.value}`}
					className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5"
				>
					{property.color && (
						<span
							className="size-2.5 shrink-0 rounded-full border border-foreground/20"
							style={{ backgroundColor: property.color }}
						/>
					)}
					<span>{property.label}</span>
					<span className="max-w-32 truncate font-mono">{property.value}</span>
				</span>
			))}
		</div>
	);
}

function getPaddingSummary(intent: StyleIntent) {
	if (intent.padding !== undefined) return `All ${intent.padding}`;

	const sideValues = paddingSideOptions.flatMap((side) => {
		const value = intent[side.property];
		if (value === undefined) return [];

		return [`${side.label.at(0)} ${value}`];
	});

	return sideValues.length > 0 ? sideValues.join(" / ") : undefined;
}

function getMarginSummary(intent: StyleIntent) {
	const sideValues = marginSideOptions.flatMap((side) => {
		const value = intent[side.property];
		if (value === undefined) return [];

		return [`${side.label.at(0)} ${value}`];
	});

	return sideValues.length > 0 ? sideValues.join(" / ") : undefined;
}

function getGapSummary(intent: StyleIntent) {
	const values = [
		intent.rowGap !== undefined && `Row ${intent.rowGap}`,
		intent.columnGap !== undefined && `Column ${intent.columnGap}`,
	].filter(Boolean);

	return values.length > 0 ? values.join(" / ") : undefined;
}

function createTarget({
	targetScope,
	sectionType,
	sectionId,
}: {
	targetScope: TargetScope;
	sectionType: string;
	sectionId: string;
}): StyleRuleTarget {
	if (targetScope === "sectionType") {
		return {
			scope: "sectionType",
			sectionType: sectionType as Extract<StyleRuleTarget, { scope: "sectionType" }>["sectionType"],
		};
	}
	if (targetScope === "sectionId") return { scope: "sectionId", sectionId };

	return { scope: "global" };
}

function getStyleRuleId(target: StyleRuleTarget, slot: StyleSlot) {
	if (target.scope === "global") return `style-global-${slot}`;
	if (target.scope === "sectionType") return `style-section-type-${target.sectionType}-${slot}`;

	return `style-section-id-${slugify(target.sectionId)}-${slot}`;
}

function getSlotLabel(slot: StyleSlot) {
	return styleSlotOptions.find((option) => option.value === slot)?.label ?? slot;
}

function getTargetLabel(data: ResumeData, target: StyleRuleTarget) {
	if (target.scope === "global") return "All sections";
	if (target.scope === "sectionType") return getSectionTitle(target.sectionType);

	return getSectionIdOptions(data).find((option) => option.value === target.sectionId)?.label ?? target.sectionId;
}

function getRuleFallbackLabel(data: ResumeData, rule: StyleRule) {
	const slots = getConfiguredSlots(rule);
	const slot = slots[0];
	return `${getTargetLabel(data, rule.target)}${slot ? `: ${getSlotLabel(slot)}` : ""}`;
}

function getConfiguredSlots(rule: StyleRule): StyleSlot[] {
	const slots: StyleSlot[] = [];

	for (const option of styleSlotOptions) {
		if (hasIntent(rule.slots[option.value])) slots.push(option.value);
	}

	return slots;
}

function getSectionIdOptions(data: ResumeData) {
	return [
		{ value: "summary", label: data.summary?.title || getSectionTitle("summary") },
		...Object.entries(data.sections).map(([section, value]) => ({
			value: section,
			label: value.title || getSectionTitle(section as keyof ResumeData["sections"]),
		})),
		...data.customSections.map((section) => ({
			value: section.id,
			label: section.title || getSectionTitle(section.type),
		})),
	];
}

function compactIntent(intent: Partial<StyleIntent>): StyleIntent {
	return Object.fromEntries(
		Object.entries(intent).filter(([, value]) => value !== undefined && value !== ""),
	) as StyleIntent;
}

function hasIntent(intent: StyleIntent | undefined) {
	return Boolean(intent && Object.keys(intent).length > 0);
}

function slugify(value: string) {
	return value
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")
		.toLowerCase();
}
