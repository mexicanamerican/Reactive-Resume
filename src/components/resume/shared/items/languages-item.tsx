import type { SectionItem } from "@/schema/resume/data";
import { cn } from "@/utils/style";
import { PageLevel } from "../page-level";

type LanguagesItemProps = SectionItem<"languages"> & {
	className?: string;
};

export function LanguagesItem({ className, ...item }: LanguagesItemProps) {
	return (
		<div className={cn("languages-item", className)}>
			<div className="section-item-header">
				<p className="section-item-title languages-item-name">
					<strong>{item.language}</strong>
				</p>
				<p className="section-item-metadata languages-item-fluency opacity-80">{item.fluency}</p>
			</div>

			<PageLevel level={item.level} className="section-item-level languages-item-level" />
		</div>
	);
}
