"use client";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import type { ReactNode } from "react";
export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {[...new Set(options.filter(o => o.trim()))].map((o) => (
          <SelectItem value={o} key={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Hint({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-80">{text}</TooltipContent>
    </Tooltip>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (/Replied|Interested|Opportunity|Verified|Positive|Complete/.test(value)
          ? "green"
          : /Follow|Waiting|Due|Review/.test(value)
            ? "amber"
            : "")
      }
    >
      {value}
    </span>
  );
}
export function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
}
export function dateLabel(date: string | null) {
  return date
    ? new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "Not recorded";
}
export type Navigate = (route: string, filter?: string) => void;
