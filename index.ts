import Polka from "polka"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { version } from "./package.json"
import { toolRegistry } from "./tools/index"

// Check for API key after handling list-tools to allow listing without a key
const API_KEY = process.env.EXA_API_KEY
if (!API_KEY) {
  throw new Error("EXA_API_KEY environment variable is required")
}

const server = new McpServer(
  {
    name: "exa-mcp",
    version,
  },
  {
    capabilities: {
      logging: {},
    },
  }
)

server.tool(
  toolRegistry.web_search.name,
  toolRegistry.web_search.description,
  toolRegistry.web_search.schema,
  toolRegistry.web_search.handler
)

if (process.argv.includes("--sse")) {
  const transports = new Map<string, SSEServerTransport>()
  const port = Number(process.env.PORT || "3000")
  const API_TOKEN = process.env.API_TOKEN

  const app = Polka()

  async function authenticate(req: any, res: any, next: any) {
    if (!API_TOKEN) {
      return (res.statusCode = 401), res.end("Unauthorized: No API_TOKEN!")
    }
    const token = req.headers["authorization"]
    console.log("🔑 token:", token)
    if (!token)
      return (res.statusCode = 401), res.end("Unauthorized: No request token!")
    if (token !== `Bearer ${API_TOKEN}`) {
      return (res.statusCode = 401), res.end("Unauthorized: Invalid token!")
    }
    next()
  }

  app.use(authenticate).get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res)
    transports.set(transport.sessionId, transport)
    res.on("close", () => {
      transports.delete(transport.sessionId)
    })
    await server.connect(transport)
  })

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string
    const transport = transports.get(sessionId)
    if (transport) {
      await transport.handlePostMessage(req, res)
    } else {
      res.status(400).send("No transport found for sessionId")
    }
  })

  app.listen(port)
  console.log(`sse server: http://localhost:${port}/sse`)
} else {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
