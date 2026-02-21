import requests
import json
from datetime import datetime

def fetch_nadlan_stats(settlement_id: int):
    """
    Fetches rent and purchase statistics for a given settlement from the Nadlan.gov.il API (via CloudFront).
    """
    base_url = "https://d30nq1hiio0r3z.cloudfront.net/api/pages/settlement"
    
    # 1. Fetch Rent Stats
    rent_url = f"{base_url}/rent/{settlement_id}.json"
    print(f"Fetching Rent Stats from: {rent_url}")
    
    try:
        rent_resp = requests.get(rent_url)
        if rent_resp.status_code == 200:
            rent_data = rent_resp.json()
            print_rent_summary(rent_data)
        else:
            print(f"Failed to fetch rent data. Status: {rent_resp.status_code}")
    except Exception as e:
        print(f"Error fetching rent data: {e}")

    # 2. Fetch Buy Stats (Bonus)
    buy_url = f"{base_url}/buy/{settlement_id}.json"
    print(f"\nFetching Buy Stats from: {buy_url}")
    
    try:
        buy_resp = requests.get(buy_url)
        if buy_resp.status_code == 200:
            buy_data = buy_resp.json()
            print_buy_summary(buy_data)
        else:
            print(f"Failed to fetch buy data. Status: {buy_resp.status_code}")
    except Exception as e:
        print(f"Error fetching buy data: {e}")

def print_rent_summary(data):
    settlement_name = data.get('settlementName', 'Unknown')
    print(f"\n--- RENT STATISTICS FOR {settlement_name} (ID: {data.get('settlementID')}) ---")
    
    trends = data.get('trends', {}).get('rooms', [])
    for room_stat in trends:
        num_rooms = room_stat.get('numRooms', 'Unknown')
        
        # Get latest price point
        graph_data = room_stat.get('graphData', [])
        latest_valid_price = None
        latest_date = None
        
        # Sort by date descending to find latest
        # Note: data seems sorted descending by year/month based on previous output
        for point in graph_data:
            price = point.get('settlementPrice')
            if price:
                latest_valid_price = price
                latest_date = f"{point.get('month')}/{point.get('year')}"
                break
        
        if latest_valid_price:
            print(f"{num_rooms} Rooms: {latest_valid_price} ILS (as of {latest_date})")
        else:
            print(f"{num_rooms} Rooms: No recent data")

def print_buy_summary(data):
    # Similar structure often applies, let's just print a summary if possible
    # Assuming similar structure based on API naming
    settlement_name = data.get('settlementName', 'Unknown')
    print(f"\n--- BUY STATISTICS FOR {settlement_name} ---")
    
    trends = data.get('trends', {}).get('rooms', [])
    for room_stat in trends:
        num_rooms = room_stat.get('numRooms', 'Unknown')
        
        graph_data = room_stat.get('graphData', [])
        latest_valid_price = None
        latest_date = None
        
        for point in graph_data:
            price = point.get('settlementPrice')
            if price:
                latest_valid_price = price
                latest_date = f"{point.get('month')}/{point.get('year')}"
                break
        
        if latest_valid_price:
            print(f"{num_rooms} Rooms: {latest_valid_price} ILS (as of {latest_date})")
        else:
            print(f"{num_rooms} Rooms: No recent data")

# Example usage for ID 3563 (Tequa)
if __name__ == "__main__":
    fetch_nadlan_stats(3563)
