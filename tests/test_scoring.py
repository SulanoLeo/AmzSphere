import unittest

from scoring import (
    RULES,
    NEEDS_OPTIMIZATION_THRESHOLD,
    evaluate_rules,
    impact_rank,
    status_for_score,
    compute_opt_score,
)


def product(**overrides):
    base = {
        "title": "ArcFold Aluminum Laptop Stand for Desk, Adjustable Portable Computer Riser for Home Office",
        "bullets": [
            "Raise your screen to a comfortable viewing height with a sturdy adjustable laptop riser.",
            "Fold-flat aluminum frame stores easily and travels between home, office, and classroom.",
            "Non-slip contact points keep laptops stable on desks and shared work surfaces.",
            "Adjustable height settings support sitting and standing desk setups.",
            "Cable management cutout keeps cords tidy behind the stand.",
        ],
        "description": "A sturdy adjustable aluminum laptop stand that folds flat for storage and travel.",
        "backend_keywords": ["laptop stand", "adjustable", "riser"],
        "images": ["img1.jpg", "img2.jpg", "img3.jpg", "img4.jpg", "img5.jpg", "img6.jpg", "img7.jpg"],
        "suppressed": False,
        "marketplace_listings": [{"status": "Live & In Sync"}],
        "sales_history": [10] * 30,
        "daily_velocity": 10,
    }
    base.update(overrides)
    return base


class RuleTests(unittest.TestCase):
    def test_perfect_listing_has_no_issues(self):
        score, issues = evaluate_rules(product())
        self.assertEqual(score, 100)
        self.assertEqual(issues, [])

    def test_short_title_penalty(self):
        score, issues = evaluate_rules(product(title="Laptop Stand"))
        self.assertEqual(score, 100 - 20)
        self.assertTrue(any("80 characters" in issue for issue in issues))

    def test_title_missing_backend_keyword_penalty(self):
        score, issues = evaluate_rules(product(title="A Great Aluminum Stand for Desks and Offices" * 2))
        self.assertEqual(score, 100 - 20)
        self.assertTrue(any("keyword" in issue.casefold() for issue in issues))

    def test_few_bullets_penalty(self):
        score, issues = evaluate_rules(product(bullets=["One", "Two", "Three"]))
        self.assertEqual(score, 100 - 15)
        self.assertTrue(any("bullet" in issue.casefold() for issue in issues))

    def test_short_bullets_penalty(self):
        score, issues = evaluate_rules(product(bullets=["a", "b", "c", "d", "e"]))
        self.assertEqual(score, 100 - 15)

    def test_few_images_penalty(self):
        score, issues = evaluate_rules(product(images=["img1.jpg", "img2.jpg"]))
        self.assertEqual(score, 100 - 15)

    def test_short_description_penalty(self):
        score, issues = evaluate_rules(product(description="Too short"))
        self.assertEqual(score, 100 - 10)

    def test_no_backend_keywords_penalty(self):
        score, issues = evaluate_rules(product(backend_keywords=[]))
        self.assertEqual(score, 100 - 10)

    def test_suppressed_penalty(self):
        score, issues = evaluate_rules(product(suppressed=True))
        self.assertEqual(score, 100 - 30)

    def test_suppressed_listing_penalty(self):
        score, issues = evaluate_rules(
            product(marketplace_listings=[{"status": "Suppressed"}, {"status": "Live & In Sync"}])
        )
        self.assertEqual(score, 100 - 30)

    def test_all_penalties_clamp_at_zero(self):
        score, issues = evaluate_rules(
            product(
                title="X",
                bullets=["a"],
                images=[],
                description="",
                backend_keywords=[],
                suppressed=True,
            )
        )
        self.assertEqual(score, 0)
        self.assertEqual(len(issues), len(RULES))


class StatusTests(unittest.TestCase):
    def test_below_threshold_is_needs_optimization(self):
        self.assertEqual(status_for_score(NEEDS_OPTIMIZATION_THRESHOLD - 1), "needs_optimization")
        self.assertEqual(status_for_score(0), "needs_optimization")

    def test_at_or_above_threshold_is_optimized(self):
        self.assertEqual(status_for_score(NEEDS_OPTIMIZATION_THRESHOLD), "optimized")
        self.assertEqual(status_for_score(100), "optimized")

    def test_compute_opt_score_returns_status(self):
        score, issues, status = compute_opt_score(product(title="X", bullets=[], images=[], description="", backend_keywords=[]))
        self.assertEqual(score, 30)
        self.assertEqual(status, "needs_optimization")
        score, issues, status = compute_opt_score(product())
        self.assertEqual(status, "optimized")


class ImpactRankTests(unittest.TestCase):
    def test_impact_uses_score_and_volume(self):
        high = product(opt_score=40, sales_history=[100] * 30)
        low = product(opt_score=80, sales_history=[100] * 30)
        self.assertEqual(impact_rank(high), 60 * 700)
        self.assertEqual(impact_rank(low), 20 * 700)
        self.assertGreater(impact_rank(high), impact_rank(low))

    def test_impact_falls_back_to_daily_velocity(self):
        p = product(opt_score=50, sales_history=None, daily_velocity=10)
        self.assertEqual(impact_rank(p), 50 * 70)


if __name__ == "__main__":
    unittest.main()
