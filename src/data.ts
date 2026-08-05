import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

export interface FlowFunction {
  name: string;
  rawText: string;
}

export interface DictionaryTable {
  name: string;
  description: string;
  fields: DictionaryField[];
}

export interface DictionaryField {
  name: string;
  description: string;
  type: string;
}

export class SankhyaDataStore {
  private flowFunctions: FlowFunction[] = [];
  private tables: Map<string, DictionaryTable> = new Map();

  async loadData() {
    await this.loadFlowFunctions();
    await this.loadDictionary();
  }

  private async loadFlowFunctions() {
    const filePath = path.join(process.cwd(), 'funções flow.md');
    if (!fs.existsSync(filePath)) {
        console.warn(`Arquivo não encontrado: ${filePath}`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const sections = content.split(/^##\s+/m).filter(s => s.trim().length > 0);
    
    for (const section of sections) {
      if (section.startsWith('Contexto Tarefa')) continue;
      
      const lines = section.split('\n');
      const name = lines[0].trim();
      const rawText = section.trim();
      
      this.flowFunctions.push({
        name,
        rawText
      });
    }
    console.log(`Carregadas ${this.flowFunctions.length} funções do Flow.`);
  }

  private async loadDictionary() {
    const files = fs.readdirSync(process.cwd());
    const xmlFile = files.find(f => f.startsWith('mgeDD_') && f.endsWith('.xml'));
    
    if (!xmlFile) {
        console.warn('Arquivo XML do dicionário de dados não encontrado.');
        return;
    }
    
    const filePath = path.join(process.cwd(), xmlFile);
    console.log(`Carregando dicionário de dados: ${xmlFile}... (isso pode levar alguns segundos)`);
    const xmlData = fs.readFileSync(filePath, 'utf-8');
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
    
    const parsed = parser.parse(xmlData);
    
    const tabelasArray = parsed.dwf_db?.tabelas?.Tabela;
    if (!tabelasArray) return;
    
    const tabelas = Array.isArray(tabelasArray) ? tabelasArray : [tabelasArray];
    
    for (const tab of tabelas) {
      const nomeTabela = tab['@_nomeTab'];
      const descrTabela = tab['@_descrTab'];
      
      const camposObj = tab.campos?.Campo;
      const camposArray = Array.isArray(camposObj) ? camposObj : (camposObj ? [camposObj] : []);
      
      const fields: DictionaryField[] = camposArray.map((c: any) => ({
        name: c['@_nomeCampo'],
        description: c['@_descrCampo'],
        type: c['@_tipCampo']
      }));
      
      this.tables.set(nomeTabela, {
        name: nomeTabela,
        description: descrTabela,
        fields
      });
    }
    console.log(`Carregadas ${this.tables.size} tabelas do dicionário.`);
  }

  searchFlowFunctions(query: string): FlowFunction[] {
    const lowerQuery = query.toLowerCase();
    return this.flowFunctions.filter(f => 
      f.name.toLowerCase().includes(lowerQuery) || 
      f.rawText.toLowerCase().includes(lowerQuery)
    );
  }

  searchTables(query: string): DictionaryTable[] {
    const lowerQuery = query.toLowerCase();
    const results: DictionaryTable[] = [];
    
    for (const table of this.tables.values()) {
      if (table.name.toLowerCase().includes(lowerQuery) || (table.description && table.description.toLowerCase().includes(lowerQuery))) {
        results.push(table);
        if (results.length >= 20) break; // limit results
      }
    }
    return results;
  }
  
  searchFields(tableName: string, query: string): DictionaryField[] {
    const table = this.tables.get(tableName.toUpperCase());
    if (!table) return [];
    
    if (!query) return table.fields; // return all fields if no query
    
    const lowerQuery = query.toLowerCase();
    return table.fields.filter(f => 
        f.name.toLowerCase().includes(lowerQuery) || 
        (f.description && f.description.toLowerCase().includes(lowerQuery))
    );
  }
}

export const dataStore = new SankhyaDataStore();
