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
    
    // Hack Definitivo: O cliente Go ignora query parameters.
    // Vamos interceptar a URL e transforma-la em Absoluta E com Path Parameter!
    // Exemplo: /messages?sessionId=123 -> https://.../messages/123
    const originalWrite = res.write.bind(res);
    res.write = (chunk: any, encoding: any, callback?: any) => {
      if (typeof chunk === "string" || Buffer.isBuffer(chunk)) {
        let str = chunk.toString();
        if (str.includes("event: endpoint") && str.includes("data: /messages?sessionId=")) {
          str = str.replace("data: /messages?sessionId=", "data: https://documentacoessankhya.onrender.com/messages/");
          return originalWrite(str, encoding, callback);
        }
      }
      return originalWrite(chunk, encoding, callback);
    };

    const transport = new SSEServerTransport("/messages", res);
    
    transports.set(transport.sessionId, transport);
    console.log(`[SSE] Sessao criada: ${transport.sessionId}. Sessoes ativas: ${transports.size}`);
    
    try {
      await mcp.server.connect(transport);
    } catch (err) {
      console.error("Erro ao conectar:", err);
    }
    
    res.on("close", () => {
      console.log(`Cliente desconectado: ${transport.sessionId}`);
      transports.delete(transport.sessionId);
    });
  });

  app.post("/messages/:sessionId", async (req, res) => {
    const sessionId = req.params.sessionId;
    const transport = transports.get(sessionId);
    
    if (!transport) {
      const activeKeys = Array.from(transports.keys()).join(", ");
      res.status(404).send(`Sessao [${sessionId}] nao encontrada. Ativas: [${activeKeys}]`);
      return;
    }
    
    // O SDK internamente verifica se req.query.sessionId === transport.sessionId.
    // Como transformamos em path parameter, precisamos injetar de volta na query
    // para enganar a validação interna do SDK!
    req.query.sessionId = sessionId;
    
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
