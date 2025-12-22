import os
import sys
import unittest


# Allow running this file from repo root without treating "Backend" as a Python package.
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from ai import ai_assistant


class TestAIRoutingRegression(unittest.TestCase):
    def test_last_meaningful_line(self):
        blob = """
You're viewing \"AFFORDABLE+SIMPLE 4 BEDROOM TOWNHOUSE\".
Utilities (planning checklist)
- Water source

how much is this plan
""".strip("\n")
        self.assertEqual(ai_assistant._last_meaningful_line(blob), "how much is this plan")

    def test_price_intent(self):
        self.assertTrue(ai_assistant._is_price_question("how much is this plan"))
        self.assertTrue(ai_assistant._is_price_question("price?"))
        self.assertTrue(ai_assistant._is_price_question("what is the cost of this plan"))
        self.assertFalse(ai_assistant._is_price_question("tell me more"))

    def test_recommendation_intent_does_not_trigger_on_tell_me_more(self):
        self.assertFalse(ai_assistant._is_recommendation_intent("tell me more"))
        self.assertFalse(ai_assistant._is_recommendation_intent("tell me more about this plan"))
        self.assertTrue(ai_assistant._is_recommendation_intent("recommend 3 plans under $500"))

    def test_edge_case_key_does_not_trigger_on_tell_me_more(self):
        # We should not classify a pure 'tell me more' prompt as a generic recommendation edge-case.
        self.assertIsNone(ai_assistant._edge_case_intent_key("tell me more"))
        self.assertIsNone(ai_assistant._edge_case_intent_key("tell me more about this plan"))

    def test_transcript_does_not_misroute_when_using_last_line(self):
        transcript = """
You're viewing \"AFFORDABLE+SIMPLE 4 BEDROOM TOWNHOUSE\".
Recommendations (so I can pick the best matches)
- Budget range
- Bedrooms + floors

 tell me more about this plan please
""".strip("\n")

        routed = ai_assistant._last_meaningful_line(transcript)
        self.assertEqual(routed, "tell me more about this plan please")

        # The last user line is focused-plan intent, not recommendation intent.
        self.assertTrue(ai_assistant._is_focused_plan_question(routed))
        self.assertFalse(ai_assistant._is_recommendation_intent(routed))

    def test_no_plan_id_tell_me_more_should_not_be_recommendations(self):
        # When the frontend fails to send plan_id, we can't summarize a specific plan.
        # Our routing input should still resolve to the user question (not the assistant prompt).
        transcript = """
Ramani AI
House plans assistant

You're viewing “AFFORDABLE+SIMPLE 4 BEDROOM TOWNHOUSE”. Ask me for pros and cons, suitability, what's included, BOQ, or any risks to watch for.
tell me more about this plan
Recommendations (so I can pick the best matches)

- Budget range
- Bedrooms + floors
- Must-have: BOQ included or not
- Any dealbreakers (stairs, parking, plot size)

What budget + bedrooms + floors do you want, and must BOQ be included?
""".strip("\n")

        routed = ai_assistant._last_user_like_line(transcript)
        self.assertEqual(routed, "tell me more about this plan")

    def test_quick_pick_tokens_are_not_recommendation_intent(self):
        # These should be handled as focused-plan quick picks (when focused_plan exists),
        # or should trigger a "can't see plan" guard if plan_id isn't available.
        for t in ["Pros", "Cons", "BOQ", "price", "included"]:
            self.assertFalse(ai_assistant._is_recommendation_intent(t))

    def test_transcript_with_unbulleted_checklist_lines_routes_to_user_question(self):
        transcript = """
You're viewing \"AFFORDABLE+SIMPLE 4 BEDROOM TOWNHOUSE\".
Does this plan include BOQ?
Recommendations (so I can pick the best matches)

Budget range
Bedrooms + floors
Must-have: BOQ included or not
Any dealbreakers (stairs, parking, plot size)

What budget + bedrooms + floors do you want, and must BOQ be included?
""".strip("\n")

        routed = ai_assistant._last_user_like_line(transcript)
        self.assertEqual(routed, "Does this plan include BOQ?")

    def test_message_with_appended_plan_context_snapshot(self):
        msg = """
Does this plan include BOQ?

[Current plan context]
Plan name: AFFORDABLE+SIMPLE 4 BEDROOM TOWNHOUSE
Bedrooms: 4
Floors: 2
Includes BOQ: No
""".strip("\n")

        # Backend should strip anything after the marker before routing.
        stripped = msg.split('[Current plan context]', 1)[0].strip()
        routed = ai_assistant._last_user_like_line(stripped)
        self.assertEqual(routed, "Does this plan include BOQ?")

    def test_transcript_with_unbulleted_utilities_lines_routes_to_user_question(self):
        transcript = """
You're viewing \"AFFORDABLE+SIMPLE 4 BEDROOM TOWNHOUSE\".
Pros
Utilities (planning checklist)

Water source + storage (tank/borehole where needed)
Sewage (public sewer vs septic + soakaway)
Power plan (grid/solar/inverter/generator)
Ventilation/AC strategy

Is your area urban (utilities available) or rural (off-grid likely)?
""".strip("\n")

        routed = ai_assistant._last_user_like_line(transcript)
        self.assertEqual(routed, "Pros")

    def test_transcript_ending_with_assistant_prompt_routes_to_user_line(self):
        transcript = """
You're viewing \"AFFORDABLE+SIMPLE 4 BEDROOM TOWNHOUSE\". Ask me for pros and cons, suitability, what's included, BOQ, or any risks to watch for.
tell me more about this plan
Recommendations (so I can pick the best matches)

- Budget range
- Bedrooms + floors
- Must-have: BOQ included or not
- Any dealbreakers (stairs, parking, plot size)

What budget + bedrooms + floors do you want, and must BOQ be included?
""".strip("\n")

        routed = ai_assistant._last_user_like_line(transcript)
        self.assertEqual(routed, "tell me more about this plan")

        self.assertTrue(ai_assistant._is_focused_plan_question(routed))
        self.assertFalse(ai_assistant._is_recommendation_intent(routed))


if __name__ == '__main__':
    unittest.main()
