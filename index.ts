import Polka from "polka"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { version } from "./package.json"
import { toolRegistry } from "./tools/index"
import { log } from "./utils/logger"

// Check for API key after handling list-tools to allow listing without a key
const API_KEY = process.env.EXA_API_KEY
if (!API_KEY) {
  throw new Error("EXA_API_KEY environment variable is required")
}

const specifiedTools = new Set<string>([
  "web_search",
  "research_paper_search",
  "twitter_search",
])

class ExaServer {
  private server: McpServer

  constructor() {
    this.server = new McpServer({
      name: "exa-search-server",
      version,
    })

    log("Server initialized")
  }

  private setupTools(): string[] {
    // Register tools based on specifications
    const registeredTools: string[] = []

    Object.entries(toolRegistry).forEach(([toolId, tool]) => {
      // If specific tools were provided, only enable those.
      // Otherwise, enable all tools marked as enabled by default
      const shouldRegister =
        specifiedTools.size > 0 ? specifiedTools.has(toolId) : tool.enabled

      if (shouldRegister) {
        this.server.tool(tool.name, tool.description, tool.schema, tool.handler)
        registeredTools.push(toolId)
      }
    })

    return registeredTools
  }

  async run(): Promise<void> {
    try {
      // Set up tools before connecting
      const registeredTools = this.setupTools()

      log(
        `Starting Exa MCP server with ${
          registeredTools.length
        } tools: ${registeredTools.join(", ")}`
      )

      const transport = new StdioServerTransport()

      // Handle connection errors
      transport.onerror = (error) => {
        log(`Transport error: ${error.message}`)
      }

      await this.server.connect(transport)
      log("Exa Search MCP server running on stdio")
    } catch (error) {
      log(
        `Server initialization error: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      throw error
    }
  }

  async connect(transport: SSEServerTransport): Promise<void> {
    await this.server.connect(transport)
  }
}
const exaServer = new ExaServer()

// Create and run the server with proper error handling
;(async () => {
  try {
    await exaServer.run()
  } catch (error) {
    log(
      `Fatal server error: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    process.exit(1)
  }
})()

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
    await exaServer.connect(transport)
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
