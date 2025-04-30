# Content-Generation Subsystem  
### *Subsystem project specification*  
**SkyNet Token-Auction Ads • Technical Design Report v2.0 (2025-04-23)**  

> **Format preserved**: identical section ordering, tables, and density as the Max-Reward Optimiser spec.

---

## 0 Notation & Acronyms  

| Symbol / term | Meaning |
|---------------|---------|
| \(π_t\) | full user/assistant prefix at token *t* |
| \(π_t^{512}\) | “condensed” prefix (≤ 512 tokens) |
| \(k_{tail}=256\) | tail length preserved verbatim |
| \(k_{sum}=8\) | number of summary chunks |
| \(e_h\) | hidden state of Content-Gen LLM |
| AWQ | *Activation-aware Weight Quantisation* (4-bit) |
| DPO | *Direct Preference Optimisation* |
| LoRA | *Low-Rank Adaptation* |
| HS-BART | Distil-BART summariser used in Hier-Sum |
| TVM | Trajectory-Value Model |
| MPC | Receding-Horizon Controller |

---

## 1 Goals & System Context  

### 1.1 Functional Goals  

| Goal | Description |
|------|-------------|
| **G-1. Ad Authoring** | Produce the next-token probability distribution \(P_i(x\midπ_t)\) for our advertiser trajectory. |
| **G-2. Prefix Compression** | Guarantee the ad-writer sees ≤ 512 tokens of prefix, regardless of chat length. |
| **G-3. Real-time throughput** | P95 ≤ 15 ms/token logits on one A100; ≤ 120 ms/token on CPU MVP. |
| **G-4. Plan Switching** | Accept `plan_id` from MPC to truncate trajectory length mid-reply. |
| **G-5. Safety compliance** | Pass policy filter (toxicity, self-harm) with FP ≤ 0.1 %, FN ≤ 1 %. |

### 1.2 External End-points

| Dir | Name | Transport | Schema | Producer → Consumer | Timing |
|-----|------|-----------|--------|---------------------|--------|
| ↑ | `condense_ctx` | Zero-copy ndarray | `float32[384]` or token IDs | Condenser → Context Encoder / Feature Hub | pre-reply |
| ↑ | `chosen_msg` | gRPC | `{msg_id,text}` | Max-Reward → Content-Gen LLM | pre-reply |
| ↑ | `plan_id` | gRPC (optional) | `int` (#remaining tokens) | MPC → Token-Trajectory Wrapper | any token |
| ↓ | `logits` | shared-mem ptr | `float16[V]` | Content-Gen LLM → Auction | per token |
| ↓ | `chosen_token` | uint32 (token id) | Auction → TokenWrap | per token |
| ↓ | `final_reply_stream` | SSE / WebSocket | text tokens | TokenWrap → Front-end | streaming |

---

## 2 Architecture & Algorithms  

### 2.1 Sequence Diagram  

```
Full Prefix (π_t)
  │
  ├─► Condense Context ─┐
  │                     │
  │         condensed (≤512 tok)
  │                     ▼
  │     +------------------------------+
  │     |  Content-Gen LLM (AWQ-4bit)  |
  │     +---------------┬--------------+
  │                     │ logits
  │                     ▼
  │    Token-Auction Engine (choose token)
  │                     │
  └── chosen token ◄────┘
        ▲
        │ plan_id (optional)
        │
     RHC / MPC
```

### 2.2 Sub-block Specs  

| ID | Name | Lang / Container | Core Algorithm | HW | P95 lat | Threads |
|----|------|------------------|----------------|----|---------|---------|
| **A** | Raw Context Stream | Rust websocket | tokeniser = tiktoken-4178 | CPU | 0 | — |
| **B** | Condense Context | PyTorch C++ ext | **Hier-Sum**:<br>1. keep last \(k_{tail}=256\) tokens verbatim.<br>2. Window older part into 64-token shards.<br>3. HS-BART-8bit summarise each shard to 32 tokens.<br>4. Keep first \(k_{sum}=8\) shard-summaries. | GPU | 6 ms | 1 |
| **C** | Condensed Context Store | in-proc struct | tuple `(tail,summaries)` | CPU | - | — |
| **D** | Content-Gen LLM | Triton + AWQ | GPT-style, 3 B, 4-bit.<br>Tokenizer shared w/ ref LLM.<br>Prompt = `[SUM]…[TAIL]…\n\n[AD_PROMPT]` | GPU | 15 ms/token | 1 |
| **E** | Hidden-State Cache | cuBLAS mem | maintain `e_h`, reused each token | GPU | negligible | — |
| **F** | Token-Trajectory Wrapper | Rust FFI | `forward_step(e_h,last_id)` returns logits ptr | GPU | 0.1 ms | 1 |
| **G** | Pre-train Job | PyTorch Lightning | Next-token LM, LR=1e-5, 2 epochs | multi-GPU | nightly | — |
| **H** | LoRA Fine-Tune | vLLM + PEFT | 64-rank, DPO; reward = log(1+click) | single GPU | weekly | — |
| **I** | Plan Truncator | inline in Wrapper | on `plan_id=k'`, set `max_len` = k' | GPU | <0.05 ms | — |
| **J** | Policy Guard (content side) | ONNX | 4-layer classifier; preludes prompt to LLM | GPU | 0.5 ms | — |

---

### 2.3 Detailed Algorithms  

#### 2.3.1 Hier-Sum Condensation  

Let prefix \(π\) length = \(L\).  
Tail tokens \(T = π[-256:]\).  
For the head \(π_{head}=π[:-256]\), split into windows \(W_j\) of 64 tokens.  
HS-BART summariser \(S(W_j) \to 32\) tokens.  
Output sequence  
\[
 π^{512} = S(W_1)‖…‖S(W_{k_{sum}})‖T
\]

#### 2.3.2 Prompt Template  

```
[SYS] You are a helpful assistant.
[SUM] <summary_1> … <summary_8>
[TAIL] last 256 user+assistant tokens
[AD_PROMPT] {{ chosen_msg.text }}
```

#### 2.3.3 Token Generation  

```
logits_t = LLM.forward_step(e_h, last_id)
P_i(x|π_t) = softmax(logits_t / T)
```
`T=0.7` temperature (matches reference LLM for KL regularisation).

#### 2.3.4 Plan Switching  

Upon gRPC `plan_id=k'`:

```
if len(generated) >= k': set EOS flag = True
else: max_len = k'
```

Trajectory salvage risk controlled in MPC (λ_risk, §7 spec).

---

## 3 Training & Fine-tuning Pipelines  

| Job | Trigger | Dataset | Loss | Artifacts |
|-----|---------|---------|------|-----------|
| Pre-train | 1×/month or 1 B new tokens | OpenChat+Marketer* | X-ent | `base_gpt3b_YYYYMM.ckpt` |
| LoRA Fine-Tune | 10 k new click pairs *or* weekly | `(ctx,msg,click)` pairs | DPO (β=0.1) | `lora_dpo_YYYYMMDD.safetensors` |
| Summariser Distil | Bi-weekly | high-quality chats | KD loss vs BART-large | `hsbart8_YYYYMM.bin` |

---

## 4 Data Models & Retention  

| Store | Path | TTL |
|-------|------|-----|
| Model Registry | `/models/cg/base`, `/models/cg/lora`, `/models/cg/hsbart` | 5 versions |
| S3 `click_pairs` | `(ctx,msg_id,label)` | 180 d |
| Redis `cond_ctx_cache` | `ctx_hash→vec` | 15 min |

---

## 5 Security & Privacy  

* PII scrub pass before summariser.  
* Ad prompt merged only after safe-completion check.  
* All GPU pods isolated via k8s PodSecurity + gVisor.

---

## 6 Acceptance Criteria  

### 6.1 Interface Contracts  

| API | Request | Response | P95 |
|-----|---------|----------|-----|
| `gRPC Generate(logits)` | `{last_id:uint32}` | `{ptr:int64}` | 15 ms |
| `Condense(raw_tokens:List[int])` | input len ≤ 6 k | `[int] (≤512)` | 6 ms |

### 6.2 Performance  

| Metric | Target | Test |
|--------|--------|------|
| Condense compression | ≤ 512 tokens, ROUGE-1 drop ≤ 0.20 | unit `pytest` |
| LLM logits latency | 15 ms/token (GPU), 120 ms CPU | locust load test |
| Policy FP | ≤ 0.1 % | 1 M sample runs |

### 6.3 Tests
**Unit (U-xx)**, **Component (C-xx)**, **Integration (I-xx)**, and **System-wide (S-xx)**.  Log names and Prometheus metric prefixes are provided for traceability.

| ID | Scope | Title | Description – *what* & *why* | Pre-conditions / Fixtures | Expected Outcome | Primary Logs / Metrics |
|----|-------|-------|--------------------------------|---------------------------|------------------|------------------------|
| **U-01** | **Unit** | *Hier-Sum window count* | Verify that the Condense Context module creates exactly **⌈(L-256)/64⌉** summary windows and caps them at **k_sum = 8**. Ensures deterministic compression. | Supply 1 024 random tokens. | Eight 64-token windows are summarised; any extras discarded. | `condense.log` lines tagged `windows_created`, Prom metric `cg_windows_total`. |
| **U-02** | Unit | *HS-BART length bound* | Each HS-BART summary must emit ≤ 32 tokens. | Mock HS-BART returning longer text. | Output forcibly trimmed to 32 tokens. | Warning in `condense.warn`, unit test assertion. |
| **U-03** | Unit | *Prompt-template integrity* | Confirm that generated prompt contains in order: `[SYS]`, `[SUM]…`, `[TAIL]…`, `[AD_PROMPT]`. Guards against template regressions. | Provide dummy summaries & tail. | Regex finds all placeholders in correct order. | `template.debug` entry. |
| **U-04** | Unit | *Policy-guard FP/FN threshold* | Feed 10 k benign and 10 k toxic samples, count false decisions; proves compliance with G-5. | Use labelled test corpus. | FP ≤ 0.1 %, FN ≤ 1 %. | `policy_metrics.json` with confusion matrix. |
| **U-05** | Unit | *Plan truncation obeys `plan_id`* | When `plan_id = 3`, generation halts after three tokens even if EOS not reached. | Invoke wrapper with plan. | Stream closes exactly at 3 tokens. | `wrapper.plan.trace`, metric `cg_plan_trunc_total`. |
| **U-06** | Unit | *KV-cache reuse* | Ensures `e_h` pointer is identical across successive forward calls when prefix unchanged. | Two consecutive `forward_step` calls, same state. | Pointer equality + checksum match. | GPU trace `cg_kv_reuse`, nvprof timeline. |
| **U-07** | Unit | *LoRA hot-swap idempotence* | Load LoRA A, then LoRA B, then A again. Weights after second A must byte-match first A. | Use two dummy adapters. | SHA-256 of model weights identical. | `lora_swap.log`, metric `cg_lora_swap_ms`. |
| **U-08** | Unit | *AWQ vs FP16 parity* | Pass 128 random activations through both 4-bit AWQ and FP16 baselines. | Offline batch, CPU. | Max absolute Δ ≤ 0.02. | `awq_parity.csv`, Prom `cg_awq_delta_max`. |
| **U-09** | Unit | *Condensed-cache eviction* | Redis LRU removes items older than 15 min. | Pre-populate 200 keys, advance clock. | First-inserted keys absent after TTL. | Redis keyspace notifications, `cache_evictions_total`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **C-01** | **Component** | *GPU latency budget* | Measure P95 time for single `forward_step` on A100. | Replay 100 k real chat steps. | P95 ≤ 15 ms, P99 ≤ 25 ms. | `latency_histogram.prom`. |
| **C-02** | Component | *CPU MVP fallback* | Same test on 32-core CPU build. | Replay 1 k steps. | P95 ≤ 120 ms. | `latency_cpu.prom`. |
| **C-03** | Component | *Back-pressure under 32 streams* | Run 32 concurrent conversations on one GPU via vLLM dynamic batching. | Stress generator for 60 s. | No OOM; token delay < 30 ms. | `batch_merge.stats`, GPU util. |
| **C-04** | Component | *Summariser GPU failure* | Kill summariser process mid-run; ensure automatic restart and no user impact. | Supervisor enabled. | Health-check detects crash, restarts within 5 s; wrapper retries context request. | k8s event log, `condense.restart_total`. |
| **C-05** | Component | *Safe-completion bypass attempt* | Inject malicious ad prompt trying to override policy filter (e.g., “\_\_unsafe\_\_”). | Send crafted message. | Policy Guard trims/blocks prompt; LLM never receives unsafe content. | `policy_block.log`, metric increment. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **I-01** | **Subsystem-integration** | *End-to-end happy path* | Condense → LLM → Auction(stub) → output 20 tokens. | Normal chat transcript. | Streamed reply matches max-reward token decisions; total latency < 300 ms. | `e2e.trace`, Grafana dashboard. |
| **I-02** | Integration | *Auction back-pressure* | Throttle Token-Auction Engine to 2× normal latency. | 16 active streams. | Wrapper queue never exceeds 8 pending steps; generation stalls gracefully. | `wrapper.backpressure.warn`. |
| **I-03** | Integration | *Plan switch mid-sentence* | MPC sends `plan_id=1` after 5 tokens. | Live convo. | Generation terminates within next token without grammar break (post-process). | `plan_switch.event`, user output. |
| **I-04** | Integration | *LoRA rollout shadow* | Hot-swap new LoRA while 10 convos decode; compare logits hash old vs. new. | Staging env. | Zero RPC failures; logits change only after swap acknowledgement. | `lora_rollout.trace`. |
| **I-05** | Integration | *KV-snapshot rewind* | Inject synthetic crash into GPU worker, trigger rewind logic. | Savepoint every 5 tokens. | Logits after replay identical; user sees no gap. | `replay.audit`, checksum pass. |
| **I-06** | Integration | *Toxic prefix + safe prompt* | Prefix contains user slur; ensure summariser masks but tail keeps context. | Toxic user input. | Policy Guard flags; summariser redacts; downstream tokens still generated. | `toxicity.mask.log`, FP counter. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **S-01** | **System-wide** | *Nightly training pipeline smoke* | Offline Orchestration triggers pre-train, LoRA-DPO, model registry push, and Canary deploy; then online traffic A/B. | CI tag. | Canary P99 latency within 5 %, CTR lift ≥ 1 %, automatic promotion event. | Airflow DAG logs, `cg_canary.prom`. |
| **S-02** | System | *GDPR delete compliance* | Delete user data ID-42; replay condensation to confirm absence. | Run delete API. | Context for ID-42 missing in next day’s dataset and Redis cache. | Neo4j lineage diff, `gdpr_delete.audit`. |
| **S-03** | System | *Full load stress 5 k RPS* | All subsystems (Condense, LLM, Auction, RHC) under 5 000 token-requests/s for 10 min. | Prod-like cluster. | No subsystem breaches SLO; auto-scale events recorded. | k8s HPA logs, Prom summaries. |
| **S-04** | System | *Disaster recovery* | Simulate region outage of primary GPU cluster; traffic fails over to standby. | Chaos Lambda on k8s node-group. | RPO = 0 (no lost context); RTO < 60 s. | Multi-region grafana, fail-over alert ack. |

---

#### Logging & Traceability – conventions used by all tests  

| Log Stream | Format | Key Fields |
|------------|--------|-----------|
| `condense.log` | JSONL | `ts, convo_id, windows_created, tail_len` |
| `template.debug` | JSONL | `ts, convo_id, template_hash` |
| `wrapper.plan.trace` | JSONL | `ts, convo_id, plan_id, gen_len` |
| `policy_metrics.json` | File-per-run | `FP, FN, TP, TN, sample_size` |
| `e2e.trace` | OpenTelemetry span | `lat_ms, token_id, advertiser_id` |
| Prometheus | Timeseries | prefixed `cg_*` for Content-Gen metrics |

*When new instrumentation is added, append to this table so every AI or engineer knows where to dig.*
---

## 7 MVP vs Prod Dial-Switch  

| Component | Prod | MVP |
|-----------|------|-----|
| Summariser | 8-bit HS-BART GPU | 16-bit Distil-BART CPU |
| LLM | AWQ-4bit, Triton | 8-bit HF on CPU |
| Vector cache | Redis LRU | Python dict |
| gRPC | envoy-mTLS | local loopback |

---

### Appendix — Summariser Distillation Loss  

\[
\mathcal L = \lambda_{\text{CE}} \text{CE}(s,\hat s) + \lambda_{\text{KD}} \|z^{\text{teacher}}-z^{\text{student}}\|_2^2
\]  
with \(\lambda_{\text{CE}}=0.7,\; \lambda_{\text{KD}}=0.3\).


# Max-Reward Optimizer System
### *Subsystem project specification* 
*A full subsystem-level implementation plan*  
**SkyNet Token-Auction Ads • Technical Design Report v1.3 (2025-04-23)**  

---

## 0.  Notation & Acronyms  

| Symbol / term | Meaning |
|---------------|---------|
| \(m_i\) | candidate advertiser message *i* |
| \(z_{m_i}\in\mathbb R^{128}\) | axis-aligned embedding of message *i* |
| \(z_{\text{ctx}}\) | embedding of condensed user context |
| \(s_i=\cos(z_{\text{ctx}},z_{m_i})\) | semantic similarity |
| \(v_i = \alpha\,\text{CPM}_i + \beta\,\text{CPC}_i\) | monetary value proxy |
| \(λ_{sem},λ_{val}\) | mixing weights, \(λ_{sem}+λ_{val}=1\) |
| ε | exploration rate (ε-greedy) |
| ANN | approximate nearest-neighbour search |
| IVFPQ | inverted-file product quantisation index |

---

## 1.  Goals & External Contracts  

### 1.1 Functional Goals  

1. **G-1  Creative Selection** – return one high-value message `m★` at *reply start*.  
2. **G-2  End-to-End Latency** – ≤ **5 ms (P95)** on production GPU; ≤ 50 ms on laptop MVP.  
3. **G-3  Budget Awareness** – incorporate advertiser CPM/CPC goals and budget pacing.  
4. **G-4  Scalability** – 50 k QPS, 10 M stored creatives, hot-reloading daily.  
5. **G-5  Reproducible Offline** – deterministic batch mode for A/B replay & unit tests.  

### 1.2 Runtime End-points (north-/south-bound)

| Dir | Name | Transport | Schema | Producer | Consumer | SLA |
|-----|------|-----------|--------|----------|----------|-----|
| ↑ | `POST /budget/{adv}` | HTTPS/JSON | `{CPM,CPC,budget_left,end_ts}` | External dashboard | Budget Loader | 100 ms |
| ↑ | `POST /select` | gRPC (proto `SelectReq`) | `ctx_id:str, ctx_vec:f32[128]` → `msg_id:int, text:str` | RHC orchestrator | MRO service | 5 ms |
| ↓ | Kafka `mro.select` | Avro | `(ctx_id,msg_id,sim,val,score,εflag,timestamp)` | Selector | ETL pipeline | n/a |
| ↓ | ETCD `/mro/axes/P_K` | binary | 128 × 384 `float32` | Axes re-cluster | Encoder, Embedder | 1 update/day |
| ↓ | ETCD `/mro/λ_weights` | JSON | `{λ_sem,λ_val}` | λ-bandit tuner | Mixer | 1 update/day |

---

## 2.  Detailed Architecture & Sub-blocks  

### 2.1 Sequence Diagram  

```
CondenseCtx ─┐
             ▼
        Context Encoder ─► ANN (Vector DB) ─► Mixer ─► Selector ─► Content-Gen LLM
                       ▲               ▲          ▲             │
      Budget Loader ───┘               │          │             │
                                        └─────────┴── log msg  →
```

### 2.2 Sub-block Specs  

| ID | Name | Language / Container | Core Algorithm | CPU / GPU | P95 lat | Threads |
|----|------|----------------------|----------------|-----------|---------|---------|
| **A** | Budget & KPI Loader | Go 1.22 | Cockroach query + Redis TTL cache | CPU | 0.2 ms | 8 |
| **B** | Message Intake Dialog | Py 3.11 / FastAPI | GPT-4-turbo 16k prompt, PII scrub | CPU | offline | 4 |
| **C** | SBERT→Axes Embedder | Triton / ONNX | MiniLM 6-L Vector → P\_K·LayerNorm | GPU | 0.7 ms | 1 |
| **D** | Axes Re-cluster | Spark 3.5 | K-means(256) → PCA → choose 128 axes | CPU | nightly | — |
| **E** | Vector DB | faiss-gpu:v1.8 | IVFPQ: nlist=4096, nprobe=16, PQ M=16 | GPU | 2 ms | 3 |
| **F** | Context Encoder | ONNX / CUDA | reuse P\_K; LRU(64 k) cache | GPU | 0.1 ms | 1 |
| **G** | Similarity + Value Mixer | Rust tokio | dot-product + value + scoring | CPU | 0.3 ms | 4 |
| **H** | Message Selector | Rust tokio | ε-greedy; seed = MurmurHash(ctx_id) | CPU | 0.05 ms | 2 |
| **I** | Logger | Logstash-Kafka | Avro serialise → topic | CPU | 0.02 ms | 1 |

#### 2.2.1  Budget & KPI Loader (A)

*SQL schema*  
```sql
CREATE TABLE adv_budget (
  adv_id INT PRIMARY KEY,
  cpm FLOAT,
  cpc FLOAT,
  budget_left FLOAT,
  end_ts TIMESTAMP
);
```  
*MVP variant*: SQLite db file, no Redis cache.

#### 2.2.2  SBERT→Axes Embedder (C)

*Weights storage*: `/models/mro/miniLM.onnx` (15 MB) + `/models/mro/P_K.bin` (192 kB).  
Batch size = 32; GPU stream = `cudaStreamNonBlocking`.

#### 2.2.3  FAISS Index Parameters (E)

| Param | Value (prod) | Value (MVP) |
|-------|--------------|-------------|
| IVFPQ `nlist` | 4096 | 1 |
| `nprobe` | 16 | 1 |
| PQ `M` | 16 (16×8-bit sub-vectors) | — |
| training schedule | nightly | none |

#### 2.2.4  Similarity & Value Mixer (G)

```text
score_i = λ_sem * s_i + λ_val * (α CPM_i + β CPC_i)
s_i = dot(z_ctx, z_mi)
```

*Implementation details*  
* SIMD `vaddps/vmulps` on 4-wide float32.  
* λ parameters hot-reloaded from ETCD; atomic swap.

#### 2.2.5  Message Selector (H)

*Exploration*  
```python
if random() < ε: pick random(m1…mN)
else:           pick argmax score_i
```
ε config in `/mro/conf/selector.yaml`.  Deterministic random with `ctx_id` seed for replayability.

---

## 3.  Algorithms & Learning Jobs  

### 3.1 Axes Re-cluster

1. Read last 90 days of `ads_msgs`.  
2. Compute MiniLM embedding \(e_m\).  
3. PCA to 256 dims, K-means(256).  
4. Select top 128 cluster centroids → rows of \(P_K\).  
5. Validate **avg cosine drop ≤ 0.03** vs. full 384-d.  
6. Put new `P_K` into ETCD path; version tag `YYYY-MM-DD-HH`.

### 3.2 λ-Bandit Tuner

*Reward* \(R = \text{click} · (α CPM + β CPC)\).  
Bucket λ_sem in \{0.1,0.2,…0.9\}, Thompson-Beta(a,b):

```math
P(λ=k) = Beta(a_k, b_k) / Σ Beta(a_j,b_j)
```

Update with `a←a+R`, `b←b+1-R`.

### 3.3 Value‐Monetary scalar \(v_i\)

*CPM_i* = advertiser field; *CPC_i* likewise.  
If either missing, use campaign medians.

---

## 4.  Data Models & Retention  

| Table / Topic | TTL | Purpose |
|---------------|-----|---------|
| `ads_msgs` | ∞ | canonical creative store |
| `mro.select` Kafka | 30 d | λ-tuning, A/B |
| FAISS index | refreshed nightly | runtime query |
| ETCD config | versioned | hot reload |

GDPR: `adv_id` pseudonymised; user PII never stored.

---

## 5.  Security & Privacy  

* All REST/gRPC under mTLS.  
* Advertiser text scanned by PII & policy filters before embedding.  
* Vector DB never returns raw context; only similarity score floats.  
* Budget Loader rate-limits at 200 rps / adv.

---

## 6.  Acceptance Criteria  

### 6.1 Interface Contracts  

| Name | Proto | Success | Error code |
|------|-------|---------|------------|
| `SelectReq` | `{ctx_id:str, ctx_vec:bytes}` | `200 OK`, JSON `{msg_id,text}` | `429 RATE_LIMIT`, `500` |
| `EmbedReq` | `{text}` → `[128]float32` | 2 ms | `400 BAD_TEXT` |
| Kafka `mro.select` | Avro schema v1.0 | 100 % schema-valid | malformed message drop <1 ppm |

### 6.2 Performance  

* P95 end-to-end ≤ 5 ms on an A100 / ≤ 50 ms CPU-only.  
* FAISS recall@10 ≥ 0.90 (prod) / 1.0 (flat MVP).  
* Mixer monotonicity unit test: if \(s_1>s_2\) & \(v_1=v_2\) ⇒ score₁>score₂.

### 6.3 Test Cases
**Unit (U-xx)**, **Component (C-xx)**, **Integration (I-xx)**, and **System-wide (S-xx)**.  Log names and Prometheus metric prefixes are provided for traceability.

| ID | Scope | Title | Description – *what* & *why* | Pre-conditions / Fixtures | Expected Outcome | Primary Logs / Metrics |
|----|-------|-------|--------------------------------|---------------------------|------------------|------------------------|
| **U-01** | **Unit** | *Embedding dimensionality* | Verify that `SBERT→Axes Embedder` always returns a **128-float** vector after projection by `P_K`. Prevent shape drift. | Pass single “hello world” string. | Output NumPy shape `(128,)`. | `embedder.debug` (`dim_check=true`). |
| **U-02** | Unit | *Self-similarity = 1* | Cosine( `z`, `z` ) must equal 1. Ensures numerical stability of Axes matrix. | Random text sample. | |Δ| ≤ 1e-6. | Prom `mro_selfsim_max`. |
| **U-03** | Unit | *λ-weights sum = 1* | Hot-reloaded `λ_sem + λ_val` must equal 1 within 1e-6.  Guards against config typos. | Mock ETCD update `{0.7,0.25}`. | Loader rejects, error logged. | `mro.lambda.error`. |
| **U-04** | Unit | *Mixer monotonicity* | If `s₁ > s₂` and `v₁ = v₂`, then `score₁ > score₂`. Tests correct weight order. | Two synthetic vectors. | Assertion passes. | `mixer.unit.monotone`. |
| **U-05** | Unit | *Value fallback to median* | When `CPM_i` missing, Mixer uses campaign median. | Remove CPM for adv 42. | Score uses median 1 $ CPM. | `mixer.warn.no_cpm`. |
| **U-06** | Unit | *ε-greedy rate accuracy* | Over 10 000 calls with ε = 0.05, verify random-pick frequency. | Seed RNG = 42. | 4.5–5.5 % random. | Prom `mro_eps_observed`. |
| **U-07** | Unit | *Budget ledger underflow guard* | Selector must not pick creative if `budget_left ≤ 0`. | `budget_left=0` for adv 7. | Adv 7 never returned. | `budget.gate.trace`. |
| **U-08** | Unit | *Vector-DB recall@10* | For a 1 k sample, ANN top-10 set contains brute-force nearest neighbour ≥ 90 %. | Snapshot of 10 M embeddings. | Recall ≥ 0.9. | `vector_db.recall.json`. |
| **U-09** | Unit | *FAISS index reload integrity* | After nightly rebuild, checksum of index file matches SHA written in ETCD. | Run `Axes Re-cluster` job. | SHA equality; new index loaded. | `faiss_reload.log`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **C-01** | **Component** | *End-to-end latency GPU* | Measure P95 `POST /select` latency on A100. | 100 k requests, 32-concurrency. | P95 ≤ 5 ms, P99 ≤ 8 ms. | `mro_latency_hist.prom`. |
| **C-02** | Component | *End-to-end latency CPU (MVP)* | Same on 16-core laptop build. | 5 k requests. | P95 ≤ 50 ms. | `mro_latency_cpu.prom`. |
| **C-03** | Component | *Vector-DB nprobe stress* | Increase `nprobe` 1→16 under 50 k QPS. | Load generator. | Latency rises < 30 %; recall improves. | `vector_db.nprobe.stats`. |
| **C-04** | Component | *Budget loader cache expiry* | Redis TTL of 60 s; query same adv rapidly. | Hit 1 k requests in 10 s. | Only 1 Cockroach SQL call. | `budget.sql.count`. |
| **C-05** | Component | *Hot-reload λ-weights with no downtime* | Update ETCD value while 500 RPS live. | Push `{0.6,0.4}`. | 0 gRPC errors; `λ` used next request. | `lambda_reload.event`. |
| **C-06** | Component | *IVFPQ quantisation error bound* | Verify avg cosine drop ≤ 0.03 after re-cluster. | Run job §3.1. | Drop ≤ 0.03. | `axes.pca.report`. |
| **C-07** | Component | *Selector determinism seed* | Same `ctx_id` → same chosen `msg_id` across runs (ε = 0). | Disable exploration. | Identical output. | `selector.deterministic.test`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **I-01** | **Integration** | *Condense→MRO link* | Pass real user context vector from 3.1 into `/select`; ensure creative returned. | Full pipeline in Docker-compose. | 200 OK, non-empty `text`. | OTEL span `ctx→select`. |
| **I-02** | Integration | *Budget exhaustion path* | Run campaign until `budget_left = 0`, continue 1 k selects. | Adv 99 small budget. | Adv 99 never selected; spend capped. | `budget.exhaust.log`. |
| **I-03** | Integration | *Exploration diversity* | ε = 0.1, 1 k sequential calls same context ID. | RNG seed varying. | ≥ 8 distinct creatives chosen. | `explore.diversity.json`. |
| **I-04** | Integration | *λ-tuner feedback loop* | Stream `mro.select` Kafka to λ-bandit; after 10 k clicks where λ = 0.3 wins, expect probability shift. | Simulated click generator. | ETCD shows λ_sem≈0.3 weight ↑. | `lambda_bandit.prom`. |
| **I-05** | Integration | *Vector-DB node failure* | Kill faiss-gpu pod; expect auto-restart & retry. | K8s liveness probe enabled. |  < 1 % 5xx during 30 s outage. | k8s events, `vector_db.restart_total`. |
| **I-06** | Integration | *Creative hot-add* | Insert new creative into `ads_msgs`, trigger incremental index build. | New adv 123 msg. | Creative retrievable < 15 min later. | `faiss_ingest.log`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **S-01** | **System-wide** | *E2E click-through gain* | A/B run: Content-Gen with MRO vs static baseline for 1 h. | Traffic splitter 50/50. | CTR lift ≥ 1 %. | Dashboard `ctr_lift_pct`. |
| **S-02** | System | *Daily pipeline regeneration* | Offline Orchestration (3.7) completes Axes re-cluster, λ-bandit stats, and FAISS rebuild before 06:00 UTC. | Nightly schedule. | All DAGs success; new artifacts SHA logged. | Airflow `mro_axes_dag`. |
| **S-03** | System | *GDPR creative delete* | Delete creative `msg_id = 888`; ensure Embedder cache invalidated and FAISS removes vector on next rebuild. | GDPR API call. | `/select` never returns msg 888. | `gdpr_purge.audit`. |
| **S-04** | System | *Regional fail-over* | Simulate full GPU-cluster outage; MRO switches to CPU replicas. | Chaos engineering tool. | RTO < 90 s; P95 latency < 40 ms during fail-over. | Multi-region Grafana, `mro_failover.timer`. |

---

#### Logging & Metric Conventions  

| Stream / Time-series | Format | Key Fields |
|----------------------|--------|-----------|
| `embedder.debug` | JSONL | `ts,ctx_id,dim_check` |
| `vector_db.*` | JSONL | `ts,index_sha,nprobe,lat_ms` |
| `mixer.*` | JSONL | `ctx_id,λ_sem,λ_val,s_i,v_i,score` |
| `selector.*` | JSONL | `ctx_id,msg_id,εflag` |
| Prometheus | `mro_*` prefix | latency, recall, eps_rate, budget_hits |
| OTEL trace | Span tree | `select_latency_ms`, `faiss_probe_ms` |

*When new instrumentation is added, append to this table so every AI or engineer knows where to dig.*
---

## 7.  MVP vs Prod Dial-Switch  

| Component | Prod | MVP |
|-----------|------|-----|
| DB | CockroachDB | SQLite |
| FAISS | IVFPQ GPU | Flat CPU |
| Redis cache | Yes | in-proc dict |
| Triton | GPU | ONNX-cpu |


# Trajectory-Value Estimation (TVE) Subsystem  
### *Subsystem project specification*  
**SkyNet Token-Auction Ads • Technical Design Report v2.1 (2025-04-23)**  

*(Format identical to previous subsystem specs; every section present and expanded.)*

---

## 0 Notation & Acronyms  

| Symbol / term | Meaning |
|---------------|---------|
| \(k\) | token index inside an ad trajectory (k = 1 is first ad token) |
| \(V(k)\) | predicted **cumulative** value after winning first *k* tokens |
| \(\Delta V_k = V(k)-V(k-1)\) | marginal value of token *k* |
| \(L_t\) | abandonment loss if we drop at step *t* |
| \(V_{\max}\) | asymptotic (plateau) value of trajectory |
| \(a, k_0\) | logistic slope & midpoint parameters |
| TVM | run-time Trajectory-Value Model service |
| DLF | Data-Lake Feeder ETL job |
| CE-ctx | 128-d axis embedding of condensed context (from MRO) |
| CE-ad  | 128-d axis embedding of ad token string |
| CRPS | Continuous Ranked Probability Score |
| KD | Knowledge Distillation |

---

## 1 Goals & System Context  

### 1.1 Functional Goals  

| Goal | Description |
|------|-------------|
| **G-1. Real-time value prediction** — return \(\{ΔV_k\}_{k=1..T},\{L_t\}_{t=1..T}\) for candidate trajectories in ≤ 10 ms. |
| **G-2. Continuous learning** — re-train on click/ROI logs daily; auto-deploy if offline R²↑ > 1 %. |
| **G-3. Abandon-aware** — provide abandonment loss curve \(L_t\) such that MPC can reason about salvage. |
| **G-4. Explainability** — expose per-token attributions for policy/debug dashboards. |
| **G-5. MVP-friendly** — runnable on laptop CPU (≤ 60 ms inference) with SQLite dataset. |

### 1.2 Runtime End-points

| Dir | Name | Transport | Schema | Producer | Consumer | SLA |
|-----|------|-----------|--------|----------|----------|-----|
| ↑ | `POST /tve/predict` | gRPC proto `TveReq` | `{ctx_vec:f32[128], ad_tokens:str}` | MPC orchestrator | TVM service | ≤ 10 ms (GPU), ≤ 60 ms CPU |
| ↓ | Kafka `tve.feedback` | Avro | `(ctx_vec, ad_tokens, clicks:int, dwell:ms)` | Collector | DLF | n/a |
| ↓ | ETCD `/tve/model/current` | binary | TorchScript or ONNX | Trainer | TVM service | 1 push/day |

---

## 2 Architecture & Algorithms  

### 2.1 High-level Sequence  

```
Auction ► Collector  (ctx,ad,clicks) ─┐
                                      ▼
           +----------------------------- DLF ---------------------+
           | parquet to S3 --------------+                        |
           |                                              nightly |
Condensed ctx ─► TVM Service ◄─ ad token string              TVM Trainer
           │             ▲                                      │
           │        model weights  ◄──────── Model Registry ◄───+
           ▼
        MPC
```

### 2.2 Sub-block Specifications  

| ID | Name | Lang / Container | Core Algorithm | HW | P95 lat | Threads |
|----|------|------------------|----------------|----|---------|---------|
| **A** | Online Feedback Collector | Rust | intercept `(win_flag, clicks, dwell)` per auctioned sequence | CPU | 0.02 ms | 1 |
| **B** | Feature Builder (inside DLF) | PySpark | build tuples: `{ctx_vec, ad_vec, clicks, dwell}`; value label = `log(1+clicks) *  (α CPM+β CPC)` | CPU | offline | — |
| **C** | Dataset Store | S3 Parquet | partition `/yyyy/mm/dd/` | — | — | — |
| **D** | TVM Trainer | PyTorch Lightning | **Dual-tower Transformer**:<br>• ctx tower 2×64 head<br>• ad-token tower (byte-pair) 4×64<br>• cross-attention fuse → MLP → \(V_{\max}, a, k_0\).<br>Loss = MSE( V̂(k) ) + λ\_CRPS·CRPS + 0.1 · L2. | 4×A100 | 4 h nightly | — |
| **E** | Model Registry | MLflow | versioning, A/B tags | — | — | — |
| **F** | TVM Service | Triton; TorchScript 16-bit | computes curve:<br>\(V(k) = \frac{V_{\max}}{1+\exp(-a(k-k_0))}\)<br>\(L_t = V_{\max}-V(t)\) | GPU (prod) / CPU (MVP) | 8 ms / 55 ms | 2 |
| **G** | Explainability API | Flask | SHAP kernel on ctx/ad towers; top-5 tokens | CPU async | < 30 ms | 4 |
| **H** | Model Refresh Trigger | Airflow sensor | `if new rows ≥ 1 M OR 24 h elapsed → kick Trainer` | — | — | — |
| **I** | Canary Validator | Python | compute dev-set R², RMSE, CRPS; promote if R²↑ | CPU | 2 min | — |

#### 2.2.1  Value Curve Computation (inside F)

```python
V = Vmax / (1 + torch.exp(-a * (torch.arange(1,T+1)-k0)))
dV = torch.cat([V[:1], V[1:] - V[:-1]])
L  = Vmax - V
return dV.float16(), L.float16()
```

#### 2.2.2  Dual-Tower Transformer Details

| Tower | Input | Layers | Hidden | Output |
|-------|-------|--------|--------|--------|
| ctx | 128-d axis vec projected to 64 | 2 self-attn | 64 | 64 |
| ad  | BPE tokens ≤ 48 | 4 self-attn | 256 | mean-pool 256 |

Cross-attention (query = ctx, key/val = ad).  

---

## 3 Training & Fine-tune Pipelines  

| Stage | Steps | Hyper-params |
|-------|-------|-------------|
| **Stage-1 pretrain** | (ctx,ad) → predict *similarity* regression | LR=1e-4, AdamW, 1 epoch |
| **Stage-2 supervised** | predict logistic params; MSE + CRPS | LR=2e-5, batch = 1024 |
| **Stage-3 KD distil** | Teacher = Stage-2, Student = half hidden dims | loss = 0.7 MSE + 0.3 KD |

Promotion rule: *dev* RMSE ≤ 0.95× previous & inference ↑ ≤ 1 ms.

---

## 4 Data Models & Retention  

```sql
CREATE TABLE tve_samples (
  day DATE,
  ctx_vec BLOB,         -- 128 × float32
  ad_tokens TEXT,
  clicks INT,
  dwell_ms INT,
  value FLOAT,          -- computed label
  PRIMARY KEY(day,ctx_hash,ad_id)
) STORED AS PARQUET;
```

TTL: 365 d.  Parquet compression ZSTD level 9.

---

## 5 Security & Privacy  

* Click logs anonymised; no user identifiers stored.  
* S3 bucket encrypted (KMS).  
* Trainer only runs in isolated VPC subnet without internet egress.

---

## 6 Acceptance Criteria  

### 6.1 Interface Contracts  

| API | Request | Response |
|-----|---------|----------|
| `/tve/predict` | `{ctx_vec:bytes(512), ad:str}` | `{dV:list<float16>, L:list<float16>}` |
| `/explain` | `{ctx_vec,ad}` | `{tokens:[str], shap:[float]}` (optional endpoint) |

### 6.2 Performance  

| Metric | Target | Test |
|--------|--------|------|
| Inference latency (GPU) | ≤ 10 ms (P95) | locust 5 k rps |
| R² dev-set | ≥ 0.70 | CI gating |
| CRPS | ≤ 0.25 | Trainer metrics |

### 6.3 Test Cases
**Unit (U-xx)**, **Component (C-xx)**, **Integration (I-xx)**, and **System-wide (S-xx)**.  Log names and Prometheus metric prefixes are provided for traceability.

| ID | Scope | Title | Description – *what & why* | Pre-conditions / Fixtures | Expected Outcome | Primary Logs / Metrics |
|----|-------|-------|----------------------------|---------------------------|------------------|------------------------|
| **U-01** | **Unit** | *Logistic monotonicity* | Check analytic curve \(V(k)\) is non-decreasing and converges to \(V_{\max}\). Prevents math-param regressions. | Feed params \(V_{\max}=10, a=0.5, k_0=4\). | \(V(1)<…<V(16)\), \(|V(16)-V_{\max}|<0.01\). | `tve.curve.debug` (`monotone=true`). |
| **U-02** | Unit | *\(L_t + V_t = V_{\max}\)* | Guarantees abandonment loss definition holds. | Same fixture. | Each t: \(|L_t + V_t - V_{\max}|<1e-4\). | Prom `tve_loss_consistency`. |
| **U-03** | Unit | *Dual-tower output shapes* | Confirm ctx tower -> 64 dims, ad tower -> 256 dims; after fuse = 128. | Synthetic tensors. | Shape assertions pass. | `model.shape.log`. |
| **U-04** | Unit | *No-NaN trainer forward* | During 100 random mini-batches, all losses finite. | Small dummy DS. | `loss.isfinite()` always true. | `trainer.loss.trace`. |
| **U-05** | Unit | *CRPS contribution* | With Monte-Carlo=20, CRPS must drop when prediction improves. | Two predictions: bad vs good. | CRPS(good) < CRPS(bad). | `trainer.crps.debug`. |
| **U-06** | Unit | *Explain-API top-k tokens* | /explain returns ≤ 5 tokens sorted by |SHAP|. | Short ad string. | Tokens ≤ 5; shap values non-increasing. | `explain.audit`. |
| **U-07** | Unit | *Inference CPU path ≤ 60 ms* | MVP latency budget. | 1 000 calls single-thread. | p95 ≤ 60 ms. | `tve_latency_cpu.prom`. |
| **U-08** | Unit | *Model-hash determinism* | Serialise → deserialise TorchScript; SHA256 identical. | Save-load round-trip. | Hash equality. | `registry.hash.log`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **C-01** | **Component** | *GPU inference latency* | P95 time for `/tve/predict` on A100. | 50 k requests, 64-concurrency. | p95 ≤ 10 ms, p99 ≤ 15 ms. | `tve_latency_gpu.prom`. |
| **C-02** | Component | *Curve vector length* | For ad ≤ T tokens, returned arrays length =T. | Random token lengths 1…48. | `len(dV)==len(L)==T`. | `curve.len.check`. |
| **C-03** | Component | *Explain API async gap* | Async SHAP must complete < 30 ms without blocking prediction. | 500 concurrent explain calls. | Prediction SLA unaffected; explain p95 ≤ 30 ms. | `explain.latency.prom`. |
| **C-04** | Component | *Daily model hot-swap* | ETCD path updated; Triton reloads model with zero downtime. | Push new weights tag. | 0 gRPC failures during swap; new SHA appears. | `model.reload.event`, Prom `tve_reload_ms`. |
| **C-05** | Component | *Value-curve boundary guard* | If \(k_0<1\) or a>10 → service returns 400. | Malformed params. | Validation error raised. | `tve.param.error`. |
| **C-06** | Component | *Dataset Parquet integrity* | After DLF job, Parquet schema matches expectation & row count > 0. | Nightly ETL. | Spark validation passes. | `dlf.parquet.audit`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **I-01** | **Integration** | *TVE↔MPC decision loop* | MPC uses \(ΔV_k\) & \(L_t\); verify early-stop triggers when \(L_t/V_t>0.4\). | Simulate 30 convos with low predicted value. | MPC issues `STOP` ≥ 25/30 cases. | `mpc.control.log`. |
| **I-02** | Integration | *Feedback path completeness* | Winning trajectory events go Collector→Kafka→Parquet. | Run 5 k auctions. | 5 k rows appear in `tve_samples` table. | Kafka lag metric `tve_fb_lag=0`. |
| **I-03** | Integration | *Retrain & auto-promote* | Insert 1 M new rows, trigger Trainer; dev R²↑1 %. | Airflow sensor. | Canary deploy (5 %) succeeds; promotion event emitted. | `validator.promote.log`. |
| **I-04** | Integration | *Abandon-aware salvage* | Force RHC to plan token truncation using \(L_t\). | High abandonment cost scenario. | RHC switches plans < 2 ms extra latency. | OTEL span `plan_trunc`. |
| **I-05** | Integration | *GPU OOM resilience* | Exhaust GPU mem, TVM falls back to CPU replica. | Chaos test. | RPS maintained; GPU pod restarts; p95 < 55 ms fallback. | K8s event, `tve_failover.timer`. |
| **I-06** | Integration | *Explain-dashboard drill-down* | /explain output visualised; top token matches highest |dV|. | Real convo sample. | UI shows matching attribution within 1 pp. | Front-end console, `explain.match.metric`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **S-01** | **System-wide** | *CTR uplift with TVE-guided MPC* | A/B: MPC with TVE vs heuristic baseline for 2 h. | Traffic splitter 50/50. | TVE arm: CTR lift ≥ 1 %; revenue ↑ ≥ 0.5 %. | Grafana board `ctr_lift_tve`. |
| **S-02** | System | *Nightly DAG SLA* | Offline Orchestration completes DLF, Train, Validate, Promote by 06:00 UTC. | Midnight schedule. | SLA met 27/30 days; alerts on miss. | Airflow SLA monitor. |
| **S-03** | System | *GDPR purge verified* | Delete all samples with ctx_id X; rerun ETL. | GDPR API call. | No Parquet rows with ctx_id X; model retrain excludes. | `gdpr.audit.tve`. |
| **S-04** | System | *Cross-version replay determinism* | Replay 10 k events on last 3 model versions; diff ≤ 1 %. | Stored events. | Hash diff report passes. | `replay.diff.csv`. |

---

#### Logging & Metric Conventions (TVE)

| Stream / Series | Format | Key Fields |
|-----------------|--------|-----------|
| `tve.curve.debug` | JSONL | `ts,req_id,Vmax,a,k0,monotone` |
| `trainer.loss.trace` | JSONL | `step,loss,crps,rmse` |
| `model.reload.event` | JSONL | `old_sha,new_sha,lat_ms` |
| `explain.audit` | JSONL | `ctx_id,tokens,shap_vals` |
| Prometheus | `tve_*` prefix | latency, loss, reload, crps |
| OpenTelemetry | Spans | `predict_ms`, `shap_ms`, `mpc_decision` |

*When new instrumentation is added, append to this table so every AI or engineer knows where to dig.*

---

## 7 MVP vs Prod Dial-Switch  

| Component | Prod | MVP |
|-----------|------|-----|
| TVM Service | Triton GPU, half-precision | ONNX CPU |
| Dataset | S3 Parquet | local CSV |
| Trainer | multi-GPU | single-GPU |
| Explain API | SHAP | disabled |

---

### Appendix A – CRPS Component  

For predicted CDF \(F\) and observation \(x\):
\[
\text{CRPS}(F,x)=\int_{-\infty}^{\infty} \bigl(F(s)-\mathbf 1_{s\ge x}\bigr)^2 ds
\]  

Used here on distribution of \(V_{\max}\) prediction (Monte-Carlo 20 samples).


# Competitor-Bid Estimation Subsystem  
### *Subsystem project specification*  
**SkyNet Token-Auction Ads • Technical Design Report v2.1 (2025-04-23)**  

> *All section names, ordering, tables, and level of detail exactly match prior subsystem specs.*

---

## 0 Notation & Acronyms  

| Symbol / Term | Meaning |
|---------------|---------|
| \(W_{-i}(t)\) | aggregate weight of **all other** advertisers at token *t* |
| \(\hat μ_t,\,\hat σ_t\) | predicted mean & std-dev of \(\log W_{-i}(t)\) |
| \(\mathcal N(\,)\) | normal distribution |
| 2-CG | two-component Gaussian mixture |
| CE-ctx | 128-d axis embedding of condensed context (shared with MRO) |
| L\_ctx / L\_hist | lengths of context & bid history windows used as features |
| DRL | deep reinforcement learning self-play simulator |
| RMSE | root–mean-square error |
| KS | Kolmogorov–Smirnov statistic |
| RHC | Receding-Horizon Controller |
| TT-Tiny | 2-layer, 4-head Tiny-Transformer predictor |

---

## 1 Goals & System Context  

### 1.1 Functional Goals  

| Goal | Description |
|------|-------------|
| **G-1. Predict competitor bidding power** — output \((\hat μ_t,\hat σ_t)\) of \(\log W_{-i}(t)\) each token. |
| **G-2. < 3 ms/token** total prediction latency at 50 k QPS; ≤ 25 ms on laptop MVP. |
| **G-3. Daily self-supervised retrain**; canary promotion only if RMSE↓ > 2 %. |
| **G-4. Robust to adversarial manoeuvres** (spikes, under-bids); maintain KS-drift ≤ 0.15. |
| **G-5. Reproducible offline replays** for audit & price-of-anarchy studies. |

### 1.2 External End-points  

| Dir | Name | Transport | Schema | Producer → Consumer | SLA |
|-----|------|-----------|--------|---------------------|-----|
| ↑ | `POST /predictor/infer` | gRPC proto `PredReq` | `{conv_id:str, token_idx:int, ctx_vec:f32[128]}` | RHC → Predictor Svc | ≤ 2.5 ms |
| ↓ | `PredResp` | `μ:float, σ:float, μ2:float, σ2:float, α:float` | Predictor Svc → RHC | — |
| ↓ | Kafka `auction.bids` | Avro `(conv_id,token_idx,W_-i_true)` | Bid Log Tap → Data Lake | async |
| ↓ | Kafka `predictor.errors` | Avro `(conv_id,token_idx,μ,σ,W_true)` | Error Logger | async |
| ↓ | ETCD `/pred/model/current` | TorchScript | Trainer → Predictor Svc | 1/day |

---

## 2 Architecture & Algorithms  

### 2.1 Sequence Diagram (per token)  

```
Auction clears token ──► Bid Log Tap  ─┐                   
                                       ▼                  
                              Real-Time Feature Hub        
                                       ▼  (fetch state)   
                               Feature Builder (CE-ctx ⊕ history)                           
                                       ▼  128-f tensor    
                                Predictor Inference Svc   
                                       ▼  μ,σ (+ mixture) 
                                       ▼                  
                               Receding-Horizon Ctrl      
```

### 2.2 Sub-block Specifications  

| ID | Name | Language / Container | Core Algorithm | HW | P95 lat | Threads |
|----|------|----------------------|----------------|----|---------|---------|
| **A** | Bid Log Tap | Rust async task in Auction pod | send Avro msg to `auction.bids` | CPU | 10 µs | 1 |
| **B** | Real-Time Feature Hub | Redis 7 cluster | ring-buffer per `conv_id` (ctx_vec + last 15 weights) | CPU | 0.3 ms | 8 |
| **C** | Feature Builder | FastAPI + PyTorch C++  | **Shared-axis cache** lookup of CE-ctx; concat Δ-time, token_idx, 15-len history stats; output float32[128] | CPU | 0.9 ms | 4 |
| **D** | Predictor Inference Svc | Triton + TT-Tiny (AWQ-int8) | TT-Tiny → Dense 5-head → \((μ_1,σ_1,μ_2,σ_2,α)\) for 2-CG | GPU | 1.3 ms | 1 |
| **E** | Error Logger | Rust consumer | compute residual; push to `predictor.errors` | CPU | 0.02 ms | 1 |
| **F** | Data Lake | S3 Parquet | partitions `/yyyy/mm/dd/` | — | — | — |
| **G** | DRL Self-Play Simulator | Ray + PyTorch | policy-grad; adds **spike & bluff adversaries** | 4×A10 | nightly 3 h | — |
| **H** | Supervised Fine-Tuner | PyTorch Lightning | MSE + Log-likelihood on log-normal | 2×A10 | 1 h | — |
| **I** | Robustness Test Harness | Python | generate 5 adversary scenarios; compute KS, RMSE | CPU | 10 min | — |
| **J** | Model Registry / Canary | MLflow + Envoy | 5 % traffic for 6 h; promote if RMSE↓ >2 % & KS < 0.15 | — | — | — |
| **K** | Monitoring & Alerting | Grafana + Prometheus | dashboards: RMSE, latency, KS-drift; alert rules | — | — | — |

#### 2.2.1 Feature Vector (128-d)

| Segment | Dim | Description |
|---------|-----|-------------|
| CE-ctx (axis) | 128 | from Max-Reward axis cache |
| 15 past log-weights | 15 | \(\log W_{-i}(t-j)\) (rolled window) |
| Stats (mean, std, slope) | 3 | of the 15-window |
| Token pos (sin-cos) | 4 | sin/cos token_idx / 1 000 |
| **Total** | **150 → PCA→128** | PCA fitted offline for latency |

---

### 2.3 Predictor Model (TT-Tiny)  

* Embedding 64 → 2 Transformer layers, 4 heads, hidden 128.  
* Output layer: 5-unit linear →  
  \[
  (μ_1,σ_1,μ_2,σ_2,α)=W h+b,\quad σ_i = \exp(r_i),\; α=\sigma(\hat α)
  \]
* Inference returns log-mixture to RHC.

---

## 3 Training & Validation Pipelines  

| Stage | Data | Loss / Obj | Hyper-params |
|-------|------|------------|--------------|
| Pre-train | 90 d auction logs | MSE on \(\log W_{-i}\) | AdamW 1e-4, 5 epochs |
| Supervised Tuner | last 30 d | negative log-likelihood of 2-CG + 0.1 MSE | LR 2e-5, batch 2048 |
| DRL Self-Play | synthetic env | minimise KL to real + regret | 256 envs, PPO, 2e5 steps |
| Robustness Tests | hold-out + adversaries | KS < 0.15, RMSE < baseline *0.98 | gating |

Promotion if **both** RMSE ↓ 2 % and KS ≤ 0.15.

---

## 4 Data Models & Retention  

| Table / Topic | Columns | TTL |
|---------------|---------|-----|
| `auction.bids` | conv_id, token_idx, ts, w_agg | 180 d |
| `predictor.errors` | conv_id, token_idx, μ,σ,w_true | 30 d |
| Parquet `pred_features` | ctx_vec:float32[128], past_w:float64[15], label | 365 d |

---

## 5 Security & Privacy  

* Kafka topics encrypted (SASL/TLS).  
* Feature vectors contain **no raw user text**.  
* Model weights stored in isolated S3 bucket with KMS.  
* DRL cluster no internet egress; temp files auto-purged.

---

## 6 Acceptance Criteria  

### 6.1 Interface Contracts  

| API | Req (proto) | Resp | Conditions |
|-----|-------------|------|------------|
| `PredReq` | `conv_id:str,token_idx:int,ctx_vec:bytes(512)` | see §1.2 | missing conv → 404 |
| Kafka schemas | Confluent Avro ID ≥ 100 | schema registry | no incompatible evolution |

### 6.2 Performance  

| Metric | Target | Test |
|--------|--------|------|
| End-to-end `infer()` | ≤ 2.5 ms P95 | locust 10 k rps |
| RMSE 30 d | ≤ 0.12 | nightly SQL |
| KS-drift | ≤ 0.15 | monitor alert |

### 6.3 
**Unit (U-xx)**, **Component (C-xx)**, **Integration (I-xx)**, and **System-wide (S-xx)**.  Log names and Prometheus metric prefixes are provided for traceability.


| ID | Scope | Title | Description – *what & why* | Pre-conditions / Fixtures | Expected Outcome | Primary Logs / Metrics |
|----|-------|-------|----------------------------|---------------------------|------------------|------------------------|
| **U-01** | **Unit** | *Feature-window rotate* | Verify Real-Time Feature Hub drops the oldest log-weight and appends the newest, keeping length = `L_hist = 15`. Ensures temporal ordering. | Populate buffer with 15 floats, push one new value. | First value evicted; len = 15. | `feature_hub.rotate.debug` |
| **U-02** | Unit | *CE-ctx lookup cache hit* | Axis embedding fetched from shared cache in ≤ 10 µs. Avoids recompute latency. | Pre-warm cache. | Lookup time < 10 µs. | Prom `cbp_ctx_hit_latency` |
| **U-03** | Unit | *PCA reverse transform error* | After PCA→inverse, average cosine drop ≤ 0.03. Guards against bad PCA matrix. | 1 000 random 150-d vectors. | Mean Δ≤ 0.03. | `pca.inverse.test` |
| **U-04** | Unit | *Mixture parameters domain* | σ₁, σ₂ > 0 and 0 ≤ α ≤ 1 for all outputs. Prevent numerical explosions. | Feed 512 random features through TorchScript. | Assertions pass. | `predictor.output.check` |
| **U-05** | Unit | *Spike-attack robustness* | Inject synthetic ×10 bid spike in history; RMSE increase < 25 %. | Craft history window. | RMSEΔ ≤ 25 %. | `robust.spike.metric` |
| **U-06** | Unit | *Under-bid bluff robustness* | History set to 0.1× typical; KS drift ≤ 0.05. | Synthetic window. | KS ≤ 0.05. | `robust.bluff.metric` |
| **U-07** | Unit | *σ scaling invariance* | If all past log-weights shifted by +c, predicted σ remains unchanged (translation invariance). | Add +2 to every input. | |σ_shift| < 1e-3. | `sigma.invariance.log` |
| **U-08** | Unit | *Redis TTL enforcement* | History entry older than 60 s auto-expires. | Insert key, advance clock. | Key deleted. | Redis keyspace event, `cbp_ttl_evictions` |
| **U-09** | Unit | *TorchScript hash determinism* | Serialise-deserialise model; SHA256 unchanged. | Round-trip save/load. | Hash equality. | `registry.hash.cbp` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **C-01** | **Component** | *Inference latency GPU* | `/predictor/infer` P95 ≤ 2.5 ms on A100. | 100 k requests @ 50 QPS. | p95 ≤ 2.5 ms, p99 ≤ 3.5 ms. | `cbp_latency_gpu.prom` |
| **C-02** | Component | *Inference latency CPU (MVP)* | Same on 16-core laptop. | 10 k requests. | p95 ≤ 25 ms. | `cbp_latency_cpu.prom` |
| **C-03** | Component | *Feature-builder PCA bug guard* | If PCA matrix missing, service returns 503 not wrong values. | Remove `PCA.bin`. | HTTP 503, alert fired. | `feature_builder.error` |
| **C-04** | Component | *Hot-swap model zero-downtime* | Update ETCD model blob while 1 000 RPS live. | Push new TorchScript. | 0 gRPC failures; new SHA in metrics. | `model_reload.event`, `cbp_reload_ms` |
| **C-05** | Component | *Error-logger rate* | Residual > 3 σ triggers error log; rate ≤ 1 % of calls. | Simulate heavy tail. | Error log ratio ≤ 1 %. | `cbp_error_ratio.prom` |
| **C-06** | Component | *KS-drift monitor alert* | Push synthetic distribution drift KS = 0.2. | Inject anomalous data. | Alert fires within 5 min. | Prom alert `KS_DRIFT_HIGH` |
| **C-07** | Component | *Redis failover* | Kill primary Redis shard; latency spike < 1 ms. | Sentinels enabled. | Auto-promote replica, SLA met. | Redis failover log, `cbp_redis_failover_ms` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **I-01** | **Integration** | *Predictor→RHC path* | RHC uses μ, σ to set reserve price; verify higher μ leads to higher bid. | Two identical auctions differing only in predicted μ. | Auction with larger μ produces ≥ 5 % higher reserve. | `rhc.reserve.debug` |
| **I-02** | Integration | *Bid log feedback completeness* | For 10 k tokens, `auction.bids` count matches predictor calls. | Full pipeline Docker-compose. | Counts equal. | Kafka lag `cbp_bids_lag=0` |
| **I-03** | Integration | *Daily retrain & canary* | Inject 1 M new rows; run Trainer → Canary 5 %. | Baseline RMSE 0.13. | Canary RMSE ≤ 0.127; promotion event logged. | `canary.promote.log` |
| **I-04** | Integration | *Adversary scenario replay* | Run DRL spike-attack scenario; KS ≤ 0.15 gating. | Nightly robustness DAG. | Pipeline passes; else stays on old model. | `robust.test.report` |
| **I-05** | Integration | *Predictor latency under 50 k QPS* | Full stack load test including Feature Hub. | Locust 50 k RPS, 5 min. | Global p95 ≤ 3 ms. | `cbp_stack_latency.prom` |
| **I-06** | Integration | *Schema evolution guard* | Update `auction.bids` Avro with optional field; Consumer compatibility. | Deploy new schema id. | Predictor continues; schema registry shows compatible. | `schema_compat.event` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **S-01** | **System-wide** | *Revenue impact A/B* | 4-h A/B: CBP-guided reserve vs static +2 % rule. | Traffic splitter 50/50. | CBP arm revenue ↑ ≥ 0.7 %. | Grafana board `revenue_lift_cbp` |
| **S-02** | System | *Cross-subsystem failure cascade* | Kill Predictor GPU pod; ensure MRO, RHC, Auction continue using last μ,σ. | ChaosMonkey kill. | No 5xx; fallback μ,σ cached 5 min. | `fallback.metric`, incident JIRA auto-created. |
| **S-03** | System | *Monthly compliance audit replay* | Replay 1 M events; verify deterministic outputs with stored seeds. | Run audit script. | Hash diff ≤ 0.1 %. | `audit.replay.csv` |
| **S-04** | System | *GDPR bid purge* | Remove all events for adv ID 77; ensure Parquet + Redis cleared. | GDPR API call. | No rows with adv 77 in S3; cache evicted. | `gdpr_purge.log`, lineage graph diff |

---

#### Logging & Metric Conventions (CBP)

| Stream / Series | Format | Key Fields |
|-----------------|--------|-----------|
| `feature_hub.rotate.debug` | JSONL | `ts,conv_id,oldest_evicted` |
| `cbp_latency_gpu.prom` | Prometheus | histogram buckets |
| `model_reload.event` | JSONL | `old_sha,new_sha,duration_ms` |
| `robust.*` | JSONL | `scenario,rmse,ks` |
| Kafka topics | Avro | versioned by schema registry |
| OTEL spans | `predict_ms`, `feature_build_ms` | trace root = `conv_id` |

*When new instrumentation is added, append to this table so every AI or engineer knows where to dig.*

---

## 7 MVP vs Prod Dial-Switch  

| Component | Prod | MVP |
|-----------|------|-----|
| Predictor | TT-Tiny int8 GPU | Bi-GRU FP32 CPU |
| Feature Hub | Redis cluster | Python dict |
| Kafka | Confluent Cloud | in-proc queue |
| DRL Trainer | Ray on A10x4 | skipped |

---

### Appendix A — 2-Component Gaussian Mixture Output  

Let  
\[
p(W)=\alpha\mathcal N(\ln W;\, μ_1,σ_1^2)+(1-\alpha)\mathcal N(\ln W; μ_2,σ_2^2)
\]  
Cumulative distribution used by MPC:

\[
P(W\le w)=\alpha Φ\!\bigl(\tfrac{\ln w-μ_1}{σ_1}\bigr)+(1-\alpha)Φ\!\bigl(\tfrac{\ln w-μ_2}{σ_2}\bigr)
\]

Derivatives cached for Newton solve inside MPC.



# Receding-Horizon Controller (MPC) Subsystem  
### *Subsystem project specification*  
**SkyNet Token-Auction Ads • Technical Design Report v2.2 (2025-04-23)**  

*(Format identical to previous subsystem specs; every section present and expanded to full depth.)*

---

## 0 Notation & Acronyms  

| Symbol / Term | Meaning |
|---------------|---------|
| \(H\) | look-ahead horizon (default = 3 tokens) |
| \(w\), \(w^{\star}\) | candidate bid weight, optimal bid weight |
| \(μ_1,σ_1,μ_2,σ_2,α\) | 2-component log-Gaussian parameters from Predictor |
| \(p_t(w)\) | win-probability for token *t* given bid *w* |
| \(ΔV_t, L_t\) | marginal value and abandonment loss from TVE |
| \(U(w)\) | horizon utility function |
| \(M\) | momentum threshold for abandonment (default 2) |
| \(λ_{\text{risk}}\) | salvage vs. risk coefficient (default 0.5) |
| \(T_{\text{left}}\) | seconds until campaign end |
| \(neg\_cnt\) | running negative-momentum counter |
| \(plan\_id\) | tokens remaining in truncated trajectory |
| TT-Tiny | Tiny-Transformer predictor (from CBP) |

---

## 1 Goals & System Context  

### 1.1 Functional Goals  

| Goal | Description |
|------|-------------|
| **G-1. Compute optimal bid \(w^{\star}\)** every token, maximising expected utility over horizon *H*. |
| **G-2. P95 latency ≤ 0.9 ms** on A100; ≤ 12 ms on laptop MVP. |
| **G-3. Respect advertiser pacing** and hard budget caps. |
| **G-4. Abandon or shorten trajectory gracefully** using momentum + risk heuristic. |
| **G-5. Expose explainable telemetry** (`mpc.decisions`) for audit & tuning. |

### 1.2 Runtime End-points  

| Dir | Name | Transport | Schema | Producer → Consumer | SLA |
|-----|------|-----------|--------|---------------------|-----|
| ↑ | `PredResp` | gRPC | `{μ1,σ1,μ2,σ2,α}` | Predictor → MPC | per token |
| ↑ | `TveResp` | gRPC | `{dV:list[float16], L:list[float16]}` | TVM → MPC | per token |
| ↑ | `budget_state` | HTTP/JSON | `{budget_left:float, end_ts:int64}` | Budget Loader → MPC | 100 ms cache |
| ↓ | `bid w★` | shared-mem float32 | MPC → Token-Auction Engine | per token |
| ↓ | `plan_id` | gRPC | `{plan_id:int}` (optional) | MPC → Content-Gen Wrapper | on abandon |
| ↓ | Kafka `mpc.decisions` | Avro | `(conv_id,token_idx,μ,σ,μ2,σ2,α,w*,util,abandon)` | MPC | async |

---

## 2 Architecture & Algorithms  

### 2.1 Sequence Diagram  

```
 Predictor ─► μ1,σ1,μ2,σ2,α ─┐
 TVM ──────► ΔV_t , L_t  ─────┤
 Budget Loader ─► budget_left,end_ts │
                                  ▼
                      +-----------------------+
                      |   MPC Core (this)     |
                      +-----------------------+
  p_eval , U(w) , Newton/Bisect , Guard , Momentum
                                  │
                       bid w★     ▼
                           Token-Auction Engine
                                  │
                              chosen token
                                  │
                          Kafka mpc.decisions
```

### 2.2 Sub-block Specifications  

| ID | Name | Lang / Container | Core Algorithm | HW | P95 lat | Threads |
|----|------|------------------|----------------|----|---------|---------|
| **A** | Input Buffer | C++17 static lib | circular arrays store last *H* tuples *(μ*,σ,ΔV,L)* | CPU | 0.05 ms | 1 |
| **B** | Probability Module | C++17 / SIMD | **2-component log-Gaussian CDF**:<br>\(p_t(w)=α Φ\!\bigl(\frac{\ln w-μ_1}{σ_1}\bigr)+(1-α)Φ\!\bigl(\frac{\ln w-μ_2}{σ_2}\bigr)\)<br>pre-computes \(p',p''\). | CPU | 0.30 ms | 1 |
| **C** | Utility Builder | header-only | \(U(w)=\sum_{t=1}^H p_t(w)ΔV_t-(1-p_t(w))L_t-wH\) | CPU | 0.10 ms | 1 |
| **D** | Solver Core | C + SIMD | 2-iter Newton-Raphson; fallback bisection if \(U'\) sign flip; tolerance 1e-4. | CPU | 0.20 ms | 1 |
| **E** | Budget Guard | Rust | Pacing:<br>\(w^{\text{paced}}=w^{\star}\min(1,\frac{budget_{left}}{T_{left}})\); clamp to `w_max`. | CPU | 0.07 ms | 1 |
| **F** | Momentum Abandon Switch | Rust | maintain `neg_cnt`; abandon if `neg_cnt≥M`. Compute `plan_id=k'` where minimal \(k'\) s.t. \(\sum_{j=t}^{t+k'}ΔV_j > λ_{risk}L_t\). | CPU | 0.08 ms | 1 |
| **G** | Telemetry Logger | Rust | Avro encode → `mpc.decisions`; non-blocking | CPU | 0.02 ms | 1 |
| **H** | Horizon & Risk Tuner | PySpark | weekly grid-search {H∈1..5, λ_risk∈[0.3,0.7], σ_max, M} → maximise realised ROI | CPU | offline | — |

---

### 2.3 Mathematical Details  

#### 2.3.1  CDF & Derivatives  

Let  
\[
g_i(w)=Φ\!\Bigl(\frac{\ln w-μ_i}{σ_i}\Bigr),\quad g_i'(w)=\frac{ϕ(\frac{\ln w-μ_i}{σ_i})}{wσ_i}.
\]

Then  
\[
p_t(w)=α g_1(w)+(1-α)g_2(w),\quad
p_t'(w)=α g_1'(w)+(1-α)g_2'(w).
\]

Second derivative \(p''\) approximated by finite diff for Newton step.

#### 2.3.2  Newton Update  

\[
w_{k+1}=w_k-\frac{U'(w_k)}{U''(w_k)+1e^{-6}}
\]

Two iterations suffice due to near-quadratic shape; if \(w_{k+1}\) exits \([0,w_{\max}]\), fall back to bisection.

#### 2.3.3  Momentum Rule  

```
if U_t < 0 or σ_eff > σ_max:
    neg_cnt += 1
else:
    neg_cnt = 0
if neg_cnt >= M:
    abandon = True
```

`σ_eff = α σ1 + (1-α) σ2`.

---

## 3 Training & Calibration Pipelines  

| Job | Data | Objective | Outcome |
|-----|------|-----------|---------|
| Utility Simulator | past 30 d logs | Monte-Carlo simulate \(w\) grid; collect realised ROI | offline contour for w_max |
| Horizon/Risk Tuner | `mpc.decisions` + click ROI | search param grid; pick top ROI | update ConfigMap (`H,λ_risk,M,σ_max`) |
| Guard Pacing Tuner | budget spend logs | keep spend variance ≤ 15 % of linear pacing | adjust pacing formula slope |

---

## 4 Data Models & Retention  

```sql
CREATE TABLE mpc_decisions (
  day DATE,
  conv_id STRING,
  token_idx INT,
  mu1 FLOAT, sigma1 FLOAT, mu2 FLOAT, sigma2 FLOAT, alpha FLOAT,
  w_star FLOAT,
  util FLOAT,
  abandon BOOLEAN,
  latency_ms FLOAT
) STORED AS PARQUET;
```

TTL: 180 d; partitioned by `day`.

---

## 5 Security & Privacy  

* No PII stored; conv_id keyed random UUID.  
* ConfigMap updates require code-signing token.  
* All gRPC calls mTLS; fallback old-value if cert expired.

---

## 6 Acceptance Criteria  

### 6.1 Interface Contracts  

| API | Request | Response | P95 |
|-----|---------|----------|-----|
| `/predictor/infer` | see §1.2 | same | 2.5 ms |
| `/tve/predict` | — | — | 10 ms |
| MPC output | shared float32 | `w_star` finite, ≥0 | — |

### 6.2 Performance  

| Metric | Target | Test |
|--------|--------|------|
| Latency per token | ≤ 0.9 ms (GPU node), ≤ 12 ms CPU | locust |
| ROI gain vs fixed-bid | ≥ +4 % | offline replay |
| Abandon false-positive | ≤ 2 % trajectories | A/B logs |

### 6.3 
**Unit (U-xx)**, **Component (C-xx)**, **Integration (I-xx)**, and **System-wide (S-xx)**.  Log names and Prometheus metric prefixes are provided for traceability.

| ID | Scope | Title | Description – *what & why* | Fixtures / Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|----------------------------|---------------------------|------------------|----------------|
| **U-01** | **Unit** | *2-CG CDF sanity* | Confirm \(p_t(μ_1)=α\) and \(p_t(μ_2)=1-α\). Validates probability module math. | Random params \(μ,σ,α\). | L∞ error ≤ 1 e-3. | `prob_module.sanity` |
| **U-02** | Unit | *g′(w) positivity* | \(p_t'(w)\) > 0 for all \(w>0\). Avoids Newton divergence. | Sweep w∈[0.01,10]. | All derivatives positive. | `mpc_derivative.debug` |
| **U-03** | Unit | *Utility monotone vs ΔV sign* | If all ΔV_t > 0 and L_t = 0, then U(w) strictly ↓ in w. | Synthetic ΔV = +1. | Solver returns w★≈0. | `utility.sign.check` |
| **U-04** | Unit | *Newton convergence 2-iter* | |Δw| < 1 e-4 after ≤2 Newton steps on 1 000 random samples. | Random μ,σ,ΔV,L. | Pass. | `solver.newton.stats` |
| **U-05** | Unit | *Bisection fallback* | When U′ sign flips, solver enters bisection and converges < 10 iters. | Construct pathological params. | |Δw| < 1 e-3. | `solver.fallback.log` |
| **U-06** | Unit | *Budget guard clamp* | \(w^{\text{paced}}\) never exceeds `w_max` nor causes spend > budget_left/T_left. | budget_left small. | Clamped value. | `budget_guard.debug` |
| **U-07** | Unit | *Momentum counter logic* | neg_cnt increments only on consecutive negatives; resets otherwise. | Manual sequence [-,-, +,-]. | neg_cnt pattern 1-2-0-1. | `momentum.unit.trace` |
| **U-08** | Unit | *Plan-id computation* | Abandon rule returns minimal k′ s.t. future ΔV ≥ λ_risk L_t. | Fixture ΔV=[1,1,1], L=2, λ=0.5 | plan_id=1. | `abandon.calc.log` |
| **U-09** | Unit | *ConfigMap signature check* | Unsigned horizon/risk update rejected. | Push unsigned map. | Error raised, old config kept. | `config.sig.error` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **C-01** | **Component** | *Token latency GPU* | Measure end-to-end compute (A→F) on A100. | 50 k tokens @ 5 k RPS. | p95 ≤ 0.9 ms. | `mpc_latency_gpu.prom` |
| **C-02** | Component | *Token latency CPU (MVP)* | Same on 8-core laptop. | 10 k tokens. | p95 ≤ 12 ms. | `mpc_latency_cpu.prom` |
| **C-03** | Component | *Probability ± INF guard* | σ→0 edge case returns p∈\{0,1\} without NaN. | σ₁=σ₂=1e-6. | Valid floats. | `prob.inf.guard` |
| **C-04** | Component | *Second derivative stabliser* | Ensure \(U''\) finite with ε=0.01 w. | Random samples. | No NaNs; Newton steps finite. | `solver.u_dd.debug` |
| **C-05** | Component | *Budget pacing accuracy* | Spend variance ≤ 15 % of linear. | Simulate 10 h spend. | Var% ≤ 15. | `pacing.var.prom` |
| **C-06** | Component | *Telemetry throughput* | Kafka `mpc.decisions` throughput ≥ call rate. | 25 k RPS for 1 min. | No backlog (lag = 0). | Kafka lag metric |
| **C-07** | Component | *Abandon false-positive rate* | Simulated high-value trajectories. | 1 k runs, ΔV≫L. | abandon ≤ 1 %. | `abandon.fp.rate` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **I-01** | **Integration** | *Predictor+TVE+MPC loop* | Provide consistent μ/σ and ΔV/L; verify w★ reacts correctly. | Two scenarios: high value vs low value. | w★_high > w★_low. | OTEL span `mpc_decision` |
| **I-02** | Integration | *Plan switch propagation* | MPC issues `plan_id`; Content-Gen truncates. | Force abandon. | Reply ends where expected. | `plan_switch.event` |
| **I-03** | Integration | *Budget exhaustion cascade* | budget_left = 0; verify w★=0, Auction picks next adv. | Adv budget=0. | Zero spend logged. | `budget.exhaust.audit` |
| **I-04** | Integration | *Latency under 40 k QPS* | Full pipeline (Predictor→TVE→MPC) 40 k RPS. | K8s autoscaled. | p95 ≤ 1.5 ms end-to-end. | `mpc_stack_latency.prom` |
| **I-05** | Integration | *Horizon param hot-swap* | Update ConfigMap `H=4`; next token uses new H without errors. | Push signed config. | Telemetry shows `horizon=4`. | `config.reload.log` |
| **I-06** | Integration | *Newton divergence recovery* | Feed adversarial μ,σ causing U''≈0; Solver falls to bisection. | Pathological sample. | Service latency ≤ 2 ms, valid w★. | `solver.fallback.metric` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **S-01** | **System-wide** | *ROI uplift vs fixed bid* | A/B 4 h: MPC vs constant \$0.05. | Traffic splitter 50/50. | ROI lift ≥ 4 %. | Grafana `roi_lift_mpc` |
| **S-02** | System | *Cross-region fail-over* | Kill primary MPC pod pool. | Multi-AZ setup. | RTO < 60 s; p95 ≤ 5 ms during fail-over. | `mpc_failover.timer` |
| **S-03** | System | *Replay determinism* | Re-run 100 k logged convos with stored seeds. | Deterministic mode. | w★ hash diff ≤ 0.1 %. | `replay.diff.csv` |
| **S-04** | System | *Config tamper protection* | Push unsigned config; verify rejection & alert. | Tampered file. | Config unchanged; alert fired. | `config.sig.alert` |

---

#### Logging & Metric Conventions (MPC)

| Stream / Series | Format | Key Fields |
|-----------------|--------|-----------|
| `prob_module.*` | JSONL | `μ1,σ1,μ2,σ2,α,w,p,ctx_id` |
| `solver.*` | JSONL | `w0,w1,iter,method,conv` |
| `budget_guard.*` | JSONL | `adv_id,w_raw,w_paced,budget_left` |
| `abandon.*` | JSONL | `conv_id,t,L,ΔV,neg_cnt,plan_id` |
| Kafka `mpc.decisions` | Avro | schema v1.0 |
| Prometheus | `mpc_*` prefix | latency,horizon,abandon_fp,etc. |
| OTEL spans | `mpc_decision_ms`, parent=`conv_id` |

*When new instrumentation is added, append to this table so every AI or engineer knows where to dig.*

---

## 7 MVP vs Prod Dial-Switch  

| Component | Prod | MVP |
|-----------|------|-----|
| Predictor params | 2-CG mixture | single log-normal |
| Redis Hub | cluster | Python dict |
| Triton | yes | CPU TorchScript |
| Telemetry | Kafka | CSV file |

---

### Appendix A — Utility Gradient  

\[
U'(w)=\sum_{t=1}^H p_t'(w)\bigl(ΔV_t+L_t\bigr)-H
\]

Second derivative approximated:

\[
U''(w)\approx\frac{U'(w+\epsilon)-U'(w-\epsilon)}{2\epsilon},\quad \epsilon=0.01w
\]

Used to stabilise Newton-Raphson.



# Token-Auction Execution Subsystem  
### *Subsystem project specification*  
**SkyNet Token-Auction Ads • Technical Design Report v2.3 (2025-04-23)**  

*(All structure, ordering, and depth identical to prior subsystem specs.)*

---

## 0 Notation & Acronyms  

| Symbol / Term | Meaning |
|---------------|---------|
| \(V\) | vocabulary size (≈ 50 k BPE) |
| \(P_{\rm ref}(x\midπ_t)\) | reference LLM next-token distribution |
| \(P_i(x\midπ_t)\) | advertiser *i* (our) next-token distribution |
| \(P_j(x\midπ_t)\) | competitor *j* distribution |
| \(w_{\rm ref},w_i,w_j\) | fixed scalar weights (reference, ours, competitor *j*) |
| \(N_t(x)\) | weight-mixed score at token *t* |
| \(c_t\) | critical bid for token *t* |
| VCG | Vickrey–Clarke–Groves mechanism |
| GPU-Fused | single kernel combining softmax & argmax |
| SGL | Streaming gRPC Log writer |
| MVP-ChatGPT | local demo that splices advertiser tokens into an OpenAI chat completion stream |

---

## 1 Goals & System Context  

### 1.1 Functional Goals  

| Goal | Description |
|------|-------------|
| **G-1. Allocate each next token** by running a linear-blend VCG auction among reference + advertiser models. |
| **G-2. Compute & charge VCG payments** (critical bid \(c_t\)) per token with proof of strategy-proofness. |
| **G-3. < 15 µs GPU time + < 3 ms policy filter** per token @ 50 k QPS; ≤ 100 µs CPU for MVP. |
| **G-4. Produce bid logs for Predictor/Telemetry** without blocking real-time loop. |
| **G-5. MVP stream patch**: overlay auction result onto an OpenAI ChatCompletion streaming API for local demo. |

### 1.2 External End-points  

| Dir | Name | Transport | Schema | Producer → Consumer | Timing |
|-----|------|-----------|--------|---------------------|--------|
| ↑ | `logits_ad` | shared-mem ptr f16[V] | Content-Gen LLM → Auction | per token |
| ↑ | `logits_comp[j]` | gRPC stream (proto `LogitChunk`) | remote advertiser *j* → Auction | per token |
| ↑ | `w_bid` | float32 | MPC → Auction | per token |
| ↑ | `w_comp[j]` | HTTP JSON (pre-reply) | competitor portal → Auction | once per reply |
| ↓ | `chosen_token` | uint32 | Auction → TokenWrap | per token |
| ↓ | `W_-i_true` | float32 | Auction → CBP FeatureHub | per token |
| ↓ | Kafka `auction.bids` | Avro `(conv_id,token_idx,w_ref,w_i,w_-i)` | Auction | async |
| ↓ | Kafka `auction.vcg` | Avro `(conv_id,token_idx,c_t,pay_i)` | Auction | async |

---

## 2 Architecture & Algorithms  

### 2.1 Sequence Diagram (deterministic path)  

```
Content-Gen logits ─┐
Competitor logits   ├──► GPU-Fused Mixer ─► Argmax ─► Policy Filter ─► chosen token
Ref logits          ┘              │                        │
                    │              │                        └─► fallback ref token if unsafe
                    │              │
MPC bid w★ ─────────┘              ├─► Critical Bid Calc (c_t)
                                   └─► Async Log Writer ─► Kafka
```

### 2.2 Sub-block Specifications  

| ID | Name | Lang / Container | Core Algorithm | HW | P95 lat | Threads |
|----|------|------------------|----------------|----|---------|---------|
| **A** | Logit Collector | C++17 | merge f16 pointers into contiguous GPU tensor | GPU | 3 µs | — |
| **B** | GPU-Fused Mixer | CUDA kernel | compute<br>\(N_t(x)=w_{\rm ref}P_{\rm ref}(x)+w_iP_i(x)+\sum_jw_jP_j(x)\)<br>optionally multiply by temp = 0.7 | GPU | 10 µs | — |
| **C¹** | Deterministic Chooser | CUDA | `argmax_x N_t(x)` | GPU | 2 µs | — |
| **C²** | Stochastic Chooser | CUDA RNG | sample from categorical(N_t) | GPU | 4 µs | — |
| **D** | Critical-Bid Calculator | CUDA | find second-best token \(s^\*\); \(c_t=(B(s^\*)-B(t))/(P_i(t)-P_i(s^\*))\) where \(B(x)=w_{\rm ref}P_{\rm ref}+\sum_{j\neq i}w_jP_j\). | GPU | 5 µs | — |
| **E** | Policy Filter | ONNX + regex | toxicity/PII classifier; fallback to ref token | GPU | 3 ms | 1 |
| **F** | Async Log Writer (SGL) | Rust | ring buffer + librdkafka producer | CPU | < 0.05 ms | 2 |
| **G** | MVP-ChatGPT Overlay | Python (async) | intercept stream; on ad section, insert tokens from Auction; throttle to 20 token/s | CPU | 100 µs / token | 1 |

---

## 3 Mathematical Details  

### 3.1 Allocation Rule  

For each token step \(t\):

\[
x_t = 
\begin{cases}
\arg\max_{x\in V} N_t(x) & \text{deterministic mode},\\[4pt]
\text{sample } x\sim \mathrm{Cat}\bigl(\tfrac{N_t(x)}{\sum_yN_t(y)}\bigr) & \text{stochastic}.
\end{cases}
\]

### 3.2 VCG Payment Proof (single-parameter case)  

*Bid space*: advertiser submits weight \(w_i\ge0\) once per reply.

*Monotonicity*: For fixed others’ weights, \(N_t(x)\) is linear in \(w_i\).  
If advertiser increases \(w_i\), their probability (or indicator) of winning token \(t\) weakly increases.  

*Critical Bid*: Smallest \(w_i\) such that \(t\) remains winner:

\[
c_t = \frac{B(s^\*)-B(t)}{P_i(t)-P_i(s^\*)},
\quad 
B(x)=w_{\rm ref}P_{\rm ref}(x)+\sum_{j\neq i} w_jP_j(x).
\]

*VCG Truthfulness*: Utility per token  
\[
u_t(w_i)=\begin{cases}
ΔV_t - c_t & w_i\ge c_t,\\
0 & w_i<c_t.
\end{cases}
\]
Because \(c_t\) is independent of \(w_i\) once outcome fixed, \(u_t\) is maximised by reporting true max-willingness \(w_i^{\text{true}}\). Therefore bidding \(w_i=w_i^{\text{true}}\) is dominant. Summing over tokens preserves property (per-token separable).

*Budget Pacing* does not break truthfulness because guard applies symmetric monotone scaling to all candidate bids before comparison; effective bid = min(real w_i, pace) is still the truthful cap within horizon.

### 3.3 Computational Complexity  

* Mixer kernel: \(O(|V|)\) with 2–3 fused ops → 10 µs.   
* Critical calculation: 2nd best search via warp reduction; \(O(\log |V|)\).

---

## 4 Training & Calibration (none)  

Auction logic is parameter-free; only policy filter and temperature come from ConfigMap.

---

## 5 Data Models & Retention  

| Topic | Schema | TTL |
|-------|--------|-----|
| `auction.bids` | `(conv_id,token_idx,w_ref,w_i,w_-i)` | 180 d |
| `auction.vcg` | `(conv_id,token_idx,c_t,pay_i)` | 180 d |
| `auction.policy` | `(conv_id,token_idx,flag_reason)` | 30 d |

---

## 6 Security & Privacy  

* Logits shared by pointer within GPU memory; never copied off card.  
* Payments aggregated per reply; invoice generator runs server-side, encrypted.  
* Policy filter prevents policy-violating token output; fallback ensures no user exposure.  

---

## 7 Acceptance Criteria  

### 7.1 Interface Contracts  

| API | Request | Response | P95 |
|-----|---------|----------|-----|
| `Auction.execute(token_ctx)` | shared ptrs + weights | `{token_id:uint32}` | 25 µs GPU |
| MVP overlay | OpenAI `stream=True` chunks | same stream w/ ad tokens | 0 dropped frames |

### 7.2 Performance  

| Metric | Target | Test |
|--------|--------|------|
| GPU time / token | ≤ 15 µs | nvprof batch |
| CPU time / token | ≤ 100 µs MVP | local py test |
| Critical bid error | ≤ 1e-6 | unit math tests |
| Policy FP | ≤ 0.1 % | toxic corpus |

### 7.3 
**Unit (U-xx)**, **Component (C-xx)**, **Integration (I-xx)**, and **System-wide (S-xx)**.  Log names and Prometheus metric prefixes are provided for traceability.

| ID | Scope | Title | Description – *what & why* | Fixtures / Pre-conditions | Expected Outcome | Primary Logs / Metrics |
|----|-------|-------|----------------------------|---------------------------|------------------|------------------------|
| **U-01** | **Unit** | *Mixer weight-sum sanity* | Ensure Σ Nₜ(x) ≈ w_ref + w_i + Σ w_j (within 1 e-3). Detects kernel mis-scaling. | Random logits, weights. | Relative error < 1 e-3. | `mixer.sum.check` |
| **U-02** | Unit | *Argmax vs manual* | GPU argmax result equals Python numpy argmax. Guards against warp reduction bug. | 512 random vectors. | 100 % match. | `mixer.argmax.test` |
| **U-03** | Unit | *Critical bid closed-form* | Analytical c_t equals brute-force threshold. | Random logits set where advertiser wins. | |Δc_t| < 1 e-6. | `vcg.cbid.accuracy` |
| **U-04** | Unit | *Payment monotonicity* | pay_i strictly increases with w_i (holding others). Strategy-proof check. | Sweep w_i. | dp/dw ≥ 0. | `vcg.monotone.metric` |
| **U-05** | Unit | *Policy filter fallback* | Toxic token replaced by reference token. Ensures no unsafe output. | Force classifier=true. | chosen_token == ref_token. | `policy.fallback.log` |
| **U-06** | Unit | *GPU kernel OOB guard* | Mixer respects vocab size V; no memory over-read with V=50 007. | Launch fuzz size. | No CUDA OOB errors. | cuda-sanitizer output |
| **U-07** | Unit | *Stochastic sampler prob* | Sample frequencies match Nₜ(x) within χ² tolerance. | 1 M draws, 4-token dist. | χ² p-value > 0.05. | `sampler.chi2.stats` |
| **U-08** | Unit | *Shared-ptr lifetime* | Logits pointer remains valid until mix kernel completes. | Shadow copy + memcheck. | No invalid access. | valgrind cuda-check |
| **U-09** | Unit | *MVP CPU path parity* | CPU numpy mixer returns same token as GPU kernel. | 100 random cases. | 100 % match. | `mvp.cpu.parity` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **C-01** | **Component** | *GPU time / token* | nvprof shows kernel time ≤ 15 µs. | 100 k tokens batch. | p95 ≤ 15 µs. | `auc_gpu_us.prom` |
| **C-02** | Component | *Policy filter latency* | ONNX classifier + regex ≤ 3 ms. | 10 k toxic + non-toxic. | p95 ≤ 3 ms. | `auc_policy_ms.prom` |
| **C-03** | Component | *Async log writer throughput* | SGL ring buffer keeps up at 60 k TPS. | Load generator. | Kafka lag = 0. | `auc_log_lag` |
| **C-04** | Component | *VCG payment precision* | 64-bit vs 32-bit calc diff ≤ 1e-5. | 10 k random samples. | Pass. | `auc_pay_precision` |
| **C-05** | Component | *Deterministic vs stochastic mode toggle* | Config switch changes chosen-token entropy. | Flip flag. | Entropy_diff > 0.5. | `auc_mode.switch.log` |
| **C-06** | Component | *CUDA stream reuse* | Mixer & chooser share same stream; no synchronization stalls. | CUPTI profiling. | Overlap > 90 %. | CUPTI timeline |
| **C-07** | Component | *MVP overlay integrity* | OpenAI stream frames preserved, ad tokens inserted at markers. | Local demo. | No malformed SSE frames. | `mvp.overlay.debug` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **I-01** | **Integration** | *Auction↔Wrapper loop* | chosen_token reaches TokenWrap; UI shows correct char. | Full GPU pipeline. | No gaps / mis-ordering. | OTEL span `auction→wrapper_ms` |
| **I-02** | Integration | *Bid log completeness* | `auction.bids` count == tokens emitted. | 20 k tokens run. | Counts equal. | Kafka lag `auc_bids_lag` |
| **I-03** | Integration | *VCG billing reconciliation* | Sum pay_i equals offline recompute within 0.01 %. | Daily job. | Diff < 0.01 %. | `billing.diff.report` |
| **I-04** | Integration | *Policy filter cascade* | Toxic token triggers policy fallback; CBP still logs true W_-i. | Crafted toxic sample. | No CBP gap. | `policy.cascade.audit` |
| **I-05** | Integration | *Weight update mid-reply* | Competitor portal sends new w_comp; auction uses new weight next token. | Live convo. | Telemetry shows weight change effect. | `auc_weight_reload` |
| **I-06** | Integration | *GPU failure auto-fallback* | Kill mixer kernel via nvidia-smi; CPU path picks up. | k8s liveness. | RTO < 1 s; latency p95 < 100 µs CPU. | `auc_failover.timer` |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **S-01** | **System-wide** | *Revenue vs baseline* | A/B 4 h: VCG vs fixed 0.05 \$ bid. | Traffic 50/50. | Revenue lift ≥ 2 %. | Grafana `revenue_lift_auc` |
| **S-02** | System | *VCG proof audit replay* | Replay 100 k events, verify critical bids monotone & IR. | Stored logs. | ≥ 99.9 % pass. | `vcg.audit.csv` |
| **S-03** | System | *Throughput stress 75 k QPS* | Full stack with Predictor, TVE, MPC at 75 k QPS. | Autoscale GPUs. | p95 mixer ≤ 18 µs. | `auc_throughput.prom` |
| **S-04** | System | *GDPR purge cascade* | Delete conv_id X; ensure bids, vcg, policy topics scrubbed. | GDPR API. | No messages for X after 24 h. | `gdpr_purge_auc` |

---

#### Logging & Metric Conventions (Auction)

| Stream / Series | Format | Key Fields |
|-----------------|--------|-----------|
| `mixer.*` | JSONL | `conv_id,token_idx,sum_weights,max_id` |
| `vcg.*` | JSONL | `c_t,pay_i,w_i` |
| `policy.*` | JSONL | `conv_id,token_idx,reason` |
| Prometheus | `auc_*` prefix | gpu_us, policy_ms, log_lag |
| Kafka topics | `auction.bids`, `auction.vcg` | Avro v1.0 |
| OTEL spans | `auction_latency` root = `conv_id` |

*When new instrumentation is added, append to this table so every AI or engineer knows where to dig.*

## 8 MVP vs Prod Dial-Switch  

| Component | Prod | MVP |
|-----------|------|-----|
| GPU-Fused kernels | CUDA C++ | numpy on CPU |
| Real competitor logits | gRPC | uniform dummy |
| Payments | Stripe invoicer nightly | print to console |
| Policy filter | ONNX GPU | simple regex |

---


### Appendix A — Full VCG Proof Sketch  

1. **Outcome monotonicity**: Increasing \(w_i\) weakly increases \(N_t(x)\) for all *x*; outcome function \(\chi_t(w)\) either stays same or switches to advertiser’s token when crossing \(c_t\).  
2. **Critical value existence**: Because \(N_t(x)\) is linear in \(w_i\) and vocab finite, the threshold where \(x_t\) flips is unique → \(c_t\).  
3. **Payment rule**: Charge \(c_t\) iff advertiser wins; else 0.  
4. **Truthfulness**: For any true weight \(w\_T\), utility \(u_t(w\_R)= (w\_T-c_t)·\mathbf 1[w\_R≥c_t]\) is maximised at \(w\_R=w\_T\) (classic single-parameter VCG).  
5. **Ex-post Individual rationality**: \(u_t≥0\) because pay ≤ true value weight.  
6. **Budget pacing compatibility**: Guard caps both \(w_i\) and \(c_t\) by same factor in horizon; preserves monotonicity and critical structure.  

∴ the token-level auction is VCG and strategy-proof for each advertiser’s single scalar bid.



# Offline Orchestration Subsystem  
### *Subsystem project specification*  
**SkyNet Token-Auction Ads • Technical Design Report v2.3 (2025-04-23)**  

*All headings, tables, and detail density exactly match previous subsystem specs.*

---

## 0 Notation & Acronyms  

| Symbol / Term | Meaning |
|---------------|---------|
| ETL | Extract-Transform-Load |
| DAG | Directed Acyclic Graph (Airflow pipeline) |
| DL F | Data-Lake Feeder job (Kafka → Parquet) |
| MR | Model Registry (MLflow) |
| CM | ConfigMap (ETCD keyspace distributed to runtime pods) |
| S3://skynet/ | canonical object store bucket (prod) |
| Minio://local/ | local object store path (MVP) |
| SQS | Amazon SQS queue (job dispatcher) |
| SLA | Service-Level Agreement |
| RoT | Retention-Of-Training policy |

---

## 1 Goals & System Context  

### 1.1 Functional Goals  

| Goal | Description |
|------|-------------|
| **G-1. Centralise data ingestion** from all runtime Kafka topics into date-partitioned Parquet in S3. |
| **G-2. Materialise training datasets** for CBP, TVE, LoRA, λ-Bandit, DRL, etc. |
| **G-3. Schedule & monitor ML training** jobs; auto-promote artifacts if validation passes. |
| **G-4. Push configs / model weights** to ETCD and Model Registry for hot-reload by runtime services. |
| **G-5. Enforce retention & GDPR policies**; auto-purge PII slices after TTL. |
| **G-6. MVP-friendly** – single-node Airflow + Minio, runnable on laptop. |

### 1.2 Inter-Subsystem Interfaces  

| Direction | Payload | Source | Sink | Frequency |
|-----------|---------|--------|------|-----------|
| **↘** ingest | Kafka: `auction.bids`, `auction.vcg`, `mpc.decisions`, `mro.select`, `tve.feedback`, `predictor.errors`, `click.logs` | Runtime services | DL F jobs | streaming |
| **↗** model artifacts | `.ckpt`, `.onnx`, `.pt`, `P_K.bin` | Trainers | Model Registry | nightly / manual |
| **↗** config push | ETCD keys: `/mro/λ`, `/tve/model`, `/pred/model`, `/mpc/params` | Promotion tasks | Online services | ≤ 5 s |
| **↘** audit exports | Parquet snapshots | DL F | BI tools / auditors | weekly |

---

## 2 Architecture & Algorithms  

### 2.1 Master DAG (Airflow)  

```
                 +--> DLFeeder  --> Warehouse CDC  --> Retention GC
                 |                                      ▲
                 |                                      |
 Raw Kafka --->  |                                      |
                 +--> Train_TVE ----> Validate ----> Promote_TVE
                 |                     |                 |
                 |                     v                 |
                 +--> Train_Pred ----> Validate ----> Promote_Pred
                 |                     |                 |
                 |                     v                 |
                 +--> Train_LoRA ----> Validate ----> Promote_LoRA
                 |                                        |
                 +--> Axes_Recluster ----> Validate ----> Publish_P_K
                 |
                 +--> Horizon_Risk_Tuner ----> Update CM
```

### 2.2 Sub-block Specifications  

| ID | Name | Lang / Container | Core Algorithm(s) | HW | Schedule | SLA |
|----|------|------------------|-------------------|----|----------|-----|
| **A** | DL F – Kafka → Parquet | Spark Streaming 3.5 | Avro decode → partition by `dt` → ZSTD | EMR 6.10 | 24×7 | end-to-end lag ≤ 5 min |
| **B** | Warehouse CDC (optional) | Debezium → Redshift | replicate critical tables | n/a | 5 min | async |
| **C** | Retention GC | Python Lambda | delete partitions > TTL; EU-delete requests | CPU | daily 02:00 UTC | ≤ 30 min |
| **D** | Train_TVE | PyTorch Lightning | dual-tower (§TVE spec) | 4×A100 | nightly 01:00 UTC | max 5 h |
| **E** | Train_Pred | PyTorch | TT-Tiny fine-tune + DRL sim | 4×A10 | nightly | 4 h |
| **F** | Train_LoRA | vLLM + PEFT | DPO on click pairs | A100 | weekly Wed | 2 h |
| **G** | Axes_Recluster | Spark MLlib | PCA → K-means → P_K | m5d.4xlarge ×20 | nightly | 1 h |
| **H** | Horizon_Risk_Tuner | PySpark | ROI grid-search | r5.2xlarge | weekly Sun | 45 min |
| **I** | Validate_x | Python | compute RMSE/R²/KS; compare gates | CPU | per train job | < 5 min |
| **J** | Model Registry | MLflow 2.9 | artifact store S3 + SQL backend | n/a | on-demand | 5 nines |
| **K** | Promotion Task | Bash + kubectl | tag model `prod`, write ETCD key, notify Slack | CPU | post-validation | < 30 sec |

#### 2.2.1  DL F Transform Schema Example (`auction.bids`)

```spark
select
  conv_id,
  token_idx,
  w_ref,
  w_i,
  w_agg - w_i - w_ref as w_comp,
  event_time,
  date_format(event_time,'yyyy-MM-dd') as dt
```

`partitionBy("dt")`.

#### 2.2.2  Promotion ETCD Payload Example

```json
{
  "version": "tve_2025_04_23_01",
  "s3_path": "s3://skynet/models/tve/tve_2025_04_23_01.ts",
  "checksum": "sha256:9af..."
}
```

---

## 3 Data Flow & SLA Summary  

| Stream | Raw → Bronze | Bronze → Silver (train sets) | Silver → Gold (features) |
|--------|--------------|------------------------------|--------------------------|
| auction.bids | DL F 5 min | hourly Spark job builds 15-window features | on train run |
| mro.select | DL F 5 min | nightly λ-bandit dataset | — |
| click.logs | DL F realtime | LoRA click pairs builder | TVE label builder |
| predictor.errors | DL F realtime | RMSE dashboard → Prometheus alert | — |

Gold tables expire 90 d by RoT.

---

## 4 Security & Privacy  

* All buckets use AES-256 server-side encryption; client-side KMS optional.  
* GDPR delete job (`Retention GC`) locates `conv_id` via manifest and deletes all derived rows.  
* IAM roles: separate `airflow-runner`, `trainer`, `promotion` with least privilege.  
* Slack webhook secrets stored in AWS Secrets Manager, rotated 30 d.

---

## 5 Acceptance Criteria  

### 5.1 Interface Contracts  

| Contract | Requirement |
|----------|-------------|
| Parquet schema evolution | only additive columns; no type change |
| MLflow artifact URI | `s3://skynet/models/<subsys>/<version>/` |
| ETCD keys | JSON + SHA-256 checksum; key path unique per version |

### 5.2 Performance  

| Metric | Target | Test |
|--------|--------|------|
| Kafka → Parquet lag | ≤ 5 min P95 | Airflow sensor |
| Training job success | ≥ 98 % | Airflow SLA miss alerts |
| Promotion latency | ≤ 30 s | CI pipeline |

### 5.3 
**Unit (U-xx)**, **Component (C-xx)**, **Integration (I-xx)**, and **System-wide (S-xx)**.  Log names and Prometheus metric prefixes are provided for traceability.

| ID | Scope | Title | Description – *what & why* | Fixtures / Pre-conditions | Expected Outcome | Primary Logs / Metrics |
|----|-------|-------|-----------------------------|---------------------------|------------------|------------------------|
| **U-01** | **Unit** | *DAG YAML lint* | Ensure every DAG YAML passes `airflow-lint`; prevents syntax errors breaking scheduler. | Parse `dags/`. | Lint exit 0. | `orch_dag_lint` CI step. |
| **U-02** | Unit | *Schema additive-only guard* | Compare new Parquet schema vs golden; fail if column drop or type change. | Mock schema diff. | Raises `SchemaViolation`. | `schema_diff.log`. |
| **U-03** | Unit | *ConfigMap checksum* | Verify ETCD payload’s `checksum` matches SHA-256 of referenced artifact. | Generate dummy file. | Hash equality. | `cm_checksum.debug`. |
| **U-04** | Unit | *Retention GC selector* | Given date partitions > TTL, GC lists correct S3 paths for deletion. | Fake 400-day folders. | Returned list length > 0, all older than TTL. | `gc.plan.log`. |
| **U-05** | Unit | *GDPR delete SQL builder* | WHERE clause targets only `conv_id` supplied; avoids collateral delete. | conv_id = “abc”. | Generates SQL `... WHERE conv_id = 'abc'`. | `gdpr.sql.debug`. |
| **U-06** | Unit | *Promotion gate logic* | Promotion happens only if **all** metrics pass (e.g., RMSE ↓, KS ≤ thr). | Stub validation JSON. | Returns `promote=True` only on pass. | `validate.outcome.log`. |
| **U-07** | Unit | *Slack notifier secret* | Fails fast if webhook env var missing; prevents silent skips. | Unset env. | Raises `MissingSecret`. | `notify.error`. |
| **U-08** | Unit | *Parquet partition naming* | File path matches `yyyy-mm-dd` regex. | `dt='2025-04-23'`. | Regex match. | `partition.naming.test`. |
| **U-09** | Unit | *Trainer artifact path* | Trainer writes model to `s3://skynet/models/<subsys>/<ver>/`. | Simulated training run. | Path exists & size > 0. | `trainer.artifact.log`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **C-01** | **Component** | *Kafka → Parquet lag* | Measure end-to-end lag for `auction.bids`. | 10 k messages. | P95 ≤ 5 min. | Prom `orch_kafka_lag_seconds`. |
| **C-02** | Component | *Training job SLA* | `Train_TVE` finishes ≤ 5 h. | Airflow manual trigger. | Duration metric below SLA. | Airflow Gantt view, `orch_train_tve_ms`. |
| **C-03** | Component | *Validate-then-promote wall-clock* | Time from job end → ETCD push ≤ 30 s. | Real artifact. | p95 ≤ 30 s. | `orch_promotion_ms`. |
| **C-04** | Component | *ETCD hot-reload latency* | Watcher on runtime pod sees new key ≤ 5 s. | Push dummy key. | Runtime log shows reload within 5 s. | `runtime_reload.ms`. |
| **C-05** | Component | *Spark job retry* | DL F Spark job fails once, retries twice, succeeds. | Inject failure exception. | Airflow task state = `success`. | `spark_retry.count`. |
| **C-06** | Component | *Retention GC throughput* | Delete ≥ 1 TB partitions in ≤ 30 min. | Dry-run list. | Bulk delete rate ≥ 600 MB/s. | `gc_throughput_mb_s`. |
| **C-07** | Component | *Model Registry availability* | MLflow `GET /api/2.0/preview/mlflow/experiments/list` responds < 300 ms. | Hit endpoint 100×. | p95 ≤ 300 ms. | `orch_mlflow_latency`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **I-01** | **Integration** | *Nightly master DAG success* | End-to-end DAG run completes before 06:00 UTC. | Trigger at 00:00 UTC. | `state=success`, finish < 06:00. | Airflow SLA report, `orch_dag_sla`. |
| **I-02** | Integration | *Artifact hot-swap propagation* | New TVE model promoted ⇒ runtime TVE pod reloads & serves new SHA. | Canary deploy. | Traffic shows new SHA within 2 min. | `tve_reload.event`, OTEL tag. |
| **I-03** | Integration | *Rollback on validation fail* | Inject high RMSE artifact; Validate_x fails; no ETCD push. | Bad model file. | ETCD key unchanged; Slack alert. | `validate.fail.log`. |
| **I-04** | Integration | *Lambda GDPR cascade* | Delete conv_id X; GC removes rows + derived features. | Call GDPR API. | Subsequent training set count for X = 0. | `gdpr.audit.parquet`. |
| **I-05** | Integration | *Horizon/Risk tuner update* | Tuner computes new params; MPC reads & uses next minute. | Weekly schedule. | MPC telemetry shows new values. | `mpc_param.reload`. |
| **I-06** | Integration | *Minio → S3 parity (MVP vs Prod)* | Run DAG on Minio; output checksums match S3 run (same data). | Identical seed. | SHA-256 parity. | `orch_mvp_parity.csv`. |

| ID | Scope | Title | Description | Pre-conditions | Expected Outcome | Logs / Metrics |
|----|-------|-------|-------------|----------------|------------------|----------------|
| **S-01** | **System-wide** | *30-day pipeline stability* | No more than 2 SLA misses across 30 nightly DAG runs. | Prod ops. | SLA miss ≤ 2. | Grafana `orch_sla_miss_total`. |
| **S-02** | System | *Region S3 outage resilience* | Simulate S3 unavailability for 15 min. | Chaos test. | DL F buffers to SQS; no data loss. | `orch_s3_retry.count`. |
| **S-03** | System | *Cost budget guard* | Monthly EMR cost ≤ budget; alert on overspend. | FinOps metrics. | Alert fired if cost > budget. | `orch_emr_cost_usd`. |
| **S-04** | System | *Cross-subsystem artifact lineage* | Pick any prod model SHA; traverse Neo4j graph to raw Kafka events without gaps. | Neo4j query. | Path exists & depth ≥ 3. | `lineage_integrity.report`. |

---

#### Logging & Metric Conventions (Offline Orchestration)

| Stream / Series | Format | Key Fields |
|-----------------|--------|-----------|
| `airflow.*` | JSONL | `dag_id,task_id,state,duration_ms` |
| `trainer.*` | JSONL | `job_id,epoch,loss,artifact_uri` |
| `validate.*` | JSONL | `job_id,rmse,ks,pass` |
| `promotion.*` | JSONL | `model_name,version,elapsed_ms` |
| `gc.*` | JSONL | `path,bytes_deleted,elapsed_ms` |
| Prometheus | `orch_*` prefix | kafka_lag_seconds, dag_sla, mlflow_latency … |
| Neo4j lineage | nodes: dataset, code, model | edges: USED, GENERATED |

*When new instrumentation is added, append to this table so every AI or engineer knows where to dig.*

---

## 6 MVP vs Prod Dial-Switch  

| Component | Prod | MVP |
|-----------|------|-----|
| Airflow | K8s with Celery executor | LocalExecutor |
| Object store | AWS S3 | Minio dir `/tmp/minio` |
| Spark cluster | EMR / K8s Spark | PySpark local[*] |
| MLflow | MySQL backend store | SQLite file |
| ETCD | 3-node etcd | localhost etcd |

---

### Appendix A — Airflow DAG YAML Snippet  

```yaml
schedule_interval: "*/5 * * * *"
default_args:
  retries: 2
  retry_delay: 5m

tasks:
  dl_auction_bids:
    operator: SparkSubmitOperator
    params: {topic: auction.bids, table: bids_raw}
  dl_click_logs:
    operator: SparkSubmitOperator
  train_tve:
    operator: BashOperator
    trigger_rule: all_success
    downstream: [validate_tve]
  validate_tve:
    operator: PythonOperator
    downstream: [promote_tve]
```
