"""Criterion: Public event landing page data comes from a correctly configured /api/event."""


def test_event_config_matches_bond_party_details(client):
    resp = client.get("/event")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert "Bond" in body["name"] or "BOND" in body["name"]
    assert "Tote Bag Bedazzling" in body["eyebrow"]
    assert "17 September 2026" in body["date_label"]
    assert "5:30 PM" in body["time_label"]
    assert "Sayaji Bagh" in body["venue"]
    assert body["price_amount"] == 359
    assert "359" in body["price_label"]
    assert body["payment_name"] == "Parshva Shah"
    assert body["payment_upi_id"] == "shah.parshva2007@oksbi"
    assert body["payment_qr_url"].startswith("https://")
