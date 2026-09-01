import { AppProvider } from "./store";
import { Shell } from "./components/Shell";

/**
 * LifeLog — a private, local-first life-logging system.
 * The AppProvider decrypts the at-rest state (or seeds first-run data),
 * then the Shell renders the active layout mode and view.
 */
export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
