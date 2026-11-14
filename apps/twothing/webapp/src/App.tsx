import { Frame } from "./shell/Frame";
import { Routes } from "./shell/Routes";
import { ScanProvider } from "./scanner/ScanProvider";
import { Toaster } from "./ui/Toaster";

/**
 * Scanner provider → responsive frame → hash routes.
 * Sign-in is handled outside, by RequireTwoDbAuth in main.tsx (central TwoDB login).
 */
export function App() {
  return (
    <ScanProvider>
      <Frame>
        <Routes />
      </Frame>
      <Toaster />
    </ScanProvider>
  );
}
