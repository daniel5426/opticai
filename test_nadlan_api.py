import requests

base_url = "https://www.nadlan.gov.il/Nadlan.REST/Main"
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.nadlan.gov.il/?view=settlement_rent&id=3563&page=rent"
}

endpoints = [
    f"{base_url}/GetSettlementRent?id=3563",
    f"{base_url}/GetSettlementRent?settlementId=3563",
    f"{base_url}/GetRent?id=3563",
    f"{base_url}/GetSettlementInfo?id=3563",
    "https://www.nadlan.gov.il/Nadlan.REST/Main/GetDataByQuery?query=3563"
]

for url in endpoints:
    try:
        print(f"Testing {url}...")
        resp = requests.get(url, headers=headers, timeout=5)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print("Success! Response preview:")
            print(resp.text[:200])
        else:
            print("Failed.")
    except Exception as e:
        print(f"Error: {e}")
