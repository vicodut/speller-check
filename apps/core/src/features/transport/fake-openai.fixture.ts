// Test fixture: a fake OpenAI-compatible endpoint on 127.0.0.1. It wants `Bearer sk-good`,
// knows the models "qwen-b" and "qwen-a" ("slow" answers after 600 ms), and records the
// Authorization header of every request.
export const GOOD_KEY = "sk-good";

const json = (body: unknown, status = 200) => Response.json(body, { status });

const chat = async (request: Request): Promise<Response> => {
  const body = (await request.json()) as { model?: string };
  if (body.model === "slow") await Bun.sleep(600);
  else if (body.model !== "qwen-a")
    return json({ error: { message: `model "${body.model}" not found` } }, 404);
  return json({ choices: [{ message: { content: "o" } }] });
};

export const startFakeOpenAi = () => {
  const seen: Array<string | null> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      const auth = request.headers.get("authorization");
      seen.push(auth);
      if (auth !== `Bearer ${GOOD_KEY}`) return json({ error: { message: "bad key" } }, 401);
      const { pathname } = new URL(request.url);
      if (pathname === "/v1/models")
        return json({ data: [{ id: "qwen-b" }, { id: "qwen-a" }, { id: "qwen-b" }] });
      if (pathname === "/v1/chat/completions") return chat(request);
      return json({}, 404);
    },
  });
  return {
    seen,
    baseUrl: `http://127.0.0.1:${server.port}/v1`,
    stop: () => server.stop(true),
  };
};
