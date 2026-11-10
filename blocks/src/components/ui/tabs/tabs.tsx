import * as React from "react";
import { cn } from "../../../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

const tabsListVariants = cva("flex shrink-0 items-center", {
  variants: {
    variant: {
      default: "bg-stone p-1",
      button: "",
      line: "border-b border-outline",
    },
    shape: {
      default: "",
      pill: "",
    },
    size: {
      lg: "gap-2",
      md: "gap-1.5",
      sm: "gap-1",
      xs: "gap-0.5",
    },
  },
  compoundVariants: [
    { variant: "default", size: "lg", className: "p-1.5 gap-2 rounded-[10px]" },
    { variant: "default", size: "md", className: "p-1 gap-1.5 rounded-[8px]" },
    { variant: "default", size: "sm", className: "p-1 gap-1 rounded-[6px]" },
    { variant: "default", size: "xs", className: "p-0.5 gap-0.5 rounded-[6px]" },

    { variant: "line", size: "lg", className: "gap-6" },
    { variant: "line", size: "md", className: "gap-5" },
    { variant: "line", size: "sm", className: "gap-4" },
    { variant: "line", size: "xs", className: "gap-3" },

    { variant: "default", shape: "pill", className: "rounded-full [&_[role=tab]]:rounded-full" },
    { variant: "button", shape: "pill", className: "rounded-full [&_[role=tab]]:rounded-full" },
  ],
  defaultVariants: { variant: "default", size: "md" },
});

const tabsTriggerVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0 [&_svg]:text-muted-foreground [&:hover_svg]:text-ink [&[data-state=active]_svg]:text-ink",
  {
    variants: {
      variant: {
        default: "text-muted-foreground hover:text-ink data-[state=active]:bg-paper data-[state=active]:text-ink",
        button: "rounded-[8px] text-ink hover:text-ink data-[state=active]:bg-stone-700 data-[state=active]:text-ink",
        line: "-mb-px border-b-2 border-transparent text-muted-foreground hover:text-ink data-[state=active]:border-ion-deep data-[state=active]:text-ink",
      },
      size: {
        lg: "gap-2 text-[15px] [&_svg]:size-4",
        md: "gap-1.5 text-[13px] [&_svg]:size-3.5",
        sm: "gap-1.5 text-[12px] [&_svg]:size-3.5",
        xs: "gap-1 text-[11px] [&_svg]:size-3",
      },
    },
    compoundVariants: [
      { variant: "default", size: "lg", className: "px-4 py-2 rounded-[8px]" },
      { variant: "default", size: "md", className: "px-3 py-1.5 rounded-[6px]" },
      { variant: "default", size: "sm", className: "px-2.5 py-1 rounded-[5px]" },
      { variant: "default", size: "xs", className: "px-2 py-0.5 rounded-[4px]" },

      { variant: "button", size: "lg", className: "px-4 py-2.5 rounded-[8px]" },
      { variant: "button", size: "md", className: "px-3 py-2 rounded-[8px]" },
      { variant: "button", size: "sm", className: "px-2.5 py-1.5 rounded-[6px]" },
      { variant: "button", size: "xs", className: "px-2 py-1 rounded-[6px]" },

      { variant: "line", size: "lg", className: "py-3" },
      { variant: "line", size: "md", className: "py-2.5" },
      { variant: "line", size: "sm", className: "py-2" },
      { variant: "line", size: "xs", className: "py-1.5" },
    ],
    defaultVariants: { variant: "default", size: "md" },
  },
);

type TabsContextType = { variant?: "default" | "button" | "line"; size?: "lg" | "sm" | "xs" | "md" };
const TabsContext = React.createContext<TabsContextType>({ variant: "default", size: "md" });

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("", className)} {...props} />;
}

function TabsList({
  className,
  variant = "default",
  shape = "default",
  size = "md",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsContext.Provider value={{ variant: variant || "default", size: size || "md" }}>
      <TabsPrimitive.List data-slot="tabs-list" className={cn(tabsListVariants({ variant, shape, size }), className)} {...props} />
    </TabsContext.Provider>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { variant, size } = React.useContext(TabsContext);
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn(tabsTriggerVariants({ variant, size }), className)} {...props} />;
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("mt-2 outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
