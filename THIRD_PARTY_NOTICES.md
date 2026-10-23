# Avisos de terceiros

## Dados da BNCC (`public/data/bncc.json`)

O arquivo `public/data/bncc.json` é uma versão compacta do dataset **bncc.dev**, que reúne as 1.721 aprendizagens da Base Nacional Comum Curricular (BNCC 2018: Educação Infantil, Ensino Fundamental e Ensino Médio) e do complemento de Computação (Parecer CNE/CEB nº 2/2022).

- **Crédito:** bncc.dev (mantido pela Profy Tecnologias Educacionais Ltda).
- **Repositório:** <https://github.com/bncc-dev/bncc-dados>
- **Versão dos dados:** `dados-2026.08`
- **DOI:** [10.5281/zenodo.21625233](https://doi.org/10.5281/zenodo.21625233)
- **Licença dos dados:** [Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.pt-br). Texto da licença do projeto: <https://github.com/bncc-dev/bncc-dados/blob/main/dados/LICENSE.md>
- **Alterações feitas aqui:** só a conversão de formato, feita por `scripts/build-bncc-data.js`, que mantém o código, o texto oficial, a etapa, o ano ou a faixa etária e o componente, a área ou o campo de cada registro, e descarta os demais campos. Os textos não foram editados.

Os textos normativos da BNCC são atos oficiais do Estado brasileiro (MEC e Conselho Nacional de Educação). Para uso formal, confira sempre o documento oficial.

Para atualizar os dados: baixe uma versão nova do repositório acima e rode `node scripts/build-bncc-data.js CAMINHO_DO_CLONE`.
