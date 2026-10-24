import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme, type ThemePreference } from "@/lib/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System (follow browser)" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function GeneralSection() {
  const { preference, setTheme } = useTheme();

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>appearance and app preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-muted-foreground text-xs">
              Light or dark. “System” follows your browser theme.
            </p>
          </div>
          <Select value={preference} onValueChange={(value) => setTheme(value as ThemePreference)}>
            <SelectTrigger className="w-44" aria-label="Theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}