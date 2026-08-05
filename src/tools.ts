import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dataStore } from "./data";

export function registerTools(server: McpServer) {
  server.tool(
    "search_flow_functions",
    "Busca funções do Sankhya Flow na documentação",
    {
      query: z.string().describe("Nome da função ou palavra-chave para buscar (ex: 'buscarDado')")
    },
    async ({ query }) => {
      const results = dataStore.searchFlowFunctions(query);
      
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `Nenhuma função encontrada para a busca: "${query}"` }]
        };
      }

      const textResults = results.map(r => `## ${r.name}\n${r.rawText}`).join("\n\n---\n\n");
      
      return {
        content: [{ type: "text", text: textResults }]
      };
    }
  );

  server.tool(
    "search_data_dictionary",
    "Busca tabelas no dicionário de dados do Sankhya",
    {
      query: z.string().describe("Nome da tabela ou palavra-chave na descrição (ex: 'TGFEMP')")
    },
    async ({ query }) => {
      const results = dataStore.searchTables(query);
      
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `Nenhuma tabela encontrada para a busca: "${query}"` }]
        };
      }

      const textResults = results.map(r => 
        `Tabela: ${r.name}\nDescrição: ${r.description}\n(Possui ${r.fields.length} campos. Use a ferramenta get_table_fields para ver os campos.)`
      ).join("\n\n");
      
      return {
        content: [{ type: "text", text: textResults }]
      };
    }
  );

  server.tool(
    "get_table_fields",
    "Busca os campos de uma tabela específica no dicionário de dados do Sankhya",
    {
      tableName: z.string().describe("Nome exato da tabela (ex: 'TGFEMP')"),
      query: z.string().optional().describe("Opcional: Filtrar campos por nome ou descrição")
    },
    async ({ tableName, query }) => {
      const results = dataStore.searchFields(tableName, query || "");
      
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `Nenhum campo encontrado na tabela "${tableName}" para a busca "${query || ''}". Verifique o nome da tabela.` }]
        };
      }

      const textResults = results.map(r => 
        `- ${r.name} (${r.type}): ${r.description}`
      ).join("\n");
      
      return {
        content: [{ type: "text", text: `Campos da tabela ${tableName.toUpperCase()}:\n\n${textResults}` }]
      };
    }
  );
}
