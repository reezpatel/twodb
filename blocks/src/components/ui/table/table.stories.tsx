import type { Meta, StoryObj } from "@storybook/react-vite";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta = {
  title: "Blocks/UI/Table",
  component: Table,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROWS = [
  { name: "Ion beam", state: "running", power: "12 kW" },
  { name: "Tritium target", state: "idle", power: "—" },
  { name: "Transmute stage", state: "running", power: "8 kW" },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Part</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Power</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((r) => (
          <TableRow key={r.name}>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.state}</TableCell>
            <TableCell className="text-right">{r.power}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
