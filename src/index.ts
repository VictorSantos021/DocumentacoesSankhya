import express from "express";
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
  app.use(express.json());

  // Manteremos as sessões ativas (se suportarmos múltiplos clientes)
  let activeTransport: SSEServerTransport | null = null;

  app.get("/sse", async (req, res) => {
    console.log("Novo cliente conectado via SSE.");
    activeTransport = new SSEServerTransport("/messages", res);
    await mcp.server.connect(activeTransport);
  });

  app.post("/messages", async (req, res) => {
    if (!activeTransport) {
      res.status(400).send("No active SSE connection.");
      return;
    }
    await activeTransport.handlePostMessage(req, res);
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor MCP Sankhya rodando via SSE na porta ${PORT}`);
    console.log(`Endpoint SSE: http://localhost:${PORT}/sse`);
    console.log(`Endpoint Messages: http://localhost:${PORT}/messages`);
  });
}

main().catch(console.error);
