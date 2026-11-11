# Lingua FAQ Chatbot

Lingua FAQ Chatbot is a web-based help center for answering common questions about the Lingua translation tool. Visitors can ask questions in a chat interface or browse a searchable FAQ library. The chatbot ranks the help articles with TF-IDF and cosine similarity, then returns the closest answer when its relevance score meets the match threshold.

## Features

- Chat interface with suggested questions and source FAQ attribution.
- Searchable FAQ library with category filters and expandable answers.
- English text preprocessing with NLTK tokenization, stop-word removal, and stemming.
- Scikit-learn TF-IDF vectors and cosine similarity for FAQ matching.
- A relevance threshold and a clear fallback when no FAQ is a good match.
- Local Flask API and responsive desktop-to-mobile web layout.
- Curated FAQs about Lingua's translation, language choices, saved items, privacy, and troubleshooting.

## Requirements

- Python 3.10 or newer
- pip
- A current desktop or mobile browser

## Run locally

From the project directory, create and activate a virtual environment, install the dependencies, then start the web server:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python server.py
```

Open [http://127.0.0.1:4174](http://127.0.0.1:4174) in your browser. The first run does not download NLTK corpora or language models; the tokenizer and stemmer work locally with the installed package.

## How matching works

1. The service loads FAQ questions, answers, categories, and keywords from `faqs.json`.
2. NLTK tokenizes each question, removes common English stop words, and stems remaining words.
3. Scikit-learn builds TF-IDF vectors from the processed FAQ text. Each question and its curated matching keywords are weighted to improve matching when a visitor uses different wording.
4. Each incoming question is processed the same way and compared with FAQ vectors using cosine similarity.
5. The closest answer is returned when its similarity is at least `0.12`; otherwise, the chat explains that it did not find a close match.

This is deterministic FAQ retrieval, not a generative AI system. Answers come only from the curated FAQ set.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check that the service is running and read the FAQ count. |
| `GET` | `/api/faqs` | Load the FAQ content for browsing. |
| `POST` | `/api/ask` | Rank the FAQs for a question. Send JSON such as `{"question":"How do I save a translation?"}`. |

## Project structure

```text
.
├── app.js                 # Chat, navigation, and FAQ browsing interactions
├── faqs.json              # Curated FAQ content and matching keywords
├── index.html             # Accessible help center structure
├── requirements.txt       # Flask, NLTK, and scikit-learn dependencies
├── server.py              # FAQ API and NLP similarity matching
├── styles.css             # Responsive teal and Nunito design system
└── vendor/
    ├── lucide.min.js      # Locally bundled Lucide icons
    └── LUCIDE-LICENSE     # Icon library license
```

## Privacy

Questions sent to the chatbot are processed by the local Flask service and are not forwarded to an external AI provider. The FAQ content is loaded from the local project files. Do not enter sensitive information into a public or shared deployment.

## Credits

Icons are provided by [Lucide](https://lucide.dev/), an open-source icon library. FAQ answers describe the Lingua translation tool and its MyMemory translation service.

