import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { dataStore } from "./data.js";
import { registerTools } from "./tools.js";

async function main() {
  console.log("Inicializando o servidor MCP Sankhya...");
  
  // Carrega os dados na memória (Flow e Dicionário)
  await dataStore.loadData();

  // Criação do servidor MCP
  const mcp = new McpServer({
    name: "Sankhya-MCP-Server",
    version: "1.0.0",
  });

  // Registra as ferramentas (tools)
  registerTools(mcp);

  // Configuração do Express para o transporte SSE
  const app = express();
  app.use(cors());

  // Mapa para manter múltiplas sessões (Ex: Inspector e Cursor ao mesmo tempo)
  const transports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (req, res) => {
    console.log("Novo cliente conectado via SSE.");
    const pathId = require("crypto").randomUUID();
    const transport = new SSEServerTransport(`/messages/${pathId}`, res);
    await mcp.server.connect(transport);
    
    transports.set(pathId, transport);
    res.on("close", () => {
      console.log(`Cliente desconectado: ${pathId}`);
      transports.delete(pathId);
    });
  });

  app.post("/messages/:pathId", async (req, res) => {
    const pathId = req.params.pathId;
    const transport = transports.get(pathId);
    
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor MCP Sankhya rodando via SSE na porta ${PORT}`);
    console.log(`Endpoint SSE: http://localhost:${PORT}/sse`);
    console.log(`Endpoint Messages: http://localhost:${PORT}/messages`);
  });
}

main().catch(console.error);
