import { mount } from "svelte";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App.svelte";
import Widget from "./Widget.svelte";
import "./app.css";

// Same page for the overlay and the screen widgets (windows "widget-<kind>").
const isWidget = getCurrentWindow().label.startsWith("widget-");
const app = mount(isWidget ? Widget : App, { target: document.getElementById("app")! });

export default app;
