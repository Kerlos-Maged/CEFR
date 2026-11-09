import type { Instrumentation } from "next";

/** Emit request failures as structured, privacy-minimized logs for the hosting log pipeline. */
export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  console.error(
    JSON.stringify({
      event: "next_request_error",
      timestamp: new Date().toISOString(),
      route: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      digest,
    }),
  );
};
