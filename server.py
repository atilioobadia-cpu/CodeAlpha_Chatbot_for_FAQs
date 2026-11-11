from __future__ import annotations
import json
import logging
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from nltk.stem.snowball import SnowballStemmer
from nltk.tokenize import RegexpTokenizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = Path(__file__).resolve().parent
FAQ_PATH = BASE_DIR / "faqs.json"
MAX_QUESTION_LENGTH = 240
MIN_MATCH_SCORE = 0.18
TOKENIZER = RegexpTokenizer(r"[A-Za-z]+(?:['’][A-Za-z]+)?|\d+")
STEMMER = SnowballStemmer("english")
STOP_WORDS = set("a an the and or but if then is are was were be been being do does did can could would should will may might have has had to of in on at for from with about into between by as it this that these those i me my we our you your what how why when where which who tell show please help there".split())
TERM_ALIASES = {"big": "maximum", "large": "maximum", "much": "maximum", "size": "maximum", "length": "maximum", "go": "store", "message": "translat", "messages": "translat", "character": "byte", "characters": "byte", "charact": "byte", "messag": "translat"}
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
with FAQ_PATH.open("r", encoding="utf-8-sig") as faq_file:
    FAQS = json.load(faq_file)

def normalize_question(text: str) -> str:
    """Normalize punctuation and case so an exact FAQ question always resolves."""
    return " ".join(TOKENIZER.tokenize(text.casefold()))

EXACT_QUESTION_INDEX = {normalize_question(item["question"]): index for index, item in enumerate(FAQS)}
FAQ_INDEX_BY_ID = {item["id"]: index for index, item in enumerate(FAQS)}

TASK_FAQ_IDS = {
    "1": "translation-task", "one": "translation-task", "first": "translation-task",
    "2": "faq-chatbot-task", "two": "faq-chatbot-task", "second": "faq-chatbot-task",
    "3": "music-task", "three": "music-task", "third": "music-task",
    "4": "object-detection-task", "four": "object-detection-task", "fourth": "object-detection-task",
}

def preprocess(text: str) -> list[str]:
    """Tokenize, normalize, remove stop words, and stem English text with NLTK."""
    cleaned = text.casefold().replace("’", "'")
    return [TERM_ALIASES.get(stem, stem) for token in TOKENIZER.tokenize(cleaned) if token not in STOP_WORDS and len(token) > 1 for stem in [STEMMER.stem(token)]]

def faq_document(item: dict) -> str:
    return " ".join((item["question"], item["question"], item.get("keywords", ""), item.get("keywords", "")))

def focused_question_index(question: str) -> int | None:
    """Resolve short, explicit intents before relying on general similarity."""
    if preprocess(question) == ["codealpha"]:
        return FAQ_INDEX_BY_ID["about-codealpha"]

    terms = normalize_question(question).split()
    task_terms = {term for term in terms if term in TASK_FAQ_IDS}
    if ("task" in terms or "tasks" in terms) and len(task_terms) == 1:
        return FAQ_INDEX_BY_ID[TASK_FAQ_IDS[task_terms.pop()]]

    normalized_terms = set(preprocess(question))
    if "certif" in normalized_terms and normalized_terms.intersection({"verifi", "valid", "authent", "check"}):
        return FAQ_INDEX_BY_ID["verify-certificate"]
    return None

VECTOR_COUNT = len(FAQS)
VECTORIZER = TfidfVectorizer(tokenizer=preprocess, preprocessor=None, token_pattern=None, lowercase=False, ngram_range=(1, 2), sublinear_tf=True)
FAQ_MATRIX = VECTORIZER.fit_transform(faq_document(item) for item in FAQS)

@app.get("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")

@app.get("/styles.css")
def styles():
    return send_from_directory(BASE_DIR, "styles.css")

@app.get("/app.js")
def client_script():
    return send_from_directory(BASE_DIR, "app.js")

@app.get("/vendor/<path:filename>")
def vendor_file(filename: str):
    return send_from_directory(BASE_DIR / "vendor", filename)

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "faq_count": VECTOR_COUNT})

@app.get("/api/faqs")
def list_faqs():
    return jsonify([{key: item[key] for key in ("id", "category", "question", "answer", "keywords")} | {"suggested": item.get("suggested", False)} for item in FAQS])

@app.post("/api/ask")
def ask():
    if not request.is_json:
        return jsonify({"error": "Send a JSON object containing a question."}), 415
    payload = request.get_json(silent=True) or {}
    question = payload.get("question")
    if not isinstance(question, str):
        return jsonify({"error": "Question must be text."}), 400
    question = question.strip()
    if not question:
        return jsonify({"error": "Enter a question to search the help guide."}), 400
    if len(question) > MAX_QUESTION_LENGTH:
        return jsonify({"error": f"Questions must be {MAX_QUESTION_LENGTH} characters or fewer."}), 400
    exact_index = EXACT_QUESTION_INDEX.get(normalize_question(question))
    if exact_index is not None:
        exact = FAQS[exact_index]
        return jsonify({"matched": True, "score": 1.0, "question": exact["question"], "answer": exact["answer"], "category": exact["category"]})
    focused_index = focused_question_index(question)
    if focused_index is not None:
        focused = FAQS[focused_index]
        return jsonify({"matched": True, "score": 0.95, "question": focused["question"], "answer": focused["answer"], "category": focused["category"]})
    if not preprocess(question):
        return jsonify({"matched": False, "score": 0, "message": "Add a few more details to your question."})
    scores = cosine_similarity(VECTORIZER.transform([question]), FAQ_MATRIX).ravel()
    best_index = int(scores.argmax())
    best_score = float(scores[best_index])
    if best_score < MIN_MATCH_SCORE:
        return jsonify({"matched": False, "score": round(best_score, 4)})
    best = FAQS[best_index]
    return jsonify({"matched": True, "score": round(best_score, 4), "question": best["question"], "answer": best["answer"], "category": best["category"]})

@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "That request is too large. Keep your question under 240 characters."}), 413

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=4174, debug=False)





