# Apostila AI — Gerador de Prompts v2

Aplicação editável para gerar briefings completos de materiais didáticos. A modalidade local funciona no navegador e não envia dados. O servidor Node.js oferece uma API segura de pré-visualização e é a base para integrar geração por IA e PDF.

## Executar

Requer Node.js 18 ou superior.

```bash
npm start
```

Abra `http://127.0.0.1:3000`. Para testar:

```bash
npm test
```

### Docker

```bash
docker compose up -d --build
```

Por padrão, a aplicação fica disponível na porta `8123` do servidor. O contêiner roda sem privilégios, com sistema de arquivos somente leitura, sem capabilities Linux e com política de reinício automático.

## Arquitetura em duas modalidades

1. **Gerador local:** `public/` contém HTML, CSS e JavaScript sem framework ou dependências. Gera, copia e exporta o prompt e o projeto JSON inteiramente no navegador.
2. **Backend Node.js:** `server.js` serve a interface e expõe `GET /api/health` e `POST /api/render`. A rota atual produz uma prévia HTML escapada e pronta para impressão.

## Próxima etapa no servidor Linux

- Colocar o projeto em um diretório não público e executá-lo com um usuário de serviço.
- Usar um proxy HTTPS (Nginx, Caddy ou equivalente) e limitar o tamanho das requisições.
- Para PDF, adicionar Playwright/Puppeteer no servidor e gerar o PDF a partir do HTML, com fila, timeout e limpeza de temporários.
- Para Mermaid e Chart.js, renderizar apenas especificações validadas e usar versões fixadas. O prompt já solicita Mermaid e tabelas de dados sem fabricar números.
- Para imagens por IA, manter a chave somente em variável de ambiente no backend; validar prompt, tipo e tamanho; aplicar limites de uso e registrar erros sem conteúdo sensível.
- Nunca colocar chaves de API em `public/app.js` nem no HTML.

## Implantação

Ainda não foi feita porque nenhum endereço, caminho ou acesso ao servidor Linux foi fornecido. Depois de receber esses dados, valide primeiro em ambiente de homologação e só então publique.
