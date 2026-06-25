import os
import json
import threading
import logging

# Load environment variables manually from .env if present
for dotenv_path in [
    os.path.join(os.path.dirname(__file__), ".env"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
]:
    if os.path.exists(dotenv_path):
        with open(dotenv_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip("'\"")

# ── Suppress HuggingFace Hub unauthenticated token warnings ──────────────────
# These models are public and do not require a token. Setting HF_TOKEN is
# optional for higher rate limits only. We silence the warning to keep logs clean.
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")          # disable usage telemetry
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")         # suppress transformers INFO/WARNING
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")        # avoid fork/deadlock warning

# Silence the huggingface_hub logger that emits the unauthenticated warning
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
logging.getLogger("huggingface_hub.utils._headers").setLevel(logging.ERROR)

import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import redis
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
import numpy as np


# ── Custom JSON encoder that handles numpy scalar types globally ──────────────
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


class NumpyJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, cls=NumpyEncoder, ensure_ascii=False).encode("utf-8")


app = FastAPI(
    title="DCart Recommendation Service",
    version="1.0.0",
    default_response_class=NumpyJSONResponse
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# PHASE 17 — PROMETHEUS METRICS
# Lightweight request metrics for observability
# =============================================================================
_metrics_store = {
    "requests_total": {},        # {(method, path, status): count}
    "request_duration_sum": {},   # {(method, path): total_seconds}
    "request_duration_count": {}, # {(method, path): count}
    "startup_time": time.time(),
}


@app.middleware("http")
async def prometheus_metrics_middleware(request: Request, call_next):
    """Track request count and duration for Prometheus /metrics endpoint."""
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start

    method = request.method
    path = request.url.path
    status = str(response.status_code)

    key_total = (method, path, status)
    key_dur = (method, path)

    _metrics_store["requests_total"][key_total] = (
        _metrics_store["requests_total"].get(key_total, 0) + 1
    )
    _metrics_store["request_duration_sum"][key_dur] = (
        _metrics_store["request_duration_sum"].get(key_dur, 0) + duration
    )
    _metrics_store["request_duration_count"][key_dur] = (
        _metrics_store["request_duration_count"].get(key_dur, 0) + 1
    )

    return response


# Connect to Redis with timeouts and retries to prevent connection hanging
redis_url = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")
r = redis.from_url(
    redis_url,
    decode_responses=True,
    socket_timeout=2.0,            # timeout read/write operations after 2 seconds
    socket_connect_timeout=2.0,    # timeout connection after 2 seconds
    retry_on_timeout=True          # retry on timeout once
)

# In-memory thread-safe products cache to protect Redis from concurrent spikes
_products_cache = {
    "data": None,
    "expires_at": 0.0
}
_products_cache_lock = threading.Lock()
CACHE_TTL = 5.0  # seconds

def get_all_products():
    global _products_cache
    now = time.time()
    
    # Fast path: read cache without locking
    if _products_cache["data"] is not None and now < _products_cache["expires_at"]:
        return _products_cache["data"]
        
    with _products_cache_lock:
        # Double check after lock acquisition
        if _products_cache["data"] is not None and now < _products_cache["expires_at"]:
            return _products_cache["data"]
            
        try:
            products_str = r.get("dcart:products")
            if not products_str:
                return []
            products = json.loads(products_str)
            _products_cache["data"] = products
            _products_cache["expires_at"] = now + CACHE_TTL
            return products
        except Exception as e:
            print(f"[AI Service] Error loading products from Redis: {e}")
            # Resilient fallback: return expired cache data if we have it
            if _products_cache["data"] is not None:
                return _products_cache["data"]
            return []

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/metrics", response_class=PlainTextResponse)
def prometheus_metrics():
    """Phase 17: Prometheus-compatible metrics endpoint (text exposition format)."""
    lines = []
    uptime = time.time() - _metrics_store["startup_time"]

    # ── Uptime
    lines.append("# HELP dcart_uptime_seconds Uptime of the AI service in seconds.")
    lines.append("# TYPE dcart_uptime_seconds gauge")
    lines.append(f"dcart_uptime_seconds {uptime:.1f}")

    # ── Request totals
    lines.append("# HELP dcart_http_requests_total Total HTTP requests by method, path, status.")
    lines.append("# TYPE dcart_http_requests_total counter")
    for (method, path, status), count in sorted(_metrics_store["requests_total"].items()):
        lines.append(
            f'dcart_http_requests_total{{method="{method}",path="{path}",status="{status}"}} {count}'
        )

    # ── Request duration
    lines.append("# HELP dcart_http_request_duration_seconds_sum Total request duration by method, path.")
    lines.append("# TYPE dcart_http_request_duration_seconds_sum counter")
    for (method, path), total in sorted(_metrics_store["request_duration_sum"].items()):
        lines.append(
            f'dcart_http_request_duration_seconds_sum{{method="{method}",path="{path}"}} {total:.4f}'
        )

    lines.append("# HELP dcart_http_request_duration_seconds_count Request count for duration tracking.")
    lines.append("# TYPE dcart_http_request_duration_seconds_count counter")
    for (method, path), count in sorted(_metrics_store["request_duration_count"].items()):
        lines.append(
            f'dcart_http_request_duration_seconds_count{{method="{method}",path="{path}"}} {count}'
        )

    # ── Service info
    lines.append("# HELP dcart_service_info Service metadata.")
    lines.append("# TYPE dcart_service_info gauge")
    lines.append('dcart_service_info{service="ai-service",version="1.0.0",framework="fastapi"} 1')

    return "\n".join(lines) + "\n"

@app.get("/recommendations/recommended-for-you")
def recommended_for_you(email: str = None, limit: int = 4):
    products = get_all_products()
    if not products:
        return []

    interacted_ids = []
    if email:
        # Fetch user's purchases, wishlist, and views from Redis
        purchases = r.smembers(f"dcart:recommendations:{email}:purchases")
        wishlist = r.smembers(f"dcart:recommendations:{email}:wishlist")
        views = r.smembers(f"dcart:recommendations:{email}:views")
        interacted_ids = list(purchases | wishlist | views)

    # Fallback to popularity/trending if no user history
    if not interacted_ids:
        top_products = r.zrevrange("dcart:analytics:top_products", 0, limit - 1)
        if top_products:
            results = [p for p in products if p["_id"] in top_products]
            if len(results) >= limit:
                return results[:limit]
        return products[:limit]

    # Content-based personalization using TF-IDF and Cosine Similarity
    df = pd.DataFrame(products)
    df["features"] = df["title"].fillna("") + " " + df["brand"].fillna("") + " " + df["description"].fillna("")
    
    vectorizer = TfidfVectorizer(stop_words='english')
    tfidf_matrix = vectorizer.fit_transform(df["features"])
    
    # Calculate similarity scores
    cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
    
    # Get indices of interacted products
    interacted_indices = df[df["_id"].isin(interacted_ids)].index.tolist()
    
    if not interacted_indices:
        return products[:limit]
        
    # Aggregate similarity scores
    sim_scores = np.zeros(len(df))
    for idx in interacted_indices:
        sim_scores += cosine_sim[idx]
        
    # Average scores and sort
    sim_scores = sim_scores / len(interacted_indices)
    
    # Get top items, excluding already interacted ones
    top_indices = np.argsort(sim_scores)[::-1]
    recommendations = []
    
    for idx in top_indices:
        prod_id = df.iloc[idx]["_id"]
        if prod_id not in interacted_ids:
            recommendations.append(products[idx])
        if len(recommendations) >= limit:
            break
            
    # If not enough recommendations, fill with remaining products
    if len(recommendations) < limit:
        for idx in top_indices:
            prod_id = df.iloc[idx]["_id"]
            if prod_id not in [p["_id"] for p in recommendations]:
                recommendations.append(products[idx])
            if len(recommendations) >= limit:
                break
                
    return recommendations[:limit]

@app.get("/recommendations/customers-also-bought")
def customers_also_bought(product_id: str, limit: int = 4):
    products = get_all_products()
    if not products:
        return []
        
    df = pd.DataFrame(products)
    if product_id not in df["_id"].values:
        return products[:limit]
        
    df["features"] = df["title"].fillna("") + " " + df["brand"].fillna("") + " " + df["description"].fillna("")
    
    vectorizer = TfidfVectorizer(stop_words='english')
    tfidf_matrix = vectorizer.fit_transform(df["features"])
    
    cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
    
    idx = df[df["_id"] == product_id].index[0]
    sim_scores = list(enumerate(cosine_sim[idx]))
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    
    recommendations = []
    for i, score in sim_scores:
        if df.iloc[i]["_id"] != product_id:
            recommendations.append(products[i])
        if len(recommendations) >= limit:
            break
            
    return recommendations

@app.get("/recommendations/trending-near-you")
def trending_near_you(limit: int = 4):
    products = get_all_products()
    if not products:
        return []
        
    # Get top products by trending score (views/sales) from Redis
    top_products = r.zrevrange("dcart:analytics:top_products", 0, limit - 1)
    if top_products:
        results = [p for p in products if p["_id"] in top_products]
        # Fill with default products if not enough
        if len(results) < limit:
            for p in products:
                if p["_id"] not in [r["_id"] for r in results]:
                    results.append(p)
                if len(results) >= limit:
                    break
        return results[:limit]
        
    return products[:limit]

# --- AI REVIEW INTELLIGENCE (PHASE 7) ---

# Aspects dictionary mapping categories to keywords
ASPECTS = {
    "Battery": ["battery", "charge", "power", "charging", "life"],
    "Display": ["display", "screen", "panel", "oled", "amoled", "viewing", "brightness"],
    "Performance": ["performance", "speed", "fast", "smooth", "gaming", "lag", "processor", "chip"],
    "Camera": ["camera", "photo", "video", "sensor", "lens", "pictures"],
    "Heating": ["heating", "heat", "hot", "warm", "thermal"],
    "Sound": ["sound", "audio", "speaker", "bass", "volume", "music"],
    "Build": ["build", "quality", "material", "premium", "sturdy", "design", "look", "feel"],
    "Price": ["price", "cost", "value", "expensive", "affordable", "cheap"],
    "Software": ["software", "ui", "os", "android", "ios", "app", "bugs", "glitch", "crash"]
}

FALLBACK_POSITIVE = {"great", "good", "excellent", "awesome", "perfect", "love", "amazing", "beautiful", "smooth", "fast", "premium", "stellar", "bright", "nice", "satisfied"}
FALLBACK_NEGATIVE = {"bad", "poor", "terrible", "heating", "heats", "hot", "slow", "lag", "laggy", "heavy", "expensive", "disappointed", "glitch", "bug", "crash", "heavier", "drains"}
NEGATIONS = {"not", "no", "never", "dont", "cant", "wont", "isnt", "wasnt", "arent", "havent"}

_sentiment_pipeline = None

def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        try:
            print("[NLP Service] Loading sentiment pipeline...")
            # Silence HF Hub auth warning at load time (public model, no token needed)
            import warnings
            warnings.filterwarnings("ignore", message=".*token.*", category=UserWarning)
            logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
            from transformers import pipeline as hf_pipeline, logging as hf_logging
            hf_logging.set_verbosity_error()   # suppress all transformers INFO/WARNING
            hf_token = os.environ.get("HF_TOKEN") or None
            # DistilBERT SST-2 — fast, lightweight, public model
            _sentiment_pipeline = hf_pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                token=hf_token,
            )
            print("[NLP Service] Sentiment pipeline ready.")
        except Exception as e:
            print(f"[NLP Service] Sentiment pipeline unavailable, using lexical fallback: {e}")
            _sentiment_pipeline = "fallback"
    return _sentiment_pipeline

def analyze_sentence_lexical(sentence: str, rating: int) -> str:
    import re
    words = re.findall(r"\b\w+\b", sentence.lower())
    pos_count = 0
    neg_count = 0
    negated = False
    
    for word in words:
        if word in NEGATIONS:
            negated = True
            continue
        if word in FALLBACK_POSITIVE:
            if negated:
                neg_count += 1
            else:
                pos_count += 1
            negated = False
        elif word in FALLBACK_NEGATIVE:
            if negated:
                pos_count += 1
            else:
                neg_count += 1
            negated = False
            
    if pos_count > neg_count:
        return "POSITIVE"
    elif neg_count > pos_count:
        return "NEGATIVE"
    else:
        # Fallback to rating
        if rating >= 4:
            return "POSITIVE"
        elif rating <= 2:
            return "NEGATIVE"
        return "NEUTRAL"

@app.get("/reviews/analyze")
def analyze_reviews(product_id: str):
    import re
    # Fetch reviews from Redis
    reviews_key = f"dcart:product:{product_id}:reviews"
    reviews_strs = r.lrange(reviews_key, 0, -1)
    
    if not reviews_strs:
        return {
            "sentiment": "Neutral",
            "pros": [],
            "cons": []
        }
        
    reviews = []
    for r_str in reviews_strs:
        try:
            reviews.append(json.loads(r_str))
        except Exception:
            pass
            
    if not reviews:
        return {
            "sentiment": "Neutral",
            "pros": [],
            "cons": []
        }
        
    # Initialize votes
    pros_votes = {aspect: 0 for aspect in ASPECTS}
    cons_votes = {aspect: 0 for aspect in ASPECTS}
    
    # Try to load sentiment pipeline
    pipeline = get_sentiment_pipeline()
    
    positive_reviews_count = 0
    negative_reviews_count = 0
    
    for rev in reviews:
        comment = rev.get("comment", "")
        rating = int(rev.get("rating", 3))
        
        # Determine overall review sentiment
        review_sentiment = "NEUTRAL"
        if pipeline and pipeline != "fallback":
            try:
                res = pipeline(comment[:512])[0]
                review_sentiment = res["label"]
            except Exception:
                review_sentiment = analyze_sentence_lexical(comment, rating)
        else:
            review_sentiment = analyze_sentence_lexical(comment, rating)
            
        if review_sentiment == "POSITIVE":
            positive_reviews_count += 1
        elif review_sentiment == "NEGATIVE":
            negative_reviews_count += 1
            
        # Split sentences and analyze aspects
        sentences = re.split(r"[.!?\n]+", comment)
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # Find aspect match
            matched_aspects = []
            sentence_lower = sentence.lower()
            for aspect, keywords in ASPECTS.items():
                for kw in keywords:
                    if re.search(r"\b" + re.escape(kw) + r"\b", sentence_lower):
                        matched_aspects.append(aspect)
                        break
                        
            if not matched_aspects:
                continue
                
            # Classify sentence sentiment
            sentence_sentiment = "NEUTRAL"
            if pipeline and pipeline != "fallback":
                try:
                    res = pipeline(sentence[:256])[0]
                    sentence_sentiment = res["label"]
                except Exception:
                    sentence_sentiment = analyze_sentence_lexical(sentence, rating)
            else:
                sentence_sentiment = analyze_sentence_lexical(sentence, rating)
                
            for aspect in matched_aspects:
                if sentence_sentiment == "POSITIVE":
                    pros_votes[aspect] += 1
                elif sentence_sentiment == "NEGATIVE":
                    cons_votes[aspect] += 1
                    
    # Compile final Pros and Cons
    pros = []
    cons = []
    
    for aspect in ASPECTS:
        p_count = pros_votes[aspect]
        c_count = cons_votes[aspect]
        if p_count > c_count and p_count >= 1:
            pros.append(aspect)
        elif c_count > p_count and c_count >= 1:
            cons.append(aspect)
            
    # Determine overall sentiment
    if positive_reviews_count > negative_reviews_count:
        overall_sentiment = "Positive"
    elif negative_reviews_count > positive_reviews_count:
        overall_sentiment = "Negative"
    else:
        overall_sentiment = "Neutral"
        
    return {
        "sentiment": overall_sentiment,
        "pros": pros,
        "cons": cons
    }

# --- AI SHOPPING COPILOT (PHASE 8) ---
from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

# Lazy load embedding models
_embed_tokenizer = None
_embed_model = None

def get_embedding_model():
    global _embed_tokenizer, _embed_model
    if _embed_tokenizer is None:
        try:
            print("[Copilot NLP] Loading sentence-transformers/all-MiniLM-L6-v2...")
            import warnings
            warnings.filterwarnings("ignore", message=".*token.*", category=UserWarning)
            from transformers import AutoTokenizer, AutoModel, logging as hf_logging
            hf_logging.set_verbosity_error()
            hf_token = os.environ.get("HF_TOKEN") or None
            _embed_tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2", token=hf_token)
            _embed_model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2", token=hf_token)
            print("[Copilot NLP] Embedding model ready.")
        except Exception as e:
            print(f"[Copilot NLP] Embedding model unavailable, using keyword fallback: {e}")
            _embed_tokenizer = "fallback"
    return _embed_tokenizer, _embed_model

def get_text_embedding(text: str):
    tokenizer, model = get_embedding_model()
    if tokenizer == "fallback" or model is None:
        return None
    try:
        import torch
        inputs = tokenizer(text, padding=True, truncation=True, max_length=256, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)
        embeddings = outputs.last_hidden_state.mean(dim=1)
        return embeddings[0].numpy()
    except Exception as e:
        print(f"[Copilot NLP] Failed to compute embedding: {e}")
        return None

def retrieve_similar_products(query: str, limit: int = 3):
    products = get_all_products()
    if not products:
        return []
    
    query_emb = get_text_embedding(query)
    
    if query_emb is not None:
        doc_embeddings = []
        valid_products = []
        
        for p in products:
            text = f"Title: {p.get('title', '')}. Brand: {p.get('brand', '')}. Price: {p.get('price', '')}. Description: {p.get('description', '')}."
            emb = get_text_embedding(text)
            if emb is not None:
                doc_embeddings.append(emb)
                valid_products.append(p)
                
        if doc_embeddings:
            import numpy as np
            # Try using FAISS
            try:
                import faiss
                d = len(query_emb)
                emb_arr = np.array(doc_embeddings).astype('float32')
                faiss.normalize_L2(emb_arr)
                
                query_arr = np.array([query_emb]).astype('float32')
                faiss.normalize_L2(query_arr)
                
                index = faiss.IndexFlatIP(d)
                index.add(emb_arr)
                
                D, I = index.search(query_arr, limit)
                retrieved = []
                for idx in I[0]:
                    if idx >= 0 and idx < len(valid_products):
                        retrieved.append(valid_products[idx])
                return retrieved
            except Exception as e:
                print(f"[Copilot NLP] FAISS error, falling back to Cosine Similarity: {e}")
                try:
                    from sklearn.metrics.pairwise import cosine_similarity
                    emb_arr = np.array(doc_embeddings)
                    query_arr = np.array([query_emb])
                    sims = cosine_similarity(query_arr, emb_arr)[0]
                    top_indices = np.argsort(sims)[::-1][:limit]
                    return [valid_products[idx] for idx in top_indices]
                except Exception as ex:
                    print(f"[Copilot NLP] Fallback Cosine Similarity failed: {ex}")
                    
    # Keyword ranking fallback
    print("[Copilot NLP] Using keyword scoring fallback for retrieval.")
    query_words = set(query.lower().split())
    scores = []
    for p in products:
        score = 0
        title_lower = p.get("title", "").lower()
        desc_lower = p.get("description", "").lower()
        brand_lower = p.get("brand", "").lower()
        for qw in query_words:
            if qw in title_lower:
                score += 3
            if qw in brand_lower:
                score += 2
            if qw in desc_lower:
                score += 1
        scores.append((score, p))
    scores = sorted(scores, key=lambda x: x[0], reverse=True)
    return [p for score, p in scores[:limit] if score > 0] or products[:limit]

async def call_gemini_llm(prompt: str, system_instruction: str = None):
    import httpx
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }
    
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [
                {"text": system_instruction}
            ]
        }
        
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=30.0)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text
            else:
                print(f"[Copilot NLP] Gemini API error {res.status_code}: {res.text}")
                return None
    except Exception as e:
        print(f"[Copilot NLP] Gemini API call exception: {e}")
        return None

def compile_copilot_prompt(message: str, history: List[ChatMessage], context_products: list) -> str:
    context_str = "Available Products in Store:\n"
    for p in context_products:
        slug_current = p.get("slug", {}).get("current", "") if isinstance(p.get("slug"), dict) else p.get("slug", "")
        context_str += f"- Product ID: {p.get('_id')}\n"
        context_str += f"  Title: {p.get('title')}\n"
        context_str += f"  Brand: {p.get('brand')}\n"
        context_str += f"  Price: INR {p.get('price')}\n"
        context_str += f"  Description: {p.get('description')}\n"
        context_str += f"  Link: /product/{slug_current}\n\n"
        
    history_str = ""
    for turn in history:
        role = turn.role
        content = turn.content
        if role == "user":
            history_str += f"User: {content}\n"
        else:
            history_str += f"Assistant: {content}\n"
            
    prompt = f"""Use the following available products context to answer the user's question. Focus on recommending or comparing products from the context. Do not mention or recommend other external products.

{context_str}

Conversation History:
{history_str}
User: {message}
Assistant:"""

    return prompt

SYSTEM_INSTRUCTION = """You are the DCart AI Shopping Copilot, a helpful, friendly, and expert sales consultant. Your goal is to guide users to find the best products in our catalog.
Guidelines:
1. Suggest gaming laptops, compare models, and recommend photography phones from our context.
2. If the user asks for budget recommendations (e.g. 'under ₹80k'), list items under that price. Convert price to Indian Rupees (INR) format (e.g. ₹78,999).
3. Be concise, professional, and use markdown formatting (tables, bold text, bullet points) for readability.
4. When mentioning products, include their link formatted as markdown (e.g. [Product Title](/product/slug-url)). Do not change the slug path.
5. If the product requested is not in the store, explain politely and suggest the nearest matches from our inventory."""

def run_local_copilot_simulation(message: str, history: List[ChatMessage]) -> str:
    msg_lower = message.lower()
    
    if "laptop" in msg_lower and ("80k" in msg_lower or "80,000" in msg_lower or "80000" in msg_lower or "under 80" in msg_lower):
        return """Here is the best gaming laptop under **₹80,000** from our store:

### 💻 Recommended Laptop
* **[Asus ROG Strix G16 Gaming Laptop](/product/asus-rog-strix-g16)** - **₹78,999** (You save ₹21,000!)
  - **Brand**: ASUS | **Rating**: 4.8 ⭐
  - **Specs**: Intel Core i7 13th Gen, 16GB DDR5 RAM, 1TB SSD, NVIDIA GeForce RTX 4060, 16-inch 165Hz Display.
  - **Pros**: Incredible gaming framerates, high-refresh display, premium ROG cooling and design.

Would you like me to compare this with the **Lenovo Legion Slim 5** (₹84,999)?"""

    elif "compare" in msg_lower and ("iphone" in msg_lower or "s25" in msg_lower or "samsung" in msg_lower):
        return """Here is a side-by-side comparison of the flagship phones in our catalog:

| Feature | [iPhone 16 Pro Max](/product/iphone-16-pro-max) | [Samsung Galaxy S25 Ultra](/product/samsung-galaxy-s25-ultra) |
| :--- | :--- | :--- |
| **Brand** | Apple | Samsung |
| **Price** | ₹1,19,999 | ₹1,24,999 |
| **Display** | 6.9-inch XDR OLED (120Hz) | 6.8-inch Dynamic AMOLED 2X |
| **Camera** | 48MP Triple Zoom Fusion | 200MP Quad Zoom System |
| **Processor** | Apple A18 Pro | Snapdragon 8 Gen 4 |
| **Storage** | 256GB | 512GB |
| **Specialty** | Longest battery, video quality | Built-in S-Pen, 100x Space Zoom |

**Recommendation**:
- Choose the **[iPhone 16 Pro Max](/product/iphone-16-pro-max)** if you want unparalleled videography, long-lasting battery, and iOS integration.
- Choose the **[Samsung Galaxy S25 Ultra](/product/samsung-galaxy-s25-ultra)** if you prefer 100x zoom photography, productivity with the S-Pen, and more storage."""

    elif "phone" in msg_lower and ("photography" in msg_lower or "camera" in msg_lower or "photo" in msg_lower):
        return """We have two outstanding flagship phones built for professional photography:

1. **[Samsung Galaxy S25 Ultra](/product/samsung-galaxy-s25-ultra)** - **₹1,24,999**
   - **Camera Specs**: 200MP main sensor, 100x Space Zoom, ultra-wide and dual telephoto lenses.
   - **Best for**: Extreme detail, long-distance zoom, and versatile shooting modes.
   
2. **[iPhone 16 Pro Max](/product/iphone-16-pro-max)** - **₹1,19,999**
   - **Camera Specs**: 48MP fusion sensor, 5x optical telephoto lens, cinematic video controls.
   - **Best for**: Consistent color accuracy, macro photography, and industry-leading video recording.

Would you like a side-by-side spec comparison?"""

    elif "laptop" in msg_lower:
        return """We offer these high-performance laptops in our store:

1. **[Asus ROG Strix G16](/product/asus-rog-strix-g16)** - **₹78,999**
   - RTX 4060, Intel Core i7 13th Gen, 16GB DDR5, 1TB SSD, 16" 165Hz Screen. (Best value for gaming)
   
2. **[Lenovo Legion Slim 5](/product/lenovo-legion-slim-5)** - **₹84,999**
   - RTX 4060, AMD Ryzen 7 7840HS, 16GB RAM, 512GB SSD. (Best for portability and specs)

Let me know if you would like to compare details!"""

    else:
        return """Hello! I am your **DCart Shopping Copilot** 🤖. I can help you find products, compare specifications, and find items matching your budget!

**Try asking me things like:**
* *Suggest gaming laptops under ₹80k*
* *Compare iPhone 16 and S25*
* *Best phone for photography*
* *What is in stock?*"""

@app.post("/copilot/chat")
async def copilot_chat(req: ChatRequest):
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    
    # 1. Retrieve context products from store
    context_products = retrieve_similar_products(req.message, limit=3)
    
    # 2. If Gemini API key is configured, run RAG LLM query
    if api_key:
        prompt = compile_copilot_prompt(req.message, req.history, context_products)
        response_text = await call_gemini_llm(prompt, SYSTEM_INSTRUCTION)
        if response_text:
            return {
                "success": True,
                "response": response_text,
                "context": [p["_id"] for p in context_products],
                "mode": "ai"
            }
            
    # 3. Fallback to highly optimized local simulation
    sim_response = run_local_copilot_simulation(req.message, req.history)
    return {
        "success": True,
        "response": sim_response,
        "context": [p["_id"] for p in context_products],
        "mode": "simulation"
    }


# --- PHASE 11: VISUAL SEARCH ---
from fastapi import UploadFile, File
import io

_clip_model = None
_clip_processor = None
_clip_available = None

def get_clip_model():
    global _clip_model, _clip_processor, _clip_available
    if _clip_available is not None:
        return _clip_model, _clip_processor, _clip_available
    try:
        print("[Visual Search] Loading CLIP model (openai/clip-vit-base-patch32)...")
        import warnings
        warnings.filterwarnings("ignore", message=".*token.*", category=UserWarning)
        from transformers import CLIPProcessor, CLIPModel, logging as hf_logging
        hf_logging.set_verbosity_error()
        _clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _clip_available = True
        print("[Visual Search] CLIP model ready.")
    except Exception as e:
        print(f"[Visual Search] CLIP model unavailable: {e}")
        _clip_available = False
    return _clip_model, _clip_processor, _clip_available

def get_clip_text_embeddings(texts: list):
    """Encode a list of texts using CLIP text encoder and return numpy array."""
    import torch
    model, processor, available = get_clip_model()
    if not available:
        return None
    try:
        inputs = processor(text=texts, return_tensors="pt", padding=True, truncation=True, max_length=77)
        with torch.no_grad():
            text_features = model.get_text_features(**inputs)
        # L2 normalize
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        return text_features.numpy()
    except Exception as e:
        print(f"[Visual Search] Text embedding error: {e}")
        return None

def get_clip_image_embedding(image_bytes: bytes):
    """Encode an image using CLIP image encoder and return numpy array."""
    import torch
    from PIL import Image
    model, processor, available = get_clip_model()
    if not available:
        return None
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            image_features = model.get_image_features(**inputs)
        # L2 normalize
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        return image_features[0].numpy()
    except Exception as e:
        print(f"[Visual Search] Image embedding error: {e}")
        return None

@app.post("/search/visual")
async def visual_search(file: UploadFile = File(...), limit: int = 6):
    """
    Phase 11: Visual Search
    Accepts an uploaded product image, encodes it with CLIP, 
    then finds the most similar products using FAISS inner product search
    over CLIP text embeddings of product descriptions.
    """
    products = get_all_products()
    if not products:
        return {"success": False, "error": "No products available", "results": []}

    try:
        image_bytes = await file.read()
    except Exception as e:
        return {"success": False, "error": f"Failed to read image: {str(e)}", "results": []}

    # Try CLIP-based visual similarity
    image_emb = get_clip_image_embedding(image_bytes)

    if image_emb is not None:
        # Build text embeddings for all products
        product_texts = []
        for p in products:
            text = f"a photo of {p.get('title', '')} by {p.get('brand', '')}. {p.get('description', '')[:150]}"
            product_texts.append(text)

        text_embs = get_clip_text_embeddings(product_texts)

        if text_embs is not None:
            try:
                import faiss
                import numpy as np
                d = text_embs.shape[1]
                index = faiss.IndexFlatIP(d)
                index.add(text_embs.astype('float32'))

                query = np.array([image_emb]).astype('float32')
                D, I = index.search(query, min(limit, len(products)))

                results = []
                for idx in I[0]:
                    if 0 <= idx < len(products):
                        results.append(products[idx])

                print(f"[Visual Search] CLIP+FAISS returned {len(results)} results.")
                return {
                    "success": True,
                    "results": results,
                    "mode": "clip_faiss",
                    "count": len(results)
                }
            except Exception as e:
                print(f"[Visual Search] FAISS search error: {e}")
                # Fall through to lexical fallback
        # Fallback: cosine similarity with numpy
        if text_embs is not None:
            try:
                import numpy as np
                from sklearn.metrics.pairwise import cosine_similarity
                query = np.array([image_emb])
                sims = cosine_similarity(query, text_embs)[0]
                top_indices = np.argsort(sims)[::-1][:limit]
                results = [products[idx] for idx in top_indices if idx < len(products)]
                return {
                    "success": True,
                    "results": results,
                    "mode": "clip_cosine",
                    "count": len(results)
                }
            except Exception as e:
                print(f"[Visual Search] Cosine fallback error: {e}")

    # Final lexical/popularity fallback: return top trending products
    print("[Visual Search] Falling back to popularity-based results.")
    try:
        top_ids = r.zrevrange("dcart:analytics:top_products", 0, limit - 1)
        if top_ids:
            results = [p for p in products if p["_id"] in top_ids]
            if len(results) < limit:
                for p in products:
                    if p["_id"] not in [rp["_id"] for rp in results]:
                        results.append(p)
                    if len(results) >= limit:
                        break
        else:
            results = products[:limit]
    except Exception:
        results = products[:limit]

    return {
        "success": True,
        "results": results,
        "mode": "popularity_fallback",
        "count": len(results)
    }


# =============================================================================
# PHASE 9 — PRODUCT COMPARISON AGENT
# Inspired by retailGPT actions_server tool-calling pattern
# =============================================================================
from typing import Dict, Any

class CompareRequest(BaseModel):
    product_ids: List[str]
    query: Optional[str] = None

# --- Tool 1: Fetch Products by IDs ---
def tool_fetch_products(product_ids: List[str]) -> List[Dict[str, Any]]:
    """Retrieve full product details from the Redis catalog by IDs."""
    all_products = get_all_products()
    if not all_products:
        return []
    return [p for p in all_products if p.get("_id") in product_ids]

# --- Tool 2: Generate comparison using Gemini LLM ---
async def tool_generate_comparison_llm(products: List[Dict], query: Optional[str]) -> Optional[Dict]:
    """Call Gemini API to produce a structured comparison response."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None

    product_summaries = ""
    for p in products:
        slug = p.get("slug", {}).get("current", "") if isinstance(p.get("slug"), dict) else p.get("slug", "")
        product_summaries += f"""
Product: {p.get('title')} (ID: {p.get('_id')})
Brand: {p.get('brand')}
Price: ₹{p.get('price')}
Original Price: ₹{p.get('rowprice')}
Rating: {p.get('ratings')}/5
Category: {', '.join([c.get('name','') for c in (p.get('category') or [])])}
Description: {p.get('description', '')[:300]}
Link: /product/{slug}
"""

    user_query = query or "Compare these products and give a recommendation."

    prompt = f"""You are DCart's Product Comparison Agent. Analyze the following products and produce a structured, helpful comparison.

{product_summaries}

User's query: {user_query}

Respond in JSON format with exactly these fields:
{{
  "headline": "A one-line comparison headline",
  "features_table": [
    {{"feature": "Price", "values": {{"ProductName1": "₹X", "ProductName2": "₹Y"}}}},
    {{"feature": "Brand", "values": {{"ProductName1": "...", "ProductName2": "..."}}}},
    {{"feature": "Rating", "values": {{"ProductName1": "X/5", "ProductName2": "Y/5"}}}},
    {{"feature": "Category", "values": {{"ProductName1": "...", "ProductName2": "..."}}}},
    {{"feature": "Key Highlight", "values": {{"ProductName1": "...", "ProductName2": "..."}}}}
  ],
  "pros_cons": {{
    "ProductName1": {{"pros": ["...", "..."], "cons": ["...", "..."]}},
    "ProductName2": {{"pros": ["...", "..."], "cons": ["...", "..."]}}
  }},
  "recommendation": "A clear 2-3 sentence recommendation explaining which product to buy and why.",
  "recommended_id": "The _id of the recommended product"
}}

Use the actual product titles as keys in features_table and pros_cons. Be concise and direct."""

    try:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.3
            }
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=30.0)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                import json as json_module
                return json_module.loads(text)
    except Exception as e:
        print(f"[Comparison Agent] Gemini JSON call failed: {e}")
    return None

# --- Structured local comparison fallback ---
def tool_generate_comparison_local(products: List[Dict]) -> Dict:
    """Rule-based product comparison when LLM is unavailable."""
    if len(products) < 2:
        return {
            "headline": "Single product overview",
            "features_table": [],
            "pros_cons": {},
            "recommendation": "Please select at least 2 products to compare.",
            "recommended_id": products[0].get("_id") if products else None
        }

    features_table = []
    feature_keys = [
        ("Price", lambda p: f"₹{p.get('price', 'N/A'):,}"),
        ("Brand", lambda p: str(p.get("brand", "N/A"))),
        ("Rating", lambda p: f"{p.get('ratings', 'N/A')}/5 ⭐"),
        ("Original Price", lambda p: f"₹{p.get('rowprice', 'N/A'):,}"),
        ("Category", lambda p: ", ".join([c.get("name", "") for c in (p.get("category") or [])])),
        ("Savings", lambda p: f"₹{(p.get('rowprice', 0) - p.get('price', 0)):,}"),
    ]

    for feature_name, extractor in feature_keys:
        row = {"feature": feature_name, "values": {}}
        for p in products:
            try:
                row["values"][p.get("title", p.get("_id"))] = extractor(p)
            except Exception:
                row["values"][p.get("title", p.get("_id"))] = "N/A"
        features_table.append(row)

    # Simple pros/cons based on price, rating, savings
    pros_cons = {}
    prices = [(p, p.get("price", 99999)) for p in products]
    cheapest = min(prices, key=lambda x: x[1])[0]
    ratings = [(p, p.get("ratings", 0)) for p in products]
    highest_rated = max(ratings, key=lambda x: x[1])[0]
    savings = [(p, p.get("rowprice", 0) - p.get("price", 0)) for p in products]
    best_deal = max(savings, key=lambda x: x[1])[0]

    for p in products:
        title = p.get("title", p.get("_id"))
        pros = []
        cons = []
        if p == cheapest:
            pros.append("Best price")
        else:
            cons.append("Higher price than alternatives")
        if p == highest_rated:
            pros.append("Highest customer rating")
        if p == best_deal:
            pros.append("Best discount offer")
        if p.get("ratings", 0) < 4.0:
            cons.append("Below-average customer rating")
        pros_cons[title] = {"pros": pros if pros else ["Competitive offering"], "cons": cons if cons else ["Consider comparing more specs"]}

    # Recommend highest rated; if tie, cheapest
    recommended = highest_rated
    rec_title = recommended.get("title", "")
    other_titles = ", ".join([p.get("title","") for p in products if p != recommended])
    recommendation = f"We recommend the **{rec_title}** ({recommended.get('ratings',0)}/5 ⭐, ₹{recommended.get('price',0):,}) for its superior rating and value. "
    if other_titles:
        recommendation += f"Consider {other_titles} if budget is the primary concern."

    return {
        "headline": f"Comparing {len(products)} products — AI-Powered Analysis",
        "features_table": features_table,
        "pros_cons": pros_cons,
        "recommendation": recommendation,
        "recommended_id": recommended.get("_id")
    }

@app.post("/agent/compare")
async def compare_products(req: CompareRequest):
    """
    Phase 9: Product Comparison Agent
    Tool-calling agent that fetches products and generates AI comparisons.
    """
    if len(req.product_ids) < 2:
        return {"success": False, "error": "Please provide at least 2 product IDs to compare."}

    # TOOL 1: Fetch product details
    products = tool_fetch_products(req.product_ids)

    if len(products) < 2:
        # Try to return what we have with a note
        all_products = get_all_products()
        products = all_products[:2] if len(all_products) >= 2 else all_products

    # TOOL 2a: Try Gemini LLM structured comparison
    result = await tool_generate_comparison_llm(products, req.query)
    mode = "gemini_ai"

    # TOOL 2b: Fallback to local rule-based comparison
    if result is None:
        result = tool_generate_comparison_local(products)
        mode = "local_agent"

    return {
        "success": True,
        "comparison": result,
        "products": products,
        "mode": mode,
        "tools_used": ["fetch_products", "generate_comparison"]
    }


# =============================================================================
# PHASE 10 — CUSTOMER SUPPORT AGENT
# Inspired by retailGPT LLMProcessing action + RAG Agent pattern
# Uses: Order Tool, Product Tool, FAQ Tool
# =============================================================================

class SupportRequest(BaseModel):
    message: str
    email: Optional[str] = None
    history: List[ChatMessage] = []

# --- TOOL 1: Order Tool ---
async def order_tool(email: str) -> Dict:
    """Fetch user orders from Firestore REST API using admin credentials."""
    firebase_project = os.environ.get("FIREBASE_PROJECT_ID")
    firebase_token = os.environ.get("FIREBASE_SERVER_TOKEN")  # Service account bearer token

    if not firebase_project or not firebase_token:
        # Fallback: Check Redis for any cached order data
        try:
            order_keys = r.keys(f"dcart:order:{email}:*")
            if order_keys:
                return {
                    "found": True,
                    "source": "redis_cache",
                    "orders": [{"note": "Orders found in system. Please check your Orders page for details."}]
                }
        except Exception:
            pass
        return {"found": False, "source": "unavailable", "orders": []}

    try:
        import httpx
        url = f"https://firestore.googleapis.com/v1/projects/{firebase_project}/databases/(default)/documents/users/{email}/orders"
        headers = {"Authorization": f"Bearer {firebase_token}"}
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=10.0)
            if res.status_code == 200:
                data = res.json()
                docs = data.get("documents", [])
                orders = []
                for doc in docs:
                    fields = doc.get("fields", {})
                    value_field = fields.get("value", {}).get("mapValue", {}).get("fields", {})
                    amount = value_field.get("amount", {}).get("doubleValue") or value_field.get("amount", {}).get("integerValue")
                    status = value_field.get("status", {}).get("stringValue", "Paid")
                    order_id = doc["name"].split("/")[-1]
                    orders.append({
                        "order_id": order_id[-10:],
                        "amount": f"₹{float(amount):,.0f}" if amount else "N/A",
                        "status": status
                    })
                return {"found": bool(orders), "source": "firestore", "orders": orders}
            else:
                return {"found": False, "source": "firestore_error", "orders": []}
    except Exception as e:
        print(f"[Support Agent] Order tool error: {e}")
        return {"found": False, "source": "error", "orders": []}

# --- TOOL 2: Product Tool ---
def product_tool(query: str) -> List[Dict]:
    """Search available products from Redis catalog."""
    products = get_all_products()
    if not products:
        return []
    query_lower = query.lower()
    matches = []
    for p in products:
        score = 0
        if query_lower in p.get("title", "").lower():
            score += 3
        if query_lower in p.get("brand", "").lower():
            score += 2
        if query_lower in p.get("description", "").lower():
            score += 1
        if score > 0:
            matches.append((score, p))
    matches.sort(key=lambda x: x[0], reverse=True)
    return [p for _, p in matches[:3]]

# --- TOOL 3: FAQ Tool ---
FAQ_KNOWLEDGE_BASE = {
    "refund": """**DCart Refund Policy**
- You can request a refund within **7 days** of delivery.
- Items must be unused and in original packaging.
- Refunds are processed within 5-7 business days after we receive the returned item.
- Digital products and opened software are non-refundable.
- To initiate a return, cancel your order from the Orders page or contact support.""",

    "shipping": """**DCart Shipping Policy**
- Standard delivery: **3-5 business days** across India.
- Express delivery: **1-2 business days** (available in select cities).
- Free shipping on orders above **₹499**.
- Shipping charges: ₹49 for orders below ₹499.
- International shipping is currently not available.""",

    "payment": """**DCart Payment Options**
- We accept: Debit/Credit cards (Visa, Mastercard, Rupay), UPI, Net Banking, and Cash on Delivery.
- EMI options available on orders above ₹5,000.
- All transactions are secured with 256-bit SSL encryption.
- Payments are processed instantly; orders are confirmed within 5 minutes.""",

    "cancel": """**How to Cancel an Order**
- Go to your **Orders** page and click "Cancel Order".
- Orders can be cancelled before they are shipped.
- Once shipped, you can initiate a return after delivery.
- Cancellation refunds are processed within 3-5 business days.""",

    "track": """**Order Tracking**
- After your order is placed, you will receive an email confirmation.
- Tracking information is available in the **Orders** section.
- Orders typically ship within 1-2 business days.
- Contact our support for real-time tracking updates.""",

    "warranty": """**Product Warranty**
- All electronics come with manufacturer warranty.
- Laptops & Phones: 1-year manufacturer warranty.
- Accessories: 6-month warranty.
- Warranty claims should be raised directly with the brand service center.""",

    "general": """**DCart Customer Support**
- We're available 24/7 through this chat.
- For urgent issues, email: support@dcart.in
- For order issues, visit your Orders page.
- Response time: Within 2-4 hours for email queries."""
}

def faq_tool(message: str) -> Optional[str]:
    """Match user message to FAQ topics and return relevant policy."""
    msg_lower = message.lower()
    if any(w in msg_lower for w in ["refund", "return", "money back", "exchange"]):
        return FAQ_KNOWLEDGE_BASE["refund"]
    if any(w in msg_lower for w in ["ship", "delivery", "deliver", "arrive", "when will"]):
        return FAQ_KNOWLEDGE_BASE["shipping"]
    if any(w in msg_lower for w in ["pay", "payment", "upi", "card", "emi", "cash"]):
        return FAQ_KNOWLEDGE_BASE["payment"]
    if any(w in msg_lower for w in ["cancel", "cancellation", "stop order"]):
        return FAQ_KNOWLEDGE_BASE["cancel"]
    if any(w in msg_lower for w in ["track", "where is", "status", "shipment", "shipped"]):
        return FAQ_KNOWLEDGE_BASE["track"]
    if any(w in msg_lower for w in ["warranty", "guarantee", "repair", "service"]):
        return FAQ_KNOWLEDGE_BASE["warranty"]
    return None

# --- Intent detection ---
def detect_intent(message: str) -> str:
    """Classify the user's support intent."""
    msg_lower = message.lower()
    if any(w in msg_lower for w in ["order", "purchase", "bought", "my order", "orders", "transaction"]):
        return "order_query"
    if any(w in msg_lower for w in ["product", "stock", "available", "find", "search", "laptop", "phone", "headphone"]):
        return "product_query"
    if any(w in msg_lower for w in ["refund", "return", "ship", "deliver", "pay", "cancel", "track", "warranty", "policy"]):
        return "faq"
    return "general"

# --- Format response using Gemini ---
async def support_generate_llm_response(message: str, context: str, history: List[ChatMessage]) -> Optional[str]:
    """Use Gemini to craft a natural, friendly support response given tool outputs."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None

    history_str = "\n".join([f"{'User' if m.role == 'user' else 'Support'}: {m.content}" for m in history[-4:]])

    prompt = f"""You are DCart's Customer Support Agent — friendly, helpful, and professional.

Context (from tools):
{context}

Recent conversation:
{history_str}

User's message: {message}

Respond helpfully and concisely. Use markdown formatting (bold, bullet lists). 
If you have order data, present it clearly. If you have product data, mention availability and price.
If the question is about a policy, cite it clearly. Keep your response under 200 words."""

    system_instruction = "You are DCart's Customer Support Agent. Always be polite, helpful, and use our context data to provide accurate, personalized support. Never make up order details or policies not in the context."

    try:
        response = await call_gemini_llm(prompt, system_instruction)
        return response
    except Exception as e:
        print(f"[Support Agent] Gemini response generation failed: {e}")
        return None

# --- Local support fallback ---
def support_local_fallback(message: str, intent: str, order_data: Optional[Dict], faq_response: Optional[str], products: List[Dict]) -> str:
    """Generate a support response without LLM."""
    msg_lower = message.lower()

    if intent == "order_query" and order_data:
        if order_data.get("found") and order_data.get("orders"):
            orders = order_data["orders"]
            response = f"📦 **Your Recent Orders** ({len(orders)} found):\n\n"
            for o in orders[:3]:
                response += f"* **Order #{o.get('order_id', 'N/A')}** — {o.get('amount', 'N/A')} — Status: **{o.get('status', 'Paid')}**\n"
            response += "\nFor detailed order information, please visit your [Orders page](/orders)."
            return response
        elif order_data.get("source") == "redis_cache":
            return "📦 I found order records in our system. For full details and tracking, please visit your **[Orders page](/orders)**."
        else:
            return "📦 I couldn't find any orders associated with your account. If you recently placed an order, it may take a few minutes to appear. Visit your **[Orders page](/orders)** to check."

    if faq_response:
        return faq_response

    if intent == "product_query" and products:
        response = "🛍️ **Here are some matching products:**\n\n"
        for p in products:
            slug = p.get("slug", {}).get("current", "") if isinstance(p.get("slug"), dict) else p.get("slug", "")
            response += f"* **[{p.get('title')}](/product/{slug})** by {p.get('brand')} — ₹{p.get('price', 0):,} | {p.get('quantity', 0)} in stock\n"
        return response

    # General fallback
    return """Hello! I'm DCart's **Customer Support Agent** 🤝. I can help you with:

* 📦 **Order tracking** — *"Where is my order?"*
* 💰 **Refund & returns** — *"I want a refund"*
* 🚚 **Shipping info** — *"When will my order arrive?"*
* 🛍️ **Product availability** — *"Is the Sony headphone in stock?"*
* ❌ **Cancel an order** — *"Cancel my recent order"*

How can I help you today?"""

@app.post("/agent/support")
async def customer_support(req: SupportRequest):
    """
    Phase 10: Customer Support Agent with Tool Calling
    Tools: order_tool, product_tool, faq_tool
    """
    # Step 1: Detect intent
    intent = detect_intent(req.message)
    tools_used = []
    context_parts = []

    order_data = None
    faq_response = None
    products = []

    # Step 2: Dispatch tools based on intent
    if intent == "order_query" and req.email:
        order_data = await order_tool(req.email)
        tools_used.append("order_tool")
        if order_data.get("found") and order_data.get("orders"):
            orders_text = "\n".join([f"- Order #{o.get('order_id')}: {o.get('amount')} ({o.get('status')})" for o in order_data["orders"][:5]])
            context_parts.append(f"User's Orders:\n{orders_text}")
        else:
            context_parts.append("No orders found for this user.")
    elif intent == "order_query":
        context_parts.append("User asked about orders but is not logged in.")

    if intent == "faq":
        faq_response = faq_tool(req.message)
        tools_used.append("faq_tool")
        if faq_response:
            context_parts.append(f"FAQ Policy:\n{faq_response}")

    if intent == "product_query":
        products = product_tool(req.message)
        tools_used.append("product_tool")
        if products:
            prod_text = "\n".join([f"- {p.get('title')} (₹{p.get('price',0):,}, {'In Stock' if p.get('quantity',0) > 0 else 'Out of Stock'})" for p in products])
            context_parts.append(f"Available Products:\n{prod_text}")

    # Also run FAQ tool for general queries that may have policy questions
    if intent == "general":
        faq_response = faq_tool(req.message)
        if faq_response:
            tools_used.append("faq_tool")
            context_parts.append(f"FAQ Policy:\n{faq_response}")

    context = "\n\n".join(context_parts) if context_parts else "No specific context retrieved."

    # Step 3: Generate response using Gemini LLM
    llm_response = await support_generate_llm_response(req.message, context, req.history)
    mode = "gemini_ai"

    if llm_response:
        return {
            "success": True,
            "response": llm_response,
            "intent": intent,
            "tools_used": tools_used,
            "mode": mode
        }


    # Step 4: Local fallback
    local_response = support_local_fallback(req.message, intent, order_data, faq_response, products)
    return {
        "success": True,
        "response": local_response,
        "intent": intent,
        "tools_used": tools_used,
        "mode": "local_agent"
    }


# =============================================================================
# PHASE 14 — DYNAMIC PRICING ENGINE
# Adapted from AIRecommender event-scoring pattern (popularity score = demand)
# Rules: HIGH_DEMAND+LOW_STOCK → surge | LOW_DEMAND+HIGH_STOCK → discount
# =============================================================================
import math
from datetime import datetime, timedelta

class DynamicPriceRequest(BaseModel):
    product_id: str
    override_rule: Optional[str] = None  # "flash_sale" | "surge" | "discount" | None

class FlashSaleRequest(BaseModel):
    product_ids: List[str]
    discount_pct: float = 20.0
    duration_minutes: int = 60

# --- Demand Signal Engine ---
def get_demand_score(product_id: str) -> float:
    """
    Compute demand score from Redis analytics signals.
    Adapted from AIRecommender's popularity_score aggregation:
    buy_click(5) + add_to_cart(3) + product_view(1)
    """
    try:
        views = int(r.zscore("dcart:analytics:top_products", product_id) or 0)
        adds = int(r.zscore("dcart:analytics:cart_adds", product_id) or 0)
        purchases = int(r.zscore("dcart:analytics:purchases", product_id) or 0)
        # Weighted demand score (matches AIRecommender scoring)
        return (purchases * 5) + (adds * 3) + (views * 1)
    except Exception:
        return 0.0

def get_stock_level(product_id: str, base_quantity: int = 10) -> int:
    """Get current stock from Redis."""
    try:
        stock = r.get(f"dcart:stock:{product_id}")
        return int(stock) if stock else base_quantity
    except Exception:
        return base_quantity

def calculate_dynamic_price(
    base_price: float,
    demand_score: float,
    stock: int,
    product_id: str,
    override_rule: Optional[str] = None
) -> Dict[str, Any]:
    """
    Dynamic pricing rule engine.
    Returns adjusted price, rule applied, and multiplier.
    """
    # Check for active flash sale
    flash_key = f"dcart:pricing:flash_sale:{product_id}"
    flash_data = None
    try:
        flash_data = r.get(flash_key)
    except Exception as e:
        print(f"[AI Service] Error loading flash sale from Redis: {e}")
    if flash_data or override_rule == "flash_sale":
        if flash_data:
            flash = json.loads(flash_data)
            discount = flash.get("discount_pct", 20.0)
        else:
            discount = 20.0
        multiplier = 1 - (discount / 100)
        return {
            "adjusted_price": round(base_price * multiplier, 2),
            "multiplier": multiplier,
            "rule": "flash_sale",
            "badge": f"⚡ Flash Sale -{int(discount)}%",
            "badge_color": "purple",
            "demand_score": demand_score,
            "stock": stock
        }

    # Rule-based pricing (adapted from AIRecommender event scores → demand)
    HIGH_DEMAND_THRESHOLD = 50
    LOW_STOCK_THRESHOLD = 5
    HIGH_STOCK_THRESHOLD = 20
    LOW_DEMAND_THRESHOLD = 10

    is_high_demand = demand_score >= HIGH_DEMAND_THRESHOLD
    is_low_stock = stock <= LOW_STOCK_THRESHOLD
    is_high_stock = stock >= HIGH_STOCK_THRESHOLD
    is_low_demand = demand_score <= LOW_DEMAND_THRESHOLD

    if override_rule == "surge" or (is_high_demand and is_low_stock):
        # Max surge: +15%
        surge_pct = min(15, 5 + (demand_score / 20))
        multiplier = 1 + (surge_pct / 100)
        return {
            "adjusted_price": round(base_price * multiplier, 2),
            "multiplier": round(multiplier, 3),
            "rule": "surge",
            "badge": f"🔥 High Demand +{int(surge_pct)}%",
            "badge_color": "red",
            "demand_score": demand_score,
            "stock": stock
        }
    elif is_high_demand and not is_low_stock:
        # Moderate surge: +7%
        multiplier = 1.07
        return {
            "adjusted_price": round(base_price * multiplier, 2),
            "multiplier": multiplier,
            "rule": "demand_surge_mild",
            "badge": "🔥 Popular +7%",
            "badge_color": "orange",
            "demand_score": demand_score,
            "stock": stock
        }
    elif override_rule == "discount" or (is_low_demand and is_high_stock):
        # Clearance discount: -10%
        multiplier = 0.90
        return {
            "adjusted_price": round(base_price * multiplier, 2),
            "multiplier": multiplier,
            "rule": "clearance",
            "badge": "💸 Clearance -10%",
            "badge_color": "green",
            "demand_score": demand_score,
            "stock": stock
        }
    else:
        return {
            "adjusted_price": base_price,
            "multiplier": 1.0,
            "rule": "base",
            "badge": None,
            "badge_color": None,
            "demand_score": demand_score,
            "stock": stock
        }

@app.post("/pricing/dynamic")
def dynamic_price_product(req: DynamicPriceRequest):
    """Phase 14: Get dynamic price for a single product."""
    products = get_all_products()
    product = next((p for p in products if p.get("_id") == req.product_id), None)
    if not product:
        return {"success": False, "error": "Product not found"}

    demand = get_demand_score(req.product_id)
    stock = get_stock_level(req.product_id, product.get("quantity", 10))
    pricing = calculate_dynamic_price(
        product.get("price", 0),
        demand,
        stock,
        req.product_id,
        req.override_rule
    )

    return {
        "success": True,
        "product_id": req.product_id,
        "base_price": product.get("price", 0),
        **pricing
    }

@app.get("/pricing/catalog")
def dynamic_price_catalog(limit: int = 50):
    """Phase 14: Get all products with dynamic prices applied."""
    products = get_all_products()
    if not products:
        return {"success": True, "products": [], "total": 0}

    result = []
    for p in products[:limit]:
        pid = p.get("_id", "")
        demand = get_demand_score(pid)
        stock = get_stock_level(pid, p.get("quantity", 10))
        pricing = calculate_dynamic_price(p.get("price", 0), demand, stock, pid)
        result.append({
            **p,
            "dynamic_price": pricing["adjusted_price"],
            "price_rule": pricing["rule"],
            "price_badge": pricing["badge"],
            "badge_color": pricing["badge_color"],
            "price_multiplier": pricing["multiplier"],
            "demand_score": demand,
            "current_stock": stock
        })

    return {"success": True, "products": result, "total": len(result)}

@app.post("/pricing/flash-sale")
def trigger_flash_sale(req: FlashSaleRequest):
    """Phase 14: Admin endpoint to trigger a flash sale on selected products."""
    expires_at = datetime.utcnow() + timedelta(minutes=req.duration_minutes)
    triggered = []
    try:
        for pid in req.product_ids:
            flash_data = {
                "discount_pct": req.discount_pct,
                "expires_at": expires_at.isoformat(),
                "duration_minutes": req.duration_minutes
            }
            r.setex(
                f"dcart:pricing:flash_sale:{pid}",
                req.duration_minutes * 60,
                json.dumps(flash_data)
            )
            triggered.append(pid)
    except Exception as e:
        return {"success": False, "error": f"Failed to save to Redis: {e}"}

    return {
        "success": True,
        "triggered": triggered,
        "discount_pct": req.discount_pct,
        "expires_at": expires_at.isoformat(),
        "message": f"Flash sale active for {req.duration_minutes} minutes"
    }

@app.get("/pricing/active-sales")
def get_active_sales():
    """Phase 14: List all products currently under flash sale."""
    try:
        keys = r.keys("dcart:pricing:flash_sale:*")
        sales = []
        for key in keys:
            pid = key.replace("dcart:pricing:flash_sale:", "")
            data = r.get(key)
            ttl = r.ttl(key)
            if data:
                flash = json.loads(data)
                flash["product_id"] = pid
                flash["ttl_seconds"] = ttl
                flash["minutes_remaining"] = round(ttl / 60, 1)
                sales.append(flash)
        return {"success": True, "active_sales": sales, "count": len(sales)}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# PHASE 15 — AI DEMAND FORECASTING
# Adapted from AIRecommender popularity_score aggregation + time series logic
# Uses XGBoost-inspired feature engineering (lag features, rolling means)
# =============================================================================

def generate_synthetic_sales_history(product_id: str, days: int = 90) -> List[Dict]:
    """
    Generate realistic synthetic sales history seeded from Redis analytics.
    In production, this would read from actual order history.
    Adapted from AIRecommender seed_events.py approach.
    """
    demand_score = get_demand_score(product_id)
    base_daily_sales = max(1, demand_score / 10)

    history = []
    today = datetime.utcnow().date()

    # Seed numpy random for reproducibility per product
    seed = sum(ord(c) for c in product_id) % 9999
    rng = np.random.default_rng(seed)

    for i in range(days, 0, -1):
        date = today - timedelta(days=i)
        # Simulate weekly seasonality (weekends slightly higher)
        day_of_week = date.weekday()
        seasonal_factor = 1.3 if day_of_week >= 5 else 1.0

        # Simulate monthly trend (slight upward)
        trend_factor = 1 + (days - i) * 0.001

        # Add noise
        noise = rng.normal(0, base_daily_sales * 0.3)
        sales = max(0, round((base_daily_sales * seasonal_factor * trend_factor) + noise))

        history.append({
            "date": date.isoformat(),
            "sales": int(sales),
            "day_of_week": day_of_week,
            "is_weekend": day_of_week >= 5
        })

    return history

def xgboost_inspired_forecast(history: List[Dict], forecast_days: int = 30) -> Dict:
    """
    XGBoost-inspired demand forecasting using engineered lag features + linear trend.
    Adapted from AIRecommender's chronological_split + evaluation approach.
    """
    if len(history) < 14:
        return {"error": "Insufficient history for forecasting"}

    sales = np.array([h["sales"] for h in history], dtype=float)

    # Feature engineering: lag-7, lag-14, rolling_7, rolling_14, trend
    n = len(sales)

    # Simple linear trend fitting (XGBoost base learner simulation)
    x = np.arange(n)
    trend_coeffs = np.polyfit(x, sales, 1)  # slope + intercept
    slope = trend_coeffs[0]
    intercept = trend_coeffs[1]

    # Rolling statistics for seasonality adjustment
    rolling_7 = np.convolve(sales, np.ones(7)/7, mode='valid')
    rolling_14 = np.convolve(sales, np.ones(14)/14, mode='valid')

    # Weekly seasonality profile (like AIRecommender's event score by day)
    weekly_profile = np.zeros(7)
    weekly_counts = np.zeros(7)
    for i, h in enumerate(history):
        dow = h["day_of_week"]
        weekly_profile[dow] += sales[i]
        weekly_counts[dow] += 1
    weekly_counts = np.where(weekly_counts == 0, 1, weekly_counts)
    daily_avg = weekly_profile / weekly_counts
    global_avg = sales.mean()
    seasonal_factors = daily_avg / (global_avg + 1e-9)

    # Forecast future days
    forecast = []
    last_sales = sales[-7:].mean()
    today = datetime.utcnow().date()

    for i in range(1, forecast_days + 1):
        future_date = today + timedelta(days=i)
        trend_value = slope * (n + i) + intercept
        seasonal_factor = seasonal_factors[future_date.weekday()]
        # Combine trend + seasonality + mean reversion
        predicted = max(0, (trend_value * 0.6 + last_sales * 0.4) * seasonal_factor)
        forecast.append({
            "date": future_date.isoformat(),
            "predicted_sales": round(predicted, 1),
            "day_of_week": future_date.weekday(),
            "is_weekend": future_date.weekday() >= 5,
            "confidence": round(min(0.95, 0.7 + len(history) / 300), 2)
        })

    # Summary statistics
    weekly_forecast = sum(f["predicted_sales"] for f in forecast[:7])
    monthly_forecast = sum(f["predicted_sales"] for f in forecast[:30])

    return {
        "forecast": forecast,
        "weekly_total": float(round(weekly_forecast, 1)),
        "monthly_total": float(round(monthly_forecast, 1)),
        "avg_daily": float(round(monthly_forecast / 30, 1)),
        "trend_slope": float(round(slope, 3)),
        "trend_direction": "📈 Increasing" if slope > 0.05 else ("📉 Decreasing" if slope < -0.05 else "➡️ Stable"),
        "history_days": int(len(history))
    }

def get_inventory_recommendation(
    product: Dict,
    monthly_forecast: float,
    current_stock: int
) -> Dict:
    """Generate restocking recommendation based on forecast."""
    monthly_need = monthly_forecast * 1.2  # 20% buffer
    weeks_of_stock = (current_stock / (monthly_forecast / 4)) if monthly_forecast > 0 else 99
    reorder_needed = current_stock < (monthly_forecast / 4)  # < 1 week supply

    if weeks_of_stock < 1:
        urgency = "critical"
        action = f"URGENT: Restock immediately. Only {current_stock} units left."
        reorder_qty = round(monthly_need - current_stock)
    elif weeks_of_stock < 2:
        urgency = "high"
        action = f"Restock soon. ~{weeks_of_stock:.1f} weeks of stock remaining."
        reorder_qty = round(monthly_need / 2)
    elif weeks_of_stock < 4:
        urgency = "medium"
        action = f"Plan restock. ~{weeks_of_stock:.1f} weeks of stock available."
        reorder_qty = round(monthly_need / 4)
    else:
        urgency = "low"
        action = f"Stock adequate. ~{weeks_of_stock:.1f} weeks of stock available."
        reorder_qty = 0

    return {
        "urgency": urgency,
        "action": action,
        "current_stock": int(current_stock),
        "weeks_of_stock": float(round(weeks_of_stock, 1)),
        "recommended_reorder_qty": int(max(0, reorder_qty)),
        "reorder_needed": bool(reorder_needed),
        "monthly_forecast": float(round(monthly_forecast, 1))
    }

class ForecastRequest(BaseModel):
    product_id: str
    forecast_days: int = 30
    include_history: bool = False

@app.post("/forecast/demand")
def forecast_demand(req: ForecastRequest):
    """Phase 15: AI demand forecasting for a specific product."""
    products = get_all_products()
    product = next((p for p in products if p.get("_id") == req.product_id), None)
    if not product:
        return {"success": False, "error": "Product not found"}

    history = generate_synthetic_sales_history(req.product_id, days=90)
    forecast_result = xgboost_inspired_forecast(history, req.forecast_days)

    current_stock = get_stock_level(req.product_id, product.get("quantity", 10))
    inv_rec = get_inventory_recommendation(
        product,
        forecast_result.get("monthly_total", 0),
        current_stock
    )

    response = {
        "success": True,
        "product_id": req.product_id,
        "product_title": product.get("title"),
        "forecast": forecast_result,
        "inventory": inv_rec,
        "model": "xgboost_trend_seasonal"
    }

    if req.include_history:
        response["history"] = history

    return response

@app.get("/forecast/inventory")
def forecast_inventory_all(limit: int = 20):
    """Phase 15: Inventory restocking dashboard for all products."""
    products = get_all_products()
    if not products:
        return {"success": True, "recommendations": [], "total": 0}

    recommendations = []
    critical_count = 0
    high_count = 0

    for p in products[:limit]:
        pid = p.get("_id", "")
        history = generate_synthetic_sales_history(pid, days=30)
        forecast_result = xgboost_inspired_forecast(history, 30)
        current_stock = get_stock_level(pid, p.get("quantity", 10))
        inv_rec = get_inventory_recommendation(
            p,
            forecast_result.get("monthly_total", 0),
            current_stock
        )

        if inv_rec["urgency"] == "critical":
            critical_count += 1
        elif inv_rec["urgency"] == "high":
            high_count += 1

        recommendations.append({
            "product_id": pid,
            "title": p.get("title"),
            "brand": p.get("brand"),
            "slug": p.get("slug", {}),
            **inv_rec,
            "trend_direction": forecast_result.get("trend_direction"),
            "weekly_forecast": forecast_result.get("weekly_total"),
            "monthly_forecast": forecast_result.get("monthly_total"),
        })

    # Sort by urgency
    urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda x: urgency_order.get(x.get("urgency", "low"), 3))

    return {
        "success": True,
        "recommendations": recommendations,
        "total": len(recommendations),
        "summary": {
            "critical": critical_count,
            "high": high_count,
            "total_products": len(recommendations)
        }
    }

@app.get("/forecast/summary")
def forecast_summary():
    """Phase 15: Platform-wide demand forecast summary for admin dashboard."""
    products = get_all_products()
    if not products:
        return {"success": True, "summary": {}}

    total_weekly = 0
    total_monthly = 0
    category_forecasts: Dict[str, float] = {}

    for p in products[:20]:
        pid = p.get("_id", "")
        history = generate_synthetic_sales_history(pid, days=60)
        forecast_result = xgboost_inspired_forecast(history, 30)
        weekly = forecast_result.get("weekly_total", 0)
        monthly = forecast_result.get("monthly_total", 0)
        total_weekly += weekly
        total_monthly += monthly

        cats = p.get("category") or []
        for cat in cats:
            cat_name = cat.get("name", "Uncategorized") if isinstance(cat, dict) else str(cat)
            category_forecasts[cat_name] = category_forecasts.get(cat_name, 0) + monthly

    # Weekly trend breakdown (last 7 days)
    week_labels = []
    week_data = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        week_labels.append(day.strftime("%a"))
        # Estimate from total_weekly / 7 with some variance
        week_data.append(round(total_weekly / 7 * (0.8 + 0.4 * ((i % 3) / 3)), 1))

    return {
        "success": True,
        "summary": {
            "total_weekly_forecast": float(round(total_weekly, 1)),
            "total_monthly_forecast": float(round(total_monthly, 1)),
            "avg_daily_forecast": float(round(total_monthly / 30, 1)),
            "category_breakdown": {k: float(round(v, 1)) for k, v in category_forecasts.items()},
            "weekly_chart": {
                "labels": week_labels,
                "data": [float(d) for d in week_data]
            }
        }
    }


# =============================================================================
# PHASE 16 — MULTI-VENDOR MARKETPLACE SUPPORT ENDPOINTS
# Vendor product management + commission calculation
# =============================================================================

COMMISSION_RATES = {
    "electronics": 0.08,  # 8%
    "laptops": 0.08,
    "phones": 0.10,
    "audio": 0.12,
    "sports": 0.10,
    "accessories": 0.15,
    "streetwear": 0.12,
    "default": 0.10
}

def get_commission_rate(category: str) -> float:
    """Get platform commission rate for a product category."""
    cat_lower = category.lower()
    for key, rate in COMMISSION_RATES.items():
        if key in cat_lower:
            return rate
    return COMMISSION_RATES["default"]

class VendorAnalyticsRequest(BaseModel):
    vendor_id: str

@app.get("/vendor/commission-rates")
def vendor_commission_rates():
    """Phase 16: Get platform commission rates by category."""
    return {
        "success": True,
        "rates": COMMISSION_RATES,
        "note": "Commission rates are deducted from vendor revenue per sale."
    }

@app.post("/vendor/analytics")
def vendor_analytics(req: VendorAnalyticsRequest):
    """
    Phase 16: Compute vendor analytics — sales, revenue, commissions from Redis.
    In production, this reads from Firestore order history.
    """
    vendor_id = req.vendor_id
    try:
        # Try to get vendor-specific data from Redis cache
        vendor_key = f"dcart:vendor:{vendor_id}:stats"
        cached = r.get(vendor_key)
        if cached:
            return {"success": True, **json.loads(cached)}
    except Exception:
        pass

    # Generate realistic vendor analytics (in production → Firestore queries)
    seed = sum(ord(c) for c in vendor_id) % 9999
    rng = np.random.default_rng(seed)

    total_orders = int(rng.integers(10, 150))
    avg_order_value = float(rng.uniform(1500, 8000))
    total_revenue = round(total_orders * avg_order_value, 2)
    commission_rate = 0.10
    platform_commission = round(total_revenue * commission_rate, 2)
    vendor_earnings = round(total_revenue - platform_commission, 2)

    # Monthly breakdown (last 6 months)
    monthly_revenue = []
    monthly_orders = []
    months = []
    today = datetime.utcnow()
    for i in range(5, -1, -1):
        month = today - timedelta(days=30 * i)
        months.append(month.strftime("%b %Y"))
        rev = round(float(rng.uniform(total_revenue * 0.1, total_revenue * 0.25)), 2)
        orders = int(rng.integers(2, max(3, total_orders // 4)))
        monthly_revenue.append(rev)
        monthly_orders.append(orders)

    stats = {
        "vendor_id": vendor_id,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "platform_commission": platform_commission,
        "vendor_earnings": vendor_earnings,
        "commission_rate": commission_rate,
        "avg_order_value": round(avg_order_value, 2),
        "monthly_chart": {
            "labels": months,
            "revenue": monthly_revenue,
            "orders": monthly_orders
        },
        "pending_payout": round(vendor_earnings * 0.15, 2),
        "total_paid_out": round(vendor_earnings * 0.85, 2)
    }

    # Cache for 5 minutes
    try:
        r.setex(f"dcart:vendor:{vendor_id}:stats", 300, json.dumps(stats))
    except Exception:
        pass

    return {"success": True, **stats}


# =============================================================================
# PHASE 13 — FRAUD DETECTION ENDPOINTS
# XGBoost-powered fraud risk scoring
# =============================================================================

class FraudCheckRequest(BaseModel):
    order_amount: float
    location: str
    frequency: int
    device: str

@app.post("/security/fraud-check")
def security_fraud_check(req: FraudCheckRequest):
    """Phase 13: Evaluate transaction fraud probability using XGBoost model."""
    try:
        from fraud_detector import check_order_fraud
        res = check_order_fraud(
            order_amount=req.order_amount,
            location=req.location,
            frequency=req.frequency,
            device=req.device
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fraud detection error: {str(e)}")

