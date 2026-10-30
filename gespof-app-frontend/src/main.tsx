import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-700.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-ext-700.css";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
