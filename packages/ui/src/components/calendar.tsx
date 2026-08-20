import type { DayPickerProps } from "react-day-picker";
import { DayPicker } from "react-day-picker";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { calendarStyles } from "./calendar.style";

export type CalendarProps = DayPickerProps;

/** Skinned react-day-picker. Behavior (keyboard, a11y, range math) is headless; the skin is ours. */
export function Calendar(props: CalendarProps) {
  return (
    <div className="tw-cal">
			<style jsx>{calendarStyles}</style>
      <DayPicker
        weekStartsOn={1}
        showOutsideDays
        components={{
          Chevron: ({ orientation }) => {
            if (orientation === "left") return <ChevronLeft />;
            if (orientation === "right") return <ChevronRight />;
            if (orientation === "up") return <ChevronUp />;
            return <ChevronDown />;
          },
        }}
        {...props}
      />
    </div>
  );
}
