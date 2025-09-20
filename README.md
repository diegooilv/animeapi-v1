# 🎌 Anime API + Player com Fallback Inteligente (Next.js) 🚀

Bem-vindo ao meu projeto de estudos em Next.js! Aqui eu montei uma “mini plataforma” para assistir episódios de anime usando múltiplas fontes (providers) com fallback automático, suporte a HLS e extração de vídeo usando token do Blogger. A ideia é aprender Next.js na prática com TypeScript, APIs, scraping leve e um player robusto.

---

## ✨ O que tem de legal?

- 🔁 Fallback inteligente entre múltiplos providers
- 🎥 Extração de vídeo direto do Blogger (AnimeFire) — pega o link googlevideo do token
- 🛰️ HLS (m3u8) com hls.js e fallback para MP4
- 🔎 Resolução automática de slug por busca (ex.: `naruto-shippuden` no AnimesOnlineCC)
- 🧩 API interna com Next.js (App Router) para orquestrar providers
- 🧰 TypeScript em tudo, CSS e um player com troca automática de fonte se der erro
- 🧪 Pensado para estudo: organização, timeouts, abort controller, proxy com allowlist, etc.

---

## 🧠 Objetivo Educacional

Este projeto é para:
- Aprender Next.js moderno (App Router, rotas de API, SSR/CSR).
- Brincar com TypeScript no back e no front.
- Entender como reproduzir HLS no navegador (hls.js) e lidar com erros de mídia.
- Ver como fazer scraping leve/resolução de slug com bom senso e limites.
- Implementar proxy com allowlist para lidar com Referer/CORS com segurança básica.
- Estudar fallback entre providers e práticas de robustez de rede (timeouts, aborts).

É 100% educacional. Use com responsabilidade e respeite os termos de uso das fontes. 

---

## 🧱 Stack

- Next.js 15 (App Router)
- TypeScript
- CSS (CSS Modules)
- hls.js
- Node.js 18+ 

---

## 📦 Requisitos

- Node.js 18+ (ou 20)
- npm ou pnpm
- Acesso à internet 

---

## ⚙️ Instalação

1) Clonar o repo
```bash
git clone https://github.com/diegooilv/animeapi-v1
cd animeapi-v1
```

2) Instalar dependências
```bash
npm install
npm install hls.js
```

3) Configurar ambiente (opcional mas recomendado)
   Crie um arquivo `.env.local` na raiz:
```ini
# Hosts permitidos para o proxy interno (quando precisar Referer/CORS)
ALLOWED_PROXY_HOSTS=*.googlevideo.com,*.akamaihd.net,*.akamaized.net,*.cloudfront.net,gogocdn.stream
```

4) Rodar em desenvolvimento
```bash
npm run dev
```

5) Build de produção
```bash
npm run build
npm start
```

Dica: se o Next “bugar” algo, limpe o cache:
```bash
rm -rf .next
npm run dev
```

---

Pontos Next.js 15:
- Rotas de API usam `export const runtime = 'nodejs'`.
- Páginas/rotas usam `await` em `params`, `searchParams` e `headers()` quando necessário (padrão do App Router).

---

## 🔌 Como funciona (alto nível)

1) Você acessa uma página tipo:
```
/anime/naruto/episodes/68?season=1&title=Naruto
```

2) O Player chama a API interna:
```
GET /api/animes/naruto/episodes/68?season=1&title=Naruto
```

3) A API tenta providers em ordem:
    1. AnimeFire (Blogger Token) → pega JSON em /video/{slug}/{episode}, baixa a página do token do Blogger, extrai os links googlevideo e escolhe o melhor (normalmente MP4)
    2. Consumet/Gogoanime → busca → info → watch → pega HLS/MP4
    3. Páginas (AnimesOnlineCC/AnimeFire/Superflix) → retorna link exato de episódio/série para abrir em nova aba

4) O Player:
    - Se for HLS (`.m3u8`), usa `hls.js` (quando o navegador não suporta nativo).
    - Se der erro no vídeo, tenta automaticamente o próximo provider.
    - Se for `isEmbed: true` (página), mostra um botão para abrir em nova aba (sem embed cheio de popup no seu site).

---

## 🧩 Providers Suportados

- AnimeFire 
    - Endpoint: `https://animefire.plus/video/{slug}/{episode}`
    - JSON traz `token` de Blogger. O projeto baixa o HTML do token e extrai links `googlevideo.com/videoplayback?...`. Escolhe a melhor qualidade pela combinação de `mime=video/mp4` + `itag`.
    - Se faltar token, tenta `data` do JSON (quando existir).

- Consumet - 
    - API base: `https://api.consumet.org/anime/gogoanime`
    - Fluxo: search → info (episódios) → watch (fontes). Prioriza `.m3u8`.

- AnimesOnlineCC 
    - Padrão: `https://animesonlinecc.to/episodio/{slug}-episodio-{n}/`
    - O `{slug}` certo é resolvido por busca server-side. Ex.: “Naruto Shippuden” → `naruto-shippuden`.

- AnimeFire 
    - Padrão: `https://animefire.plus/video/{slug}/{n}`

- Superflix 
    - Padrão: `https://superflix.tv/serie/{slug}/` (varia por tema; por isso mando para a série)

---

## 📡 Endpoints da API

### GET `/api/animes/{slug}/episodes/{episode}`

---

## 🖥️ Player

Arquivo: `src/components/PlayerWithFallback.tsx`

- Suporta:
    - Fonte direta MP4/HLS
    - hls.js para `.m3u8` quando o navegador não tem suporte nativo
    - Botão “Abrir no provedor” para links de página (sem iframes chatos/popups)
- Troca de provider automática em erros de playback
- Exibe o provider atual e permite “tentar próximo” manualmente também

Dica: Sempre passe `title` na URL da página do episódio para melhorar a busca:
```
/anime/naruto-shippuden/episodes/1?season=1&title=Naruto%20Shippuden
```

---

## 🧯 Troubleshooting

- AnimeFire vem com `"data": []` mas tem `"token"`:
    - Normal! O projeto usa o token do Blogger e extrai o link real do vídeo do HTML.

- Consumet/Gogo tem fontes mas não toca:
    - Alguns servidores exigem `Referer`. O provider pode marcar `requiresProxy: true` com `headers`. O player usa `/api/proxy` nesses casos. Confirme a allowlist no `.env`.

- Slug das páginas (AnimesOnlineCC) não bate:
    - O `slugResolver` usa busca para achar o slug real do site. Passe o `title` bem certinho (ex.: “Naruto Shippuden”).

- 403/410 no googlevideo:
    - Link expirou. Recarrega a página para renovar o token.

---

## 🗺️ Roadmap de Estudos/Features

- Seletor de provider na UI
- Mostrar qualidade do vídeo (360p/480p/720p) quando disponível
- Cache persistente (Redis/KV) para slugs e resultados
- Melhor heurística para filmes/OVA/partes
- Telemetria simples (quais providers mais acertam/falham)

---

## 🤝 Contribuindo

- Sugestões de novos providers são super bem-vindas!
- Siga a interface `Provider` e retorne:
    - `episode` com URL tocável (HLS/MP4) ou
    - `isEmbed: true` com `episode` apontando para a página do episódio/série
- Use timeouts com `AbortController` para evitar travamentos no server

---

## ⚖️ Aviso Legal

Este projeto é para fins educacionais. Links e integrações citadas pertencem aos seus respectivos proprietários. Respeite os termos de uso e as leis locais. Eu não hospedo conteúdo licenciado; aqui só estudo como integrar fontes públicas para aprender Next.js e conceitos de web. 🙇

---

## 📜 Licença

[MIT](LICENSE)