# exa-mcp

MCP server for [Exa](https://exa.ai/) Search API.

## Usage

Get your API Key [here](https://dashboard.exa.ai/api-keys).

### Configure manually

```bash
# stdio server
npx -y exa-mcp

# sse server
npx -y exa-mcp --sse
```

Environment variables:

```
EXA_API_KEY=<your-api-key>
```

### JSON config

```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp"],
      "env": {
        "EXA_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

## License

MIT.
