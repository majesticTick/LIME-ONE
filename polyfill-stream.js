// Minimal polyfills for Parcel reporter: fetch/Request and Readable.toWeb/fromWeb.
// Some Node builds ship without these helpers; Parcel expects them.
try {
  // Ensure Web Streams globals exist before loading undici
  const web = require("stream/web");
  if (web.ReadableStream && !globalThis.ReadableStream) globalThis.ReadableStream = web.ReadableStream;
  if (web.WritableStream && !globalThis.WritableStream) globalThis.WritableStream = web.WritableStream;
  if (web.TransformStream && !globalThis.TransformStream) globalThis.TransformStream = web.TransformStream;

  if (typeof globalThis.Request !== "function") {
    const { fetch, Request, Response, Headers } = require("undici");
    if (fetch) globalThis.fetch = fetch;
    if (Request) globalThis.Request = Request;
    if (Response) globalThis.Response = Response;
    if (Headers) globalThis.Headers = Headers;
  }
} catch (e) {
  // ignore
}

// stream polyfill
try {
  const stream = require("stream");
  const web = require("stream/web");

  if (stream?.Readable && !stream.Readable.toWeb) {
    stream.Readable.toWeb = function toWeb(readable) {
      const { ReadableStream } = web;
      return new ReadableStream({
        start(controller) {
          readable.on("data", (chunk) => controller.enqueue(chunk));
          readable.on("end", () => controller.close());
          readable.on("error", (err) => controller.error(err));
        },
        cancel() {
          if (readable.destroy) readable.destroy();
        }
      });
    };
  }

  if (stream?.Readable && !stream.Readable.fromWeb) {
    stream.Readable.fromWeb = function fromWeb(readableStream) {
      const reader = readableStream.getReader();
      return stream.Readable.from((async function* () {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield value;
          }
        } finally {
          reader.releaseLock();
        }
      })());
    };
  }
} catch (e) {
  // If anything fails, we just continue without polyfilling.
}
