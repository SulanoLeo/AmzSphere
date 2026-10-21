"""Deterministic listing optimization scoring.

Pure functions with no Amazon, AI, or database dependencies. Rules are plain
data so new rules can be added without touching the scoring logic. The same
module is used on every sync and every product edit.
"""

from __future__ import annotations

OPT_SCORE_MAX = 100
OPT_SCORE_MIN = 0
NEEDS_OPTIMIZATION_THRESHOLD = 70

# Rule penalties
PENALTY_TITLE = 20          # title shorter than 80 chars or missing the main keyword
PENALTY_BULLETS = 15        # fewer than 5 bullets or very short bullets
PENALTY_IMAGES = 15         # fewer than 7 main images
PENALTY_DESCRIPTION = 10    # empty or short description
PENALTY_BACKEND_KEYWORDS = 10  # unused backend search keywords
PENALTY_SUPPRESSED = 30     # suppressed listing or open listing issues

MIN_TITLE_CHARS = 80
MIN_BULLETS = 5
MIN_BULLET_CHARS = 20
MIN_IMAGES = 7
MIN_DESCRIPTION_CHARS = 50


class Rule:
    __slots__ = ("name", "penalty", "message", "condition")

    def __init__(self, name, penalty, message, condition):
        self.name = name
        self.penalty = penalty
        self.message = message
        self.condition = condition


def _has_main_keyword(title, keywords):
    title_lower = title.casefold()
    return any(keyword.casefold() in title_lower for keyword in keywords if keyword)


def title_rule(product):
    title = product.get("title") or product.get("name") or ""
    keywords = product.get("backend_keywords") or []
    too_short = len(title.strip()) < MIN_TITLE_CHARS
    missing_keyword = keywords and not _has_main_keyword(title, keywords)
    if too_short and missing_keyword:
        return True, "Title is shorter than 80 characters and does not contain a backend keyword."
    if too_short:
        return True, "Title is shorter than 80 characters."
    if missing_keyword:
        return True, "Title does not contain any of the backend keywords."
    return False, ""


def bullets_rule(product):
    bullets = product.get("bullets") or []
    if len(bullets) < MIN_BULLETS:
        return True, f"Only {len(bullets)} bullet points; at least {MIN_BULLETS} are recommended."
    short = [b for b in bullets if len(str(b).strip()) < MIN_BULLET_CHARS]
    if short:
        return True, f"{len(short)} bullet points are very short (under {MIN_BULLET_CHARS} characters)."
    return False, ""


def images_rule(product):
    images = product.get("images") or []
    if len(images) < MIN_IMAGES:
        return True, f"Only {len(images)} main images; at least {MIN_IMAGES} are recommended."
    return False, ""


def description_rule(product):
    description = product.get("description") or ""
    if len(description.strip()) < MIN_DESCRIPTION_CHARS:
        return True, f"Description is shorter than {MIN_DESCRIPTION_CHARS} characters."
    return False, ""


def backend_keywords_rule(product):
    keywords = product.get("backend_keywords") or []
    if not keywords:
        return True, "No backend search keywords are configured."
    return False, ""


def suppressed_rule(product):
    if product.get("suppressed"):
        return True, "Listing is suppressed."
    listings = product.get("marketplace_listings") or []
    for listing in listings:
        if str(listing.get("status", "")).casefold() == "suppressed":
            return True, "A marketplace listing is suppressed."
    return False, ""


RULES = [
    Rule("title", PENALTY_TITLE, "", title_rule),
    Rule("bullets", PENALTY_BULLETS, "", bullets_rule),
    Rule("images", PENALTY_IMAGES, "", images_rule),
    Rule("description", PENALTY_DESCRIPTION, "", description_rule),
    Rule("backend_keywords", PENALTY_BACKEND_KEYWORDS, "", backend_keywords_rule),
    Rule("suppressed", PENALTY_SUPPRESSED, "", suppressed_rule),
]


def evaluate_rules(product):
    """Return (score, issues). Score is clamped to 0-100; issues are human readable."""
    score = OPT_SCORE_MAX
    issues = []
    for rule in RULES:
        failed, message = rule.condition(product)
        if failed:
            score -= rule.penalty
            issues.append(message or f"{rule.name.replace('_', ' ')} needs attention.")
    return max(OPT_SCORE_MIN, min(OPT_SCORE_MAX, score)), issues


def status_for_score(score):
    """opt_status implied by the score alone (workflow states override this)."""
    if score < NEEDS_OPTIMIZATION_THRESHOLD:
        return "needs_optimization"
    return "optimized"


def recent_sales_volume(product, window_days=7):
    history = product.get("sales_history") or []
    if history:
        return sum(history[-window_days:])
    return product.get("daily_velocity", 0) * window_days


def impact_rank(product):
    """Optimization impact = (100 - opt_score) x recent sales volume."""
    score = product.get("opt_score", 0)
    volume = recent_sales_volume(product)
    return (100 - score) * volume


def compute_opt_score(product):
    """Convenience: evaluate rules and return (score, issues, status)."""
    score, issues = evaluate_rules(product)
    return score, issues, status_for_score(score)
