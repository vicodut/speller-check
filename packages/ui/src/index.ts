// Shared React primitives with the shadcn look. Styles: import "@gc/ui/theme.css" in the page's
// Tailwind entry. Shadow DOM UI uses "@gc/ui/shadow-theme" instead.
export { Alert, AlertDescription, AlertTitle } from "./components/alert";
export { type AlertVariants, alertVariants } from "./components/alert.variants";
export { Badge } from "./components/badge";
export { type BadgeVariants, badgeVariants } from "./components/badge.variants";
export { Button } from "./components/button";
export { type ButtonVariants, buttonVariants } from "./components/button.variants";
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/card";
export { cn } from "./components/cn.util";
export { Input } from "./components/input";
export { Label } from "./components/label";
export { NativeSelect } from "./components/native-select";
export { Progress } from "./components/progress";
export { StatusDot, type StatusTone } from "./components/status-dot";
export { Textarea } from "./components/textarea";
