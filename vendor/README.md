# Bibliotecas de terceiros (vendor)

Arquivos de terceiros copiados sem alteração e usados só no servidor, pelo Chromium sem rede, para desenhar diagramas e gráficos (`lib/visuals.js`). Nunca são servidos ao navegador da pessoa.

| Arquivo | Pacote | Versão | Licença | SHA-256 |
|---|---|---|---|---|
| `mermaid.min.js` | [mermaid](https://github.com/mermaid-js/mermaid) (`dist/mermaid.min.js`) | 11.17.2 | MIT (`LICENSE-mermaid`) | `581ed7d74bd9048d0e3a91363927d72ef22942d7722546b27f7cc29e35390eb8` |
| `chart.umd.min.js` | [chart.js](https://github.com/chartjs/Chart.js) (`dist/chart.umd.min.js`) | 4.5.1 | MIT (`LICENSE-chartjs`) | `48444a82d4edcb5bec0f1965faacdde18d9c17db3063d042abada2f705c9f54a` |

Para atualizar: `npm pack mermaid@X chart.js@Y`, copie os mesmos arquivos de `dist/`, atualize a tabela e rode `npm test` e o teste de desenho no contêiner.
