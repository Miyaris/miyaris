# Miyaris — AI Worker

Miyaris platformu için **bağımsız** çalışan otonom AI agent servisi. Backend'in
içinde değil, ayrı bir süreç olarak deploy edilir; iletişim yalnızca HTTP +
`X-Service-Key` üzerinden.

## Mimari

```
┌──────────────────┐    poll     ┌─────────────────────┐
│   Miyaris API    │ ◄──────────│   ai-worker         │
│  (FastAPI)       │             │                     │
│                  │   POST      │  ┌──────────────┐   │
│  /api/v1/service │ ◄──────────│  │ Valuation    │   │
│   /watches/...   │             │  │ Agent        │   │
│                  │             │  └──────────────┘   │
└──────────────────┘             │  ┌──────────────┐   │
                                  │  │ SEO Writer  │   │
                                  │  │ Agent        │   │
                                  │  └──────────────┘   │
                                  └────────┬────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ LLM (Ollama / │
                                    │  StubLLM)    │
                                    └──────────────┘
```

## Pipeline

1. Kullanıcı saat ilanı oluşturur → backend `ai_processing_status=QUEUED`
2. Worker her 15sn'de `/service/watches/queued` endpoint'ini poll'lar
3. Her saat için `/start-processing` ile **atomic claim** (race-safe)
4. **Valuation Agent**: piyasa karşılaştırmaları topla → LLM ile değer aralığı çıkar → POST
5. **SEO Writer Agent**: valuation + saat metadata'sıyla Türkçe ilan metni yaz → POST
6. `/complete` ile DONE/FAILED bildir

## Çalıştırma

```bash
cd ai-worker
python -m venv .venv && source .venv/bin/activate
pip install -e .

cp .env.example .env
# SERVICE_API_KEY'i Miyaris backend ile aynı değere set et

python -m worker.main
```

## LLM Sürücüsü

| Sürücü | Tetikleyici | Notlar |
|---|---|---|
| **StubLLM** | hiçbir env yok | Deterministik mock; pipeline test için |
| **Ollama** | `OLLAMA_BASE_URL` set | Lokal, ücretsiz; `llama3.1:8b` önerilir |
| **OpenAI** | (gelecek) | Production fallback |

## Production Yol Haritası

- [ ] Gerçek scraping: Playwright + Chrono24/eBay sold listings
- [ ] CrewAI veya LangGraph tabanlı multi-agent koordinasyon
- [ ] Retry & dead-letter queue (Redis)
- [ ] Metrics (Prometheus): processed_per_minute, avg_latency, error_rate
