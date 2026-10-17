# AmzSphere mock-data upgrade

Copy these into the repo root (same relative paths), then:

    python3 generate_mock_db.py        # optional: regenerates mock_db.json (already included)
    python3 apply_app_patch.py         # patches static/app.js (aborts without writing if anything differs)
    python3 -m unittest discover -s tests -v
    python3 local_server.py

Files: simulator.py, generate_mock_db.py, mock_db.json, tests/test_simulator.py, apply_app_patch.py

Notes
- mock_db.json is overwritten by every server run; run generate_mock_db.py to reset it.
- On Vercel/Supabase the existing amzsphere_state row keeps the OLD data. Delete the row
  (or update its state) so the new mock_db.json is re-seeded.
