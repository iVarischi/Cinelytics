# 🎬 Cinelytics

> Plataforma web full-stack de análise de perfil cinematográfico e recomendação inteligente baseada em IA e validação de dados em tempo real.

O **Cinelytics** é uma aplicação interativa concebida para mapear o gosto cinematográfico do utilizador através de uma **Tier List** personalizada (com classificações de **S** a **D**). A partir dessa seleção, o sistema utiliza Inteligência Artificial Generativa para identificar padrões narrativos, criar um arquétipo do utilizador e sugerir novos filmes validados e reais.

---

## ✨ Funcionalidades

### 📋 Tier List Interativa
- **Pesquisa em tempo real:** Encontre qualquer filme através da integração com a API do TMDB.
- **Classificação dinâmica (S a D):** Organize os seus filmes favoritos no tier **S** (favoritos absolutos) até ao tier **D** (menos apreciados ou evitados).
- **Interface responsiva e ágil:** Altere o tier de um filme com um simples clique no título ou remova-o instantaneamente.
- **Persistência local:** Guarde o progresso automaticamente no `localStorage` do navegador para não perder a sua lista entre sessões.

### 🧠 Análise Comportamental com IA
- **Arquétipo de Gosto:** Geração de um perfil criativo que resume a sua identidade como espectador (ex.: *"O Melancólico Cerebral"*).
- **Resumo Analítico:** Leitura inteligente dos temas, estrutura narrativa, tom e diretores recorrentes nas suas escolhas, considerando o que gosta (tiers S/A) e o que evita (tiers C/D).
- **Eixos Estatísticos Personagidos:** Mapeamento visual em barras percentuais (0 a 100%) indicando traços específicos do seu perfil (ex.: *Complexidade Narrativa*, *Imersão Visual*, *Profundidade Temática*).

### 🔍 Recomendações Validadas (Filtro Anti-Alucinação)
- **Sugestões Personalizadas:** Geração de recomendações ajustadas ao seu gosto com justificações diretas.
- **Validação Paralela via Backend:** O servidor intercepta as sugestões da IA e realiza buscas paralelas no TMDB para confirmar se o filme realmente existe, validar o ano de lançamento e descartar duplicados ou itens que já constam na sua lista.

### 📤 Partilha Rápida
- **Cópia para Clipboard:** Exporte a sua Tier List formatada em texto simples com um clique para partilhar nas redes sociais ou com amigos.

---

## 🛠️ Tecnologias Utilizadas

### Backend (Python)
- **FastAPI:** Framework web assíncrono e de alto desempenho para criação de endpoints REST.
- **Google GenAI SDK:** Integração com o modelo `gemini-flash-latest` utilizando *Structured Outputs* (`response_schema`) para garantir respostas em JSON estrito.
- **HTTPX & ThreadPoolExecutor:** Requisições assíncronas e processamento concorrente em múltiplas threads para consulta e validação na API do TMDB.
- **Pydantic:** Validação de tipos, esquemas de entrada/saída de dados e manipulação de objetos JSON.
- **python-dotenv:** Gestão segura de variáveis de ambiente (`.env`).

### Frontend (Browser Native)
- **HTML5:** Estruturação semântica, moderna e acessível.
- **CSS3:** Variáveis CSS, layout responsivo em Flexbox/Grid, tipografia refinada e suporte a modo escuro nativo.
- **JavaScript (ES6+ Vanilla):** Lógica reativa sem dependências de frameworks pesados, manipulação eficiente do DOM e controlo de requisições pendentes (*searchRequestId* e *debounce*).

---

## 🚀 Como Executar o Projeto

Como o projeto é dividido em backend (Python) e frontend (estático), siga os passos abaixo para o colocar a rodar localmente:

### 1. Clonar o repositório
```bash
git clone [https://github.com/iVarischi/cinelytics.git](https://github.com/iVarischi/cinelytics.git)
cd cinelytics
