import requests
import json
from datetime import datetime
from typing import Optional, Dict, Any

class NadlanClient:
    """
    A client for fetching real estate statistics from the Israeli Government Nadlan website.
    Source: https://www.nadlan.gov.il/
    
    Data is fetched from CloudFront endpoints identified via reverse engineering.
    """
    
    BASE_URL = "https://d30nq1hiio0r3z.cloudfront.net/api/pages/settlement"

    def __init__(self, settlement_id: int):
        self.settlement_id = settlement_id

    def get_rent_stats(self) -> Dict[str, Any]:
        """Fetches rental statistics."""
        url = f"{self.BASE_URL}/rent/{self.settlement_id}.json"
        return self._fetch_json(url)

    def get_buy_stats(self) -> Dict[str, Any]:
        """Fetches purchase (buy) statistics."""
        url = f"{self.BASE_URL}/buy/{self.settlement_id}.json"
        return self._fetch_json(url)

    def _fetch_json(self, url: str) -> Dict[str, Any]:
        try:
            print(f"Fetching: {url}")
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                # The server might return binary content type but it is JSON
                try:
                    return response.json()
                except json.JSONDecodeError:
                     # Fallback if content-type is wrong but body is valid json
                    return json.loads(response.content)
            else:
                print(f"Error: Received status code {response.status_code}")
                return {}
        except Exception as e:
            print(f"Exception while fetching {url}: {e}")
            return {}

def print_summary(data: Dict[str, Any], data_type: str):
    if not data:
        print(f"No {data_type} data found.")
        return

    name = data.get('settlementName', 'Unknown')
    sid = data.get('settlementID', 'Unknown')
    print(f"\n=== {data_type.upper()} STATISTICS FOR {name} (ID: {sid}) ===")
    
    trends = data.get('trends', {}).get('rooms', [])
    
    for room_stat in trends:
        num_rooms = room_stat.get('numRooms', 'Unknown')
        graph_data = room_stat.get('graphData', [])
        
        # Find latest entry with a valid settlement price
        latest_entry = None
        for entry in graph_data:
            if entry.get('settlementPrice') is not None:
                latest_entry = entry
                break
        
        if latest_entry:
            price = latest_entry['settlementPrice']
            date = f"{latest_entry['month']}/{latest_entry['year']}"
            print(f"- {num_rooms} Rooms: {price:,.0f} ILS ({date})")
        else:
            # Fallback: check if we have data but just not for settlement (only country average)
            if graph_data:
                 print(f"- {num_rooms} Rooms: No specific settlement data available.")
            else:
                 print(f"- {num_rooms} Rooms: No data.")

if __name__ == "__main__":
    # Example: ID 3563 (Tequa)
    client = NadlanClient(3563)
    
    rent_data = client.get_rent_stats()
    print_summary(rent_data, "Rent")
    
    buy_data = client.get_buy_stats()
    print_summary(buy_data, "Buy")
