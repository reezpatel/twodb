import { useState } from "react";
import { Check } from "lucide-react";
import "./clock-planner";

/* ---------- Types ---------- */

interface TimeBlock {
	id: string;
	startHour: number;
	endHour: number;
	label: string;
	position:
		| "top-right"
		| "right"
		| "bottom-right"
		| "bottom-left"
		| "left"
		| "top-left";
	color: "rose" | "go" | "warning" | "cobalt" | "purple" | "teal";
}

interface TodoItem {
	id: string;
	title: string;
	priority: "A" | "B" | "C";
	done: boolean;
}

interface SupplyItem {
	id: string;
	text: string;
}

/* ---------- Data ---------- */

const TIME_BLOCKS: TimeBlock[] = [
	{
		id: "1",
		startHour: 12,
		endHour: 1,
		label: "Lunch with Jeff",
		position: "top-right",
		color: "go",
	},
	{
		id: "2",
		startHour: 2,
		endHour: 3,
		label: "Meet with Printer",
		position: "right",
		color: "cobalt",
	},
	{
		id: "3",
		startHour: 4,
		endHour: 4.5,
		label: "Post to Blog",
		position: "bottom-right",
		color: "purple",
	},
	{
		id: "4",
		startHour: 7,
		endHour: 8,
		label: "Work on TPS Reports",
		position: "bottom-left",
		color: "warning",
	},
	{
		id: "5",
		startHour: 9,
		endHour: 10,
		label: "Work on Project",
		position: "left",
		color: "teal",
	},
	{
		id: "6",
		startHour: 10,
		endHour: 11.5,
		label: "Sales Rep Conference Call",
		position: "top-left",
		color: "rose",
	},
];

const INITIAL_TODOS: TodoItem[] = [
	{ id: "1", title: "Update Flow Chart", priority: "A", done: true },
	{ id: "2", title: "Clean-up email folder", priority: "B", done: false },
	{ id: "3", title: "Select Virtual Assistant", priority: "B", done: true },
	{
		id: "4",
		title: "Finish eNewsletter (Post Jan 8)",
		priority: "A",
		done: false,
	},
	{ id: "5", title: "Review quarterly reports", priority: "A", done: false },
	{ id: "6", title: "Schedule team standup", priority: "C", done: false },
];

const SUPPLIES: SupplyItem[] = [
	{ id: "1", text: "Get new red stapler" },
	{ id: "2", text: "Purchase computer printer" },
	{ id: "3", text: "Order office supplies" },
];

/* ---------- Helpers ---------- */

/**
 * Convert hour to angle (12 o'clock = -90 degrees, clockwise)
 */
function hourToAngle(hour: number): number {
	return (hour / 12) * 360 - 90;
}

/**
 * Generate SVG arc path for a time block
 */
function describeArc(
	cx: number,
	cy: number,
	radius: number,
	startHour: number,
	endHour: number,
): string {
	// Handle wrap-around (e.g., 11 to 1)
	const start = startHour;
	let end = endHour;
	if (end <= start) {
		end += 12;
	}

	const startAngle = hourToAngle(start);
	const endAngle = hourToAngle(end);

	const startRad = (startAngle * Math.PI) / 180;
	const endRad = (endAngle * Math.PI) / 180;

	const x1 = cx + radius * Math.cos(startRad);
	const y1 = cy + radius * Math.sin(startRad);
	const x2 = cx + radius * Math.cos(endRad);
	const y2 = cy + radius * Math.sin(endRad);

	const largeArc = end - start > 6 ? 1 : 0;

	return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/* ---------- Components ---------- */

function ClockFace({ blocks }: { blocks: TimeBlock[] }) {
	const size = 380;
	const center = size / 2;
	const faceRadius = 140;
	const arcRadius = 165;
	const numberRadius = 110;

	// Hour numbers and marks
	const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

	return (
		<svg
			className="mock-clock-planner__clock"
			viewBox={`0 0 ${size} ${size}`}
			aria-label="Clock planner"
		>
			{/* Clock face */}
			<circle
				className="mock-clock-planner__clock-face"
				cx={center}
				cy={center}
				r={faceRadius}
			/>

			{/* Hour lines from center */}
			{hours.map((hour) => {
				const angle = hourToAngle(hour);
				const rad = (angle * Math.PI) / 180;
				const x2 = center + faceRadius * Math.cos(rad);
				const y2 = center + faceRadius * Math.sin(rad);
				return (
					<line
						key={`line-${hour}`}
						className="mock-clock-planner__hour-line"
						x1={center}
						y1={center}
						x2={x2}
						y2={y2}
					/>
				);
			})}

			{/* Time block arcs */}
			{blocks.map((block) => (
				<path
					key={block.id}
					className={`mock-clock-planner__time-block mock-clock-planner__time-block--${block.color}`}
					d={describeArc(
						center,
						center,
						arcRadius,
						block.startHour,
						block.endHour,
					)}
				/>
			))}

			{/* Hour numbers */}
			{hours.map((hour) => {
				const angle = hourToAngle(hour);
				const rad = (angle * Math.PI) / 180;
				const x = center + numberRadius * Math.cos(rad);
				const y = center + numberRadius * Math.sin(rad);
				return (
					<text
						key={`num-${hour}`}
						className="mock-clock-planner__hour-number"
						x={x}
						y={y}
					>
						{hour}
					</text>
				);
			})}

			{/* Center dot */}
			<circle
				className="mock-clock-planner__clock-center"
				cx={center}
				cy={center}
				r={6}
			/>
		</svg>
	);
}

function TaskLabels({ blocks }: { blocks: TimeBlock[] }) {
	return (
		<>
			{blocks.map((block) => (
				<div
					key={block.id}
					className={`mock-clock-planner__task-label mock-clock-planner__task-label--${block.position} mock-clock-planner__task-label--${block.color}`}
				>
					{block.label}
				</div>
			))}
		</>
	);
}

function TodoList({
	todos,
	onToggle,
}: {
	todos: TodoItem[];
	onToggle: (id: string) => void;
}) {
	return (
		<div className="mock-clock-planner__todos">
			<div className="mock-clock-planner__todo-header">
				<span>✓</span>
				<span>Pri</span>
				<span>Task</span>
			</div>
			{todos.map((todo) => (
				<div
					key={todo.id}
					className={`mock-clock-planner__todo-row${todo.done ? " is-done" : ""}`}
				>
					<div className="mock-clock-planner__todo-check">
						<span
							className={`mock-clock-planner__checkbox${todo.done ? " is-checked" : ""}`}
							onClick={() => onToggle(todo.id)}
						>
							{todo.done && <Check aria-hidden="true" />}
						</span>
					</div>
					<div
						className={`mock-clock-planner__todo-priority mock-clock-planner__todo-priority--${todo.priority.toLowerCase()}`}
					>
						{todo.priority}
					</div>
					<div className="mock-clock-planner__todo-title">{todo.title}</div>
				</div>
			))}
		</div>
	);
}

function SuppliesList({ items }: { items: SupplyItem[] }) {
	return (
		<div className="mock-clock-planner__supplies">
			<div className="mock-clock-planner__supplies-title">Supplies</div>
			{items.map((item) => (
				<div key={item.id} className="mock-clock-planner__supply-item">
					{item.text}
				</div>
			))}
		</div>
	);
}

/* ---------- Main Component ---------- */

export function ClockPlannerMock() {
	const [todos, setTodos] = useState(INITIAL_TODOS);

	const today = new Date();
	const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
	const dateStr = today.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	function toggleTodo(id: string) {
		setTodos((ts) =>
			ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
		);
	}

	return (
		<div className="mock-clock-planner">
			{/* Header */}
			<header className="mock-clock-planner__header">
				<div>
					<div className="mock-clock-planner__day">{dayName}</div>
					<div className="mock-clock-planner__labels">
						<span className="mock-clock-planner__label">Day</span>
					</div>
				</div>
				<div>
					<div className="mock-clock-planner__date">{dateStr}</div>
					<div className="mock-clock-planner__labels">
						<span className="mock-clock-planner__label">Date</span>
					</div>
				</div>
			</header>

			{/* Clock */}
			<section className="mock-clock-planner__clock-section">
				<div className="mock-clock-planner__clock-container">
					<ClockFace blocks={TIME_BLOCKS} />
					<TaskLabels blocks={TIME_BLOCKS} />
				</div>
			</section>

			{/* Todo List */}
			<TodoList todos={todos} onToggle={toggleTodo} />

			{/* Supplies */}
			<SuppliesList items={SUPPLIES} />
		</div>
	);
}
