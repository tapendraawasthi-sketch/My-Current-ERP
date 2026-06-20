import { Suspense, lazy, useEffect, useState } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/routes/index.tsx?tsr-split=component
var App = lazy(() => import("./App-BOordijL.js"));
function ClientApp() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;
	return /* @__PURE__ */ jsx(Suspense, {
		fallback: null,
		children: /* @__PURE__ */ jsx(App, {})
	});
}
//#endregion
export { ClientApp as component };
