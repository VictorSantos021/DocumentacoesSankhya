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
          // Extraímos o ID para usá-lo tanto no Path quanto no Query
          const id = str.split("sessionId=")[1].trim();
          str = str.replace(`data: /messages?sessionId=${id}`, `data: https://documentacoessankhya.onrender.com/messages/${id}?sessionId=${id}`);
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
    
    req.query.sessionId = sessionId;
    await transport.handlePostMessage(req, res);
  });

  // Hack Supremo: Se o cliente Go for extremamente bugado e mandar POST direto para /messages
  // ignorando completamente a URL que enviamos no endpoint, vamos aceitar e usar a sessão mais recente.
  app.post("/messages", async (req, res) => {
    console.log("Recebido POST direto em /messages sem ID de sessao!");
    // Pega a última sessão criada (como só há 1 usuário testando, isso funciona 100%)
    const activeKeys = Array.from(transports.keys());
    if (activeKeys.length === 0) {
      res.status(404).send("Nenhuma sessao ativa para o fallback.");
      return;
    }
    const lastSessionId = activeKeys[activeKeys.length - 1];
    const transport = transports.get(lastSessionId);
    
    if (transport) {
      req.query.sessionId = lastSessionId;
      await transport.handlePostMessage(req, res);
    } else {
      res.status(404).send("Erro interno no fallback.");
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor MCP Sankhya rodando via SSE na porta ${PORT}`);
    console.log(`Endpoint SSE: http://localhost:${PORT}/sse`);
    console.log(`Endpoint Messages: http://localhost:${PORT}/messages`);
  });
}

main().catch(console.error);
